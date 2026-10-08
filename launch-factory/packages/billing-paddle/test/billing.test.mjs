// Paddle 웹훅(Review Focus 1)·메일 연결(대장 D36)·예약 작업·요금제 권한 서버 검사·실결제 잠금.
// PGlite 메모리 DB 하나와 가짜 Paddle 하나를 파일 전체가 같이 쓴다. 진짜 SDK 의 서명 검증(unmarshal)과 엔터티 변환을 그대로 거친다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import {
  assertPaddleEnv,
  BillingConfigError,
  CD,
  createPaddleClient,
  EntitlementError,
  PaddleLiveModeError,
  paymentFailedEmailsEnabled,
  protectAction,
  requireEntitlement,
  withEntitlement,
} from "../src/index.ts"
import { SUBSCRIPTION_CREATED_ENVELOPE, SUBSCRIPTION_ENTITY } from "../fixtures/paddle-examples.mjs"
import { signature, TEST_WEBHOOK_SECRET, webhookRequest } from "./fake-paddle.mjs"
import { DAY, PLANS, setup } from "./harness.mjs"

let h
before(async () => {
  h = await setup()
})
after(async () => {
  await h?.close()
})

/** 사용자 하나와 그 사용자의 Paddle 구독(웹훅으로 DB 에 실음) */
async function subscribed(status = "active", priceId = "pri_pro") {
  const userId = await h.newUser()
  const s = h.fake.seed({ status, priceId, customData: { [CD.userId]: userId } })
  const r = await h.deliver(h.fake.envelope("subscription.created", s))
  assert.equal(r.status, 200)
  return { userId, subId: s.id }
}
async function row(subId) {
  const r = await h.d.execute(sql`select * from subscriptions where provider_sub_id = ${subId}`)
  return (r.rows ?? r)[0] ?? null
}
async function eventRow(eventId) {
  const r = await h.d.execute(sql`select * from webhook_events where event_id = ${eventId}`)
  return (r.rows ?? r)[0] ?? null
}
/** DB 전체 모양(두 표의 모든 행) — 「DB 가 변하지 않았다」를 행 수가 아니라 내용으로 본다 */
async function dbSnapshot() {
  const a = await h.d.execute(sql`select * from subscriptions order by id`)
  const b = await h.d.execute(sql`select * from webhook_events order by event_id`)
  return JSON.stringify([a.rows ?? a, b.rows ?? b])
}
const sentFor = (template, subId) => h.sent.filter((m) => m.template === template && (!subId || m.idempotencyKey.includes(subId)))

// ── 서명 ──────────────────────────────────────────────

