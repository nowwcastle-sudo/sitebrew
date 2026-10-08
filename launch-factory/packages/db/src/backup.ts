// 백업·복원 연습·「마지막 백업」 (v0 Task 17, 대장 D100).
// Supabase 일일 백업은 Pro·Team·Enterprise 만 된다(https://supabase.com/docs/guides/platform/backups, 2026-09-30 확인).
// Free 에서는 우리가 직접 뜬다: GitHub Actions(.github/workflows/backup.yml)가 매일 pg_dump → 복원 연습 → gpg 암호화 → 비공개 artifact(보관 14일).
//
// 덤프 형식은 일반 SQL + INSERT(`--inserts`)다. PGlite 의 exec() 는 psql 이 아니라서 `COPY … FROM stdin` 을 읽지 못한다.
// 그래서 복원 연습(PGlite)과 운영 복원(psql)이 같은 파일을 쓸 수 있도록 INSERT 로 뜬다. 느린 복원은 v0 크기에서는 문제가 아니다.
import type { Database } from "./client.ts"

/** 우리가 가진 스키마: 앱 표(public) + drizzle 마이그레이션 기록(drizzle). Supabase 관리 스키마(auth·storage 등)는 쓰지 않으므로 뜨지 않는다 */
export const BACKUP_SCHEMAS = ["public", "drizzle"] as const

/** pg_dump 공통 인자(운영 docker pg_dump 와 시험용 PGlite pg_dump 가 같이 쓴다) */
export const PG_DUMP_FLAGS: readonly string[] = [
  "--format=plain",
  "--inserts",
  "--no-owner",
  "--no-privileges",
  ...BACKUP_SCHEMAS.map((s) => `--schema=${s}`),
]

/** 운영 덤프에 쓰는 pg_dump 이미지. pg_dump 는 자기 주 판보다 새 서버는 뜨지 않는다(PostgreSQL 17 문서) — 17 은 Supabase 15·17 둘 다 뜬다 */
export const PG_DUMP_IMAGE = "postgres:17.11"

/** 이 시간이 넘으면 doctor 가 실패로 본다(매일 1회 + 예약 지연 여유) */
export const BACKUP_MAX_AGE_HOURS = 26
/** GitHub artifact 이름(backup.yml 과 같아야 한다) */
export const BACKUP_ARTIFACT = "db-backup"

// ── 행 수 ───────────────────────────────────────────────────────────────────────

/** 백업 스키마의 모든 표와 행 수. 표마다 count(*) 를 동적으로 돌린다(query_to_xml — 함수를 만들지 않고 한 문장으로) */
export const ROW_COUNTS_SQL = `
select table_schema || '.' || table_name as "table",
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as "rows"
from information_schema.tables
where table_type = 'BASE TABLE' and table_schema in (${BACKUP_SCHEMAS.map((s) => `'${s}'`).join(", ")})
order by 1`

export type RowCounts = Record<string, number>

