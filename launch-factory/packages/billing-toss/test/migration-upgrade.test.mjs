import { test } from "node:test"
import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { migrate } from "drizzle-orm/pglite/migrator"
import { sql } from "drizzle-orm"
import { db, MIGRATIONS_DIR } from "@launch-factory/db"

test("기존 0019 앱 DB에서 토스 마이그레이션으로 업그레이드하고 재적용한다", async () => {
  const root = resolve(".tmp")
  await mkdir(root, { recursive: true })
  const dir = await mkdtemp(join(root, "toss-upgrade-"))
  const journal = JSON.parse(await readFile(join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"))
  const previous = journal.entries.filter((entry) => entry.idx <= 19)
  await mkdir(join(dir, "meta"))
  await writeFile(join(dir, "meta/_journal.json"), JSON.stringify({ ...journal, entries: previous }))
  for (const entry of previous) await cp(join(MIGRATIONS_DIR, `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`))
  let d, cleanupFailure = false
  try {
    d = await db.local({ migrationsFolder: dir })
    await d.execute(sql`insert into "user" (id, name, email) values ('upgrade-user', 'Example', 'example@example.test')`)
    await migrate(d, { migrationsFolder: MIGRATIONS_DIR })
    const tables = await d.execute(sql`select table_name from information_schema.tables where table_schema='public' and table_name like 'toss_%'`)
    assert.equal(tables.rows.length, 4)
    assert.equal((await d.execute(sql`select count(*)::int as n from "user" where id='upgrade-user'`)).rows[0].n, 1)
    const count = (await d.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0].n
    assert.equal(count, journal.entries.length)
    await migrate(d, { migrationsFolder: MIGRATIONS_DIR })
    assert.equal((await d.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0].n, count)
  } finally {
    if (d) await d.$client.close()
    const realRoot = await realpath(root), realDir = await realpath(dir)
    if (!realDir.startsWith(`${realRoot}\\`) && !realDir.startsWith(`${realRoot}/`)) cleanupFailure = true
    else await rm(realDir, { recursive: true, force: true })
  }
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
