import { test } from "node:test"
import assert from "node:assert/strict"
import { gunzipSync } from "node:zlib"
import { createServerAnalytics, disabledServerAnalytics } from "../src/server.ts"
import { DECIDED, fakePostHogNode } from "./fakes.mjs"

const ATTR = { blockId: "pricing-3tier", recipeId: "r1-measure", copyVariant: "a", experiment: { key: "hero-cta", arm: "control" } }
const CONSENTED = { analytics: true, marketing: false, decidedAt: DECIDED }

test("서버: 동의가 없으면(undefined·unset·false) 0건, 동의면 captureImmediate 로 wf_* 와 함께 보낸다", async () => {
  const node = fakePostHogNode()
  const server = createServerAnalytics({ projectKey: "phc_test", region: "us", client: node })
  for (const consent of [undefined, { analytics: false, marketing: false }, { analytics: false, marketing: true, decidedAt: DECIDED }]) {
    server.forRequest({ distinctId: "user_1", consent }).track("checkout_complete", { planId: "pro", amount: 2900, currency: "USD" }, { attribution: ATTR })
  }
  await server.flush()
  assert.equal(node.captured.length, 0)
  server.forRequest({ distinctId: "user_1", consent: CONSENTED }).track("checkout_complete", { planId: "pro", amount: 2900, currency: "USD" }, { attribution: ATTR })
  await server.flush()
  assert.deepEqual(node.captured, [
    {
      distinctId: "user_1",
      event: "checkout_complete",
      disableGeoip: true,
      properties: { planId: "pro", amount: 2900, currency: "USD", wf_block: "pricing-3tier", wf_recipe: "r1-measure", wf_copy: "a", wf_experiment: "hero-cta:control" },
    },
  ])
})

test("서버: 개인정보 모양 props 거부, distinctId 에 이메일 금지, 보내기 실패는 던지지 않고 onError", async () => {
  const rejected = []
  const errors = []
  const failing = { captureImmediate: async () => Promise.reject(new Error("network")), shutdown: async () => {} }
  const server = createServerAnalytics({ projectKey: "phc_test", region: "eu", client: failing, onReject: (r) => rejected.push(r), onError: (e) => errors.push(e) })
  const port = server.forRequest({ distinctId: "user_2", consent: CONSENTED })
  port.track("form_submit", { form: "contact", email: "a@b.io" })
  port.track("form_submit", { form: "contact" })
  await server.flush()
  assert.equal(rejected.length, 1)
  assert.equal(errors.length, 1)
  assert.throws(() => server.forRequest({ distinctId: "kim@example.com", consent: CONSENTED }), /email/)
  assert.throws(() => server.forRequest({ distinctId: " ", consent: CONSENTED }), /distinctId/)
})

test("서버: 철회(setConsent false) 뒤에는 보내지 않고, shutdown 은 남은 것을 기다린 뒤 닫는다", async () => {
  const node = fakePostHogNode()
  const saved = []
  const server = createServerAnalytics({ projectKey: "phc_test", region: "us", client: node, now: () => new Date(DECIDED) })
  const port = server.forRequest({ distinctId: "user_3", consent: CONSENTED, onConsentChange: (c) => saved.push(c) })
  port.track("resume", {})
  port.setConsent({ analytics: false, marketing: false })
  port.track("resume", {})
  await server.shutdown()
  assert.equal(node.captured.length, 1)
  assert.equal(node.shut, true)
  assert.deepEqual(saved, [{ analytics: false, marketing: false, decidedAt: DECIDED }])
})

// 실제 posthog-node 5.54.1 을 네트워크 없이: fetch 를 녹화 응답으로 바꿔 끼우고, SDK 가 만든 요청을 본다.
// 응답 본문 {"status":"Ok"} 은 목이다(실제 PostHog 응답과 대조하지 않았다 — O5 키가 생기면 Task 12 에서 한 번 실호출로 확인).
test("서버(실제 posthog-node + 녹화 응답): EU 호스트로, 프로젝트 키·이벤트·wf_* 속성을 싣고 보낸다", async () => {
  const requests = []
  const recordedFetch = async (url, options) => {
    let body = options.body
    if (typeof body !== "string") {
      const buf = Buffer.from(await new Response(body).arrayBuffer())
      body = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8")
    }
    requests.push({ url, method: options.method, body: JSON.parse(body) })
    return { status: 200, text: async () => '{"status":"Ok"}', json: async () => ({ status: "Ok" }) }
  }
  const server = createServerAnalytics({ projectKey: "phc_recorded_test", host: "https://eu.i.posthog.com", fetch: recordedFetch })
  assert.equal(server.region.region, "eu")
  server.forRequest({ distinctId: "user_9", consent: undefined }).track("login", { method: "google" }) // 동의 없음 → 요청 없음
  server.forRequest({ distinctId: "user_9", consent: CONSENTED }).track("login", { method: "google" }, { attribution: { blockId: "auth-card" } })
  await server.shutdown()
  assert.equal(requests.length, 1, JSON.stringify(requests.map((r) => r.url)))
  const [req] = requests
  assert.ok(req.url.startsWith("https://eu.i.posthog.com/"), req.url)
  assert.equal(req.method, "POST")
  const s = JSON.stringify(req.body)
  assert.ok(s.includes("phc_recorded_test"), "프로젝트 키가 있어야 한다")
  const events = req.body.batch ?? [req.body]
  const login = events.find((e) => e.event === "login")
  assert.ok(login, s)
  assert.equal(login.distinct_id, "user_9")
  assert.equal(login.properties.method, "google")
  assert.equal(login.properties.wf_block, "auth-card")
  assert.equal(login.properties.$geoip_disable, true)
})

test("서버(LFOBS): 꺼진 계측은 같은 모양이지만 동의가 있어도 아무것도 보내지 않고 던지지 않는다", async () => {
  const off = disabledServerAnalytics()
  assert.equal(off.enabled, false)
  assert.equal(off.region, null)
  const port = off.forRequest({ distinctId: "user_1", consent: CONSENTED })
  assert.doesNotThrow(() => port.track("checkout_complete", { planId: "pro", amount: 2900, currency: "USD" }, { attribution: ATTR }))
  assert.deepEqual(port.consent(), { analytics: false, marketing: false }, "저장된 동의가 true 여도 꺼진 계측은 항상 결정 전으로 읽힌다")
  port.setConsent({ analytics: true, marketing: true })
  assert.equal(port.consent().analytics, false)
  await Promise.all([port.flush(), off.flush(), off.shutdown()])
  // 양성 대조군: 켜진 어댑터는 enabled true 이고 지역이 있다
  const on = createServerAnalytics({ projectKey: "phc_test", region: "eu", client: fakePostHogNode() })
  assert.equal(on.enabled, true)
  assert.equal(on.region.region, "eu")
})
