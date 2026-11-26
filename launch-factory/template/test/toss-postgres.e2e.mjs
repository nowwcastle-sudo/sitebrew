// 선택 시험: 로컬 임시 PostgreSQL에서 앱 Drizzle 어댑터를 검증한다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createServer } from "node:net"
import { randomBytes } from "node:crypto"
import { db } from "@launch-factory/db"
import { tossTestDatabase } from "../lib/launch/toss-test-db.ts"

test("실제 PostgreSQL 드라이버의 바인딩·READ COMMITTED·롤백", { timeout: 120_000 }, async () => {
  const moduleDir = process.env.TOSS_EMBEDDED_POSTGRES_DIR
  if (!moduleDir) throw new Error("TOSS_EMBEDDED_POSTGRES_DIR is required")
  const { default: EmbeddedPostgres } = await import(pathToFileURL(join(moduleDir, "node_modules/embedded-postgres/dist/index.js")).href)
  const root = resolve(".tmp")
  await mkdir(root, { recursive: true })
  const cluster = await mkdtemp(join(root, "toss-app-pg-"))
  const listener = createServer()
  await new Promise((done) => listener.listen(0, "127.0.0.1", done))
  const port = listener.address().port
  await new Promise((done) => listener.close(done))
  const password = randomBytes(24).toString("hex")
  const pg = new EmbeddedPostgres({ databaseDir: cluster, user: "postgres", password, port, persistent: true, postgresFlags: ["-h", "127.0.0.1"], autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} })
  let raw, d, started = false, cleanupFailure = false
  try {
    await pg.initialise(); await pg.start(); started = true
    raw = pg.getPgClient(); await raw.connect()
    await raw.query('CREATE TABLE "user" (id text PRIMARY KEY)')
    await raw.query(await readFile(new URL("../../packages/db/migrations/0020_toss_registration.sql", import.meta.url), "utf8"))
    d = db(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`)
    const adapter = tossTestDatabase(d)
    await adapter.transaction(async (tx) => {
      assert.equal((await tx.query("SHOW transaction_isolation")).rows[0].transaction_isolation, "read committed")
      await tx.query('INSERT INTO "user" (id) VALUES ($1)', ["safe-user"])
    })
    assert.equal((await adapter.query('SELECT id FROM "user" WHERE id=$1', ["safe-user"])).rows.length, 1)
    assert.equal((await adapter.query('SELECT id FROM "user" WHERE id=$1', ["safe-user' OR true --"])).rows.length, 0)
    await assert.rejects(() => adapter.transaction(async (tx) => { await tx.query('INSERT INTO "user" (id) VALUES ($1)', ["rollback-user"]); throw new Error("rollback") }))
    assert.equal((await adapter.query('SELECT id FROM "user" WHERE id=$1', ["rollback-user"])).rows.length, 0)
  } finally {
    if (d) await d.$client.end()
    if (raw) await raw.end()
    if (started) await pg.stop()
    const realRoot = await realpath(root), realCluster = await realpath(cluster)
    if (!realCluster.startsWith(`${realRoot}\\`) && !realCluster.startsWith(`${realRoot}/`)) cleanupFailure = true
    else await rm(realCluster, { recursive: true, force: true })
  }
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
