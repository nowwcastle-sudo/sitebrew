import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { readFile, mkdtemp, rm, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createTestTossClient, createTestTossLedger } from "../src/index.ts"

const migration = await readFile(new URL("../../db/migrations/0020_toss_registration.sql", import.meta.url), "utf8")
const scheduleMigration = await readFile(new URL("../../db/migrations/0022_toss_schedule.sql", import.meta.url), "utf8")
const cancelMigration = await readFile(new URL("../../db/migrations/0023_toss_cancel_at.sql", import.meta.url), "utf8")
const customerKey = "01234567-89ab-4def-8123-456789abcdef"
const secret = Buffer.alloc(32, 7)
const subscription = (id) => ({ id, userId: `user_${id}`, customerKey, billingKey: `billing_${id}`, planId: "monthly", orderName: "예시 구독", amount: 4900 })
const adapter = (pg) => ({ query: (sql, params) => pg.query(sql, params), transaction: (run) => pg.transaction((tx) => run({ query: (sql, params) => tx.query(sql, params) })) })
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
const payment = (orderId, amount = 4900) => ({ mId: "test-mid", orderId, totalAmount: amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `payment_${orderId}` })
const setup = (pg, fetch, encryptionKey = secret) => createTestTossLedger({ db: adapter(pg), encryptionKey, client: createTestTossClient({ secretKey: "test_sk_fake", merchantId: "test-mid", fetch }) })
let pg
before(async () => { pg = new PGlite(); await pg.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE account_deletions (user_id text, status text)'); await pg.exec(migration); await pg.exec(scheduleMigration); await pg.exec(cancelMigration); for (const id of ["race", "lost", "crypt", "tamper", "cancel_first", "mismatch", "erase", "erase_lost", "initial", "initial_lost"]) await pg.query('INSERT INTO "user" VALUES ($1)', [`user_${id}`]) })
after(async () => { await pg.close() })

test("소유자만 초회 승인하며 DB 현재 월과 서버 금액을 사용하고 중복을 막는다", async () => {
  let calls = 0
  const ledger = setup(pg, async (_url, init) => { calls++; const body = JSON.parse(init.body); assert.equal(body.amount, 4900); return response(payment(body.orderId)) })
  await ledger.createSubscription(subscription("initial"))
  assert.equal(await ledger.chargeInitial("initial", "user_initial_lost"), "not_claimed")
  const results = await Promise.all([ledger.chargeInitial("initial", "user_initial"), ledger.chargeInitial("initial", "user_initial")])
  assert.deepEqual(results.sort(), ["not_claimed", "paid"])
  assert.equal(calls, 1)
  const row = (await pg.query("SELECT billing_month,to_char(now() AT TIME ZONE 'UTC','YYYY-MM') AS expected FROM toss_ledger_charges WHERE subscription_id='initial'")).rows[0]
  assert.equal(row.billing_month, row.expected)
})

test("초회 응답 유실은 반복 버튼으로 재승인하지 않는다", async () => {
  let calls = 0
  const ledger = setup(pg, async () => { calls++; throw new Error("lost") })
  await ledger.createSubscription(subscription("initial_lost"))
  assert.equal(await ledger.chargeInitial("initial_lost", "user_initial_lost"), "unresolved")
  assert.equal(await ledger.chargeInitial("initial_lost", "user_initial_lost"), "not_claimed")
  assert.equal(calls, 1)
})

test("시험 클라이언트만 허용하고 원장 표는 RLS를 켠다", async () => {
  assert.throws(() => createTestTossLedger({ db: adapter(pg), encryptionKey: secret, client: {} }), /Invalid test ledger configuration/)
  const rows = await pg.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('toss_ledger_subscriptions','toss_ledger_charges') ORDER BY relname")
  assert.equal(rows.rows.length, 2)
  assert.ok(rows.rows.every((row) => row.relrowsecurity))
})

test("월 청구를 원자적으로 한 번만 예약하고 호출 중에는 해지를 보류한다", async () => {
  let resolveFetch
  let entered
  const started = new Promise((resolve) => { entered = resolve })
  let calls = 0
  const ledger = setup(pg, async (_url, init) => {
    calls++
    const body = JSON.parse(init.body)
    entered()
    await new Promise((resolve) => { resolveFetch = resolve })
    return response(payment(body.orderId, body.amount))
  })
  await ledger.createSubscription(subscription("race"))
  const first = ledger.chargeMonth("race", "2026-11")
  await started
  assert.equal(await ledger.chargeMonth("race", "2026-11"), "not_claimed")
  assert.equal(await ledger.chargeMonth("race", "2026-12"), "not_claimed")
  assert.equal(await ledger.cancel("race"), "cancel_requested")
  resolveFetch()
  assert.equal(await first, "paid")
  assert.equal(calls, 1)
  assert.equal(await ledger.chargeMonth("race", "2026-11"), "not_claimed")
  assert.equal(await ledger.cancel("race"), "canceled")
  assert.equal(await ledger.chargeMonth("race", "2026-12"), "not_claimed")
  const rows = await pg.query("SELECT billing_month,status,amount FROM toss_ledger_charges WHERE subscription_id=$1", ["race"])
  assert.deepEqual(rows.rows, [{ billing_month: "2026-11", status: "paid", amount: 4900 }])
})

test("응답 유실 뒤 재시작·반복 실행은 재승인하지 않고 같은 주문번호만 조회한다", async () => {
  let order
  let charges = 0
  let lookups = 0
  const fetch = async (url, init) => {
    if (init.method === "POST") { charges++; order = JSON.parse(init.body).orderId; throw new Error("connection lost") }
    lookups++
    assert.equal(url, `https://api.tosspayments.com/v1/payments/orders/${order}`)
    return lookups === 1 ? response({ code: "NOT_FOUND" }, 404) : response(payment(order))
  }
  let ledger = setup(pg, fetch)
  await ledger.createSubscription(subscription("lost"))
  assert.equal(await ledger.chargeMonth("lost", "2026-11"), "unresolved")
  ledger = setup(pg, fetch)
  assert.equal(await ledger.chargeMonth("lost", "2026-11"), "not_claimed")
  assert.equal(await ledger.reconcileMonth("lost", "2026-11"), "unresolved")
  assert.equal(await ledger.cancel("lost"), "cancel_requested")
  assert.equal(await ledger.chargeMonth("lost", "2026-12"), "not_claimed")
  assert.equal(await ledger.reconcileMonth("lost", "2026-11"), "paid")
  assert.equal(await ledger.reconcileMonth("lost", "2026-11"), "paid")
  assert.equal(charges, 1)
  assert.equal(lookups, 2)
  assert.equal(await ledger.cancel("lost"), "canceled")
})

test("암호문만 저장하고 키가 틀리거나 변조되면 공급자를 부르지 않는다", async () => {
  let calls = 0
  const ledger = setup(pg, async () => { calls++; return response({}) })
  await ledger.createSubscription(subscription("crypt"))
  const { rows } = await pg.query("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1", ["crypt"])
  assert.ok(!rows[0].encrypted_billing_key.includes("billing_crypt"))
  const wrongKey = setup(pg, async () => { calls++; return response({}) }, Buffer.alloc(32, 9))
  await assert.rejects(() => wrongKey.chargeMonth("crypt", "2026-11"), /storage failure/)
  assert.equal(calls, 0)
  assert.equal(await ledger.deleteCredential("crypt"), "not_available")
  assert.equal(await ledger.cancel("crypt"), "canceled")
  await ledger.createSubscription(subscription("tamper"))
  await pg.query("UPDATE toss_ledger_subscriptions SET encrypted_billing_key=$1 WHERE id=$2", [rows[0].encrypted_billing_key, "tamper"])
  await assert.rejects(() => ledger.chargeMonth("tamper", "2026-11"), /storage failure/)
  assert.equal(calls, 0)
})

test("해지가 먼저 확정되면 동시 청구는 공급자를 부르지 않는다", async () => {
  let calls = 0
  const ledger = setup(pg, async () => { calls++; return response({}) })
  await ledger.createSubscription(subscription("cancel_first"))
  const [canceled, charged] = await Promise.all([ledger.cancel("cancel_first"), ledger.chargeMonth("cancel_first", "2026-11")])
  assert.equal(canceled, "canceled")
  assert.equal(charged, "not_claimed")
  assert.equal(calls, 0)
})

test("변조된 결제 응답은 확정하지 않고 같은 주문번호를 유지한다", async () => {
  let order
  const ledger = setup(pg, async (_url, init) => {
    if (init.method === "POST") { order = JSON.parse(init.body).orderId; return response(payment(order, 1)) }
    return response(payment(order))
  })
  await ledger.createSubscription(subscription("mismatch"))
  assert.equal(await ledger.chargeMonth("mismatch", "2026-11"), "unresolved")
  assert.equal(await ledger.reconcileMonth("mismatch", "2026-11"), "paid")
  assert.equal((await pg.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1", ["mismatch"])).rows[0].order_id, order)
})

test("해지 뒤 공급자 삭제를 확인해야 암호문을 지우며 삭제 후 청구할 수 없다", async () => {
  let calls = 0
  const ledger = setup(pg, async (_url, init) => { assert.equal(init.method, "DELETE"); calls++; return response({}) })
  await ledger.createSubscription(subscription("erase"))
  assert.equal(await ledger.deleteCredential("erase"), "not_available")
  assert.equal(await ledger.cancel("erase"), "canceled")
  assert.equal(await ledger.deleteCredential("erase"), "deleted")
  assert.equal(await ledger.deleteCredential("erase"), "not_available")
  assert.equal((await pg.query("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1", ["erase"])).rows[0].encrypted_billing_key, null)
  assert.equal(await ledger.chargeMonth("erase", "2026-11"), "not_claimed")
  assert.equal(calls, 1)
})

test("삭제 응답 유실 시 로컬 암호문을 보존한다", async () => {
  const ledger = setup(pg, async () => { throw new Error("lost") })
  await ledger.createSubscription(subscription("erase_lost"))
  assert.equal(await ledger.cancel("erase_lost"), "canceled")
  assert.equal(await ledger.deleteCredential("erase_lost"), "unresolved")
  assert.ok((await pg.query("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1", ["erase_lost"])).rows[0].encrypted_billing_key)
})

test("파일 DB를 닫고 다시 열어도 불명 청구와 주문번호가 보존된다", async () => {
  const base = join(process.cwd(), ".tmp")
  await mkdir(base, { recursive: true })
  const dir = await mkdtemp(join(base, "toss-ledger-"))
  let disk
  let order
  let charges = 0
  const fetch = async (_url, init) => {
    if (init.method === "POST") { charges++; order = JSON.parse(init.body).orderId; throw new Error("lost") }
    return response(payment(order))
  }
  try {
    disk = new PGlite(dir)
    await disk.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE account_deletions (user_id text, status text)')
    await disk.exec(migration)
    await disk.exec(scheduleMigration)
    await disk.exec(cancelMigration)
    await disk.query('INSERT INTO "user" VALUES ($1)', ["user_restart"])
    let ledger = setup(disk, fetch)
    await ledger.createSubscription(subscription("restart"))
    assert.equal(await ledger.chargeMonth("restart", "2026-11"), "unresolved")
    await disk.close()
    disk = new PGlite(dir)
    ledger = setup(disk, fetch)
    assert.equal(await ledger.chargeMonth("restart", "2026-11"), "not_claimed")
    assert.equal(await ledger.reconcileMonth("restart", "2026-11"), "paid")
    assert.equal(charges, 1)
  } finally {
    if (disk) await disk.close()
    await rm(dir, { recursive: true, force: true })
  }
})
