// Gumroad 알림 처리기(위조·중복·순서·연결)·권한 서버 검사·메일·체크아웃·지원 안 함 동작.
// PGlite 메모리 DB 하나와 가짜 Gumroad(진짜 fetch 클라이언트가 부르는 HTTP) 하나를 파일 전체가 같이 쓴다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { EntitlementError, requireEntitlement, signRef, verifyRef, UNSUPPORTED_METHODS, PROVIDER_UNSUPPORTED, REF_TTL_MS, validateGumroadConfig } from "../src/index.ts"
import { TEST_PING_SECRET } from "./fake-gumroad.mjs"
import { DAY, PLANS, setup } from "./harness.mjs"

let h
before(async () => {
  h = await setup()
})
after(async () => {
  await h?.close()
})

const ref = (userId, at = new Date()) => ({ lf_ref: signRef(TEST_PING_SECRET, userId, at) })
/** 사용자 하나와 그 사용자의 Gumroad 구독(판매 알림으로 DB 에 실음) */
async function subscribed({ productId = "prod_pro", trial = false, billing } = {}) {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId, trial, urlParams: ref(userId) })
  const res = await h.deliver(r.ping, undefined, billing)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
  return { userId, r, subId: r.sub.id }
}
async function row(subId) {
  const r = await h.d.execute(sql`select * from subscriptions where provider = 'gumroad' and provider_sub_id = ${subId}`)
  return (r.rows ?? r)[0] ?? null
}
const sentFor = (template, needle) => h.sent.filter((m) => m.template === template && (!needle || m.idempotencyKey.includes(needle)))
let seq = 0
const stamp = () => new Date(Date.now() + ++seq * 1000).toISOString()

// ── 처음 구독·상태 ─────────────────────────────────────

test("판매 알림 → API 재조회 → 구독 행(서명된 lf_ref 로 사용자 연결) · 화면 상태 · 체험 중이면 trialing", async () => {
  const { userId, subId } = await subscribed()
  const r = await row(subId)
  assert.equal(r.user_id, userId)
  assert.equal(r.plan_id, "pro")
  assert.equal(r.status, "active")
  const sub = await h.base.port({ userId }).subscription()
  assert.equal(sub.ok, true)
  assert.equal(sub.data.status, "active")
  assert.equal(sub.data.planId, "pro")
  const t = await subscribed({ productId: "prod_pro_trial", trial: true })
  assert.equal((await row(t.subId)).status, "trialing")
  const ts = await h.base.port({ userId: t.userId }).subscription()
  assert.equal(ts.data.status, "trialing")
  assert.ok(ts.data.trialEnd)
})

test("해지 알림: 기간 끝까지 이용(cancelAt) → 그 뒤 cancelled 는 canceled · 알림이 아니라 재조회 결과를 저장한다", async () => {
  const { userId, r, subId } = await subscribed()
  const end = new Date(Date.now() + 10 * DAY)
  const ping = h.fake.requestCancel(subId, end)
  const res = await h.deliver(ping)
  assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
  const st = (await h.base.port({ userId }).subscription()).data
  assert.equal(st.status, "active")
  assert.equal(st.cancelAt, end.toISOString())
  h.fake.mutate(subId, (s) => {
    s.status = "cancelled"
    s.cancelled_at = new Date(Date.now() - DAY).toISOString()
  })
  const res2 = await h.deliver(h.fake.subscriptionPing(subId, "subscription_ended", { ended_at: stamp() }))
  assert.equal(res2.body.kind, "processed", JSON.stringify(res2.body))
  assert.equal((await row(subId)).status, "canceled")
  void r
})

// ── 위조·서명 없음 대체(공유 비밀 + 재조회) ──────────────────

