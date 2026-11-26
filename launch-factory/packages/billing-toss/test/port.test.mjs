import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { db, user } from "@launch-factory/db"
import { createTestRegistration, createTestTossBilling, createTestTossClient, createTestTossLedger } from "../src/index.ts"
import { tossTestDatabase } from "../../../template/lib/launch/toss-test-db.ts"
import { describeTossTestState } from "../../../template/lib/toss-test-status.ts"

const plan = { id: "monthly", name: "시험", interval: "month", price: { amount: 4900, currency: "KRW", vatIncluded: true }, features: [] }
const key = Buffer.alloc(32, 7), origin = "https://example.test"
let d, adapter
before(async () => { d = await db.local(); adapter = tossTestDatabase(d) })
after(async () => d.$client.close())
const paid = (orderId, amount = 4900) => ({ mId: "fake-mid", orderId, totalAmount: amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `fake_${orderId}` })

async function setup(id, transport) {
  await d.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
  const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: transport })
  const productId = `product_${id}`
  const registration = createTestRegistration({ db: adapter, client, encryptionKey: key, origin, plans: [{ id: plan.id, productId, orderName: plan.name, amount: plan.price.amount }] })
  const ledger = createTestTossLedger({ db: adapter, client, encryptionKey: key })
  const billing = createTestTossBilling({ db: adapter, ledger, productId, plan, origin })
  return { ledger, registration, port: billing.port(id), billing }
}
async function register(id, registration) {
  const start = await registration.start({ userId: id, planId: "monthly" })
  const url = new URL(start.successUrl); url.searchParams.set("customerKey", start.customerKey); url.searchParams.set("authKey", `fake_${id}`)
  assert.equal(await registration.complete({ userId: id, requestUrl: url.toString() }), "registered")
  return (await adapter.query("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1", [id])).rows[0].id
}
const issue = (body) => ({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} })

test("등록 전·카드 등록·실제 확인된 모의 승인 기간만 포트 상태에 반영한다", async () => {
  let posts = 0
  const { port, registration, ledger } = await setup("port_basic", async (url, init) => {
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json(issue(body))
    posts++; return Response.json(paid(body.orderId, body.amount))
  })
  assert.equal((await port.plans()).data[0].price.amount, 4900)
  assert.equal((await port.checkout({ planId: "monthly" })).data.redirectUrl, `${origin}/account/billing/toss-test`)
  assert.equal((await port.checkout({ planId: "monthly", trial: true })).code, "trial_unavailable")
  assert.equal((await port.subscription()).data.status, "none")
  const sub = await register("port_basic", registration)
  assert.equal((await port.detail()).data.phase, "registered_unpaid")
  assert.equal((await port.subscription()).data.status, "none")
  assert.equal(await ledger.chargeInitial(sub, "port_basic"), "paid")
  const active = await port.subscription()
  assert.equal(active.data.status, "active"); assert.ok(active.data.currentPeriodEnd)
  assert.equal(posts, 1)
  assert.equal((await port.cancel({ when: "period_end" })).code, "confirmation_required")
  const end = await port.cancel({ when: "period_end", confirmed: true })
  assert.equal(end.data.status, "active"); assert.equal(end.data.cancelAt, active.data.currentPeriodEnd)
  const dbrow = (await adapter.query("SELECT next_due_at,cancel_at FROM toss_ledger_subscriptions WHERE id=$1", [sub])).rows[0]
  assert.equal(dbrow.next_due_at, null); assert.ok(dbrow.cancel_at)
  assert.equal(await ledger.chargeMonth(sub, "2099-01"), "not_claimed")
  assert.equal((await ledger.runDueBatch("product_port_basic")).examined, 0)
  await adapter.query("UPDATE toss_ledger_subscriptions SET period_end=now()-interval '1 second',cancel_at=now()-interval '1 second' WHERE id=$1", [sub])
  assert.equal((await port.subscription()).data.status, "canceled")
  assert.equal((await port.checkout({ planId: "monthly" })).ok, true)
  assert.equal((await registration.start({ userId: "port_basic", planId: "monthly" })).status, "ready")
  assert.equal((await port.detail()).data.phase, "registering")
  assert.equal((await port.checkout({ planId: "monthly" })).code, "invalid_state")
})

