// Solapi 서명·메시지 모양·응답 해석. 기대 서명은 시험에서 node:crypto 로 직접 계산한다.
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { authHeader, buildMessage, newSalt, scrub, SOLAPI_ENDPOINT, sendSolapi, smsType } from "../src/solapi.ts"

const KEY = "NCSTESTKEY0123456789"
const SECRET = "test-secret-do-not-use-0123456789abcdef"
const NOW = new Date("2026-10-22T03:00:00.000Z")
const SALT = "0123456789abcdef0123456789abcdef"

test("authHeader: HMAC-SHA256(secret, date+salt) hex · 머리 모양", () => {
  const expected = createHmac("sha256", SECRET).update("2026-10-22T03:00:00.000Z" + SALT).digest("hex")
  assert.equal(authHeader(KEY, SECRET, NOW, SALT), `HMAC-SHA256 apiKey=${KEY}, date=2026-10-22T03:00:00.000Z, salt=${SALT}, signature=${expected}`)
  // 입력이 하나라도 바뀌면 서명이 바뀐다
  assert.notEqual(authHeader(KEY, SECRET, NOW, SALT), authHeader(KEY, `${SECRET}x`, NOW, SALT))
  assert.notEqual(authHeader(KEY, SECRET, NOW, SALT), authHeader(KEY, SECRET, new Date(NOW.getTime() + 1), SALT))
  assert.notEqual(authHeader(KEY, SECRET, NOW, SALT), authHeader(KEY, SECRET, NOW, SALT.replace("0", "1")))
})

test("newSalt: 32자 16진수, 매번 다르다", () => {
  assert.match(newSalt(), /^[0-9a-f]{32}$/)
  assert.notEqual(newSalt(), newSalt())
})

const ata = (over = {}) => ({
  kind: "ata", to: "01012345678", from: "0212345678", pfId: "KA01PF-test", templateId: "KA01TP-test",
  requiredVars: ["service", "when"], vars: { service: "상담", when: "내일" }, text: "대체 문자", ...over,
})

test("buildMessage(알림톡): ATA + kakaoOptions, 변수 키는 #{} 로 감싼다", () => {
  const r = buildMessage(ata({ disableSms: true }))
  assert.deepEqual(r, {
    ok: true,
    message: {
      to: "01012345678", from: "0212345678", type: "ATA", text: "대체 문자",
      kakaoOptions: { pfId: "KA01PF-test", templateId: "KA01TP-test", variables: { "#{service}": "상담", "#{when}": "내일" }, disableSms: true },
    },
  })
  // 이미 감싼 키는 다시 감싸지 않고, disableSms 기본은 false(문자 대체 허용)
  const w = buildMessage(ata({ vars: { "#{service}": "a", when: "b" } }))
  assert.deepEqual(Object.keys(w.message.kakaoOptions.variables), ["#{service}", "#{when}"])
  assert.equal(w.message.kakaoOptions.disableSms, false)
})

test("buildMessage(알림톡): 요구한 변수가 빠지면 보내기 전에 거절 — 사유에 값이 없다", () => {
  assert.deepEqual(buildMessage(ata({ vars: { service: "상담" } })), { ok: false, reason: "missing_vars:when" })
  assert.deepEqual(buildMessage(ata({ vars: { service: "  ", when: "" } })), { ok: false, reason: "missing_vars:service,when" })
  assert.deepEqual(buildMessage(ata({ vars: {} })), { ok: false, reason: "missing_vars:service,when" })
})

test("buildMessage(문자): 90바이트 이하는 SMS, 넘으면 LMS · 빈 본문은 거절", () => {
  assert.equal(smsType("a".repeat(90)), "SMS")
  assert.equal(smsType("a".repeat(91)), "LMS")
  assert.equal(smsType("가".repeat(45)), "SMS")
  assert.equal(smsType("가".repeat(46)), "LMS")
  assert.deepEqual(buildMessage({ kind: "sms", to: "01012345678", from: "0212345678", text: "안녕" }), { ok: true, message: { to: "01012345678", from: "0212345678", type: "SMS", text: "안녕" } })
  assert.equal(buildMessage({ kind: "sms", to: "x", from: "y", text: "가".repeat(60) }).message.type, "LMS")
  assert.deepEqual(buildMessage({ kind: "sms", to: "x", from: "y", text: "  " }), { ok: false, reason: "empty_text" })
})

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const GOOD = { failedMessageList: [], groupInfo: { groupId: "G4V-test-group" } }
const MSG = { to: "01012345678", from: "0212345678", type: "SMS", text: "hi" }

test("sendSolapi: 요청 모양(주소·머리·본문) 과 성공 응답 → providerRef", async () => {
  const calls = []
  const fetchFn = async (url, init) => (calls.push({ url, init }), json(200, GOOD))
  const r = await sendSolapi(fetchFn, { apiKey: KEY, apiSecret: SECRET }, [MSG], { now: NOW, salt: SALT })
  assert.deepEqual(r, { ok: true, providerRef: "G4V-test-group" })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, SOLAPI_ENDPOINT)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.headers.Authorization, authHeader(KEY, SECRET, NOW, SALT))
  assert.deepEqual(JSON.parse(calls[0].init.body), { messages: [MSG] })
})

test("sendSolapi: 접수 실패(failedMessageList) · 비 2xx · 네트워크 오류 · 깨진 응답은 던지지 않고 값", async () => {
  const send = (fetchFn) => sendSolapi(fetchFn, { apiKey: KEY, apiSecret: SECRET }, [MSG])
  const rejected = await send(async () => json(200, { failedMessageList: [{ to: "01012345678", statusCode: "3059", statusMessage: "수신번호 오류 01012345678" }], groupInfo: { groupId: "G" } }))
  assert.equal(rejected.ok, false)
  assert.match(rejected.reason, /^rejected:3059:/)
  assert.ok(!rejected.reason.includes("01012345678"), "전화 전체가 오류에 없다")
  const unauthorized = await send(async () => json(401, { errorCode: "InvalidApiKey", errorMessage: `API Key(${KEY}) 오류` }))
  assert.equal(unauthorized.ok, false)
  assert.match(unauthorized.reason, /^http_401:InvalidApiKey/)
  assert.ok(!unauthorized.reason.includes(KEY))
  const serverError = await send(async () => new Response("<html>502</html>", { status: 502 }))
  assert.deepEqual(serverError, { ok: false, reason: "http_502" })
  const down = await send(async () => { throw new TypeError(`fetch failed ${KEY} ${SECRET}`) })
  assert.deepEqual(down, { ok: false, reason: "network_error:TypeError" })
  assert.deepEqual(await send(async () => json(200, { nope: true })), { ok: false, reason: "bad_response" })
  assert.deepEqual(await send(async () => new Response("not json", { status: 200 })), { ok: false, reason: "bad_response" })
})

test("scrub: 키·비밀키·전화·이메일을 가리고 길이를 줄인다", () => {
  const out = scrub(`키 ${KEY} 비밀 ${SECRET} 전화 010-1234-5678 01099998888 메일 a@example.com ${"x".repeat(300)}`, [KEY, SECRET])
  for (const bad of [KEY, SECRET, "1234-5678", "01099998888", "a@example.com"]) assert.ok(!out.includes(bad), bad)
  assert.ok(out.length <= 161)
})