test("위조 알림: 키 틀림·없음 401 · 키 맞고 없는 판매 503 · 구독 불일치 400 — 세 경우 모두 DB 전체(구독·이벤트 표)가 그대로", async () => {
  const { userId, r } = await subscribed()
  const before = await h.snapshot()
  const calls = h.fake.calls.length
  // 키 틀림 · 키 없음 · 빈 키
  for (const key of ["wrong-secret", null, ""]) {
    const res = await h.deliver(r.ping, { key })
    assert.equal(res.status, 401, `key=${String(key)}`)
  }
  assert.equal(h.fake.calls.length, calls, "키가 틀린데 Gumroad API 를 불렀다")
  // 키 맞고 API 에 없는 판매(아무나 sale_id 를 지어냄)
  const fakeSale = { ...r.sale, id: "not-a-real-sale" }
  const ghost = await h.deliver(h.fake.salePing(fakeSale, { urlParams: ref(userId) }))
  assert.equal(ghost.status, 503)
  assert.equal(ghost.body.error, "unverified")
  // 판매는 진짜인데 알림이 다른 구독을 말함
  const fresh = h.fake.charge(r.sub) // 아직 처리 안 한 진짜 판매(이미 처리한 판매 id 는 duplicate 로 먼저 끝난다)
  const mismatch = await h.deliver(h.fake.salePing(fresh, { overrides: { subscription_id: "someone-elses-subscription" } }))
  assert.equal(mismatch.status, 400)
  assert.equal(await h.snapshot(), before, "위조 알림이 DB 를 바꿨다")
  // 위조가 진짜 알림의 id 를 미리 막지 않는다: 아직 API 에 안 보이는 진짜 판매 알림 → 503(이벤트 id 안 남김) → 보이게 된 뒤 재전송이 처리된다
  const u2 = await h.newUser()
  const late = h.fake.purchase({ productId: "prod_pro", urlParams: ref(u2) })
  h.fake.hidden.add(late.sale.id)
  const snap = await h.snapshot()
  assert.equal((await h.deliver(late.ping)).status, 503)
  assert.equal(await h.snapshot(), snap)
  h.fake.hidden.delete(late.sale.id)
  assert.equal((await h.deliver(late.ping)).body.kind, "processed")
})

test("본문에 실은 값(이메일·금액·상품 이름·환불 표시)은 믿지 않는다: 재조회한 API 값만 저장된다", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: ref(userId) })
  // 알림 본문이 환불·다른 상품·다른 이메일이라고 주장
  const body = h.fake.salePing(r.sale, { urlParams: ref(userId), overrides: { refunded: "true", product_id: "prod_team_year", email: "attacker@example.test", price: "1" } })
  const res = await h.deliver(body)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const saved = await row(r.sub.id)
  assert.equal(saved.plan_id, "pro", "본문의 product_id 를 믿었다")
  assert.equal(saved.status, "active", "본문의 refunded 를 믿었다")
})

test("Gumroad API 가 실패하면 500 이고 이벤트 id 도 남지 않는다 → 재전송이 처리된다", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: ref(userId) })
  const before = await h.snapshot()
  h.fake.failNext = 503
  const res = await h.deliver(r.ping)
  assert.ok([500, 503].includes(res.status), String(res.status))
  assert.equal(await h.snapshot(), before)
  const retry = await h.deliver(r.ping)
  assert.equal(retry.body.kind, "processed", JSON.stringify(retry.body))
})

test("공유 비밀이 설정되지 않으면 500(위조 통과 금지)", async () => {
  const billing = h.make({ pingSecret: "" })
  const res = await h.deliver("sale_id=x&resource_name=sale", { key: "" }, billing)
  assert.equal(res.status, 500)
})

test("잘못된 본문: 비어 있음·너무 큼·모르는 resource 는 처리하지 않는다(400 · 400 · 200 ignored)", async () => {
  assert.equal((await h.deliver("")).status, 400)
  assert.equal((await h.deliver("sale_id=" + "a".repeat(70 * 1024) + "&resource_name=sale")).status, 400)
  assert.equal((await h.deliver("sale_id=1&resource_name=something_new")).body.kind, "ignored")
  assert.equal((await h.deliver("resource_name=sale")).status, 400) // sale_id 없음
  assert.equal((await h.deliver("{not json", { contentType: "application/json" })).status, 400)
})

