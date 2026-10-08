// 서명 링크 토큰: 서명·용도·만료 검사. 양성(맞는 토큰) + 음성(위조·다른 용도·다른 비밀·만료·잘림·잘못된 모양).
import { test } from "node:test"
import assert from "node:assert/strict"
import { signToken, verifyToken } from "../src/signed-token.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const OTHER = "lf-other-secret-not-real-0123456789abcd"
const NOW = new Date("2026-10-03T00:00:00.000Z")

test("맞는 토큰은 본문을 돌려준다(만료 없음 = 오래된 메일의 수신거부 링크도 통한다)", () => {
  const t = signToken({ u: "user_1", c: "email" }, { secret: SECRET, purpose: "unsubscribe" })
  assert.deepEqual(verifyToken(t, { secret: SECRET, purpose: "unsubscribe", now: new Date("2036-01-01") }), { u: "user_1", c: "email" })
})

test("용도·비밀이 다르면 통하지 않는다(수신거부 토큰으로 계정을 지울 수 없다)", () => {
  const t = signToken({ u: "user_1" }, { secret: SECRET, purpose: "unsubscribe" })
  assert.equal(verifyToken(t, { secret: SECRET, purpose: "not-me" }), null)
  assert.equal(verifyToken(t, { secret: OTHER, purpose: "unsubscribe" }), null)
})

test("본문·서명을 고치거나 자르면 통하지 않는다", () => {
  const t = signToken({ u: "user_1", c: "email" }, { secret: SECRET, purpose: "p" })
  const [body, sig] = t.split(".")
  const forged = Buffer.from(JSON.stringify({ u: "user_2", c: "email" })).toString("base64url")
  for (const bad of [`${forged}.${sig}`, `${body}.${sig.slice(0, -2)}`, `${body}.`, `.${sig}`, body, `${t}.x`, "", "a.b.c", `${body}.${sig}A`]) {
    assert.equal(verifyToken(bad, { secret: SECRET, purpose: "p" }), null, bad)
  }
  for (const bad of [undefined, null, 5, {}, "x".repeat(2000)]) assert.equal(verifyToken(bad, { secret: SECRET, purpose: "p" }), null)
})

test("만료: 기한 안에는 통하고, 지나면 통하지 않는다", () => {
  const t = signToken({ u: "user_1" }, { secret: SECRET, purpose: "keep", expiresAt: new Date(NOW.getTime() + 60_000) })
  assert.ok(verifyToken(t, { secret: SECRET, purpose: "keep", now: NOW }))
  assert.equal(verifyToken(t, { secret: SECRET, purpose: "keep", now: new Date(NOW.getTime() + 60_000) }), null)
  assert.equal(verifyToken(t, { secret: SECRET, purpose: "keep", now: new Date(NOW.getTime() + 3_600_000) }), null)
})

test("짧은 비밀·빈 용도는 만들 때 던진다", () => {
  assert.throws(() => signToken({ u: "x" }, { secret: "short", purpose: "p" }), /secret/)
  assert.throws(() => signToken({ u: "x" }, { secret: SECRET, purpose: "" }), /purpose/)
  assert.equal(verifyToken("a.b", { secret: "short", purpose: "p" }), null)
})
