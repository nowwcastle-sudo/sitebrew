// web-factory 결제 적합성 묶음(billingConformance)을 Gumroad 어댑터에 돌리는 실행기. conformance.test.mjs 와 scripts/conformance-all.mjs 가 같이 쓴다.
// 묶음에는 「지원 안 함」 갈래가 없다(대장 D160 — A52 묶음에 요청). 그래서 지원하는 부분은 통과를, API 가 없는 부분은
// 정해진 이유(provider_unsupported · scenario_unsupported)로 실패하는지를 **정확한 목록으로** 단언한다. 목록 밖 실패·목록 안 통과는 모두 실패다.
// make 는 검사마다 새 사용자와 그 장면의 Gumroad 구독(가짜 Gumroad)을 만들고 판매 알림을 처리기로 보낸다. 체크아웃은 상품 링크만 돌려주므로
// 묶음 주석대로 「결제를 끝낸 뒤 subscription() 이 새 구독을 보이게」 포트를 감싼다(손님이 링크로 결제 → 가짜 Gumroad 판매 알림).
import assert from "node:assert/strict"
import { signRef } from "../src/index.ts"
import { DAY, setup } from "./harness.mjs"
import { TEST_PING_SECRET } from "./fake-gumroad.mjs"

/** Gumroad 에서 만들 수 없는 장면(일시정지·가격 변경 동의가 Gumroad 에 없다) */
export const UNSUPPORTED_SCENARIOS = ["paused", "pending-price-change"]

/** 지원 안 함으로 실패해야 하는 검사와 그 이유(보고서 표와 같다) */
export const EXPECTED_FAILURES = {
  "billing.state.paused": "scenario_unsupported",
  "billing.state.pending-price-change": "scenario_unsupported",
  "billing.cancel.trialing.period-end": "provider_unsupported",
  "billing.cancel.trialing.now": "provider_unsupported",
  "billing.cancel.active.period-end": "provider_unsupported",
  "billing.cancel.active.now": "provider_unsupported",
  "billing.cancel.past_due.period-end": "provider_unsupported",
  "billing.cancel.past_due.now": "provider_unsupported",
  "billing.cancel.paused.period-end": "scenario_unsupported",
  "billing.cancel.paused.now": "scenario_unsupported",
  "billing.cancel.pending-price-change.period-end": "scenario_unsupported",
  "billing.cancel.pending-price-change.now": "scenario_unsupported",
  "billing.cancel.parity.trial-signup": "provider_unsupported",
  "billing.cancel.parity.paid-signup": "provider_unsupported",
  "billing.price-change.shape": "scenario_unsupported",
  "billing.price-change.accept": "scenario_unsupported",
  "billing.retention.apply.conf-pause-1m": "provider_unsupported",
  "billing.retention.apply.conf-downgrade": "provider_unsupported",
  "billing.retention.apply.conf-discount-30-3m": "provider_unsupported",
  "billing.retention.apply.conf-discount-10-2m": "provider_unsupported",
}

/** Paddle 과 같은 40개가 돌아야 한다 */
export const GUMROAD_PINS = { total: 40, expectedFailures: EXPECTED_FAILURES }

const STATUS_OF = {
  past_due: { status: "pending_failure", failed_at: () => new Date(Date.now() - DAY).toISOString() },
  canceled: { status: "cancelled", cancelled_at: () => new Date(Date.now() - DAY).toISOString() },
  expired: { status: "fixed_subscription_period_ended", ended_at: () => new Date(Date.now() - DAY).toISOString() },
}

/** @param {{ mod: { billingConformance: Function } }} loaded */
export async function runGumroadConformance(loaded) {
  const h = await setup()
  try {
    async function seedScenario(userId, sub, billing) {
      if (sub === "none") return
      if (UNSUPPORTED_SCENARIOS.includes(sub)) throw new Error(`scenario_unsupported: Gumroad has no ${sub} state`)
      const r = h.fake.purchase({ productId: sub === "trialing" ? "prod_pro_trial" : "prod_pro", trial: sub === "trialing", urlParams: { lf_ref: signRef(TEST_PING_SECRET, userId, new Date()) } })
      const change = STATUS_OF[sub]
      if (change) h.fake.mutate(r.sub.id, (s) => Object.assign(s, Object.fromEntries(Object.entries(change).map(([k, v]) => [k, typeof v === "function" ? v() : v]))))
      const res = await h.deliver(r.ping, undefined, billing)
      assert.equal(res.status, 200, JSON.stringify(res.body))
      assert.equal(res.body.kind, "processed", JSON.stringify(res.body))
    }
    const make = async ({ sub, retentionOffers }) => {
      const userId = await h.newUser()
      const billing = h.make({ retentionOffers }) // 한도를 넘는 대안이면 여기서 던진다
      await seedScenario(userId, sub, billing)
      const port = billing.port({ userId })
      return {
        ...port,
        async checkout(input) {
          const r = await port.checkout(input)
          if (r.ok) await h.completeCheckout(r.data.redirectUrl, billing)
          return r
        },
      }
    }
    const results = await loaded.mod.billingConformance(make, { timeoutMs: 8_000 })
    return { adapter: "billing-gumroad", suite: "billingConformance", results, pins: GUMROAD_PINS }
  } finally {
    await h.close()
  }
}