// ── 중복·순서 ─────────────────────────────────────────

test("같은 판매 알림이 두 번(그리고 재전송 retry_count 를 붙여) 오면 한 번만 처리한다 — Gumroad API 조회도 첫 번째만", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: ref(userId) })
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const first = await h.deliver(r.ping, undefined, billing)
  assert.equal(first.body.kind, "processed")
  const calls = h.fake.calls.length
  const again = await h.deliver(r.ping, undefined, billing)
  assert.equal(again.status, 200)
  assert.equal(again.body.kind, "duplicate")
  const retried = await h.deliver(`${r.ping}&retry_count=2`, undefined, billing)
  assert.equal(retried.body.kind, "duplicate")
  assert.equal(h.fake.calls.length, calls, "중복인데 API 를 다시 불렀다")
  assert.equal(sentFor("orderConfirmation", r.sale.id).length, 1, "중복 알림에 메일이 또 나갔다")
})

test("같은 sale_id 라도 resource_name 이 다르면 다른 사건이다(sale 다음 refund 는 처리된다)", async () => {
  const { r, subId } = await subscribed()
  const refund = await h.deliver(h.fake.salePing(r.sale, { resource: "refund" }))
  assert.equal(refund.body.kind, "processed", JSON.stringify(refund.body))
  assert.equal(refund.body.eventId, `refund:${r.sale.id}`)
  assert.ok(await row(subId))
})

test("옛 스냅숏이 새 상태를 못 덮는다: 시계가 되감긴 처리(재조회가 옛 것)는 applied false, 새 처리는 적용", async () => {
  const { userId, subId, r } = await subscribed()
  const end = new Date(Date.now() + 5 * DAY)
  await h.deliver(h.fake.requestCancel(subId, end))
  const stored = await row(subId)
  assert.ok(stored.cancel_at, "해지 예약이 저장되지 않았다")
  // 뒤늦게 온 옛 이벤트의 재조회가 「해지 없음」을 돌려주는 상황 + 처리 시각이 저장값보다 이르다
  h.fake.mutate(subId, (s) => {
    s.status = "alive"
    s.cancelled_at = null
  })
  const oldBilling = h.make({ now: () => new Date(Date.now() - 3600_000) })
  const charge = h.fake.charge(h.fake.get(subId))
  const res = await h.deliver(h.fake.salePing(charge), undefined, oldBilling)
  assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
  assert.equal(res.body.applied, false, "옛 스냅숏이 적용됐다")
  const after = await row(subId)
  assert.equal(new Date(after.cancel_at).getTime(), end.getTime(), "옛 스냅숏이 해지 예약을 지웠다")
  assert.equal(new Date(after.updated_from_event_at).getTime(), new Date(stored.updated_from_event_at).getTime())
  // 같은 재조회라도 지금 시각의 처리는 적용된다(해지 철회 = alive)
  const charge2 = h.fake.charge(h.fake.get(subId))
  const res2 = await h.deliver(h.fake.salePing(charge2))
  assert.equal(res2.body.applied, true)
  assert.equal((await row(subId)).cancel_at, null)
  void userId
  void r
})

test("멤버십이 아닌 판매(subscription_id 없음)는 무시한다 — 200 ignored", async () => {
  const oneOff = { ...h.fake.purchase({ productId: "prod_pro" }).sale, id: "one-off-sale-1", subscription_id: null }
  h.fake.seedSale(oneOff)
  const res = await h.deliver(h.fake.salePing(oneOff))
  assert.equal(res.status, 200)
  assert.equal(res.body.kind, "ignored", JSON.stringify(res.body))
})

