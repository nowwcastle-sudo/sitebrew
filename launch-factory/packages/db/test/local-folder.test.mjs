// db.local({ migrationsFolder }) — 번들된 앱(Next)이 자기 db/migrations 를 준다(v0 Task 9 설치 시험에서 나온 요구).
// 기본값(패키지 migrations/)은 db.test.mjs 가 이미 덮는다. 여기서는 폴더를 바꿔도 같은 표가 생기고, 없는 폴더는 조용히 넘어가지 않는다는 것을 본다.
import assert from "node:assert/strict"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { db, MIGRATIONS_DIR } from "../src/index.ts"

const tables = async (d) => (await d.$client.query("select table_name from information_schema.tables where table_schema = 'public'")).rows.map((r) => r.table_name)

test("migrationsFolder 로 준 폴더의 마이그레이션이 적용된다(기본 폴더와 같은 표)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-db-folder-"))
  try {
    cpSync(MIGRATIONS_DIR, dir, { recursive: true })
    const a = await db.local({ migrationsFolder: dir })
    const b = await db.local()
    try {
      const [ta, tb] = [await tables(a), await tables(b)]
      assert.ok(ta.includes("subscriptions") && ta.includes("user"))
      assert.deepEqual([...ta].sort(), [...tb].sort())
    } finally {
      await a.$client.close()
      await b.$client.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("없는 마이그레이션 폴더는 던진다(빈 DB 로 조용히 열리지 않는다)", async () => {
  await assert.rejects(() => db.local({ migrationsFolder: join(tmpdir(), "lf-no-such-migrations-folder") }))
})