test("서명이 틀리면 401 이고 DB 는 그대로다(틀린 비밀·본문 변조·헤더 없음·5초 지난 ts·헤더 모양 틀림)", async () => {
  const { subId } = await subscribed()
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  const env = h.fake.envelope("subscription.past_due", h.fake.get(subId))
  const before = await dbSnapshot()
  const getsBefore = h.fake.count("GET", /^\/subscriptions\//)
  const raw = JSON.stringify(env)
  const cases = {
    "틀린 비밀": webhookRequest(env, { secret: "wrong-secret" }),
    "본문 변조": webhookRequest(env, { tamper: (r) => r.replace('"past_due"', '"active"') }),
    "헤더 없음": new Request("https://app.example.test/api/webhooks/paddle", { method: "POST", body: raw }),
    "5초 지난 ts": webhookRequest(env, { ts: Math.floor(Date.now() / 1000) - 10 }),
    "헤더 모양 틀림": new Request("https://app.example.test/api/webhooks/paddle", { method: "POST", body: raw, headers: { "paddle-signature": "garbage" } }),
  }
  for (const [name, req] of Object.entries(cases)) {
    const res = await h.base().handleWebhook(req)
    assert.equal(res.status, 401, name)
    assert.deepEqual(await res.json(), { error: "invalid_signature" }, name)
  }
  assert.equal(await dbSnapshot(), before, "DB 가 바뀌었다")
  assert.equal(h.fake.count("GET", /^\/subscriptions\//), getsBefore, "서명 실패인데 공급자를 조회했다")
  // 양성 대조: 같은 이벤트를 제대로 서명하면 반영된다
  const ok = await h.deliver(env)
  assert.equal(ok.status, 200)
  assert.equal((await row(subId)).status, "past_due")
})

test("공식 문서 예시 페이로드(subscription.created)가 SDK unmarshal·매핑을 거쳐 저장된다 — 모르는 가격이면 500, 설정을 고친 뒤 재전송은 처리된다", async () => {
  const userId = await h.newUser()
  const entity = { ...structuredClone(SUBSCRIPTION_ENTITY), custom_data: { [CD.userId]: userId } }
  h.fake.subs.set(entity.id, entity) // 공급자 조회도 같은 예시를 돌려준다
  const env = { ...SUBSCRIPTION_CREATED_ENVELOPE, data: entity }
  const first = await h.deliver(env)
  assert.equal(first.status, 500, "예시 가격(pri_01gsz8…)은 요금제 설정에 없다")
  assert.equal(await eventRow(env.event_id), null, "실패한 처리가 이벤트를 「본 것」으로 남겼다")
  const withExample = h.make({ plans: [...PLANS, { id: "legacy", name: "AeroEdit Pro", price: { amount: 3266, currency: "USD", vatIncluded: false }, interval: "month", features: [], paddle: { priceId: "pri_01gsz8x8sawmvhz1pv30nge1ke" } }] })
  const res = await withExample.handleWebhook(webhookRequest(env))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).kind, "processed")
  const r = await row(entity.id)
  assert.equal(r.status, "active")
  assert.equal(r.plan_id, "legacy")
  assert.equal(new Date(r.current_period_end).toISOString(), "2023-10-21T11:31:08.689Z")
  assert.equal(r.cancel_at, null, "예약된 pause 는 해지가 아니다")
  // 순서 시각 = max(occurred_at 2024-04-12, updated_at 2023-09-27)
  assert.equal(new Date(r.updated_from_event_at).toISOString(), "2024-04-12T10:18:49.621Z")
  assert.ok(await eventRow(env.event_id))
})

// ── 중복·재조회·순서·트랜잭션 ─────────────────────────────

test("같은 이벤트가 두 번 오면 두 번째는 버린다 — 공급자 조회 1번(해지 메일은 Paddle 몫이라 우리는 0통 — D93)", async () => {
  const { subId } = await subscribed()
  h.fake.mutate(subId, (s) => {
    s.scheduled_change = { action: "cancel", effective_at: s.current_billing_period.ends_at, resume_at: null }
  })
  const env = h.fake.envelope("subscription.updated", h.fake.get(subId))
  const gets = h.fake.count("GET", new RegExp(`^/subscriptions/${subId}$`))
  const a = await h.deliver(env)
  const b = await h.deliver(env)
  assert.equal(a.body.kind, "processed")
  assert.deepEqual(b.body, { kind: "duplicate", eventId: env.event_id })
  assert.equal(h.fake.count("GET", new RegExp(`^/subscriptions/${subId}$`)) - gets, 1, "중복 이벤트가 다시 조회했다")
  assert.equal(sentFor("cancellation", subId).length, 0)
  assert.ok((await row(subId)).cancel_at)
})

test("재조회: 웹훅 본문이 아니라 공급자의 지금 상태를 저장한다", async () => {
  const { subId } = await subscribed()
  const stalePayload = h.fake.get(subId) // 본문은 active
  h.fake.mutate(subId, (s) => {
    s.status = "paused"
    s.paused_at = new Date().toISOString()
    s.current_billing_period = null
    s.scheduled_change = { action: "resume", effective_at: new Date(Date.now() + 30 * DAY).toISOString(), resume_at: null }
  })
  const r = await h.deliver(h.fake.envelope("subscription.updated", stalePayload))
  assert.equal(r.status, 200)
  const saved = await row(subId)
  assert.equal(saved.status, "paused", "본문(active)을 믿었다")
  assert.ok(saved.paused_until)
})

test("순서 뒤바뀜: updated 가 created 보다 먼저 와도 결과는 최신 상태다", async () => {
  const userId = await h.newUser()
  const s = h.fake.seed({ status: "active", priceId: "pri_pro", customData: { [CD.userId]: userId } })
  const created = h.fake.envelope("subscription.created", s)
  const updatedSnap = h.fake.mutate(s.id, (x) => {
    x.scheduled_change = { action: "cancel", effective_at: x.current_billing_period.ends_at, resume_at: null }
  })
  const updated = h.fake.envelope("subscription.updated", updatedSnap)
  const u = await h.deliver(updated) // 먼저 도착 — 행이 없어도 재조회로 만든다
  assert.equal(u.body.kind, "processed")
  assert.equal(u.body.applied, true)
  const c = await h.deliver(created) // 늦게 도착한 옛 이벤트
  assert.equal(c.body.kind, "processed")
  assert.equal(c.body.applied, false, "옛 이벤트가 새 상태를 덮었다")
  assert.ok((await row(s.id)).cancel_at)
})

test("순서 보호: 먼저 읽고 늦게 쓴 처리기(옛 스냅숏)가 새 상태를 덮지 않는다", async () => {
  const { subId } = await subscribed()
  const oldSnap = h.fake.get(subId) // active
  const oldEvent = h.fake.envelope("subscription.updated", oldSnap) // 옛 이벤트(발생 시각이 이르다)
  h.fake.mutate(subId, (s) => {
    s.status = "canceled"
    s.canceled_at = new Date().toISOString()
    s.current_billing_period = null
    s.next_billed_at = null
  })
  const newEvent = h.fake.envelope("subscription.canceled", h.fake.get(subId))
  assert.equal((await h.deliver(newEvent)).status, 200)
  assert.equal((await row(subId)).status, "canceled")
  h.fake.serveStale(subId, oldSnap) // 옛 이벤트 처리기의 조회가 옛 상태를 읽은 경우
  const late = await h.deliver(oldEvent)
  assert.equal(late.status, 200)
  assert.equal(late.body.applied, false)
  assert.equal((await row(subId)).status, "canceled", "옛 상태(active)로 되돌아갔다")
})

test("처리 중 실패하면 이벤트 기록까지 되돌려 500 — 재전송은 처리된다", async () => {
  const { subId } = await subscribed()
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  const env = h.fake.envelope("subscription.past_due", h.fake.get(subId))
  const before = await dbSnapshot()
  h.fake.failNext("GET", new RegExp(`^/subscriptions/${subId}$`), 503, "service_unavailable")
  const first = await h.deliver(env)
  assert.equal(first.status, 500)
  assert.equal(await eventRow(env.event_id), null, "실패한 이벤트가 기록으로 남아 재전송이 버려진다")
  assert.equal(await dbSnapshot(), before)
  const retry = await h.deliver(env)
  assert.equal(retry.status, 200)
  assert.equal(retry.body.kind, "processed")
  assert.equal((await row(subId)).status, "past_due")
  assert.ok(await eventRow(env.event_id))
})

test("결제 실패(transaction.payment_failed)는 구독을 다시 읽고 사유(card_declined)를 싣는다", async () => {
  const userId = await h.newUser()
  const s = h.fake.seed({ status: "past_due", priceId: "pri_pro", customData: { [CD.userId]: userId }, paymentError: "declined" })
  const txn = [...h.fake.txns.values()].find((t) => t.subscription_id === s.id)
  const r = await h.deliver(h.fake.envelope("transaction.payment_failed", txn))
  assert.equal(r.body.kind, "processed")
  const saved = await row(s.id)
  assert.equal(saved.status, "past_due")
  assert.deepEqual(saved.payment_issue, { reason: "card_declined" })
  const port = h.base().port({ userId })
  const sub = await port.subscription()
  assert.equal(sub.ok && sub.data.paymentIssue?.reason, "card_declined")
})

test("사용자와 이어지지 않은 구독(custom_data 없음)은 저장하지 않고 200, 구독과 무관한 이벤트는 기록만 한다", async () => {
  const s = h.fake.seed({ status: "active", priceId: "pri_pro", customData: null })
  const a = await h.deliver(h.fake.envelope("subscription.created", s))
  assert.equal(a.status, 200)
  assert.equal(a.body.kind, "unlinked")
  assert.equal(await row(s.id), null)
  const other = h.fake.envelope("customer.created", { id: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4", email: "x@example.test", name: null, status: "active", custom_data: null, locale: "en", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), marketing_consent: false, import_meta: null })
  const b = await h.deliver(other)
  assert.equal(b.status, 200)
  assert.equal(b.body.kind, "ignored")
  assert.ok(await eventRow(other.event_id))
})

// ── 메일(대장 D36) ────────────────────────────────────

test("D93 Paddle(MoR)이 영수증·해지 메일을 보낸다: 체크아웃 완료(transaction.completed)·해지에서 우리 메일은 0통", async () => {
  const userId = await h.newUser()
  const port = h.base().port({ userId })
  const mine = (template) => h.sent.filter((m) => m.template === template && m.to === `${userId}@example.test`)
  const c = await port.checkout({ planId: "basic" }) // 가짜 Paddle 이 결제 완료 웹훅(subscription.created·transaction.completed)을 보낸다
  assert.ok(c.ok && c.data.redirectUrl.startsWith("https://"))
  const sub = await port.subscription()
  assert.equal(sub.ok && sub.data.status, "active")
  const subId = (await h.d.execute(sql`select provider_sub_id from subscriptions where user_id = ${userId}`)).rows[0].provider_sub_id
  assert.equal(mine("orderConfirmation").length, 0, "Paddle 영수증과 겹치는 주문 확인을 보냈다")

  const cancel = await port.cancel({ when: "period_end", reason: "too_expensive", detail: "free text stays here" })
  assert.ok(cancel.ok)
  await h.deliver(h.fake.envelope("subscription.updated", h.fake.get(subId)))
  const now = await port.cancel({ when: "now" })
  assert.ok(now.ok)
  assert.equal(mine("cancellation").length, 0, "Paddle 해지 메일과 겹치는 해지 확인을 보냈다")
  assert.equal(h.sent.filter((m) => m.to === `${userId}@example.test`).length, 0)
  // detail(자유 글)은 Paddle 로 가지 않는다
  assert.ok(!JSON.stringify(h.fake.calls).includes("free text stays here"))
})

test("D93 sendBillingEmails: true(스스로 메일을 안 보내는 공급자용) — 주문 확인(order:<거래>)·해지 확인이 한 번씩, 뒤따른 웹훅에 다시 안 보냄", async () => {
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const userId = await h.newUser()
  const port = billing.port({ userId })
  const mine = (template) => h.sent.filter((m) => m.template === template && m.to === `${userId}@example.test`)
  h.state.autoComplete = false
  let c
  try {
    c = await port.checkout({ planId: "basic" })
  } finally {
    h.state.autoComplete = true
  }
  assert.ok(c.ok)
  const txnId = new URL(c.data.redirectUrl).searchParams.get("_ptxn")
  for (const e of h.fake.completeCheckout(txnId)) assert.equal((await billing.handleWebhook(webhookRequest(e))).status, 200)
  const orders = mine("orderConfirmation")
  assert.equal(orders.length, 1)
  assert.match(orders[0].idempotencyKey, /^order:txn_/)
  assert.equal(orders[0].input.amount.amount, 900)

  const subId = (await h.d.execute(sql`select provider_sub_id from subscriptions where user_id = ${userId}`)).rows[0].provider_sub_id
  const cancel = await port.cancel({ when: "period_end" })
  assert.ok(cancel.ok)
  const mails = mine("cancellation")
  assert.equal(mails.length, 1)
  assert.equal(mails[0].idempotencyKey, `cancellation:${subId}:${cancel.data.cancelAt}`)
  assert.equal(mails[0].input.accessUntil, cancel.data.cancelAt)
  assert.ok(mails[0].res.ok, "메일 렌더·전송 실패")
  await billing.handleWebhook(webhookRequest(h.fake.envelope("subscription.updated", h.fake.get(subId))))
  assert.equal(mine("cancellation").length, 1)
})

test("가격 변경 안내: 적용일이 30일보다 멀면 거절(전자상거래법 제13조⑥·시행령 제20조의2), 안이면 안내 메일 정확히 한 통(price-change:<구독>:<consentBy>) — D93 뒤에도 보낸다", async () => {
  const { subId, userId } = await subscribed()
  const billing = h.base()
  const input = { providerSubId: subId, priceId: "pri_pro_2027", kind: "price_increase", from: { amount: 2900, currency: "USD", vatIncluded: false }, to: { amount: 3300, currency: "USD", vatIncluded: false } }
  // 이 구독의 다음 청구는 한 달 뒤(28~31일). 31일이면 창 밖이다 → 시각을 옮겨 두 경우를 모두 본다
  const periodEnd = Date.parse((await row(subId)).current_period_end)
  const far = h.make({ now: () => new Date(periodEnd - 31 * DAY) })
  const tooEarly = await far.schedulePriceChange({ ...input, consentBy: new Date(periodEnd - 10 * DAY).toISOString() })
  assert.equal(tooEarly.ok, false)
  assert.equal(tooEarly.code, "outside_consent_window")
  assert.equal(sentFor("priceChange", subId).length, 0)

  const near = h.make({ now: () => new Date(periodEnd - 20 * DAY) })
  const bad = await near.schedulePriceChange({ ...input, consentBy: new Date(periodEnd - 1 * 3600_000).toISOString() })
  assert.equal(bad.code, "invalid_consent_deadline", "동의 기한이 바꿀 여유(6시간) 안이다")
  const consentBy = new Date(periodEnd - 7 * DAY).toISOString()
  const ok = await near.schedulePriceChange({ ...input, consentBy })
  assert.ok(ok.ok, JSON.stringify(ok))
  assert.equal(ok.data.pendingPriceChange.consentBy, consentBy)
  const mails = sentFor("priceChange", subId)
  assert.equal(mails.length, 1)
  assert.equal(mails[0].idempotencyKey, `price-change:${subId}:${consentBy}`)
  assert.ok(mails[0].res.ok)
  // 동의하면 결과에 pendingPriceChange 가 없다
  const accepted = await billing.port({ userId }).acceptPriceChange()
  assert.ok(accepted.ok)
  assert.equal(accepted.data.pendingPriceChange, undefined)
})

// ── 예약 작업(Cron) ──────────────────────────────────

test("기간 끝 요금제 변경: Paddle 에 바로 보내지 않고, Cron 이 청구 전(30분 제한 밖)에 do_not_bill 로 바꾼다", async () => {
  const { subId, userId } = await subscribed("active", "pri_pro")
  const port = h.base().port({ userId })
  const patchesBefore = h.fake.calls.filter((c) => c.method === "PATCH" && c.body?.items).length
  const r = await port.changePlan({ planId: "basic", when: "period_end" })
  assert.ok(r.ok)
  assert.equal(r.data.scheduledPlanId, "basic")
  assert.equal(r.data.planId, "pro", "기간 끝 예약인데 바로 바뀌었다")
  assert.equal(h.fake.calls.filter((c) => c.method === "PATCH" && c.body?.items).length, patchesBefore, "항목 변경을 바로 보냈다")

  const end = Date.parse((await row(subId)).current_period_end)
  const early = await h.base().runScheduledChanges(new Date(end - 7 * 3600_000)) // 창(6시간) 밖
  assert.ok(!early.switched.some((s) => s.subId === subId))
  const late = await h.base().runScheduledChanges(new Date(end - 20 * 60_000)) // 30분 안 → Paddle 이 막는다
  assert.ok(late.tooLate.includes(subId))
  const run = await h.base().runScheduledChanges(new Date(end - 3 * 3600_000))
  assert.deepEqual(run.switched.find((s) => s.subId === subId), { subId, priceId: "pri_basic", reason: "scheduled_plan" })
  const patch = h.fake.calls.filter((c) => c.method === "PATCH" && c.path.endsWith(subId) && c.body?.items).at(-1)
  assert.equal(patch.body.proration_billing_mode, "do_not_bill")
  const after = await port.subscription()
  assert.equal(after.data.planId, "basic")
  assert.equal(after.data.scheduledPlanId, undefined)
})

test("동의 기한이 지난 가격 인상은 청구하지 않는다(L6 — 무응답은 동의가 아니다): 예정을 지우고 옛 가격을 유지", async () => {
  const { subId, userId } = await subscribed()
  const periodEnd = Date.parse((await row(subId)).current_period_end)
  const near = h.make({ now: () => new Date(periodEnd - 20 * DAY) })
  const consentBy = new Date(periodEnd - 7 * DAY)
  const s = await near.schedulePriceChange({ providerSubId: subId, priceId: "pri_pro_2027", kind: "price_increase", from: { amount: 2900, currency: "USD", vatIncluded: false }, to: { amount: 3300, currency: "USD", vatIncluded: false }, consentBy: consentBy.toISOString() })
  assert.ok(s.ok)
  const lateAccept = await h.make({ now: () => new Date(consentBy.getTime() + 60_000) }).port({ userId }).acceptPriceChange()
  assert.equal(lateAccept.code, "consent_window_closed")
  const report = await h.base().runScheduledChanges(new Date(consentBy.getTime() + 3600_000))
  assert.ok(report.lapsed.some((x) => x.subId === subId && x.kind === "price_increase"))
  const saved = await row(subId)
  assert.equal(saved.pending_price_change, null)
  const renewal = await h.base().runScheduledChanges(new Date(periodEnd - 3 * 3600_000))
  assert.ok(!renewal.switched.some((x) => x.subId === subId), "동의 없이 새 가격으로 바꿨다")
  assert.equal(h.fake.get(subId).items[0].price.id, "pri_pro")
})

test("동의한 가격 인상은 Cron 이 청구 전에 새 가격으로 바꾼다", async () => {
  const { subId, userId } = await subscribed()
  const periodEnd = Date.parse((await row(subId)).current_period_end)
  const near = h.make({ now: () => new Date(periodEnd - 20 * DAY) })
  await near.schedulePriceChange({ providerSubId: subId, priceId: "pri_pro_2027", kind: "price_increase", from: { amount: 2900, currency: "USD", vatIncluded: false }, to: { amount: 3300, currency: "USD", vatIncluded: false }, consentBy: new Date(periodEnd - 7 * DAY).toISOString() })
  assert.ok((await near.port({ userId }).acceptPriceChange()).ok)
  const run = await h.base().runScheduledChanges(new Date(periodEnd - 2 * 3600_000))
  assert.deepEqual(run.switched.find((x) => x.subId === subId), { subId, priceId: "pri_pro_2027", reason: "accepted_price" })
  assert.equal(h.fake.get(subId).items[0].price.id, "pri_pro_2027")
  assert.equal((await row(subId)).plan_id, "pro", "새 가격도 같은 요금제로 읽힌다")
})

// ── 요금제 권한 서버 검사 ─────────────────────────────

test("requireEntitlement: 무료 사용자가 유료 서버 경로·액션을 직접 부르면 403, 로그인 안 했으면 401, 유료면 통과", async () => {
  const free = await h.newUser()
  const { userId: paid } = await subscribed("active", "pri_pro")
  const opts = { db: h.d, plans: PLANS, freeEntitlements: ["projects"] }
  let ran = 0
  const route = withEntitlement("reports.advanced", { ...opts, session: async (req) => ({ userId: req.headers.get("x-test-user") }) }, async () => {
    ran += 1
    return new Response("report")
  })
  const call = (userId) => route(new Request("https://app.example.test/api/reports", { method: "POST", headers: userId ? { "x-test-user": userId } : {} }))
  const denied = await call(free)
  assert.equal(denied.status, 403)
  assert.deepEqual(await denied.json(), { error: "entitlement_required", feature: "reports.advanced" })
  assert.equal(ran, 0, "권한 없이 처리기가 돌았다")
  const anon = await withEntitlement("reports.advanced", { ...opts, session: async () => null }, async () => new Response("x"))(new Request("https://app.example.test/"))
  assert.equal(anon.status, 401)
  assert.equal((await call(paid)).status, 200)
  assert.equal(ran, 1)

  const action = protectAction("reports.advanced", { ...opts, session: async () => ({ userId: free }) }, async () => {
    ran += 1
    return { ok: true }
  })
  const r = await action()
  assert.equal(r.ok, false)
  assert.equal(r.status, 403)
  assert.equal(ran, 1, "권한 없이 서버 액션 본문이 돌았다")
  await assert.rejects(requireEntitlement({ userId: free }, "team", opts), (e) => e instanceof EntitlementError && e.status === 403)
  assert.deepEqual(await requireEntitlement({ userId: free }, "projects", opts), { planId: null })
  // 일시정지·해지된 구독은 권한이 없다
  const { userId: paused } = await subscribed("paused", "pri_pro")
  await assert.rejects(requireEntitlement({ userId: paused }, "reports.advanced", opts), (e) => e.status === 403)
})

// ── 설정 ────────────────────────────────────────────

test("실결제(production)는 LF_PADDLE_LIVE=1 일 때만, 설정 오류는 만들 때 한 번에 알린다", () => {
  assert.throws(() => assertPaddleEnv("production", {}), PaddleLiveModeError)
  assert.throws(() => assertPaddleEnv("production", { LF_PADDLE_LIVE: "true" }), PaddleLiveModeError)
  assert.equal(assertPaddleEnv("production", { LF_PADDLE_LIVE: "1" }), "production")
  assert.equal(assertPaddleEnv("sandbox", {}), "sandbox")
  assert.throws(() => assertPaddleEnv("live", {}), /sandbox/)
  assert.throws(() => createPaddleClient({ apiKey: "test-api-key-not-real", env: "production", vars: {} }), PaddleLiveModeError)
  assert.throws(() => h.make({ env: "production", vars: {} }), PaddleLiveModeError)
  try {
    h.make({ plans: [{ ...PLANS[1], paddle: { priceId: "pri_pro" } }, { ...PLANS[0], trialDays: 45, paddle: { priceId: "pri_basic", trialPriceId: "pri_x" } }], retentionOffers: [{ id: "big", kind: "discount", discount: { percent: 50, months: 3 } }] })
    assert.fail("잘못된 설정이 통과했다")
  } catch (e) {
    assert.ok(e instanceof BillingConfigError)
    assert.equal(e.problems.length, 3, e.problems.join("\n")) // 체험 가격 없음 · 체험 45일 · 할인 50%
  }
})

test("서명 헤더 도우미 자체 확인: 공식 형식 ts=…;h1=64자 hex", () => {
  assert.match(signature("{}", { secret: TEST_WEBHOOK_SECRET, ts: 1671552777 }), /^ts=1671552777;h1=[0-9a-f]{64}$/)
})

test("비밀 교체 중(h1 여럿): 우리 비밀과 맞는 h1 이 첫째여도 받는다 — SDK 는 마지막 h1 만 보므로 나눠 검증한다", async () => {
  const { subId } = await subscribed()
  const env = h.fake.envelope("subscription.updated", h.fake.get(subId))
  const raw = JSON.stringify(env)
  const ts = Math.floor(Date.now() / 1000)
  const ours = signature(raw, { ts }).split(";")[1]
  const other = signature(raw, { ts, secret: "rotated-new-secret" }).split(";")[1]
  const req = (header) => new Request("https://app.example.test/api/webhooks/paddle", { method: "POST", body: raw, headers: { "paddle-signature": header } })
  const res = await h.base().handleWebhook(req(`ts=${ts};${ours};${other}`))
  assert.equal(res.status, 200)
  // 양성 대조: 둘 다 우리 비밀이 아니면 401
  const bad = await h.base().handleWebhook(req(`ts=${ts};${other};${other}`))
  assert.equal(bad.status, 401)
})

// ── Task 19: 결제 포털(D75)·past_due 유예(D57)·받는 사람 언어(D74) ─────────────

const portalCalls = () => h.fake.calls.filter((c) => c.method === "POST" && /\/portal-sessions$/.test(c.path))

test("D75 결제 포털: 내 구독의 고객으로만 세션을 만든다(남의 구독·고객 id 는 입력으로 받지 않는다), 링크는 매번 새로", async () => {
  const a = await subscribed("active", "pri_pro")
  const b = await subscribed("active", "pri_basic")
  const r = await h.base().port({ userId: a.userId }).portal()
  assert.ok(r.ok, JSON.stringify(r))
  assert.match(r.data.redirectUrl, /^https:\/\/customer-portal\.paddle\.test\/.*action=overview/)
  assert.match(r.data.paymentMethodUrl, new RegExp(`action=update_subscription_payment_method&subscription_id=${a.subId}&`))
  const last = portalCalls().at(-1)
  assert.equal(last.path, `/customers/${h.fake.get(a.subId).customer_id}/portal-sessions`)
  assert.deepEqual(last.body, { subscription_ids: [a.subId] })

  const rb = await h.base().port({ userId: b.userId }).portal()
  assert.ok(rb.ok)
  assert.ok(!JSON.stringify(rb.data).includes(a.subId), "남의 구독 링크가 섞였다")
  assert.deepEqual(portalCalls().at(-1).body, { subscription_ids: [b.subId] })
  assert.equal(portalCalls().at(-1).path, `/customers/${h.fake.get(b.subId).customer_id}/portal-sessions`)
  // 캐시하지 않는다: 누를 때마다 새 세션
  const again = await h.base().port({ userId: a.userId }).portal()
  assert.notEqual(again.data.redirectUrl, r.data.redirectUrl)

  // 음성: 구독이 없는 사용자 → no_subscription, Paddle 포털 호출 0
  const before = portalCalls().length
  const none = await h.base().port({ userId: await h.newUser() }).portal()
  assert.equal(none.ok, false)
  assert.equal(none.code, "no_subscription")
  // 음성: DB 행이 다른 사용자를 가리켜도(잘못 연결된 행) Paddle custom_data 의 주인과 다르면 거절
  const intruder = await h.newUser()
  await h.d.execute(sql`update subscriptions set user_id = ${intruder} where provider_sub_id = ${b.subId}`)
  const stolen = await h.base().port({ userId: intruder }).portal()
  assert.equal(stolen.ok, false)
  assert.equal(stolen.code, "not_owner")
  assert.equal(portalCalls().length, before, "주인이 아닌데 포털 세션을 만들었다")
  await h.d.execute(sql`update subscriptions set user_id = ${b.userId} where provider_sub_id = ${b.subId}`)
})

test("D57 past_due 유예: 시작(이벤트 occurred_at)부터 7일은 유료 기능 유지 → 지나면 403(무료 기능·데이터는 그대로) → 결제 회복하면 다시 허용 · 0 이면 바로 막음", async () => {
  const { userId, subId } = await subscribed("active", "pri_pro")
  const began = new Date(Date.now() - 3 * DAY)
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  assert.equal((await h.deliver(h.fake.envelope("subscription.past_due", h.fake.get(subId), began))).status, 200)
  const since = () => row(subId).then((r) => (r.past_due_since ? new Date(r.past_due_since).getTime() : null))
  assert.equal(await since(), began.getTime(), "시작 시각이 이벤트 occurred_at 이 아니다")
  // past_due 가 이어지는 동안 뒤 이벤트가 와도 시작 시각은 그대로
  await h.deliver(h.fake.envelope("subscription.updated", h.fake.get(subId)))
  assert.equal(await since(), began.getTime())

  const graceEnd = new Date(began.getTime() + 7 * DAY).toISOString()
  const at = (ms) => ({ db: h.d, plans: PLANS, freeEntitlements: ["projects"], now: () => new Date(began.getTime() + ms) })
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(0)), { planId: "pro", graceEndsAt: graceEnd })
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(7 * DAY - 1)), { planId: "pro", graceEndsAt: graceEnd })
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", at(7 * DAY)), (e) => e instanceof EntitlementError && e.status === 403)
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", at(8 * DAY)), (e) => e.status === 403)
  // 유료 기능만 막는다: 무료 기능은 그대로, 구독 행(데이터)도 그대로
  assert.deepEqual(await requireEntitlement({ userId }, "projects", at(8 * DAY)), { planId: null })
  assert.equal((await row(subId)).status, "past_due")
  // 화면(결제 실패 배너)이 기한을 보인다
  const sub = await h.base().port({ userId }).subscription()
  assert.equal(sub.data.graceEndsAt, graceEnd)
  assert.equal(sub.data.paymentIssue.reason, "unknown")
  // 설정 0 → 바로 막는다
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", { ...at(0), pastDueGraceMs: 0 }), (e) => e.status === 403)
  assert.equal((await h.make({ pastDueGraceMs: 0 }).port({ userId }).subscription()).data.graceEndsAt, began.toISOString())

  // 결제 회복 → 다시 허용, 시작 시각·기한이 지워진다
  h.fake.mutate(subId, (s) => {
    s.status = "active"
  })
  await h.deliver(h.fake.envelope("subscription.updated", h.fake.get(subId)))
  assert.equal(await since(), null)
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(30 * DAY)), { planId: "pro" })
  assert.equal((await h.base().port({ userId }).subscription()).data.graceEndsAt, undefined)
  // 다시 past_due 가 되면 새 시각부터 센다
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  const again = new Date(Date.now() - 1000)
  await h.deliver(h.fake.envelope("subscription.past_due", h.fake.get(subId), again))
  assert.equal(await since(), again.getTime())
})

