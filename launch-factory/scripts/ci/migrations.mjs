// 마이그레이션 일치 점검(순수 함수) — scripts/test/migrations.test.mjs(오프라인, CI)와 scripts/db-status.mjs(로컬, DATABASE_URL 있을 때만)가 쓴다.
// 오프라인 규칙(checkMigrationsDir): _journal.json 항목 == SQL 파일, 번호가 0000 부터 빈틈없이 이어지고 항목 순서·idx·파일 접두사가 같다,
//   when(적용 순서의 기준)이 순증가, 각 항목에 스냅샷(meta/NNNN_snapshot.json)이 있다, 목록에 없는 SQL·스냅샷이 없다, SQL 이 비어 있지 않다.
// 적용 상태 비교(compareApplied): drizzle 은 drizzle.__drizzle_migrations(hash, created_at)에 적용 기록을 남긴다 — hash = SQL 파일 내용의 sha256, created_at = journal 의 when.
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const sha256 = (text) => createHash("sha256").update(text).digest("hex")

export function readJournal(dir) {
  return JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8"))
}

/** 폴더 하나의 오프라인 일치 점검. 문제 목록(빈 배열 = 일치) */
export function checkMigrationsDir(dir, { snapshots = true } = {}) {
  const problems = []
  const label = dir
  if (!existsSync(join(dir, "meta", "_journal.json"))) return [`${label}: meta/_journal.json 이 없다`]
  const journal = readJournal(dir)
  const entries = journal.entries ?? []
  const sqlFiles = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  const snaps = existsSync(join(dir, "meta")) ? readdirSync(join(dir, "meta")).filter((f) => /^\d{4}_snapshot\.json$/.test(f)).sort() : []

  entries.forEach((e, i) => {
    const num = String(i).padStart(4, "0")
    if (e.idx !== i) problems.push(`${label}: 항목 ${i} 의 idx 가 ${e.idx} — 0 부터 빈틈없이 이어져야 한다`)
    if (!e.tag?.startsWith(`${num}_`)) problems.push(`${label}: 항목 ${i} 의 tag(${e.tag})가 ${num}_ 로 시작하지 않는다 — 번호가 건너뛰었거나 순서가 바뀌었다`)
    if (!sqlFiles.includes(`${e.tag}.sql`)) problems.push(`${label}: journal 의 ${e.tag} 에 SQL 파일(${e.tag}.sql)이 없다`)
    else if (readFileSync(join(dir, `${e.tag}.sql`), "utf8").trim() === "") problems.push(`${label}: ${e.tag}.sql 이 비어 있다`)
    if (snapshots && !snaps.includes(`${num}_snapshot.json`)) problems.push(`${label}: ${num}_snapshot.json 스냅샷이 없다`)
    if (i > 0 && !(e.when > entries[i - 1].when)) problems.push(`${label}: ${e.tag} 의 when(${e.when})이 앞 항목(${entries[i - 1].when})보다 크지 않다 — drizzle 은 when 순으로 적용 여부를 정한다`)
  })
  const tags = new Set(entries.map((e) => e.tag))
  for (const f of sqlFiles) if (!tags.has(f.replace(/\.sql$/, ""))) problems.push(`${label}: ${f} 가 journal 에 없다 — drizzle-kit generate 로 만들지 않은 파일이다`)
  for (const s of snapshots ? snaps : []) if (!entries[Number(s.slice(0, 4))]) problems.push(`${label}: ${s} 는 journal 항목이 없는 스냅샷이다`)
  if (new Set(entries.map((e) => e.tag)).size !== entries.length) problems.push(`${label}: journal 에 같은 tag 가 두 번 있다`)
  return problems
}

/** 적용 기록(rows: [{hash, created_at}] created_at 순)과 journal 을 비교. status: in-sync | behind | ahead | diverged */
export function compareApplied(dir, rows) {
  const entries = readJournal(dir).entries
  const expected = entries.map((e) => ({ tag: e.tag, when: Number(e.when), hash: sha256(readFileSync(join(dir, `${e.tag}.sql`), "utf8")) }))
  const applied = rows.map((r) => ({ hash: String(r.hash), when: Number(r.created_at) }))
  const lines = []
  const n = Math.min(expected.length, applied.length)
  let diverged = false
  for (let i = 0; i < n; i++) {
    if (expected[i].when !== applied[i].when || expected[i].hash !== applied[i].hash) {
      diverged = true
      lines.push(`#${i} ${expected[i].tag}: 기록과 다르다(${expected[i].when !== applied[i].when ? `when ${applied[i].when} ≠ ${expected[i].when}` : "SQL 내용 해시가 다르다 — 적용 뒤 파일이 바뀌었다"})`)
    }
  }
  if (diverged) return { status: "diverged", applied: applied.length, journal: expected.length, lines }
  if (applied.length < expected.length) return { status: "behind", applied: applied.length, journal: expected.length, lines: expected.slice(applied.length).map((e) => `대기: ${e.tag}`) }
  if (applied.length > expected.length) return { status: "ahead", applied: applied.length, journal: expected.length, lines: [`DB 에 journal 보다 ${applied.length - expected.length}개 더 적용돼 있다 — 더 새 브랜치로 적용했거나 journal 이 되돌려졌다`] }
  return { status: "in-sync", applied: applied.length, journal: expected.length, lines: [] }
}
