// 구독 입력 검사 표 — 통과 한 줄 + 칸마다 거절 갈래.
import { test } from "node:test"
import assert from "node:assert/strict"
import { validateSubscription } from "../src/index.ts"
import { makeSub } from "./fixtures.mjs"

test("올바른 구독은 평평한 값으로 통과한다(expirationTime 없음 → null)", () => {
  const sub = makeSub()
  delete sub.expirationTime
  const r = validateSubscription(sub)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, expirationTime: null })
})

test("expirationTime: 0 이상의 정수 또는 null 만", () => {
  assert.equal(validateSubscription(makeSub({ expirationTime: 1_900_000_000_000 })).value.expirationTime, 1_900_000_000_000)
  assert.equal(validateSubscription(makeSub({ expirationTime: null })).ok, true)
  for (const bad of [-1, 1.5, NaN, Infinity, "123", {}]) {
    const r = validateSubscription(makeSub({ expirationTime: bad }))
    assert.equal(r.ok, false, String(bad))
    assert.ok(r.fieldErrors.expirationTime?.length, String(bad))
  }
})

const cases = [
  ["http 주소", (s) => ({ ...s, endpoint: "http://fcm.googleapis.com/fcm/send/x" }), "endpoint"],
  ["주소 아님", (s) => ({ ...s, endpoint: "not a url" }), "endpoint"],
  ["빈 문자열", (s) => ({ ...s, endpoint: "" }), "endpoint"],
  ["숫자", (s) => ({ ...s, endpoint: 5 }), "endpoint"],
  ["너무 긺", (s) => ({ ...s, endpoint: `https://push.example.com/${"a".repeat(2100)}` }), "endpoint"],
  ["localhost", (s) => ({ ...s, endpoint: "https://localhost/push" }), "endpoint"],
  ["단일 라벨 호스트", (s) => ({ ...s, endpoint: "https://intranet/push" }), "endpoint"],
  ["IPv4 직접", (s) => ({ ...s, endpoint: "https://169.254.169.254/latest" }), "endpoint"],
  ["IPv6 직접", (s) => ({ ...s, endpoint: "https://[::1]/push" }), "endpoint"],
  [".internal", (s) => ({ ...s, endpoint: "https://db.internal/push" }), "endpoint"],
  ["사용자 정보", (s) => ({ ...s, endpoint: "https://user:pw@push.example.com/x" }), "endpoint"],
  ["443 아닌 포트", (s) => ({ ...s, endpoint: "https://push.example.com:8443/x" }), "endpoint"],
  ["p256dh 짧음", (s) => ({ ...s, keys: { ...s.keys, p256dh: "AAAA" } }), "p256dh"],
  ["p256dh base64url 아님", (s) => ({ ...s, keys: { ...s.keys, p256dh: `${"A".repeat(86)}+` } }), "p256dh"],
  ["p256dh 패딩", (s) => ({ ...s, keys: { ...s.keys, p256dh: `${s.keys.p256dh}=` } }), "p256dh"],
  ["p256dh 비압축 아님", (s) => ({ ...s, keys: { ...s.keys, p256dh: `A${s.keys.p256dh.slice(1)}` } }), "p256dh"],
  ["auth 길이 다름", (s) => ({ ...s, keys: { ...s.keys, auth: "A".repeat(30) } }), "auth"],
  ["auth 문자 아님", (s) => ({ ...s, keys: { ...s.keys, auth: "!".repeat(22) } }), "auth"],
  ["keys 없음", (s) => ({ endpoint: s.endpoint }), "keys"],
]
for (const [name, mutate, field] of cases) {
  test(`거절: ${name}`, () => {
    const r = validateSubscription(mutate(makeSub()))
    assert.equal(r.ok, false)
    const key = field === "keys" ? Object.keys(r.fieldErrors)[0] : field
    assert.ok(r.fieldErrors[key]?.length > 0, JSON.stringify(r.fieldErrors))
  })
}

test("객체가 아니면 거절하고, 영어 문구도 있다", () => {
  for (const bad of [null, undefined, "x", 3, []]) assert.equal(validateSubscription(bad).ok, false)
  const ko = validateSubscription({ ...makeSub(), endpoint: "http://x.example.com" }, "ko")
  const en = validateSubscription({ ...makeSub(), endpoint: "http://x.example.com" }, "en")
  assert.notDeepEqual(ko.fieldErrors, en.fieldErrors)
  assert.match(en.fieldErrors.endpoint[0], /https/)
})

test("모르는 칸은 버려진다", () => {
  const r = validateSubscription({ ...makeSub(), extra: "x", keys: { ...makeSub().keys, junk: 1 } })
  assert.equal(r.ok, true)
  assert.deepEqual(Object.keys(r.value).sort(), ["auth", "endpoint", "expirationTime", "p256dh"])
})