test("미확정 주문은 버튼을 막고 같은 주문만 재조회하며 즉시 해지는 접근을 끊는다", async () => {
  let posts = 0, lookups = 0, order
  const { port, registration, ledger } = await setup("port_pending", async (url, init) => {
    if (init.method === "GET") { lookups++; assert.equal(String(url), `https://api.tosspayments.com/v1/payments/orders/${order}`); return lookups === 1 ? new Response(null, { status: 404 }) : Response.json(paid(order)) }
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json(issue(body))
    posts++; order = body.orderId; throw new Error("lost")
  })
  const sub = await register("port_pending", registration)
  assert.equal(await ledger.chargeInitial(sub, "port_pending"), "unresolved")
  const pending = (await port.detail()).data
  assert.equal(pending.phase, "payment_pending")
  assert.equal(pending.paymentDeclined, false)
  assert.equal(pending.retryAt, null)
  assert.equal((await port.subscription()).data.status, "none")
  assert.equal((await port.checkout({ planId: "monthly" })).code, "invalid_state")
  assert.equal((await port.reconcile()).data.phase, "payment_pending")
  assert.equal((await port.reconcile()).data.subscription.status, "active")
  assert.equal(posts, 1); assert.equal(lookups, 2)
  assert.equal((await port.cancel({ when: "now", confirmed: true })).data.status, "canceled")
})

test("다른 사용자·탈퇴 사용자·DB 장애를 차단하고 미지원 행동을 명시한다", async () => {
  const { port, billing, registration } = await setup("port_owner", async (_url, init) => { const body = JSON.parse(init.body); return Response.json(issue(body)) })
  await register("port_owner", registration)
  assert.equal((await billing.port("missing_user").subscription()).code, "sign_in_required")
  await d.insert(user).values({ id: "port_other", name: "Example", email: "port_other@example.test" })
  const other = billing.port("port_other")
  assert.equal((await other.subscription()).data.status, "none")
  assert.equal((await other.cancel({ when: "now", confirmed: true })).code, "invalid_state")
  assert.equal((await other.reconcile()).code, "invalid_state")
  for (const result of [await port.changePlan({ planId: "x", when: "now" }), await port.pause({ until: "2026-01-01" }), await port.resume(), await port.updatePaymentMethod(), await port.portal(), await port.acceptPriceChange(), await port.applyRetentionOffer({ offerId: "x" })]) assert.equal(result.code, "provider_unsupported")
  await adapter.query("INSERT INTO account_deletions (user_id,status,grace_until) VALUES ($1,'pending',now())", ["port_owner"])
  assert.equal((await port.subscription()).code, "sign_in_required")
  assert.equal((await port.checkout({ planId: "monthly" })).code, "sign_in_required")
  assert.equal((await port.reconcile()).code, "sign_in_required")
  const broken = createTestTossBilling({ db: { query: async () => { throw new Error("secret SQL") }, transaction: async () => { throw new Error("secret SQL") } }, ledger: {}, productId: "product", plan, origin }).port("user")
  const failed = await broken.subscription(); assert.equal(failed.code, "provider_unavailable"); assert.ok(!JSON.stringify(failed).includes("secret SQL"))
})

test("갱신 중 기간 끝 해지는 추가 청구를 막고 확인된 갱신 기간은 보존한다", async () => {
  let calls = 0, entered, release
  const started = new Promise((resolve) => { entered = resolve })
  const { port, registration, ledger } = await setup("port_cancel_race", async (url, init) => {
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json(issue(body))
    calls++
    if (calls === 2) { entered(); await new Promise((resolve) => { release = resolve }) }
    return Response.json(paid(body.orderId, body.amount))
  })
  const sub = await register("port_cancel_race", registration)
  assert.equal(await ledger.chargeInitial(sub, "port_cancel_race"), "paid")
  await adapter.query("UPDATE toss_ledger_charges SET billing_month=to_char(now() AT TIME ZONE 'UTC' - interval '1 month','YYYY-MM') WHERE subscription_id=$1", [sub])
  await adapter.query("UPDATE toss_ledger_subscriptions SET billing_anchor=now()-interval '1 month',period_start=now()-interval '1 month',period_end=now()-interval '1 second',next_due_at=now()-interval '1 second' WHERE id=$1", [sub])
  const run = ledger.runDueBatch("product_port_cancel_race")
  await started
  const cancellation = await port.cancel({ when: "period_end", confirmed: true })
  assert.equal(cancellation.ok, true)
  assert.equal(cancellation.data.status, "expired")
  const pendingDetail = (await port.detail()).data
  assert.equal(pendingDetail.phase, "cancel_pending")
  assert.equal(pendingDetail.paymentPending, true)
  assert.equal(pendingDetail.cancelPending, true)
  assert.equal((await port.checkout({ planId: "monthly" })).code, "invalid_state")
  assert.equal(await ledger.chargeMonth(sub, "2099-01"), "not_claimed")
  release(); assert.equal((await run).paid, 1)
  const after = (await port.subscription()).data
  assert.equal(after.status, "active"); assert.equal(after.cancelAt, after.currentPeriodEnd)
  assert.equal((await ledger.runDueBatch("product_port_cancel_race")).examined, 0)
  assert.equal(calls, 2)
})


