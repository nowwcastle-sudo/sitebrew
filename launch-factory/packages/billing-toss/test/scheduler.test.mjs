import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { createTestTossClient, createTestTossLedger, handleTestTossCron } from "../src/index.ts"
import { nextMonthlyBoundary } from "../src/ledger.ts"
import { cronAuthorized } from "../../../template/lib/launch/cron.ts"

const pg = new PGlite()
const db = { query: (sql, args) => pg.query(sql, args), transaction: (fn) => pg.transaction((tx) => fn({ query: (sql, args) => tx.query(sql, args) })) }
const secret = Buffer.alloc(32, 4)
const customerKey = "01234567-89ab-4def-8123-456789abcdef"
const payment = (orderId, amount) => ({ mId: "fake-mid", orderId, totalAmount: amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `pay_${orderId}` })
const json = (body, status = 200) => Response.json(body, { status })
const ledger = (transport) => createTestTossLedger({ db, encryptionKey: secret, client: createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: transport }) })
const initialTransport = async (_url, init) => { const body = JSON.parse(init.body); return json(payment(body.orderId, body.amount)) }

before(async () => {
  await pg.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE account_deletions (user_id text, status text)')
  await pg.exec(await readFile(new URL("../../db/migrations/0020_toss_registration.sql", import.meta.url), "utf8"))
  await pg.exec(await readFile(new URL("../../db/migrations/0022_toss_schedule.sql", import.meta.url), "utf8"))
  await pg.exec(await readFile(new URL("../../db/migrations/0023_toss_cancel_at.sql", import.meta.url), "utf8"))
  await pg.exec(await readFile(new URL("../../db/migrations/0024_toss_scheduler_safety.sql", import.meta.url), "utf8"))
})
after(async () => pg.close())

async function make(id, paid = true) {
  await pg.query('INSERT INTO "user" (id) VALUES ($1)', [`user_${id}`])
  const first = ledger(initialTransport)
  await first.createSubscription({ id, userId: `user_${id}`, productId: `product_${id}`, planId: "monthly", customerKey, billingKey: `key_${id}`, amount: 4900, orderName: "시험" })
  if (paid) assert.equal(await first.chargeInitial(id, `user_${id}`), "paid")
  return first
}
async function due(id) {
  await pg.query("UPDATE toss_ledger_charges SET billing_month=to_char(now() AT TIME ZONE 'UTC' - interval '1 month','YYYY-MM') WHERE subscription_id=$1 AND status='paid'", [id])
  await pg.query("UPDATE toss_ledger_subscriptions SET billing_anchor=now()-interval '1 month',period_start=now()-interval '1 month',period_end=now()-interval '1 second',next_due_at=now()-interval '1 second' WHERE id=$1", [id])
}

test("UTC 월말과 윤년은 원래 기준일로 돌아간다", () => {
  const anchor = new Date("2024-01-31T15:30:00Z")
  const feb = nextMonthlyBoundary(anchor, anchor)
  assert.equal(feb.toISOString(), "2024-02-29T15:30:00.000Z")
  assert.equal(nextMonthlyBoundary(anchor, feb).toISOString(), "2024-03-31T15:30:00.000Z")
  assert.equal(nextMonthlyBoundary(new Date("2025-01-31T23:00:00Z"), new Date("2025-01-31T23:00:00Z")).toISOString(), "2025-02-28T23:00:00.000Z")
})

test("첫 승인으로 기간이 생기며 도래 전·미결제·탈퇴·해지에는 청구하지 않는다", async () => {
  let calls = 0
  const runner = ledger(async (...args) => { calls++; return initialTransport(...args) })
  await make("future")
  const row = (await pg.query("SELECT billing_anchor,period_start,period_end,next_due_at FROM toss_ledger_subscriptions WHERE id='future'")).rows[0]
  assert.equal(row.billing_anchor.getTime(), row.period_start.getTime())
  assert.equal(row.period_end.getTime(), row.next_due_at.getTime())
  assert.equal((await runner.runDueBatch("product_future")).examined, 0)
  await make("unpaid", false)
  assert.equal((await runner.runDueBatch("product_unpaid")).examined, 0)
  const canceled = await make("canceled"); await due("canceled"); await canceled.cancel("canceled")
  assert.equal((await runner.runDueBatch("product_canceled")).examined, 0)
  await make("deletion"); await due("deletion"); await pg.query("INSERT INTO account_deletions VALUES ('user_deletion','pending')")
  assert.equal((await runner.runDueBatch("product_deletion")).examined, 0)
  assert.equal(calls, 0)
})

