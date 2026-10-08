// 백업·복원 연습·「마지막 백업」 (v0 Task 17, 대장 D100).
// 덤프는 PGlite 의 pg_dump(WASM, @electric-sql/pglite-tools)로 뜬다 — 운영은 docker postgres:17.11 의 pg_dump 로 Supabase 를 뜬다(차이는 task-17 보고).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { pgDump } from "@electric-sql/pglite-tools/pg_dump"
import { db } from "../src/index.ts"
import { seed } from "../src/seed.ts"
import {
  PG_DUMP_FLAGS,
  compareCounts,
  dockerPgDumpArgs,
  lastBackupCheck,
  libpqEnv,
  restoreDrill,
  rowCounts,
  sanitizeDump,
} from "../src/backup.ts"

let d
let dump
let manifest

before(async () => {
  d = await db.local()
  await seed(d, { now: new Date("2026-09-30T00:00:00Z") })
  const beforeCounts = await rowCounts(d)
  // pglite-tools 는 --inserts 를 스스로 더한다. 운영과 같은 인자를 넘긴다(같은 스키마·소유자·권한 제외).
  dump = await (await pgDump({ pg: d.$client, args: [...PG_DUMP_FLAGS] })).text()
  manifest = { before: beforeCounts, after: await rowCounts(d) }
})
after(async () => {
  await d.$client.close()
})

test("복원 연습: 시드한 DB 의 덤프를 빈 PGlite 에 넣으면 표·행 수가 기록과 같다", { timeout: 120_000 }, async () => {
  assert.ok(manifest.before["public.user"] === 4 && manifest.before["public.subscriptions"] === 2, JSON.stringify(manifest.before))
  assert.ok(manifest.before["drizzle.__drizzle_migrations"] >= 6)
  assert.match(dump, /INSERT INTO public\."user"/, "INSERT 형식(COPY 아님)")
  assert.doesNotMatch(dump, /FROM stdin/)
  const r = await restoreDrill(dump, manifest)
  assert.deepEqual(r.problems, [])
  assert.equal(r.ok, true)
  assert.deepEqual(r.restored, manifest.after)
  assert.ok(r.tables >= 17, `표 ${r.tables}개`)
})

test("복원 연습 음성 대조: 행 하나 빠진 덤프·잘못된 기록·빈 덤프는 실패한다", { timeout: 120_000 }, async () => {
  const lines = dump.split("\n")
  const i = lines.findIndex((l) => l.startsWith('INSERT INTO public."user"'))
  assert.ok(i >= 0)
  const missingRow = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n")
  const r1 = await restoreDrill(missingRow, manifest)
  assert.equal(r1.ok, false)
  assert.deepEqual(r1.problems, ["row count public.user: restored 3, source 4"])

  const r2 = await restoreDrill(dump, { before: { ...manifest.before, "public.ghost": 1 }, after: manifest.after })
  assert.deepEqual(r2.problems, ["table missing after restore: public.ghost"])

  const r3 = await restoreDrill("", manifest)
  assert.equal(r3.ok, false)
  assert.deepEqual(r3.problems, ["restored database has no tables"])

  const r4 = await restoreDrill(dump + "\nINSERT INTO public.nope VALUES (1);\n", manifest)
  assert.equal(r4.ok, false)
  assert.match(r4.problems[0], /^restore failed:/)
})

test("덤프 도중 쓰기: 복원 값이 앞·뒤 행 수 사이면 통과, 밖이면 실패", () => {
  const base = { "public.user": 4, "public.subscriptions": 2, "drizzle.__drizzle_migrations": 6 }
  const m = { before: base, after: { ...base, "public.user": 6 } }
  assert.deepEqual(compareCounts(m, { ...base, "public.user": 5 }), [])
  assert.deepEqual(compareCounts(m, { ...base, "public.user": 7 }), ["row count public.user: restored 7, source 4..6"])
  assert.deepEqual(compareCounts({ before: base, after: base }, { ...base, "public.extra": 0 }), ["unexpected table after restore: public.extra"])
  const noCore = { "public.other": 1 }
  assert.deepEqual(compareCounts({ before: noCore, after: noCore }, noCore), [
    "core table missing after restore: public.user",
    "core table missing after restore: public.subscriptions",
    "core table missing after restore: drizzle.__drizzle_migrations",
    "no migration rows restored (drizzle.__drizzle_migrations)",
  ])
})

