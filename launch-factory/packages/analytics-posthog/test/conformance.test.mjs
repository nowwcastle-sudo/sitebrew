// web-factory 적합성 묶음(analyticsConformance, p3-3)을 브라우저·서버 어댑터에 돌린다(J3). 결과 { id, ok, message }[] 중 실패가 0이어야 한다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createPostHogAnalytics } from "../src/index.ts"
import { consentOf, fakePostHogJs, toSent } from "./fakes.mjs"
import { ANALYTICS_PINS, makeClient, makeServer } from "./conformance-run.mjs"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"

const wf = await loadWfConformance()
const skip = wf.skip ?? false
const loaded = { mod: wf.analytics }
if (!skip) {
  console.log(`# analyticsConformance: web-factory @ ${wf.commit}`)
  process.on("exit", () => wf.cleanup())
}

function assertAllPass(results, label) {
  const failed = results.filter((r) => !r.ok)
  assert.equal(results.length, ANALYTICS_PINS.total, `${label}: 검사 수가 다르다(${results.length})`)
  assert.deepEqual(failed, [], `${label}: 실패 ${failed.length}/${results.length}`)
  console.log(`# ${label}: ${results.length}개 검사 · 통과 ${results.length - failed.length} · 실패 ${failed.length}`)
}

test("적합성: 브라우저 어댑터(posthog-js 가짜 — SDK 에 넘긴 capture 호출을 되읽음)", { skip }, async () => {
  assertAllPass(await loaded.mod.analyticsConformance(makeClient, { timeoutMs: 2_000 }), "client")
})

test("적합성: 서버 어댑터(posthog-node 가짜 — captureImmediate 호출을 되읽음)", { skip }, async () => {
  assertAllPass(await loaded.mod.analyticsConformance(makeServer, { timeoutMs: 2_000 }), "server")
})

// 양성 대조: 묶음이 실제로 잡는지 — 동의를 무시하는 어댑터는 떨어져야 한다
test("적합성 대조: 동의를 무시하고 보내는 어댑터는 떨어진다", { skip }, async () => {
  const make = ({ consent }) => {
    const ph = fakePostHogJs()
    const port = createPostHogAnalytics({ projectKey: "phc_test", region: "us", consent: consentOf(consent), load: () => ph, location: () => ({}) })
    // 동의 검사를 건너뛰는 망가진 track
    const broken = { ...port, track: (name, props) => ph.capture(name, props) }
    return { port: broken, sent: async () => ph.captures().map((c) => toSent(c.event, c.properties)) }
  }
  const results = await loaded.mod.analyticsConformance(make, { timeoutMs: 2_000 })
  const failedIds = results.filter((r) => !r.ok).map((r) => r.id)
  assert.ok(failedIds.includes("analytics.track.dropped-without-consent"), failedIds.join(", "))
  assert.ok(failedIds.includes("analytics.track.dropped-after-withdrawal"), failedIds.join(", "))
})