test("동시 Cron은 한 주문만 승인하고 기간은 성공 뒤 전진한다", async () => {
  await make("race"); await due("race")
  let calls = 0, enter, release
  const started = new Promise((resolve) => { enter = resolve })
  const runner = ledger(async (_url, init) => { if (init.method === "GET") return json({}, 404); calls++; enter(); await new Promise((resolve) => { release = resolve }); const body = JSON.parse(init.body); return json(payment(body.orderId, body.amount)) })
  const beforeDue = (await pg.query("SELECT next_due_at FROM toss_ledger_subscriptions WHERE id='race'")).rows[0].next_due_at
  const a = runner.runDueBatch("product_race")
  await started
  await runner.runDueBatch("product_race")
  assert.equal((await pg.query("SELECT next_due_at FROM toss_ledger_subscriptions WHERE id='race'")).rows[0].next_due_at.getTime(), beforeDue.getTime())
  release(); assert.equal((await a).paid, 1)
  assert.equal(calls, 1)
  assert.ok((await pg.query("SELECT next_due_at FROM toss_ledger_subscriptions WHERE id='race'")).rows[0].next_due_at > beforeDue)
})

test("확정 거절만 하루 간격 최대 3회, 다른 실패는 같은 주문을 조회한다", async () => {
  await make("decline"); await due("decline")
  let calls = 0
  const decline = ledger(async () => { calls++; return json({ code: "REJECT_CARD_PAYMENT", message: "private" }, 403) })
  for (let i = 0; i < 3; i++) {
    assert.equal((await decline.runDueBatch("product_decline")).declined, 1)
    assert.equal((await decline.runDueBatch("product_decline")).examined, 0)
    await pg.query("UPDATE toss_ledger_subscriptions SET retry_at=now()-interval '1 second' WHERE id='decline'")
  }
  assert.equal((await decline.runDueBatch("product_decline")).examined, 0)
  assert.equal(calls, 3)
  assert.equal((await pg.query("SELECT count(*)::int n FROM toss_ledger_charges WHERE subscription_id='decline' AND status='declined'")).rows[0].n, 3)
  await make("lost"); await due("lost")
  let order, post = 0, get = 0
  const lost = ledger(async (url, init) => {
    if (init.method === "POST") { post++; order = JSON.parse(init.body).orderId; return json({ code: "REJECT_CARD_PAYMENT" }, 400) }
    get++; assert.equal(url, `https://api.tosspayments.com/v1/payments/orders/${order}`); return json(payment(order, 4900))
  })
  assert.equal((await lost.runDueBatch("product_lost")).unresolved, 1)
  assert.equal((await ledger(async (url, init) => { get++; assert.equal(url, `https://api.tosspayments.com/v1/payments/orders/${order}`); assert.equal(init.method, "GET"); return json(payment(order, 4900)) }).runDueBatch("product_lost")).paid, 1)
  assert.equal(post, 1); assert.equal(get, 1)
  const after = (await pg.query("SELECT period_end,next_due_at FROM toss_ledger_subscriptions WHERE id='lost'")).rows[0]
  assert.equal(after.next_due_at.getTime(), after.period_end.getTime())
  assert.ok(after.next_due_at > new Date())
  assert.equal((await lost.runDueBatch("product_lost")).examined, 0)
  assert.equal(post, 1)
})

test("미확정 갱신 중 해지는 새 청구를 막되 같은 주문 조회를 허용한다", async () => {
  await make("cancel_lost"); await due("cancel_lost")
  let order, charges = 0
  const runner = ledger(async (_url, init) => {
    if (init.method === "POST") { charges++; order = JSON.parse(init.body).orderId; throw new Error("lost") }
    return json(payment(order, 4900))
  })
  assert.equal((await runner.runDueBatch("product_cancel_lost")).unresolved, 1)
  assert.equal(await runner.cancel("cancel_lost"), "cancel_requested")
  assert.equal((await runner.runDueBatch("product_cancel_lost")).paid, 1)
  const sub = (await pg.query("SELECT status,next_due_at FROM toss_ledger_subscriptions WHERE id='cancel_lost'")).rows[0]
  assert.equal(sub.status, "canceled"); assert.equal(sub.next_due_at, null)
  assert.equal((await runner.runDueBatch("product_cancel_lost")).examined, 0)
  assert.equal(charges, 1)
})

