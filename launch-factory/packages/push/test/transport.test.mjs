// 전송기: 실제 web-push 래퍼는 가짜 sendNotification 을 주입해 시험한다(네트워크 0). 오류는 값이 되고 비밀은 나가지 않는다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { recordingTransport, safeMessage, webPushTransport } from "../src/index.ts"
import { makeSub, makeVapid } from "./fixtures.mjs"

const target = () => {
  const s = makeSub()
  return { endpoint: s.endpoint, keys: s.keys }
}

test("webPushTransport: 옵션(TTL·urgency·timeout·vapidDetails)을 web-push 모양으로 넘기고 성공은 { ok: true }", async () => {
  const vapid = makeVapid()
  const seen = []
  const send = async (sub, payload, options) => (seen.push({ sub, payload, options }), { statusCode: 201 })
  const transport = webPushTransport(vapid, { sendNotification: send })
  const sub = target()
  assert.deepEqual(await transport(sub, '{"title":"t"}'), { ok: true })
  assert.deepEqual(seen[0].sub, sub)
  assert.equal(seen[0].payload, '{"title":"t"}')
  assert.deepEqual(seen[0].options, { TTL: 86400, urgency: "normal", timeout: 10000, vapidDetails: vapid })
  await transport(sub, "{}", { ttlSeconds: 60, urgency: "high", timeoutMs: 500 })
  assert.deepEqual({ ...seen[1].options, vapidDetails: undefined }, { TTL: 60, urgency: "high", timeout: 500, vapidDetails: undefined })
})

test("webPushTransport: 던진 오류를 값으로 — statusCode 가 있으면 담고, 없으면 담지 않는다", async () => {
  const vapid = makeVapid()
  const gone = Object.assign(new Error("Received unexpected response code"), { statusCode: 410, body: "gone", headers: {} })
  const t1 = webPushTransport(vapid, { sendNotification: async () => { throw gone } })
  assert.deepEqual(await t1(target(), "{}"), { ok: false, statusCode: 410, message: "Received unexpected response code" })
  const t2 = webPushTransport(vapid, { sendNotification: async () => { throw new Error("socket hang up") } })
  const r2 = await t2(target(), "{}")
  assert.equal(r2.ok, false)
  assert.equal("statusCode" in r2, false)
  const t3 = webPushTransport(vapid, { sendNotification: async () => { throw "문자열 오류" } })
  assert.equal((await t3(target(), "{}")).ok, false)
})

test("webPushTransport: 오류 메시지에 개인키·이메일·토큰이 나가지 않는다", async () => {
  const vapid = makeVapid()
  const leaky = new Error(`bad key ${vapid.privateKey} for ops@example.com Bearer abc.def.ghi ${"x".repeat(500)}`)
  const transport = webPushTransport(vapid, { sendNotification: async () => { throw leaky } })
  const r = await transport(target(), "{}")
  assert.equal(r.ok, false)
  assert.ok(!r.message.includes(vapid.privateKey))
  assert.ok(!r.message.includes("ops@example.com"))
  assert.ok(!r.message.includes("abc.def.ghi"))
  assert.ok(r.message.length <= 200)
  assert.ok(!JSON.stringify(r).includes(vapid.privateKey))
})

test("safeMessage: 비밀 목록·개인정보 가림·길이 제한, 빈 값은 기본 문구", () => {
  assert.equal(safeMessage(new Error("a SECRET b"), ["SECRET"]), "a [redacted] b")
  assert.equal(safeMessage(new Error("   ")), "send failed")
  assert.equal(safeMessage(undefined), "send failed")
})

test("webPushTransport: 실제 web-push 를 불러 오는 기본 경로 — 잘못된 키는 던지지 않고 값이 된다(네트워크 0)", async () => {
  // 구독 키가 모양만 맞는 가짜라 암호화 이전 단계(주소 검사)에서 실패한다 — 어떤 경우에도 던지면 안 된다
  const transport = webPushTransport(makeVapid())
  const r = await transport({ endpoint: "not-a-url", keys: { p256dh: "x", auth: "y" } }, "{}", { timeoutMs: 100 })
  assert.equal(r.ok, false)
  assert.equal(typeof r.message, "string")
})

test("recordingTransport: 전송 없이 기록만(키는 담지 않는다) · clear", async () => {
  const rec = recordingTransport()
  const sub = target()
  assert.deepEqual(await rec(sub, '{"title":"t"}', { urgency: "low" }), { ok: true })
  assert.deepEqual(rec.sent, [{ endpoint: sub.endpoint, payload: '{"title":"t"}', opts: { urgency: "low" } }])
  assert.ok(!JSON.stringify(rec.sent).includes(sub.keys.auth))
  rec.clear()
  assert.equal(rec.sent.length, 0)
})