test("psql 메타 명령: pg_dump 17.6+ 의 \\restrict·\\unrestrict 만 빼고, 다른 것은 던진다", async () => {
  const wrapped = `\\restrict AbC123\n${dump}\n\\unrestrict AbC123\n`
  assert.doesNotMatch(sanitizeDump(wrapped), /\\restrict/)
  const r = await restoreDrill(wrapped, manifest)
  assert.deepEqual(r.problems, [])
  assert.throws(() => sanitizeDump("\\connect other\nselect 1;"), /unsupported psql meta-command/)
})

test("운영 덤프 인자: 비밀번호는 환경으로만, 트랜잭션 풀러(6543)는 거부", () => {
  const env = libpqEnv("postgresql://postgres.abcd:p%40ss-not-real@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres")
  assert.deepEqual(env, {
    PGHOST: "aws-0-ap-northeast-2.pooler.supabase.com",
    PGPORT: "5432",
    PGUSER: "postgres.abcd",
    PGPASSWORD: "p@ss-not-real",
    PGDATABASE: "postgres",
    PGSSLMODE: "require",
  })
  const args = dockerPgDumpArgs()
  assert.ok(!args.join(" ").includes("p@ss"), "명령줄에 비밀번호가 없다")
  assert.ok(args.includes("-e") && args.includes("PGPASSWORD"))
  for (const f of PG_DUMP_FLAGS) assert.ok(args.includes(f), f)
  assert.equal(libpqEnv("postgres://u:p@h:5432/db?sslmode=disable").PGSSLMODE, "disable")
  assert.throws(() => libpqEnv("postgresql://u:p@h:6543/postgres"), /transaction pooler/)
  assert.throws(() => libpqEnv("not a url"), /not a valid/)
  assert.throws(() => libpqEnv("mysql://u:p@h/db"), /must start with postgres/)
})

test("「마지막 백업」: 26시간 안이면 통과, 넘거나 없거나 토큰이 없으면 실패", async () => {
  const now = new Date("2026-09-30T12:00:00Z")
  const fake = (artifacts, status = 200) => {
    const calls = []
    const f = async (url, init) => {
      calls.push({ url, auth: init.headers.authorization })
      return new Response(JSON.stringify({ total_count: artifacts.length, artifacts }), { status })
    }
    return { f, calls }
  }
  const art = (created_at, expired = false, name = "db-backup") => ({ name, created_at, expired })

  const fresh = fake([art("2026-09-29T18:00:00Z"), art("2026-09-30T09:00:00Z"), art("2026-09-28T18:00:00Z")])
  const ok = await lastBackupCheck({ repo: "o/r", token: "t", now, fetchImpl: fresh.f })
  assert.deepEqual(ok, { ok: true, at: "2026-09-30T09:00:00Z", ageHours: 3, line: "마지막 백업 3시간 전 (2026-09-30T09:00:00Z)" })
  assert.match(fresh.calls[0].url, /^https:\/\/api\.github\.com\/repos\/o\/r\/actions\/artifacts\?name=db-backup&per_page=100$/)

  const stale = await lastBackupCheck({ repo: "o/r", token: "t", now, fetchImpl: fake([art("2026-09-29T09:00:00Z")]).f })
  assert.equal(stale.ok, false)
  assert.equal(stale.ageHours, 27)
  assert.match(stale.line, /26시간 초과/)

  const onlyExpired = await lastBackupCheck({ repo: "o/r", token: "t", now, fetchImpl: fake([art("2026-09-30T09:00:00Z", true), art("2026-09-30T10:00:00Z", false, "other")]).f })
  assert.equal(onlyExpired.ok, false)
  assert.match(onlyExpired.line, /^마지막 백업: 없음/)

  assert.equal((await lastBackupCheck({ repo: "o/r", token: undefined, now, fetchImpl: fresh.f })).ok, false)
  assert.match((await lastBackupCheck({ repo: "o/r", token: "t", now, fetchImpl: fake([], 404).f })).line, /GitHub 응답 404/)
  assert.equal((await lastBackupCheck({ repo: "bad repo", token: "t", now, fetchImpl: fresh.f })).ok, false)
})