test("Cron은 기존 비밀 검사를 통과한 시험 서비스에서 해당 상품의 좁은 배치를 호출한다", async () => {
  const old = process.env.CRON_SECRET
  process.env.CRON_SECRET = "test-cron-secret"
  let calls = 0
  try {
    const service = (productId) => async () => ({ productId, ledger: { runDueBatch: async (product, limit) => { calls++; assert.equal(product, productId); assert.equal(limit, 20); return { examined: 0 } } } })
    const req = (auth) => new Request("https://example.test/api/cron/toss-test", { headers: auth ? { authorization: auth } : {} })
    assert.equal((await handleTestTossCron(req(), cronAuthorized, service("test-product-mock"))).status, 401)
    assert.equal((await handleTestTossCron(req("Bearer wrong"), cronAuthorized, service("test-product-sandbox"))).status, 401)
    const authorized = req("Bearer test-cron-secret")
    assert.equal((await handleTestTossCron(authorized, cronAuthorized, async () => null)).status, 404)
    for (const productId of ["test-product-mock", "test-product-sandbox"]) assert.equal((await handleTestTossCron(authorized, cronAuthorized, service(productId))).status, 200)
    assert.equal(calls, 2)
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old }
})

test("인증된 fake Cron은 DB의 도래한 상품만 갱신한다", async () => {
  const old = process.env.CRON_SECRET
  process.env.CRON_SECRET = "test-cron-secret"
  try {
    await make("cron_due"); await due("cron_due")
    await pg.query("UPDATE toss_ledger_subscriptions SET product_id='test-product-mock' WHERE id='cron_due'")
    let calls = 0
    const runner = ledger(async (...args) => { calls++; return initialTransport(...args) })
    const request = new Request("https://example.test/api/cron/toss-test", { headers: { authorization: "Bearer test-cron-secret" } })
    const response = await handleTestTossCron(request, cronAuthorized, async () => ({ productId: "test-product-mock", ledger: runner }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).paid, 1)
    assert.equal(calls, 1)
    assert.equal((await pg.query("SELECT count(*)::int n FROM toss_ledger_charges WHERE subscription_id='cron_due' AND status='paid'")).rows[0].n, 2)
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old }
})


test("미확정 대기열의 절반 예산과 재조회 간격이 도래 구독을 보호한다", async () => {
  for (let i = 0; i < 5; i++) {
    const id = `pending_fair_${i}`
    await make(id, false)
    await pg.query("UPDATE toss_ledger_subscriptions SET product_id='fair' WHERE id=$1", [id])
    const lost = ledger(async () => { throw new Error("lost") })
    assert.equal(await lost.chargeInitial(id, `user_${id}`), "unresolved")
  }
  await make("fair_due"); await due("fair_due")
  await pg.query("UPDATE toss_ledger_subscriptions SET product_id='fair' WHERE id='fair_due'")
  let gets=0, posts=0
  const runner=ledger(async (_url, init) => { if (init.method === "GET") { gets++; return json({},404) }; posts++; return initialTransport(_url,init) })
  const report=await runner.runDueBatch("fair",4)
  assert.equal(report.examined,3); assert.equal(report.paid,1); assert.equal(gets,2); assert.equal(posts,1)
  await runner.runDueBatch("fair",4)
  assert.equal(gets,4)
  assert.equal((await pg.query("SELECT count(*)::int n FROM toss_ledger_charges c JOIN toss_ledger_subscriptions s ON s.id=c.subscription_id WHERE s.product_id='fair' AND c.status='in_flight' AND c.next_reconcile_at>now()")).rows[0].n,4)
  await runner.runDueBatch("fair",4)
  assert.equal(gets,5)
  assert.equal((await runner.runDueBatch("fair",4)).examined,0)
  assert.equal(gets,5)
})

