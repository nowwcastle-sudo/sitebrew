// web-factory 알림 적합성 묶음(notifyConformance)을 NotifyPort 어댑터(consent/notify)에 돌린다(J3, Task 11).
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"
import { NOTIFY_PINS, runNotifyConformance } from "./conformance-run.mjs"

const loaded = await loadWfConformance()
const skip = loaded.skip ?? false
if (!skip) {
  console.log(`# notifyConformance: web-factory @ ${loaded.commit}`)
  process.on("exit", () => loaded.cleanup())
}

test("적합성: notifyConformance — NotifyPort 어댑터(PGlite)", { skip }, async () => {
  const { results } = await runNotifyConformance({ mod: loaded.notify })
  assert.equal(results.length, NOTIFY_PINS.total, "무엇이 돌았는지 수로 확인한다")
  assert.deepEqual(results.filter((r) => !r.ok), [])
})

// 양성 대조: 사전 선택(기본 켜짐)인 어댑터는 default-false 에서 떨어진다
test("적합성 대조: 정하기 전에 켜져 있는 어댑터는 떨어진다", { skip }, async () => {
  const make = async () => ({
    consents: async () => ({ ok: true, data: { email: true, sms: false, kakao: false, push: false } }),
    setConsents: async () => ({ ok: true, data: { updatedAt: new Date().toISOString() } }),
  })
  const results = await loaded.notify.notifyConformance(make, { timeoutMs: 2_000 })
  assert.ok(results.some((r) => r.id === "notify.consents.default-false" && !r.ok))
})