// ── 사용자 연결(lf_ref) ────────────────────────────────

test("lf_ref 위조·만료·없음 → unlinked(구독 행이 만들어지지 않는다). 서명된 값만 연결한다", async () => {
  const victim = await h.newUser()
  const attacker = await h.newUser()
  const forged = signRef("some-other-secret", victim, new Date())
  const [, exp, sig] = signRef(TEST_PING_SECRET, attacker, new Date()).split(".")
  const swapped = `${Buffer.from(victim).toString("base64url")}.${exp}.${sig}`
  const expired = signRef(TEST_PING_SECRET, victim, new Date(Date.now() - REF_TTL_MS - DAY))
  for (const [label, urlParams] of [["다른 비밀로 서명", { lf_ref: forged }], ["사용자 부분만 바꿈", { lf_ref: swapped }], ["만료", { lf_ref: expired }], ["없음", {}]]) {
    const r = h.fake.purchase({ productId: "prod_pro", urlParams })
    const before = await h.count("subscriptions")
    const res = await h.deliver(r.ping)
    assert.equal(res.status, 200, label)
    assert.equal(res.body.kind, "unlinked", `${label}: ${JSON.stringify(res.body)}`)
    assert.equal(await row(r.sub.id), null, `${label}: 행이 만들어졌다`)
    assert.equal(await h.count("subscriptions"), before)
  }
  assert.ok(h.logs.some((l) => l.includes("no linked user")))
  // 검증 함수 자체
  assert.equal(verifyRef(TEST_PING_SECRET, signRef(TEST_PING_SECRET, victim, new Date()), new Date()), victim)
  assert.equal(verifyRef(TEST_PING_SECRET, null, new Date()), null)
  assert.equal(verifyRef(TEST_PING_SECRET, "a.b", new Date()), null)
})

test("처음 연결이 이긴다: 이미 연결된 구독에 다른 사용자의 (서명된) lf_ref 가 실린 알림이 와도 사용자가 바뀌지 않는다", async () => {
  const { userId, r, subId } = await subscribed()
  const other = await h.newUser()
  const charge = h.fake.charge(r.sub)
  const res = await h.deliver(h.fake.salePing(charge, { urlParams: ref(other) }))
  assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
  assert.equal((await row(subId)).user_id, userId)
})

test("모르는 상품(같은 판매자 계정의 다른 상품) 알림은 무시한다 — 구독 행 없음, 200 ignored", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_other", urlParams: ref(userId) })
  const res = await h.deliver(r.ping)
  assert.equal(res.status, 200)
  assert.equal(res.body.kind, "ignored")
  assert.equal(await row(r.sub.id), null)
})

test("JSON 본문(application/json, url_params 객체)도 같은 규칙으로 처리한다", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: {} })
  const form = new URLSearchParams(r.ping)
  const json = JSON.stringify({ sale_id: form.get("sale_id"), sale_timestamp: form.get("sale_timestamp"), resource_name: "sale", subscription_id: r.sub.id, url_params: ref(userId) })
  const res = await h.deliver(json, { contentType: "application/json" })
  assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
  assert.equal((await row(r.sub.id)).user_id, userId)
  const bad = await h.deliver(JSON.stringify({ sale_id: h.fake.charge(r.sub).id, resource_name: "sale", subscription_id: "other" }), { contentType: "application/json" })
  assert.equal(bad.status, 400)
})

// ── D57 유예 · 권한 서버 검사(provider gumroad) ────────────