/** postgres-js 는 배열, PGlite 는 { rows } 로 돌려준다 */
function rowsOf<T>(r: unknown): T[] {
  return (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[]
}

export function toRowCounts(rows: readonly { table: string; rows: number | string | bigint }[]): RowCounts {
  return Object.fromEntries(rows.map((r) => [r.table, Number(r.rows)]))
}

export async function rowCounts(d: Database): Promise<RowCounts> {
  const { sql } = await import("drizzle-orm")
  return toRowCounts(rowsOf<{ table: string; rows: number }>(await d.execute(sql.raw(ROW_COUNTS_SQL))))
}

/** 덤프와 함께 올리는 기록. 덤프 앞·뒤 행 수를 둘 다 적는다 — 덤프 도중 쓰기가 있으면 복원 값이 그 사이에 있어야 한다 */
export interface BackupManifest {
  createdAt: string
  pgDumpImage: string
  flags: readonly string[]
  before: RowCounts
  after: RowCounts
}

// ── 덤프 정리 ───────────────────────────────────────────────────────────────────

/**
 * PGlite exec() 로 넣을 수 있게 psql 메타 명령을 뺀다. pg_dump 17.6 부터 첫 줄 `\restrict <키>`·끝 줄 `\unrestrict <키>` 가 붙는다
 * (PostgreSQL 17 문서 --restrict-key). 그 둘만 빼고, 다른 메타 명령이 있으면 조용히 버리지 않고 던진다.
 */
export function sanitizeDump(dump: string): string {
  const out: string[] = []
  for (const line of dump.split(/\r?\n/)) {
    if (/^\\(un)?restrict\s+[A-Za-z0-9]+\s*$/.test(line)) continue
    if (line.startsWith("\\")) throw new Error(`dump has an unsupported psql meta-command: ${line.slice(0, 40)}`)
    out.push(line)
  }
  return out.join("\n")
}

// ── 복원 연습 ───────────────────────────────────────────────────────────────────

/** 빠지면 엉뚱한 DB·스키마를 뜬 것이다 */
export const CORE_TABLES = ["public.user", "public.subscriptions", "drizzle.__drizzle_migrations"] as const

export interface DrillResult {
  ok: boolean
  problems: string[]
  restored: RowCounts
  tables: number
  rows: number
}

/** 빈 PGlite(메모리)에 덤프를 넣고 행 수를 기록과 대조한다. 운영 DB 에는 닿지 않는다 */
export async function restoreDrill(dump: string, manifest: Pick<BackupManifest, "before" | "after">): Promise<DrillResult> {
  const { PGlite } = await import("@electric-sql/pglite")
  const pg = new PGlite()
  const problems: string[] = []
  let restored: RowCounts = {}
  try {
    try {
      // `--schema=public` 을 주면 pg_dump 가 `CREATE SCHEMA public;` 을 쓴다. 빈 DB 에도 public 이 있으므로 먼저 지운다(운영 복원도 같다 — 보고서 복원 절차).
      await pg.exec("DROP SCHEMA public CASCADE;")
      await pg.exec(sanitizeDump(dump))
    } catch (e) {
      problems.push(`restore failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!problems.length) {
      restored = toRowCounts((await pg.query<{ table: string; rows: number }>(ROW_COUNTS_SQL)).rows)
    }
  } finally {
    await pg.close()
  }
  problems.push(...compareCounts(manifest, restored))
  return { ok: problems.length === 0, problems, restored, tables: Object.keys(restored).length, rows: Object.values(restored).reduce((a, b) => a + b, 0) }
}

/** 기록(앞·뒤)과 복원 결과를 대조한다. 순수 함수 — 시험이 음성 대조에 쓴다 */
export function compareCounts(manifest: Pick<BackupManifest, "before" | "after">, restored: RowCounts): string[] {
  const problems: string[] = []
  if (!Object.keys(restored).length) return ["restored database has no tables"]
  for (const t of CORE_TABLES) if (!(t in restored)) problems.push(`core table missing after restore: ${t}`)
  if ((restored["drizzle.__drizzle_migrations"] ?? 0) < 1) problems.push("no migration rows restored (drizzle.__drizzle_migrations)")
  const tables = new Set([...Object.keys(manifest.before), ...Object.keys(manifest.after)])
  for (const t of tables) {
    if (!(t in restored)) {
      problems.push(`table missing after restore: ${t}`)
      continue
    }
    const a = manifest.before[t] ?? 0
    const b = manifest.after[t] ?? 0
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)]
    const got = restored[t]!
    if (got < lo || got > hi) problems.push(`row count ${t}: restored ${got}, source ${lo === hi ? lo : `${lo}..${hi}`}`)
  }
  for (const t of Object.keys(restored)) if (!tables.has(t)) problems.push(`unexpected table after restore: ${t}`)
  return problems
}

// ── 운영 덤프(docker pg_dump) ────────────────────────────────────────────────────

/**
 * DATABASE_URL → libpq 환경 변수. 비밀번호가 명령줄(ps)에 보이지 않도록 URL 을 인자로 넘기지 않고 환경으로 넘긴다
 * (GitHub 문서 「Using secrets」: 명령줄로 비밀을 넘기지 말 것). sslmode 가 없으면 require.
 */
export function libpqEnv(url: string): Record<string, string> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error("DATABASE_URL is not a valid postgres:// URL")
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new Error("DATABASE_URL must start with postgres:// or postgresql://")
  if (u.port === "6543") throw new Error("DATABASE_URL uses the transaction pooler (6543); pg_dump needs a session connection (session pooler 5432 or direct)")
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    PGSSLMODE: u.searchParams.get("sslmode") ?? "require",
  }
}

/** docker run 인자. 값 없는 `-e NAME` 은 부모 환경에서 값을 가져온다 — 명령줄에 값이 없다 */
export function dockerPgDumpArgs(image: string = PG_DUMP_IMAGE): string[] {
  const names = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"]
  return ["run", "--rm", ...names.flatMap((n) => ["-e", n]), image, "pg_dump", ...PG_DUMP_FLAGS]
}

// ── 「마지막 백업」 (doctor · Task 11) ──────────────────────────────────────────────

export interface BackupStatus {
  ok: boolean
  /** doctor 에 그대로 찍는 한 줄. 비밀값은 없다 */
  line: string
  at?: string
  ageHours?: number
}

interface ArtifactRow {
  name: string
  created_at: string
  expired: boolean
}

/**
 * GitHub REST 「List artifacts for a repository」(`GET /repos/{owner}/{repo}/actions/artifacts?name=`)로 가장 최근 백업 시각을 읽는다.
 * 정렬 순서가 문서에 없어서 받은 것 중 created_at 최댓값을 쓴다. 토큰은 비공개 저장소라 필요하다(actions 읽기). 값은 출력하지 않는다.
 */
export async function lastBackupCheck(opts: {
  repo: string
  token: string | undefined
  now?: Date
  maxAgeHours?: number
  artifactName?: string
  fetchImpl?: typeof fetch
}): Promise<BackupStatus> {
  const { repo, token, now = new Date(), maxAgeHours = BACKUP_MAX_AGE_HOURS, artifactName = BACKUP_ARTIFACT, fetchImpl = fetch } = opts
  if (!token) return { ok: false, line: "마지막 백업: 확인 못 함 — GitHub 토큰(GITHUB_TOKEN 또는 GH_TOKEN)이 없다" }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, line: `마지막 백업: 확인 못 함 — 저장소 이름이 owner/repo 가 아니다(${repo})` }
  let res: Response
  try {
    res = await fetchImpl(`https://api.github.com/repos/${repo}/actions/artifacts?name=${encodeURIComponent(artifactName)}&per_page=100`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" },
    })
  } catch (e) {
    return { ok: false, line: `마지막 백업: 확인 못 함 — GitHub 호출 실패(${e instanceof Error ? e.name : "error"})` }
  }
  if (!res.ok) return { ok: false, line: `마지막 백업: 확인 못 함 — GitHub 응답 ${res.status}` }
  const body = (await res.json()) as { artifacts?: ArtifactRow[] }
  const live = (body.artifacts ?? []).filter((a) => a.name === artifactName && !a.expired)
  if (!live.length) return { ok: false, line: `마지막 백업: 없음 — ${artifactName} artifact 가 없다(backup.yml 이 한 번도 성공하지 않았거나 보관 기간이 지났다)` }
  const at = live.map((a) => a.created_at).sort().at(-1)!
  const ageHours = Math.floor((now.getTime() - Date.parse(at)) / 3_600_000)
  const ok = ageHours <= maxAgeHours
  return { ok, at, ageHours, line: `마지막 백업 ${ageHours}시간 전 (${at})${ok ? "" : ` — ${maxAgeHours}시간 초과, backup.yml 실행 기록을 확인한다`}` }
}
