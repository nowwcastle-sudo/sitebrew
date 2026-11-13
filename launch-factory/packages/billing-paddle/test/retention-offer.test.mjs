// 해지 대안 적용 — 서버가 적격 대안을 정하고(화면이 보인 첫 대안), 구독·대안별 사용을 원자적으로 예약해 반복을 막는다(CWE-841).
// 가짜 Paddle(진짜 SDK 가 부르는 HTTP) + PGlite. 공급자 호출이 실패하면 예약을 풀어 정상 고객이 다시 받는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { CD, eligibleRetentionOffer } from "../src/index.ts"
import { PLANS, setup } from "./harness.mjs"

let h
before(async () => {
  h = await setup()
})
after(async () => {
  await h?.close()
})

const PAUSE = { id: "pause-1m", kind: "pause", pauseMonths: 1 }
const DISCOUNT_10 = { id: "discount-10-2m", kind: "discount", discount: { percent: 10, months: 2 } }
const DISCOUNT_30 = { id: "discount-30-3m", kind: "discount", discount: { percent: 30, months: 3 } }

/** 사용자 하나와 그 사용자의 Paddle 구독(웹훅으로 DB 에 실음) → 그 사용자의 결제 포트 */
async function portWith(retentionOffers, makeOver = {}) {
  const userId = await h.newUser()
  const s = h.fake.seed({ status: "active", priceId: "pri_pro", customData: { [CD.userId]: userId } })
  const r = await h.deliver(h.fake.envelope("subscription.created", s))
  assert.equal(r.status, 200)
  return { port: h.make({ retentionOffers, ...makeOver }).port({ userId }), subId: s.id, userId }
}
const uses = async (subId) => ((await h.d.execute(sql`select offer_id, applied_at from retention_offer_uses where provider_sub_id = ${subId} order by offer_id`)).rows ?? []).map((r) => [r.offer_id, r.applied_at !== null])

test("숨은 대안: 화면이 보이지 않는 설정상의 다른 대안 id 를 직접 제출하면 거절되고 공급자는 부르지 않는다", async () => {
  // 화면은 일시정지(첫 적격 대안)만 보인다 — 할인 id 를 직접 제출한다
  const { port, subId } = await portWith([PAUSE, DISCOUNT_30])
  const before = h.fake.get(subId)
  const r = await port.applyRetentionOffer({ offerId: DISCOUNT_30.id })
  assert.deepEqual([r.ok, r.code], [false, "offer_not_eligible"])
  assert.deepEqual(h.fake.get(subId), before, "공급자 구독은 그대로(할인이 붙지 않았다)")
  assert.deepEqual(await uses(subId), [], "예약도 남지 않는다")
})

test("같은 대안을 두 번 적용할 수 없다: 두 번째부터 offer_already_used 이고 공급자에 할인이 또 만들어지지 않는다", async () => {
  const { port, subId } = await portWith([DISCOUNT_10])
  const first = await port.applyRetentionOffer({ offerId: DISCOUNT_10.id })
  assert.equal(first.ok, true, JSON.stringify(first))
  const afterFirst = JSON.stringify(h.fake.get(subId))
  const again = await port.applyRetentionOffer({ offerId: DISCOUNT_10.id })
  assert.deepEqual([again.ok, again.code], [false, "offer_already_used"])
  assert.equal(JSON.stringify(h.fake.get(subId)), afterFirst)
  assert.deepEqual(await uses(subId), [[DISCOUNT_10.id, true]])
})

test("동시에 두 번 눌러도 한 번만 적용된다(원자적 예약)", async () => {
  const { port, subId } = await portWith([DISCOUNT_10])
  const both = await Promise.all([port.applyRetentionOffer({ offerId: DISCOUNT_10.id }), port.applyRetentionOffer({ offerId: DISCOUNT_10.id })])
  assert.deepEqual(both.map((r) => r.ok).sort(), [false, true])
  assert.equal(both.find((r) => !r.ok).code, "offer_already_used")
  assert.deepEqual(await uses(subId), [[DISCOUNT_10.id, true]])
})

test("정상 선례: 첫 적격 대안은 한 번 적용되고 예약된 해지는 거둬진다", async () => {
  const { port, subId } = await portWith([PAUSE, DISCOUNT_30])
  assert.equal((await port.cancel({ reason: "too_expensive", when: "period_end" })).ok, true)
  const r = await port.applyRetentionOffer({ offerId: PAUSE.id })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.data.status, "paused")
  assert.equal(r.data.cancelAt, undefined)
  assert.deepEqual(await uses(subId), [[PAUSE.id, true]])
})

test("공급자 호출이 실패하면 예약을 풀어 정상 고객이 다시 받을 수 있다", async () => {
  // 할인 만들기가 한 번 실패하는 Paddle 클라이언트
  let failures = 1
  const flaky = new Proxy(h.paddle, {
    get: (target, prop) => (prop === "discounts" ? { create: async (...a) => (failures-- > 0 ? Promise.reject(new Error("boom")) : target.discounts.create(...a)) } : target[prop]),
  })
  const { port, subId } = await portWith([DISCOUNT_10], { paddle: flaky })
  const failed = await port.applyRetentionOffer({ offerId: DISCOUNT_10.id })
  assert.equal(failed.ok, false)
  assert.deepEqual(await uses(subId), [], "실패하면 예약이 풀린다")
  const retry = await port.applyRetentionOffer({ offerId: DISCOUNT_10.id })
  assert.equal(retry.ok, true, JSON.stringify(retry))
  assert.deepEqual(await uses(subId), [[DISCOUNT_10.id, true]])
})

test("eligibleRetentionOffer: 일시정지 → 다운그레이드 → 할인 순 첫 적격 대안. 한도를 넘는 대안·지금보다 비싼 다운그레이드는 건너뛴다", () => {
  const ctx = { planId: "pro", plans: PLANS }
  const over = { id: "over", kind: "discount", discount: { percent: 50, months: 3 } }
  const up = { id: "up", kind: "downgrade", planId: "team" } // team 은 더 비싸다 — 다운그레이드가 아니다
  const down = { id: "down", kind: "downgrade", planId: "basic" }
  assert.equal(eligibleRetentionOffer([DISCOUNT_10, down, PAUSE], ctx)?.id, PAUSE.id)
  assert.equal(eligibleRetentionOffer([over, up, DISCOUNT_10, down], ctx)?.id, "down")
  assert.equal(eligibleRetentionOffer([over, up], ctx), null)
  assert.equal(eligibleRetentionOffer([DISCOUNT_10], { planId: null, plans: PLANS }), null)
})