test("D57 past_due 유예(Gumroad): failed_at 부터 7일은 유료 기능 유지 → 지나면 403(무료 기능·데이터 그대로) → 회복하면 허용 · 0 이면 바로 막음", async () => {
  const { userId, subId } = await subscribed()
  const began = new Date(Date.now() - 3 * DAY)
  h.fake.mutate(subId, (s) => {
    s.status = "pending_failure"
    s.failed_at = began.toISOString()
  })
  assert.equal((await h.deliver(h.fake.subscriptionPing(subId, "subscription_updated", { effective_as_of: stamp() }))).body.kind, "processed")
  const r = await row(subId)
  assert.equal(r.status, "past_due")
  assert.equal(new Date(r.past_due_since).getTime(), began.getTime(), "시작 시각이 failed_at 이 아니다")
  const graceEnd = new Date(began.getTime() + 7 * DAY).toISOString()
  const at = (ms) => ({ db: h.d, plans: PLANS, freeEntitlements: ["projects"], now: () => new Date(began.getTime() + ms) })
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(0)), { planId: "pro", graceEndsAt: graceEnd })
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(7 * DAY - 1)), { planId: "pro", graceEndsAt: graceEnd })
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", at(7 * DAY)), (e) => e instanceof EntitlementError && e.status === 403)
  assert.deepEqual(await requireEntitlement({ userId }, "projects", at(8 * DAY)), { planId: null })
  assert.equal((await row(subId)).status, "past_due", "유예가 끝나도 데이터는 그대로다")
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", { ...at(0), pastDueGraceMs: 0 }), (e) => e.status === 403)
  const sub = await h.base.port({ userId }).subscription()
  assert.equal(sub.data.graceEndsAt, graceEnd)
  // 로그인 안 함 401
  await assert.rejects(requireEntitlement(null, "reports.advanced", at(0)), (e) => e.status === 401)
  // 회복
  h.fake.mutate(subId, (s) => {
    s.status = "alive"
    s.failed_at = null
  })
  await h.deliver(h.fake.subscriptionPing(subId, "subscription_restarted", { restarted_at: stamp() }))
  assert.equal((await row(subId)).past_due_since, null)
  assert.deepEqual(await requireEntitlement({ userId }, "reports.advanced", at(30 * DAY)), { planId: "pro" })
})

test("권한 서버 검사는 gumroad 행만 본다: 무료 사용자 403, 요금제 권한표 밖 기능 403, 다른 공급자 행은 권한이 아니다", async () => {
  const free = await h.newUser()
  const opts = { db: h.d, plans: PLANS, freeEntitlements: ["projects"] }
  assert.deepEqual(await requireEntitlement({ userId: free }, "projects", opts), { planId: null })
  await assert.rejects(requireEntitlement({ userId: free }, "reports.advanced", opts), (e) => e.status === 403)
  const { userId } = await subscribed({ productId: "prod_basic" })
  assert.deepEqual(await requireEntitlement({ userId }, "projects", opts), { planId: "basic" })
  await assert.rejects(requireEntitlement({ userId }, "reports.advanced", opts), (e) => e.status === 403)
  // paddle 표기 행은 gumroad 검사에서 보이지 않는다
  const paddleUser = await h.newUser()
  await h.d.execute(sql`insert into subscriptions (provider, provider_sub_id, user_id, plan_id, status, updated_from_event_at) values ('paddle', ${"sub_" + paddleUser}, ${paddleUser}, 'pro', 'active', now())`)
  await assert.rejects(requireEntitlement({ userId: paddleUser }, "reports.advanced", opts), (e) => e.status === 403)
})

// ── D93 메일 ──────────────────────────────────────────

test("D93 Gumroad(MoR)가 영수증·해지 메일을 보낸다: 기본 설정에서 우리 메일은 0통", async () => {
  const before = h.sent.length
  const { subId } = await subscribed()
  await h.deliver(h.fake.requestCancel(subId, new Date(Date.now() + 9 * DAY)))
  assert.equal(h.sent.length, before, "기본 설정인데 우리가 메일을 보냈다")
})