test("보류 사유는 해당 소유자·상품의 원장에 한정하고 기존 승인 기간만 제공한다", async () => {
  const { port, billing, registration, ledger } = await setup("port_hold", async (url, init) => {
    const body = JSON.parse(init.body)
    return Response.json(String(url).endsWith("/authorizations/issue") ? issue(body) : paid(body.orderId, body.amount))
  })
  const sub = await register("port_hold", registration)
  assert.equal(await ledger.chargeInitial(sub, "port_hold"), "paid")
  await d.insert(user).values({ id: "port_hold_other", name: "Example", email: "port_hold_other@example.test" })
  const expected = { legacy_paid: /이전 결제/, overdue: /장기간/, credential_unavailable: /결제 정보/ }
  for (const reason of ["legacy_paid", "overdue", "credential_unavailable"]) {
    await adapter.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason=$2 WHERE id=$1", [sub, reason])
    const detail = (await port.detail()).data
    assert.equal(detail.scheduleHoldReason, reason)
    assert.equal(detail.subscription.status, "active")
    assert.match(describeTossTestState(detail).holdMessage, expected[reason])
    assert.equal((await billing.port("port_hold_other").detail()).data.scheduleHoldReason, null)
  }
  await adapter.query("UPDATE toss_ledger_subscriptions SET period_start=now()-interval '60 days',period_end=now()-interval '30 days' WHERE id=$1", [sub])
  const expired = (await port.detail()).data
  assert.equal(expired.subscription.status, "expired")
  assert.equal(expired.scheduleHoldReason, "credential_unavailable")
})

test("초회 확정 거절·재시각·횟수 초과와 불명 상태를 구별해 표시한다", async () => {
  let chargeCalls = 0
  const { port, registration, ledger } = await setup("port_declined", async (url, init) => {
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json(issue(body))
    chargeCalls++; return Response.json({ code: "REJECT_CARD_PAYMENT" }, { status: 403 })
  })
  const sub = await register("port_declined", registration)
  assert.equal(await ledger.chargeInitial(sub, "port_declined"), "declined")
  let detail = (await port.detail()).data
  assert.equal(detail.paymentDeclined, true)
  assert.equal(detail.canChargeInitial, false)
  assert.ok(detail.retryAt)
  assert.match(describeTossTestState(detail).retryMessage, /거절/)
  await adapter.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason='credential_unavailable' WHERE id=$1", [sub])
  assert.equal((await port.detail()).data.retryAt, null)
  await adapter.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason=NULL,retry_at=now()-interval '1 second' WHERE id=$1", [sub])
  assert.equal((await port.detail()).data.canChargeInitial, true)
  await adapter.query("UPDATE toss_ledger_subscriptions SET retry_count=3,retry_at=NULL WHERE id=$1", [sub])
  detail = (await port.detail()).data
  assert.equal(detail.retryLimitReached, true)
  assert.equal(detail.canChargeInitial, false)
  assert.match(describeTossTestState(detail).retryMessage, /횟수/)
  assert.equal(chargeCalls, 1)
})

test("확인 중인 기간 끝 해지는 화면에 해지 완료로 표현하지 않는다", () => {
  const view = describeTossTestState({ phase: "cancel_pending", paymentPending: true, cancelPending: true, scheduleHoldReason: null, paymentDeclined: false, retryAt: null, retryLimitReached: false })
  assert.match(view.statusMessage, /해지 요청/)
  assert.match(view.statusMessage, /확인/)
  assert.doesNotMatch(view.statusMessage, /해지되었습니다/)
})


test("확인된 이용 기간은 미확정 갱신의 기간 끝 해지 요청 중에도 보존한다", async () => {
  const { port, registration, ledger } = await setup("port_pending_active", async (url, init) => {
    const body = JSON.parse(init.body)
    return Response.json(String(url).endsWith("/authorizations/issue") ? issue(body) : paid(body.orderId, body.amount))
  })
  const sub = await register("port_pending_active", registration)
  assert.equal(await ledger.chargeInitial(sub, "port_pending_active"), "paid")
  await adapter.query("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status) VALUES ($1,$2,'2099-01',4900,'in_flight')", ["pending_active_order", sub])
  assert.equal((await port.detail()).data.canCancelPeriod, true)
  const canceled = await port.cancel({ when: "period_end", confirmed: true })
  assert.equal(canceled.data.status, "active")
  const detail = (await port.detail()).data
  assert.equal(detail.phase, "cancel_pending")
  assert.equal(detail.canCancelPeriod, false)
  assert.equal(detail.subscription.status, "active")
  assert.equal(await ledger.chargeMonth(sub, "2099-02"), "not_claimed")
})
