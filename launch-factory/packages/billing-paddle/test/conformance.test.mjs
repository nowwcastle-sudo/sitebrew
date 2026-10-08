// web-factory 결제 적합성 묶음(billingConformance, p3-3)을 Paddle 어댑터에 돌린다(J3). 7상태 + 가격 변경 + 체험 갈래 + 해지 대안 한도.
// make(setup)는 검사마다 새 사용자와 그 장면의 Paddle 구독(가짜 Paddle — 진짜 SDK 가 부르는 HTTP)을 만들고, 서명된 subscription.created 웹훅을
// 우리 처리기로 보내 DB 에 싣는다. 체크아웃은 호스팅 결제창 주소만 돌려주므로, 가짜 Paddle 이 결제 완료 웹훅을 보내 subscription() 이 새 구독을 보이게 한다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { retentionOfferIssues } from "../src/index.ts"
import { PADDLE_PINS, runPaddleConformance } from "./conformance-run.mjs"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"

const wf = await loadWfConformance()
const skip = wf.skip ?? false
const loaded = { mod: wf.billing, lib: wf.retention }
if (!skip) {
  console.log(`# billingConformance: web-factory @ ${wf.commit}`)
  process.on("exit", () => wf.cleanup())
}

test("적합성: billingConformance — Paddle 어댑터(진짜 SDK + 가짜 Paddle HTTP + PGlite)", { skip, timeout: 120_000 }, async () => {
  const { results } = await runPaddleConformance(loaded)
  const failed = results.filter((r) => !r.ok)
  const ids = results.map((r) => r.id)
  // 무엇이 돌았는지 수로 확인한다(0건 통과를 통과로 읽지 않는다)
  assert.equal(results.length, PADDLE_PINS.total)
  assert.equal(ids.filter((id) => id.startsWith("billing.state.")).length, 8, "상태 7개 + 가격 변경 장면")
  assert.equal(ids.filter((id) => id.startsWith("billing.trial.")).length, 5, "체험 표(켬·끔·기본 둘·trial_unavailable)")
  assert.equal(ids.filter((id) => id.startsWith("billing.price-change.")).length, 3)
  assert.equal(ids.filter((id) => id.startsWith("billing.retention.")).length, 10)
  assert.ok(ids.includes("billing.trial.trial-unavailable"))
  assert.deepEqual(failed, [], `실패 ${failed.length}/${results.length}`)
  console.log(`# billingConformance: ${results.length}개 검사 · 통과 ${results.length - failed.length} · 실패 ${failed.length}`)
})

test("해지 대안 한도: 우리 retentionOfferIssues 가 web-factory 원본과 같은 판정(통과·거절)을 낸다", { skip }, () => {
  const cases = [
    { id: "a", kind: "discount", discount: { percent: 30, months: 3 } },
    { id: "b", kind: "discount", discount: { percent: 30, months: 2 } },
    { id: "c", kind: "discount", discount: { percent: 31, months: 2 } },
    { id: "d", kind: "discount", discount: { percent: 0, months: 2 } },
    { id: "e", kind: "discount", discount: { percent: 10.5, months: 2 } },
    { id: "f", kind: "discount", discount: { percent: 10, months: 1 } },
    { id: "g", kind: "discount", discount: { percent: 10, months: 4 } },
    { id: "h", kind: "discount" },
    { id: "i", kind: "pause", pauseMonths: 1 },
    { id: "j", kind: "pause", pauseMonths: 0 },
    { id: "k", kind: "pause" },
    { id: "l", kind: "downgrade", planId: "basic" },
    { id: "m", kind: "downgrade" },
    { id: "", kind: "pause", pauseMonths: 2 },
    { id: "n", kind: "refund" },
  ]
  for (const c of cases) {
    const theirs = loaded.lib.retentionOfferIssues(c).length
    const ours = retentionOfferIssues(c).length
    assert.equal(ours, theirs, `${JSON.stringify(c)}: 우리 ${ours}건 · web-factory ${theirs}건`)
  }
  // 양성 대조: 판정이 실제로 갈린다
  assert.equal(retentionOfferIssues(cases[0]).length, 0)
  assert.ok(retentionOfferIssues(cases[2]).length > 0)
})
