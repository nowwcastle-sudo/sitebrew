// 마이그레이션 일치 시험(오프라인) — journal 항목 == SQL 파일, 번호 연속, 스냅샷 짝, when 순증가.
// 양성 대조: 임시 복사본에 결함을 하나씩 심어 각각 잡히는지 본다. 적용 상태 비교(compareApplied)는 PGlite 에 실제로 적용한 기록으로 시험한다.
import assert from "node:assert/strict"
import { cpSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { db, MIGRATIONS_DIR } from "@launch-factory/db"
import { checkMigrationsDir, compareApplied, readJournal } from "../ci/migrations.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const DIRS = ["packages/db/migrations", "template/db/migrations"].map((d) => join(ROOT, d))
// 템플릿 사본에는 SQL·journal 만 있고 drizzle-kit 스냅샷은 싣지 않는다(기능 번들이 실어 나르는 파일)
const OPTS = [{ snapshots: true }, { snapshots: false }]

test("저장소의 두 마이그레이션 폴더(packages/db · template/db)는 journal 과 일치한다", () => {
  for (const dir of DIRS) {
    assert.ok(readJournal(dir).entries.length >= 13, `${dir}: 항목이 너무 적다 — 읽기가 깨졌다`)
    assert.deepEqual(checkMigrationsDir(dir, OPTS[DIRS.indexOf(dir)]), [])
  }
})

test("템플릿 사본은 원천(packages/db)과 파일이 같다", () => {
  const [src, copy] = DIRS
  const names = (d) => readdirSync(d).filter((f) => f.endsWith(".sql")).sort()
  assert.deepEqual(names(copy), names(src))
  for (const f of names(src)) assert.equal(readFileSync(join(copy, f), "utf8"), readFileSync(join(src, f), "utf8"), f)
  assert.equal(readFileSync(join(copy, "meta", "_journal.json"), "utf8"), readFileSync(join(src, "meta", "_journal.json"), "utf8"))
})

/** 원천 폴더의 임시 복사본에서 결함을 심고 점검 결과를 돌려준다 */
function planted(mutate) {
  const tmp = mkdtempSync(join(tmpdir(), "lf-mig-"))
  try {
    cpSync(DIRS[0], tmp, { recursive: true })
    assert.deepEqual(checkMigrationsDir(tmp), [], "심기 전에는 통과해야 한다(기준)")
    mutate(tmp)
    return checkMigrationsDir(tmp)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
const editJournal = (dir, fn) => {
  const p = join(dir, "meta", "_journal.json")
  const j = JSON.parse(readFileSync(p, "utf8"))
  fn(j.entries)
  writeFileSync(p, JSON.stringify(j, null, 2))
}

test("양성 대조: 결함을 하나씩 심으면 각각 잡힌다", () => {
  // 마지막 마이그레이션이 늘어도 시험이 깨지지 않게 journal 에서 읽는다(병렬 레인이 번호를 먼저 쓰는 일이 잦다)
  const entries = readJournal(DIRS[0]).entries
  const lastTag = entries.at(-1).tag
  const orphan = `${String(entries.length).padStart(4, "0")}_orphan`
  const cases = [
    ["SQL 파일 삭제", (d) => rmSync(join(d, "0012_notice_outbox.sql")), /0012_notice_outbox\.sql\)이 없다/],
    ["journal 에 없는 SQL 추가", (d) => writeFileSync(join(d, `${orphan}.sql`), "select 1;"), new RegExp(`${orphan}\\.sql 가 journal 에 없다`)],
    ["번호 건너뜀(0012 → 0014)", (d) => { renameSync(join(d, "0012_notice_outbox.sql"), join(d, "0014_notice_outbox.sql")); editJournal(d, (e) => (e[12].tag = "0014_notice_outbox")) }, /0012_ 로 시작하지 않는다/],
    ["idx 중복", (d) => editJournal(d, (e) => (e[5].idx = 4)), /idx 가 4/],
    ["스냅샷 삭제", (d) => rmSync(join(d, "meta", "0007_snapshot.json")), /0007_snapshot\.json 스냅샷이 없다/],
    ["when 이 앞 항목보다 작음", (d) => editJournal(d, (e) => (e[9].when = e[8].when - 1)), /0009_admin_plugin 의 when/],
    ["빈 SQL", (d) => writeFileSync(join(d, "0003_consents.sql"), "  \n"), /0003_consents\.sql 이 비어 있다/],
    ["journal 항목 삭제(SQL 은 남음)", (d) => editJournal(d, (e) => e.pop()), new RegExp(`${lastTag}\\.sql 가 journal 에 없다`)],
  ]
  for (const [name, mutate, re] of cases) {
    const found = planted(mutate)
    console.log(`  양성 대조 [${name}]:`, found)
    assert.ok(found.some((m) => re.test(m)), `${name}: 못 잡았다 ${JSON.stringify(found)}`)
  }
})

test("적용 상태 비교: 실제로 PGlite 에 적용한 기록은 journal 과 일치하고, 대기·앞섬·다름을 가른다", async () => {
  const d = await db.local()
  try {
    const { rows } = await d.execute("select hash, created_at from drizzle.__drizzle_migrations order by created_at, id")
    const dir = MIGRATIONS_DIR
    const entries = readJournal(dir).entries
    assert.equal(rows.length, entries.length)
    assert.deepEqual(compareApplied(dir, rows), { status: "in-sync", applied: entries.length, journal: entries.length, lines: [] })
    const behind = compareApplied(dir, rows.slice(0, -2))
    assert.equal(behind.status, "behind")
    assert.deepEqual(behind.lines, entries.slice(-2).map((e) => `대기: ${e.tag}`))
    assert.equal(compareApplied(dir, [...rows, { hash: "x", created_at: 9 }]).status, "ahead")
    const tampered = rows.map((r, i) => (i === 3 ? { ...r, hash: "0".repeat(64) } : r))
    const diverged = compareApplied(dir, tampered)
    assert.equal(diverged.status, "diverged")
    assert.match(diverged.lines[0], /#3 0003_consents: .*해시가 다르다/)
    assert.equal(compareApplied(dir, rows.map((r, i) => (i === 0 ? { ...r, created_at: 1 } : r))).status, "diverged")
  } finally {
    await d.$client.close()
  }
})

test("db:status 는 DATABASE_URL 이 없으면 아무것도 건드리지 않고 종료 2 로 알린다", async () => {
  const { spawnSync } = await import("node:child_process")
  const env = { ...process.env }
  delete env.DATABASE_URL
  const r = spawnSync(process.execPath, ["scripts/db-status.mjs"], { cwd: ROOT, env, encoding: "utf8" })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /DATABASE_URL 이 없다/)
})
