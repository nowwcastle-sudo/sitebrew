// web-factory 결제 적합성 묶음(billingConformance)을 Paddle 어댑터에 돌리는 실행기. conformance.test.mjs 와 scripts/conformance-all.mjs 가 같이 쓴다.
// make(setup)는 검사마다 새 사용자와 그 장면의 Paddle 구독(가짜 Paddle — 진짜 SDK 가 부르는 HTTP)을 만들고, 서명된 subscription.created 웹훅을
// 우리 처리기로 보내 DB 에 싣는다. 체크아웃은 호스팅 결제창 주소만 돌려주므로, 가짜 Paddle 이 결제 완료 웹훅을 보내 subscription() 이 새 구독을 보이게 한다.
import assert from "node:assert/strict"
import { confirmedBillingActions } from "@launch-factory/consent"
import { applySubscriptionState } from "@launch-factory/db"
import { CD } from "../src/index.ts"
import { DAY, setup } from "./harness.mjs"

/** 묶음이 돌려야 하는 검사 수(web-factory v0.0.12 기준 — v0.0.10 의 40개에서 44개로: requireConfirmation 을 켜서 `billing.confirmation.*` 4개(change-plan·cancel·apply-retention-offer·accept-price-change)가 늘었다). 0건·모자란 통과를 통과로 읽지 않으려는 못이다 */
export const PADDLE_PINS = { total: 44, expectedFailures: {} }

/** @param {{ mod: { billingConformance: Function } }} loaded */
export async function runPaddleConformance(loaded) {
  const h = await setup()
  try {
    /** 장면 하나를 가진 구독을 만든다 */
    async function seedScenario(userId, sub) {
      if (sub === "none") return
      if (sub === "expired") {
        // Paddle 구독 상태에 expired 는 없다(active·canceled·past_due·paused·trialing). DB 는 다른 공급자를 위해 받으므로 저장소에서 바로 읽는 길만 본다.
        await applySubscriptionState(h.d, { provider: "paddle", providerSubId: `sub_expired_${userId}`, userId, status: "expired", planId: "pro", currentPeriodEnd: new Date(Date.now() - DAY), updatedFromEventAt: new Date() })
        return
      }
      const customData = { [CD.userId]: userId }
      let status = sub
      if (sub === "pending-price-change") status = "active"
      const s = h.fake.seed({ status, priceId: status === "trialing" ? "pri_pro_trial" : "pri_pro", customData })
      if (sub === "pending-price-change") {
        const effectiveAt = s.current_billing_period.ends_at
        const change = {
          priceId: "pri_pro_2027",
          kind: "price_increase",
          from: { amount: 2900, currency: "USD", vatIncluded: false },
          to: { amount: 3300, currency: "USD", vatIncluded: false },
          effectiveAt,
          consentBy: new Date(Date.parse(effectiveAt) - 7 * DAY).toISOString(),
        }
        h.fake.mutate(s.id, (x) => {
          x.custom_data = { ...customData, [CD.pendingPriceChange]: change }
        })
      }
      const r = await h.deliver(h.fake.envelope("subscription.created", h.fake.get(s.id)))
      assert.equal(r.status, 200, JSON.stringify(r.body))
    }
    const make = async ({ sub, retentionOffers }) => {
      const userId = await h.newUser()
      const billing = h.make({ retentionOffers }) // 한도를 넘는 대안이면 여기서 던진다(묶음이 「만들 때 거절」로 받는다)
      await seedScenario(userId, sub)
      const port = billing.port({ userId })
      // LFPIN11: 승인 행동 넷(요금제 변경·해지·해지 대안·가격 변경 동의)은 서버 입구가 `confirmed: true` 를 요구한다 — 입구를 거친 포트를 묶음에 준다(requireConfirmation)
      return { ...port, ...confirmedBillingActions(port) }
    }
    const results = await loaded.mod.billingConformance(make, { timeoutMs: 8_000, requireConfirmation: true })
    return { adapter: "billing-paddle", suite: "billingConformance", results, pins: PADDLE_PINS }
  } finally {
    await h.close()
  }
}
