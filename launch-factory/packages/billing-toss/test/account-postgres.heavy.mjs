import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { randomBytes } from "node:crypto"
import { createServer } from "node:net"
import { closeWithin, stopPostgres } from "./scheduler-pg-teardown.mjs"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { db, MIGRATIONS_DIR, user } from "@launch-factory/db"
import { NO_ANALYTICS_ERASER, requestAccountDeletion, runPurge } from "@launch-factory/account-lifecycle"
import { createTestRegistration, createTestTossBilling, createTestTossClient, createTestTossLedger } from "../src/index.ts"
import { tossTestDatabase } from "../../../template/lib/launch/toss-test-db.ts"
import { blockTossDeletion } from "../../../template/lib/launch/toss-account.ts"

const noBilling = () => ({ subscription: async () => ({ ok: true, data: { status: "none", planId: null } }), cancel: async () => ({ ok: true, data: { status: "canceled", planId: null } }) })
const payment = (body) => ({ mId: "fake-mid", orderId: body.orderId, totalAmount: body.amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `fake_${body.orderId}` })
const customerKey = "toss-test-customer-".padEnd(36, "0")
const signal = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

test("실제 PostgreSQL 두 연결에서 탈퇴와 초회·월 청구의 양쪽 선점 순서", { timeout: 120_000 }, async () => {
  const moduleDir = process.env.TOSS_EMBEDDED_POSTGRES_DIR
  if (!moduleDir) throw new Error("TOSS_EMBEDDED_POSTGRES_DIR is required")
  const { default: EmbeddedPostgres } = await import(pathToFileURL(join(moduleDir, "node_modules/embedded-postgres/dist/index.js")).href)
  const root = resolve(".tmp"); await mkdir(root, { recursive: true }); const cluster = await mkdtemp(join(root, "toss-account-pg-"))
  const socket = createServer(); await new Promise((done) => socket.listen(0, "127.0.0.1", done)); const port = socket.address().port; await new Promise((done) => socket.close(done))
  const password = randomBytes(24).toString("hex")
  const pg = new EmbeddedPostgres({ databaseDir: cluster, user: "postgres", password, port, persistent: true, postgresFlags: ["-h", "127.0.0.1"], autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} })
  let a, b, started = false, cleanupFailure = false
  try {
    await pg.initialise(); await pg.start(); started = true
    const url = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`
    a = db(url); b = db(url)
    await migrate(a, { migrationsFolder: MIGRATIONS_DIR })
    const adapterA = tossTestDatabase(a), adapterB = tossTestDatabase(b)
    const pidA = (await adapterA.query("SELECT pg_backend_pid() AS pid")).rows[0].pid
    const pidB = (await adapterB.query("SELECT pg_backend_pid() AS pid")).rows[0].pid
    assert.notEqual(pidA, pidB)
    await a.insert(user).values({ id: "pg_registration", name: "Example", email: "pg_registration@example.test" })
    const registration = createTestRegistration({ db: adapterB, encryptionKey: Buffer.alloc(32, 7), origin: "https://example.test", plans: [{ id: "monthly", productId: "registration_product", orderName: "test", amount: 4900 }], client: createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: async (_url, init) => { const body = JSON.parse(init.body); return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_key", card: {} }) } }) })
    const registered = await registration.start({ userId: "pg_registration", planId: "monthly" })
    assert.equal(registered.status, "ready")
    const callback = new URL(registered.successUrl); callback.searchParams.set("authKey", "fake_auth"); callback.searchParams.set("customerKey", registered.customerKey)
    assert.equal(await registration.complete({ userId: "pg_registration", requestUrl: callback.toString() }), "registered")
    for (const mode of ["initial", "monthly"]) for (const winner of ["deletion", "charge"]) {
      const id = `${mode}_${winner}`, product = `product_${id}`
      await a.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
      let posts = 0, holdProvider = false
      const providerEntered = signal(), providerRelease = signal()
      const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: async (_url, init) => {
        if (init.method === "GET") return Response.json({}, { status: 404 })
        posts++; const body = JSON.parse(init.body)
        if (holdProvider) { providerEntered.resolve(); await providerRelease.promise }
        return Response.json(payment(body))
      } })
      const base = createTestTossLedger({ db: adapterB, encryptionKey: Buffer.alloc(32, 7), client })
      await base.createSubscription({ id, userId: id, productId: product, planId: "monthly", customerKey, billingKey: "fake_key", orderName: "test", amount: 4900 })
      if (mode === "monthly") {
        assert.equal(await base.chargeInitial(id, id), "paid")
        await adapterA.query("UPDATE toss_ledger_charges SET billing_month=to_char(now() AT TIME ZONE 'UTC' - interval '1 month','YYYY-MM') WHERE subscription_id=$1", [id])
        await adapterA.query("UPDATE toss_ledger_subscriptions SET billing_anchor=now()-interval '1 month',period_start=now()-interval '1 month',period_end=now()-interval '1 second',next_due_at=now()-interval '1 second' WHERE id=$1", [id])
      }
      const before = posts
      const priorDue = mode === "monthly" ? (await adapterA.query("SELECT next_due_at FROM toss_ledger_subscriptions WHERE id=$1", [id])).rows[0].next_due_at : null
      const held = signal(), release = signal(), userLockAttempt = signal()
      const wrapped = { ...adapterB, transaction: (fn) => adapterB.transaction((tx) => fn({ query: async (text, params) => {
        if (text.startsWith('SELECT id FROM "user"')) userLockAttempt.resolve()
        const result = await tx.query(text, params)
        if (winner === "charge" && text.startsWith("INSERT INTO toss_ledger_charges")) { held.resolve(); await release.promise }
        return result
      } })) }
      const runner = createTestTossLedger({ db: wrapped, encryptionKey: Buffer.alloc(32, 7), client })
      const charge = () => mode === "initial" ? runner.chargeInitial(id, id) : runner.runDueBatch(product)
      if (winner === "deletion") {
        const deleting = requestAccountDeletion({ db: a, billingFor: noBilling, graceDays: 0, onDeletionRequested: async (tx, who) => { await blockTossDeletion(tx, who); held.resolve(); await release.promise } }, id)
        await held.promise
        const charging = charge()
        await userLockAttempt.promise
        release.resolve(); assert.equal((await deleting).ok, true)
        const result = await charging
        assert.equal(mode === "initial" ? result : result.paid, mode === "initial" ? "not_claimed" : 0)
        assert.equal(posts, before)
      } else {
        holdProvider = true
        const charging = charge()
        await held.promise
        const billingStarted = signal()
        const deleting = requestAccountDeletion({ db: a, billingFor: () => ({ ...noBilling(), subscription: async () => { billingStarted.resolve(); return { ok: true, data: { status: "none", planId: null } } } }), graceDays: 0, onDeletionRequested: blockTossDeletion }, id)
        await billingStarted.promise
        release.resolve(); await providerEntered.promise
        assert.equal((await deleting).ok, true, "탈퇴 접수는 공급자 호출이 진행 중이어도 커밋한다")
        assert.equal((await adapterA.query("SELECT status FROM toss_ledger_subscriptions WHERE id=$1", [id])).rows[0].status, "cancel_requested")
        assert.equal(await base.chargeInitial(id, id), "not_claimed")
        providerRelease.resolve(); const result = await charging
        assert.equal(mode === "initial" ? result : result.paid, mode === "initial" ? "paid" : 1)
        assert.equal(posts, before + 1)
        const after = (await adapterA.query("SELECT status,period_start,next_due_at FROM toss_ledger_subscriptions WHERE id=$1", [id])).rows[0]
        assert.equal(after.status, "canceled"); assert.equal(after.next_due_at, null)
        if (priorDue) assert.equal(new Date(after.period_start).getTime(), new Date(priorDue).getTime())
      }
    }
    await a.insert(user).values({ id: "pg_port", name: "Example", email: "pg_port@example.test" })
    const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: async (_url, init) => Response.json(payment(JSON.parse(init.body))) })
    const ledger = createTestTossLedger({ db: adapterB, client, encryptionKey: Buffer.alloc(32, 7) })
    const plan = { id: "monthly", name: "시험", interval: "month", price: { amount: 4900, currency: "KRW", vatIncluded: true }, features: [] }
    const billingPort = createTestTossBilling({ db: adapterB, ledger, productId: "pg_product", plan, origin: "https://example.test" }).port("pg_port")
    await ledger.createSubscription({ id: "pg_port_sub", userId: "pg_port", productId: "pg_product", planId: "monthly", customerKey, billingKey: "fake_key", orderName: "test", amount: 4900 })
    assert.equal(await ledger.chargeInitial("pg_port_sub", "pg_port"), "paid")
    assert.equal((await billingPort.subscription()).data.status, "active")
    const canceled = await billingPort.cancel({ when: "period_end", confirmed: true })
    assert.equal(canceled.data.status, "active"); assert.ok(canceled.data.cancelAt)
    assert.equal((await adapterA.query("SELECT next_due_at FROM toss_ledger_subscriptions WHERE id='pg_port_sub'")).rows[0].next_due_at, null)
    // 같은 임시 DB에서 앞선 탈퇴 요청을 이 검사와 분리한다.
    await adapterA.query("UPDATE account_deletions SET status='cancelled' WHERE status IN ('pending','purging')")
    await a.insert(user).values({ id: "pg_purge_race", name: "Example", email: "pg_purge_race@example.test" })
    const now = new Date()
    assert.equal((await requestAccountDeletion({ db: a, billingFor: noBilling, graceDays: 0, now: () => now }, "pg_purge_race")).ok, true)
    const entered = signal(), releasePurge = signal()
    let preparations = 0
    const deps = (connection) => ({ db: connection, billingFor: noBilling, subjectKey: "fake-subject-key-0123456789-0123456789", analytics: NO_ANALYTICS_ERASER, batchSize: 1, now: () => now, preparePurge: async () => { preparations++; entered.resolve(); await releasePurge.promise; return "ready" } })
    let firstError
    const firstPurge = runPurge(deps(a)).catch((error) => { firstError = error; entered.resolve(); return null })
    await entered.promise
    if (firstError) throw firstError
    try {
      const secondPurge = await runPurge(deps(b))
      assert.equal(secondPurge.purged, 0); assert.equal(preparations, 1)
    } finally { releasePurge.resolve() }
    const firstResult = await firstPurge
    if (firstError) throw firstError
    assert.equal(firstResult.purged, 1)
    assert.equal((await adapterA.query("SELECT id FROM \"user\" WHERE id='pg_purge_race'")).rows.length, 0)
  } finally {
    try {
      await closeWithin(Promise.all([a?.$client.end({ timeout: 5 }), b?.$client.end({ timeout: 5 })]), "DB connections")
    } finally { if (started) await stopPostgres(pg) }
    const actual = await realpath(cluster), parent = await realpath(root)
    if (!actual.startsWith(`${parent}\\`) && !actual.startsWith(`${parent}/`)) cleanupFailure = true
    else await rm(actual, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  }
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