test("느린 도래 승인 뒤에도 예약된 미확정 주문 한 건을 조회한다", async (t) => {
  await make("slow_due")
  await due("slow_due")
  await make("slow_pending", false)
  await pg.query("UPDATE toss_ledger_subscriptions SET product_id='slow' WHERE id IN ('slow_due','slow_pending')")
  const lost = ledger(async () => { throw new Error("lost") })
  assert.equal(await lost.chargeInitial("slow_pending", "user_slow_pending"), "unresolved")
  let now = Date.now()
  t.mock.method(Date, "now", () => now)
  const methods = []
  const runner = ledger(async (url, init) => {
    methods.push(init.method)
    if (init.method === "GET") return json({}, 404)
    now += 21_000
    return initialTransport(url, init)
  })
  assert.equal((await runner.runDueBatch("slow", 4)).examined, 2)
  assert.deepEqual(methods, ["POST", "GET"])
})

test("28일 이상 연체와 손상된 키는 격리하며 정상 구독은 결제한다", async () => {
  for (const id of ["stale", "bad_key", "good_key"]) { await make(id); await due(id); await pg.query("UPDATE toss_ledger_subscriptions SET product_id='isolation' WHERE id=$1", [id]) }
  await pg.query("UPDATE toss_ledger_subscriptions SET period_end=now()-interval '60 days',next_due_at=now()-interval '60 days',period_start=now()-interval '90 days' WHERE id='stale'")
  await pg.query("UPDATE toss_ledger_subscriptions SET encrypted_billing_key='damaged',next_due_at=now()-interval '2 seconds',period_end=now()-interval '2 seconds' WHERE id='bad_key'")
  let posts=0
  const runner=ledger(async (...args) => { posts++; return initialTransport(...args) })
  assert.equal((await runner.runDueBatch('isolation',10)).paid,1)
  assert.equal(posts,1)
  const rows=(await pg.query("SELECT id,schedule_hold_reason FROM toss_ledger_subscriptions WHERE id IN ('stale','bad_key','good_key') ORDER BY id")).rows
  assert.deepEqual(rows.map(r=>[r.id,r.schedule_hold_reason]), [['bad_key','credential_unavailable'],['good_key',null],['stale','overdue']])
  await runner.runDueBatch('isolation',10)
  assert.equal(posts,1)
})

test("과거 paid는 근거 없이 기간을 계산하지 않고 수동 확인에 둔다", async () => {
  await make('legacy')
  await pg.query("UPDATE toss_ledger_subscriptions SET billing_anchor=NULL,period_start=NULL,period_end=NULL,next_due_at=NULL WHERE id='legacy'")
  const migration=await readFile(new URL("../../db/migrations/0024_toss_scheduler_safety.sql", import.meta.url),'utf8')
  const update=migration.split('--> statement-breakpoint')[2]
  await pg.exec(update)
  const row=(await pg.query("SELECT schedule_hold_reason,billing_anchor,next_due_at FROM toss_ledger_subscriptions WHERE id='legacy'")).rows[0]
  assert.equal(row.schedule_hold_reason,'legacy_paid'); assert.equal(row.billing_anchor,null); assert.equal(row.next_due_at,null)
})

test("최초 확정 거절은 24시간 뒤 사용자 요청으로 최대 세 번, 불명은 새 승인 금지", async () => {
  await make('initial_declined',false)
  let calls=0
  const ids=[]
  const declined=ledger(async (_url, init) => { calls++; ids.push(JSON.parse(init.body).orderId); return json({code:'REJECT_CARD_PAYMENT'},403) })
  for (let i=0;i<3;i++) {
    assert.equal(await declined.chargeInitial('initial_declined','user_initial_declined'),'declined')
    assert.equal(await declined.chargeInitial('initial_declined','user_initial_declined'),'not_claimed')
    await pg.query("UPDATE toss_ledger_subscriptions SET retry_at=now()-interval '1 second' WHERE id='initial_declined'")
  }
  assert.equal(await declined.chargeInitial('initial_declined','user_initial_declined'),'not_claimed')
  assert.equal(calls,3); assert.equal(new Set(ids).size,3)
  await make('initial_unknown',false)
  let unknownCalls=0
  const unknown=ledger(async () => { unknownCalls++; return json({code:'DUPLICATED_ORDER_ID'},400) })
  assert.equal(await unknown.chargeInitial('initial_unknown','user_initial_unknown'),'unresolved')
  assert.equal(await unknown.chargeInitial('initial_unknown','user_initial_unknown'),'not_claimed')
  assert.equal(unknownCalls,1)
})
