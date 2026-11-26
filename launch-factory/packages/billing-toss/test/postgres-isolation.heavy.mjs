// opt-in: TOSS_EMBEDDED_POSTGRES_DIR는 embedded-postgres가 설치된 로컬 폴더다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { randomBytes } from "node:crypto"
import { createServer } from "node:net"
import { closeWithin, stopPostgres } from "./scheduler-pg-teardown.mjs"
import { createTestTossClient, createTestTossLedger } from "../src/index.ts"

test("PostgreSQL 두 연결, 오래된 REPEATABLE READ 스냅샷도 미확정 두 건을 만들 수 없다", { timeout: 120_000 }, async () => {
  const moduleDir = process.env.TOSS_EMBEDDED_POSTGRES_DIR
  if (!moduleDir) throw new Error("TOSS_EMBEDDED_POSTGRES_DIR is required")
  const { default: EmbeddedPostgres } = await import(pathToFileURL(join(moduleDir, "node_modules/embedded-postgres/dist/index.js")).href)
  const tempRoot = resolve(".tmp")
  await mkdir(tempRoot, { recursive: true })
  const cluster = await mkdtemp(join(tempRoot, "toss-pg-"))
  const check = createServer()
  await new Promise((done) => check.listen(0, "127.0.0.1", done))
  const port = check.address().port
  await new Promise((done) => check.close(done))
  const pg = new EmbeddedPostgres({ databaseDir: cluster, user: "postgres", password: randomBytes(24).toString("hex"), port, persistent: true, postgresFlags: ["-h", "127.0.0.1"], autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} })
  let a, b, started = false, cleanupFailure = false
  try {
    await pg.initialise(); await pg.start(); started = true
    a = pg.getPgClient(); b = pg.getPgClient()
    await Promise.all([a.connect(), b.connect()])
    assert.notEqual(a.processID, b.processID)
    assert.match((await a.query("SHOW server_version")).rows[0].server_version, /^17\./)
    await a.query('CREATE TABLE "user" (id text PRIMARY KEY)')
    await a.query(await readFile(new URL("../../db/migrations/0020_toss_registration.sql", import.meta.url), "utf8"))
    await a.query('INSERT INTO "user" VALUES ($1)', ["u"])
    await a.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,plan_id,order_name,amount,status) VALUES ('s','u','product','customer','plan','name',4900,'enabled')")
    await b.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await b.query("SELECT id FROM toss_ledger_subscriptions WHERE id='s'")
    await a.query("BEGIN")
    await a.query("SELECT id FROM toss_ledger_subscriptions WHERE id='s' FOR UPDATE")
    await a.query("INSERT INTO toss_ledger_charges(order_id,subscription_id,billing_month,amount,status) VALUES ('first','s','2026-11',4900,'in_flight')")
    await a.query("COMMIT")
    await b.query("SELECT id FROM toss_ledger_subscriptions WHERE id='s' FOR UPDATE")
    assert.equal((await b.query("SELECT count(*)::int AS n FROM toss_ledger_charges WHERE subscription_id='s' AND status='in_flight'")).rows[0].n, 0)
    await assert.rejects(() => b.query("INSERT INTO toss_ledger_charges(order_id,subscription_id,billing_month,amount,status) VALUES ('second','s','2026-12',4900,'in_flight')"), (error) => error.code === "23505")
    await b.query("ROLLBACK")
    assert.equal((await a.query("SELECT count(*)::int AS n FROM toss_ledger_charges WHERE subscription_id='s' AND status='in_flight'")).rows[0].n, 1)
    await a.query(await readFile(new URL("../../db/migrations/0022_toss_schedule.sql", import.meta.url), "utf8"))
    await a.query(await readFile(new URL("../../db/migrations/0023_toss_cancel_at.sql", import.meta.url), "utf8"))
    await a.query(await readFile(new URL("../../db/migrations/0024_toss_scheduler_safety.sql", import.meta.url), "utf8"))
    await a.query("CREATE TABLE account_deletions (user_id text, status text)")
    await a.query('INSERT INTO "user" VALUES ($1)', ["scheduler_user"])
    const adapter = (connection) => ({ query: (sql, args) => connection.query(sql, args), transaction: async (fn) => { await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED"); try { const result = await fn({ query: (sql, args) => connection.query(sql, args) }); await connection.query("COMMIT"); return result } catch (error) { await connection.query("ROLLBACK"); throw error } } })
    let calls = 0, release, entered
    const startedCharge = new Promise((resolve) => { entered = resolve })
    const payment = (body) => ({ mId: "fake-mid", orderId: body.orderId, totalAmount: body.amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `payment_${body.orderId}` })
    let block = false
    const fetch = async (_url, init) => {
      if (init.method === "GET") return Response.json({}, { status: 404 })
      calls++; const body = JSON.parse(init.body)
      if (block) { entered(); await new Promise((resolve) => { release = resolve }) }
      return Response.json(payment(body))
    }
    const make = (connection) => createTestTossLedger({ db: adapter(connection), encryptionKey: Buffer.alloc(32, 4), client: createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch }) })
    const first = make(a), second = make(b)
    await first.createSubscription({ id: "scheduler", userId: "scheduler_user", productId: "schedule_product", customerKey: "01234567-89ab-4def-8123-456789abcdef", billingKey: "fake_key", planId: "monthly", orderName: "test", amount: 4900 })
    assert.equal(await first.chargeInitial("scheduler", "scheduler_user"), "paid")
    await a.query("UPDATE toss_ledger_charges SET billing_month=to_char(now() AT TIME ZONE 'UTC' - interval '1 month','YYYY-MM') WHERE subscription_id='scheduler'")
    await a.query("UPDATE toss_ledger_subscriptions SET billing_anchor=now()-interval '1 month',period_start=now()-interval '1 month',period_end=now()-interval '1 second',next_due_at=now()-interval '1 second' WHERE id='scheduler'")
    block = true
    const run = first.runDueBatch("schedule_product")
    await startedCharge
    await second.runDueBatch("schedule_product")
    release(); assert.equal((await run).paid, 1)
    assert.equal(calls, 2, "initial and one renewal")
    assert.equal((await a.query("SELECT count(*)::int n FROM toss_ledger_charges WHERE subscription_id='scheduler' AND status='paid'")).rows[0].n, 2)
  } finally {
    try {
      await closeWithin(Promise.all([a?.end(), b?.end()]), "DB connections")
    } finally { if (started) await stopPostgres(pg) }
    const realRoot = await realpath(tempRoot)
    const realCluster = await realpath(cluster)
    if (!realCluster.startsWith(`${realRoot}\\`) && !realCluster.startsWith(`${realRoot}/`)) cleanupFailure = true
    else await rm(realCluster, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  }
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