test("D74 받는 사람 언어: 요청 머리가 없는 가격 변경 안내(관리·Cron 경로)가 사용자 locale·timeZone 으로 간다, 비었으면 설정 기본", async () => {
  const ko = await subscribed("active", "pri_pro")
  await h.d.execute(sql`update "user" set locale = 'ko', time_zone = 'Asia/Seoul' where id = ${ko.userId}`)
  const plain = await subscribed("active", "pri_pro")
  const input = { priceId: "pri_pro_2027", kind: "price_increase", from: { amount: 2900, currency: "USD", vatIncluded: false }, to: { amount: 3300, currency: "USD", vatIncluded: false } }
  for (const s of [ko, plain]) {
    const periodEnd = Date.parse((await row(s.subId)).current_period_end)
    const near = h.make({ now: () => new Date(periodEnd - 20 * DAY) })
    const r = await near.schedulePriceChange({ ...input, providerSubId: s.subId, consentBy: new Date(periodEnd - 7 * DAY).toISOString() })
    assert.ok(r.ok, JSON.stringify(r))
  }
  const [koMail] = sentFor("priceChange", ko.subId)
  assert.equal(koMail.input.locale, "ko")
  assert.equal(koMail.input.timeZone, "Asia/Seoul")
  assert.ok(koMail.res.ok)
  const [plainMail] = sentFor("priceChange", plain.subId)
  assert.equal(plainMail.input.locale, "en")
  assert.equal(plainMail.input.timeZone, undefined)
})

