import { test } from "node:test"
import assert from "node:assert/strict"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"
import { judge } from "../../../scripts/lib/judge.mjs"
import { runTossConformance } from "./conformance-run.mjs"

test("공용 BillingPort 적합성 묶음: 지원과 미지원 결과를 분리", { timeout: 120_000 }, async () => {
  const wf = await loadWfConformance()
  assert.ok(!wf.skip, wf.skip)
  try {
    const verdict = judge(await runTossConformance({ mod: wf.billing }))
    assert.equal(verdict.status, "PASS", verdict.problems.join("\n"))
    assert.deepEqual([verdict.total, verdict.passed, verdict.expectedFail], [40, 12, 28])
  } finally {
    wf.cleanup()
  }
})