test("D93 sendBillingEmails: true — 주문 확인(order:<판매>)과 해지 확인이 각 한 번, 재전송·뒤따른 알림에 다시 안 보낸다", async () => {
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const { r, subId } = await subscribed({ billing })
  assert.equal(sentFor("orderConfirmation", r.sale.id).length, 1)
  assert.equal(sentFor("orderConfirmation", r.sale.id)[0].idempotencyKey, `order:${r.sale.id}`)
  const cancelPing = h.fake.requestCancel(subId, new Date(Date.now() + 9 * DAY))
  await h.deliver(cancelPing, undefined, billing)
  assert.equal(sentFor("cancellation", subId).length, 1)
  await h.deliver(cancelPing, undefined, billing)
  // 해지 뒤 갱신 청구: 새 주문 확인 한 통, 해지 메일은 그대로
  const charge = h.fake.charge(h.fake.get(subId))
  await h.deliver(h.fake.salePing(charge), undefined, billing)
  assert.equal(sentFor("cancellation", subId).length, 1)
  assert.equal(sentFor("orderConfirmation", charge.id).length, 1)
})

// ── 포트: 체크아웃 · 지원 안 함 ─────────────────────────

test("checkout: 상품 링크에 wanted·주기·이메일·서명된 lf_ref 를 붙이고, 체험 상품·계획 검사·이미 구독 중 거절을 따른다", async () => {
  const userId = await h.newUser()
  const p = h.base.port({ userId, email: "buyer@example.test" })
  const ok = await p.checkout({ planId: "pro" })
  assert.equal(ok.ok, true)
  const u = new URL(ok.data.redirectUrl)
  assert.equal(u.origin + u.pathname, "https://seller.gumroad.com/l/pro-trial", "체험이 있는 요금제는 기본이 체험 상품")
  assert.equal(u.searchParams.get("wanted"), "true")
  assert.equal(u.searchParams.get("monthly"), "true")
  assert.equal(u.searchParams.get("email"), "buyer@example.test")
  assert.equal(verifyRef(TEST_PING_SECRET, u.searchParams.get("lf_ref"), new Date()), userId)
  const noTrial = new URL((await p.checkout({ planId: "pro", trial: false })).data.redirectUrl)
  assert.equal(noTrial.pathname, "/l/pro")
  const yearly = new URL((await p.checkout({ planId: "team" })).data.redirectUrl)
  assert.equal(yearly.searchParams.get("yearly"), "true")
  assert.equal(yearly.searchParams.get("monthly"), null)
  assert.equal((await p.checkout({ planId: "basic", trial: true })).code, "trial_unavailable")
  assert.equal((await p.checkout({ planId: "nope" })).code, "unknown_plan")
  assert.equal((await h.make({ pingSecret: "" }).port({ userId }).checkout({ planId: "basic" })).code, "checkout_unavailable")
  const { userId: subscribedUser } = await subscribed()
  assert.equal((await h.base.port({ userId: subscribedUser }).checkout({ planId: "basic" })).code, "already_subscribed")
})

test("API 가 없는 동작은 흉내 내지 않고 provider_unsupported 로 끝난다(manageUrl 이 있으면 함께) · 모르는 제안은 unknown_offer", async () => {
  const userId = await h.newUser()
  const p = h.make({ manageUrl: "https://app.gumroad.com/library", retentionOffers: [{ id: "conf-pause-1m", kind: "pause", pauseMonths: 1 }] }).port({ userId })
  const calls = h.fake.calls.length
  const args = { changePlan: [{ planId: "basic", when: "now" }], cancel: [{ when: "period_end" }], pause: [{ until: "2026-12-01" }], resume: [], updatePaymentMethod: [], acceptPriceChange: [], applyRetentionOffer: [{ offerId: "conf-pause-1m" }] }
  assert.deepEqual(Object.keys(args).sort(), [...UNSUPPORTED_METHODS].sort())
  for (const m of UNSUPPORTED_METHODS) {
    const res = await p[m](...args[m])
    assert.equal(res.ok, false, m)
    assert.equal(res.code, PROVIDER_UNSUPPORTED, m)
    assert.equal(res.manageUrl, "https://app.gumroad.com/library", m)
  }
  assert.equal((await p.applyRetentionOffer({ offerId: "made-up" })).code, "unknown_offer")
  assert.equal(h.fake.calls.length, calls, "지원 안 함인데 Gumroad 를 불렀다")
  const bare = await h.base.port({ userId }).cancel({ when: "now" })
  assert.equal(bare.code, PROVIDER_UNSUPPORTED)
  assert.equal("manageUrl" in bare, false)
})

