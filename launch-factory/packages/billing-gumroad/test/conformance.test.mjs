// web-factory 결제 적합성 묶음(billingConformance, p3-3)을 Gumroad 어댑터에 돌린다(J3).
// 묶음에는 「지원 안 함」 갈래가 없다(대장 D160 — A52 묶음에 요청). 그래서 지원하는 부분은 통과를, API 가 없는 부분은
// 정해진 이유(provider_unsupported · scenario_unsupported)로 실패하는지를 **정확한 목록으로** 단언한다. 목록 밖 실패·목록 안 통과는 모두 테스트 실패다.
// make 는 검사마다 새 사용자와 그 장면의 Gumroad 구독(가짜 Gumroad)을 만들고 판매 알림을 처리기로 보낸다. 체크아웃은 상품 링크만 돌려주므로
// 묶음 주석대로 「결제를 끝낸 뒤 subscription() 이 새 구독을 보이게」 포트를 감싼다(손님이 링크로 결제 → 가짜 Gumroad 판매 알림).
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"
import { EXPECTED_FAILURES, GUMROAD_PINS, runGumroadConformance } from "./conformance-run.mjs"

const wf = await loadWfConformance()
const skip = wf.skip ?? false
const loaded = { mod: wf.billing }
if (!skip) {
  console.log(`# billingConformance(gumroad): web-factory @ ${wf.commit}`)
  process.on("exit", () => wf.cleanup())
}

test("적합성: billingConformance — 지원하는 검사는 통과, API 없는 검사는 정해진 code 로만 실패", { skip, timeout: 120_000 }, async () => {
  const { results } = await runGumroadConformance(loaded)
  const ids = results.map((r) => r.id)
  // 무엇이 돌았는지 수로 확인한다(Paddle 과 같은 40개)
  assert.equal(results.length, GUMROAD_PINS.total)
  assert.equal(ids.filter((id) => id.startsWith("billing.state.")).length, 8)
  assert.equal(ids.filter((id) => id.startsWith("billing.trial.")).length, 5)
  const failed = results.filter((r) => !r.ok)
  const unexpected = failed.filter((r) => !(r.id in EXPECTED_FAILURES))
  assert.deepEqual(unexpected, [], "목록 밖 실패")
  const passedButExpected = Object.keys(EXPECTED_FAILURES).filter((id) => results.find((r) => r.id === id)?.ok !== false)
  assert.deepEqual(passedButExpected, [], "지원 안 함인데 통과했거나 돌지 않은 검사")
  for (const r of failed) assert.ok(r.message.includes(EXPECTED_FAILURES[r.id]), `${r.id}: 이유가 ${EXPECTED_FAILURES[r.id]} 가 아니다 — ${r.message}`)
  // 지원하는 핵심은 통과한다
  for (const id of ["billing.plans.trial-pair", "billing.state.none", "billing.state.trialing", "billing.state.active", "billing.state.past_due", "billing.state.canceled", "billing.state.expired", "billing.trial.trial-on", "billing.trial.trial-off", "billing.trial.trial-unavailable", "billing.cancel.none.refused", "billing.price-change.nothing-to-accept", "billing.retention.unknown-offer"]) {
    assert.equal(results.find((r) => r.id === id)?.ok, true, id)
  }
  console.log(`# billingConformance(gumroad): ${results.length}개 검사 · 통과 ${results.length - failed.length} · 지원 안 함 실패 ${failed.length}(예상 ${Object.keys(EXPECTED_FAILURES).length})`)
})
