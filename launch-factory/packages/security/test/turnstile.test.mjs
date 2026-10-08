// 봇 방어(Turnstile)와 차단 결과 모양 — v0 Task 15. 네트워크 없이 녹화 응답(turnstile-fixtures.mjs)으로 돈다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { EnvError, loadAppEnv } from "@launch-factory/env"
import { MESSAGES } from "@launch-factory/i18n"
import { createTurnstile, SITEVERIFY_URL, TurnstileConfigError, TURNSTILE_CSP, TURNSTILE_FIELD } from "../src/turnstile.ts"
import { createNonce, securityHeaders } from "../src/index.ts"
import { blockedResponse, blockedResult } from "../src/protect.ts"
import { DUMMY_TOKEN, fakeSiteverify, RECORDED, TEST_SECRET_PASS } from "./turnstile-fixtures.mjs"

test("mock 모드는 키 없이 통과한다 — 토큰이 없어도(키가 없을 때의 개발 흐름)", async () => {
  const ts = createTurnstile({ mode: "mock" })
  assert.equal(ts.mode, "mock")
  for (const token of [undefined, "", "anything"]) assert.deepEqual(await ts.verify({ token }), { ok: true, mode: "mock" })
  assert.equal(TURNSTILE_FIELD, "cf-turnstile-response")
})

test("CSP: 위젯 출처를 securityHeaders 에 더하면 script-src·frame-src 에 들어간다", () => {
  const csp = securityHeaders(createNonce(), { extend: TURNSTILE_CSP }).get("content-security-policy")
  assert.match(csp, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/)
  assert.match(csp, /frame-src [^;]*https:\/\/challenges\.cloudflare\.com/)
  // 양성 대조: 더하지 않으면 frame-src 'none'
  assert.match(securityHeaders(createNonce()).get("content-security-policy"), /frame-src 'none'/)
})

test("live 모드는 키가 없으면 만들 때 설정 오류다 — 환경 검증도 TURNSTILE_SECRET_KEY 를 빠진 이름으로 알린다(O7)", () => {
  assert.throws(() => createTurnstile({ mode: "live" }), TurnstileConfigError)
  assert.throws(() => createTurnstile({ mode: "live", secretKey: "" }), /TURNSTILE_SECRET_KEY/)
  assert.throws(() => loadAppEnv({ LF_MODE: "live" }), (e) => e instanceof EnvError && e.missing.includes("TURNSTILE_SECRET_KEY"))
  // mock 이면 없어도 켜진다
  assert.equal(loadAppEnv({ LF_MODE: "mock" }).LF_MODE, "mock")
})

test("live: 토큰이 없으면 Cloudflare 를 부르지 않고 invalid, 틀린·재사용 토큰은 녹화 응답대로 invalid, 맞으면 통과", async () => {
  const cf = fakeSiteverify({ spent: RECORDED.duplicate })
  const ts = createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch })
  for (const token of [undefined, null, "", "   "]) assert.deepEqual(await ts.verify({ token }), { ok: false, reason: "invalid", errorCodes: ["missing-input-response"] })
  assert.deepEqual(await ts.verify({ token: "x".repeat(2049) }), { ok: false, reason: "invalid", errorCodes: ["invalid-input-response"] })
  assert.equal(cf.calls.length, 0)

  assert.deepEqual(await ts.verify({ token: "forged" }), { ok: false, reason: "invalid", errorCodes: ["invalid-input-response"] })
  assert.deepEqual(await ts.verify({ token: "spent" }), { ok: false, reason: "invalid", errorCodes: ["timeout-or-duplicate"] })
  const key = "0f8e6a52-2b4c-4d1e-9a7b-3c5d6e7f8a9b"
  assert.deepEqual(await ts.verify({ token: DUMMY_TOKEN, remoteIp: "203.0.113.7", idempotencyKey: key }), { ok: true, mode: "live", hostname: "example.com", action: "login" })

  const last = cf.calls.at(-1)
  assert.equal(last.url, SITEVERIFY_URL)
  assert.equal(last.method, "POST")
  assert.deepEqual([...last.body.keys()].sort(), ["idempotency_key", "remoteip", "response", "secret"])
  assert.equal(last.body.get("remoteip"), "203.0.113.7")
  assert.equal(last.body.get("idempotency_key"), key)
  // UUID 가 아닌 키는 보내지 않는다(Cloudflare 는 UUID 를 받는다)
  await ts.verify({ token: DUMMY_TOKEN, idempotencyKey: "not-a-uuid-key" })
  assert.equal(cf.calls.at(-1).body.has("idempotency_key"), false)
})

test("live: hostname·action 확인(공식 권고), 설정 오류·Cloudflare 장애는 방문자 탓이 아니라 unavailable", async () => {
  const cf = fakeSiteverify({ badsecret: RECORDED.badSecret, internal: RECORDED.internal, net: "network", http: 502 })
  const strict = createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch, expectedHostnames: ["sampleco.test"] })
  assert.deepEqual(await strict.verify({ token: DUMMY_TOKEN }), { ok: false, reason: "invalid", errorCodes: ["hostname-mismatch"] })
  const okHost = createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch, expectedHostnames: ["example.com"], expectedAction: "signup" })
  assert.deepEqual(await okHost.verify({ token: DUMMY_TOKEN }), { ok: false, reason: "invalid", errorCodes: ["action-mismatch"] })

  const ts = createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch })
  assert.equal((await ts.verify({ token: "badsecret" })).reason, "unavailable")
  assert.equal((await ts.verify({ token: "internal" })).reason, "unavailable")
  assert.deepEqual(await ts.verify({ token: "net" }), { ok: false, reason: "unavailable", errorCodes: ["network-error"] })
  assert.deepEqual(await ts.verify({ token: "http" }), { ok: false, reason: "unavailable", errorCodes: ["http-502"] })
})

test("차단 모양: 한도 초과 429 + Retry-After, 봇 확인 실패 400, 확인 불가 503 — 서버 액션은 code·retryAfter(D104)", async () => {
  const rate = blockedResponse({ kind: "rate_limited", retryAfter: 42 }, "ko")
  assert.equal(rate.status, 429)
  assert.equal(rate.headers.get("retry-after"), "42")
  assert.deepEqual(await rate.json(), { ok: false, code: "rate_limited", retryAfter: 42, retryable: true, formError: "요청이 너무 많아요. 42초 뒤에 다시 해 주세요." })

  const bad = blockedResponse({ kind: "bot", result: { ok: false, reason: "invalid", errorCodes: ["invalid-input-response"] } })
  assert.equal(bad.status, 400)
  assert.equal(bad.headers.get("retry-after"), null)
  assert.deepEqual(await bad.json(), { ok: false, code: "bot_check_failed", retryable: true, formError: MESSAGES.en.protect.botCheckFailed })
  assert.equal(blockedResponse({ kind: "bot", result: { ok: false, reason: "unavailable", errorCodes: ["network-error"] } }).status, 503)
  assert.equal(blockedResult({ kind: "bot", result: { ok: false, reason: "unavailable", errorCodes: [] } }, "ko").formError, MESSAGES.ko.protect.botCheckUnavailable)
})