test("요금제 설정 검사: 상품 없음·체험 길이·중복 상품·체험 없는데 체험 상품을 거절한다", () => {
  const good = PLANS[0]
  assert.doesNotThrow(() => validateGumroadConfig(PLANS))
  assert.throws(() => validateGumroadConfig([{ ...good, gumroad: { ...good.gumroad, productId: "" } }]), /productId/)
  assert.throws(() => validateGumroadConfig([{ ...PLANS[1], trialDays: 14 }]), /7 days or one month/)
  assert.throws(() => validateGumroadConfig([{ ...PLANS[1], gumroad: { productId: "prod_pro", url: "https://s.gumroad.com/l/x" } }]), /trialProductId/)
  assert.throws(() => validateGumroadConfig([good, { ...PLANS[2], gumroad: { ...PLANS[2].gumroad, productId: "prod_basic" } }]), /belongs to both/)
  assert.throws(() => validateGumroadConfig([{ ...good, gumroad: { ...good.gumroad, url: "http://insecure" } }]), /https/)
  assert.throws(() => validateGumroadConfig([{ ...good, interval: "once" }]), /memberships only/)
})

// ── 재조회(정기 대조) ───────────────────────────────────

test("resync·reconcile: 알림을 놓친 변경(해지 예약)을 API 재조회로 따라잡는다 · 실패한 구독은 세고 나머지는 계속한다", async () => {
  const a = await subscribed()
  const b = await subscribed()
  h.fake.mutate(a.subId, (s) => {
    s.status = "pending_cancellation"
    s.cancelled_at = new Date(Date.now() + 4 * DAY).toISOString()
  })
  const out = await h.base.resync(a.subId)
  assert.equal(out.status, "active")
  assert.ok(out.cancelAt)
  h.fake.mutate(b.subId, (s) => {
    s.status = "cancelled"
    s.cancelled_at = new Date(Date.now() - DAY).toISOString()
  })
  const rec = await h.base.reconcile()
  assert.ok(rec.checked >= 2)
  assert.equal(rec.failed, 0)
  assert.equal((await row(b.subId)).status, "canceled")
  // 재조회 실패는 실패로 센다
  h.fake.failNext = 500
  const rec2 = await h.base.reconcile()
  assert.ok(rec2.failed >= 1)
  assert.equal(await h.base.resync("does-not-exist").then(() => "ok", (e) => e.code ?? e.name), "not_found")
})

test("모르는 구독 상태(문서의 7개 밖)는 조용히 넘기지 않고 처리 실패(500)로 끝난다 — 이벤트 id 도 남지 않는다", async () => {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: ref(userId) })
  h.fake.mutate(r.sub.id, (s) => {
    s.status = "some_new_status"
  })
  const before = await h.snapshot()
  const res = await h.deliver(r.ping)
  assert.equal(res.status, 500)
  assert.equal(await h.snapshot(), before)
})

test("ref 는 Gumroad 로 보내는 URL 값이라 사용자 id 가 그대로 노출되지 않는 길이·형식이다(base64url, 512자 이하)", () => {
  const v = signRef(TEST_PING_SECRET, "user_abc", new Date())
  assert.match(v, /^[A-Za-z0-9_-]+\.[0-9a-z]+\.[A-Za-z0-9_-]+$/)
  assert.ok(v.length < 512)
})