// ── F11: 결제 실패 안내 메일(우리가 직접) ─────────────────────────────

test("F11 결제 실패 안내: past_due 로 들어갈 때 한 통 — 받는 사람·카드 변경 링크·이용 가능한 마지막 날(시작+7일)·멱등 키", async () => {
  const { userId, subId } = await subscribed("active", "pri_pro")
  const began = new Date(Date.now() - 2 * DAY)
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  const before = sentFor("paymentFailed", subId).length
  assert.equal((await h.deliver(h.fake.envelope("subscription.past_due", h.fake.get(subId), began))).status, 200)
  const mails = sentFor("paymentFailed", subId).slice(before)
  assert.equal(mails.length, 1)
  const [m] = mails
  assert.equal(m.to, `${userId}@example.test`)
  assert.equal(m.input.updateUrl, "https://app.example.test/billing", "우리 앱의 결제 관리 화면(대행사 포털 링크는 임시 토큰이라 싣지 않는다)")
  assert.equal(m.input.accessUntil, new Date(began.getTime() + 7 * DAY).toISOString())
  assert.equal(m.input.retryAt, undefined, "재시도 날짜를 모르면 지어내지 않는다")
  assert.equal(m.idempotencyKey, `payment-failed:${subId}:${began.toISOString()}`)
  assert.equal(m.res.ok, true)
})

test("F11 멱등: 같은 이벤트 재전송·한 번의 실패에 함께 오는 transaction.payment_failed·뒤따르는 업데이트는 두 번째 메일을 만들지 않는다", async () => {
  const userId = await h.newUser()
  const s = h.fake.seed({ status: "past_due", priceId: "pri_pro", customData: { [CD.userId]: userId } })
  const txn = [...h.fake.txns.values()].find((t) => t.subscription_id === s.id)
  const a = h.fake.envelope("subscription.past_due", h.fake.get(s.id))
  assert.equal((await h.deliver(a)).body.kind, "processed")
  assert.equal(sentFor("paymentFailed", s.id).length, 1)
  assert.equal((await h.deliver(a)).body.kind, "duplicate", "같은 이벤트 재전송")
  assert.equal((await h.deliver(h.fake.envelope("transaction.payment_failed", txn))).body.kind, "processed")
  assert.equal((await h.deliver(h.fake.envelope("subscription.updated", h.fake.get(s.id)))).body.kind, "processed")
  assert.equal(sentFor("paymentFailed", s.id).length, 1, "한 실패 주기에 한 통")
  // 거래 이벤트가 먼저 와도 한 통(그 뒤 subscription.past_due 는 이미 past_due 라 보내지 않는다)
  const other = await h.newUser()
  const s2 = h.fake.seed({ status: "past_due", priceId: "pri_pro", customData: { [CD.userId]: other } })
  const txn2 = [...h.fake.txns.values()].find((t) => t.subscription_id === s2.id)
  await h.deliver(h.fake.envelope("transaction.payment_failed", txn2))
  await h.deliver(h.fake.envelope("subscription.past_due", h.fake.get(s2.id)))
  assert.equal(sentFor("paymentFailed", s2.id).length, 1)
})

test("F11 새 실패 주기: 결제가 회복된 뒤 다시 past_due 가 되면 새 키로 한 통 더", async () => {
  const { subId } = await subscribed("active", "pri_pro")
  const fail = async (at) => {
    h.fake.mutate(subId, (s) => {
      s.status = "past_due"
    })
    await h.deliver(h.fake.envelope("subscription.past_due", h.fake.get(subId), at))
  }
  await fail(new Date(Date.now() - 20 * DAY))
  h.fake.mutate(subId, (s) => {
    s.status = "active"
  })
  await h.deliver(h.fake.envelope("subscription.updated", h.fake.get(subId), new Date(Date.now() - 10 * DAY)))
  assert.equal(sentFor("paymentFailed", subId).length, 1, "회복은 메일을 만들지 않는다")
  await fail(new Date(Date.now() - 1000))
  const mails = sentFor("paymentFailed", subId)
  assert.equal(mails.length, 2)
  assert.notEqual(mails[0].idempotencyKey, mails[1].idempotencyKey)
})

test("F11 끄기: sendPaymentFailedEmails=false(Paddle Retain 을 켠 live)면 보내지 않는다 · 옵션 없으면 켜짐 · 유예 설정이 이용 마지막 날에 반영된다", async () => {
  const off = h.make({ mail: { ...h.mail, sendPaymentFailedEmails: false } })
  const { subId } = await subscribed("active", "pri_pro")
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  const env = h.fake.envelope("subscription.past_due", h.fake.get(subId))
  const res = await off.handleWebhook(webhookRequest(env))
  assert.equal(res.status, 200)
  assert.equal(sentFor("paymentFailed", subId).length, 0, "끄면 0통")
  // 양성 대조: 켜 둔 처리기는 같은 모양의 다른 구독에 보낸다
  const { subId: other } = await subscribed("active", "pri_pro")
  h.fake.mutate(other, (s) => {
    s.status = "past_due"
  })
  const began = new Date(Date.now() - DAY)
  await h.make({ pastDueGraceMs: 3 * DAY }).handleWebhook(webhookRequest(h.fake.envelope("subscription.past_due", h.fake.get(other), began)))
  const [m] = sentFor("paymentFailed", other)
  assert.ok(m, "켜 둔 경우 보낸다")
  assert.equal(m.input.accessUntil, new Date(began.getTime() + 3 * DAY).toISOString(), "pastDueGraceMs 가 마지막 날을 정한다")
})

test("F11 링크 설정: urls.updatePaymentMethod 가 있으면 그 주소로", async () => {
  const b = h.make({ mail: { ...h.mail, urls: { ...h.mail.urls, updatePaymentMethod: "https://app.example.test/billing#payment-method" } } })
  const { subId } = await subscribed("active", "pri_pro")
  h.fake.mutate(subId, (s) => {
    s.status = "past_due"
  })
  await b.handleWebhook(webhookRequest(h.fake.envelope("subscription.past_due", h.fake.get(subId))))
  assert.equal(sentFor("paymentFailed", subId)[0].input.updateUrl, "https://app.example.test/billing#payment-method")
})

test("F11 스위치 값: 비었거나 없으면 켜짐, off·0·false·no(대소문자·공백 무시)만 끈다 — 모르는 값은 켜 둔 채로(조용히 꺼지지 않는다)", () => {
  for (const on of [undefined, null, "", "  ", "on", "1", "true", "yes", "offf", "disabled"]) assert.equal(paymentFailedEmailsEnabled(on), true, JSON.stringify(on))
  for (const off of ["off", "OFF", " Off ", "0", "false", "False", "no", "NO"]) assert.equal(paymentFailedEmailsEnabled(off), false, JSON.stringify(off))
})
