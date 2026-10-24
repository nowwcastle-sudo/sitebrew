// 서명 링크(순수) — 확인 링크는 7일·신청 한 번에 묶이고, 수신거부 링크는 만료가 없다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { signToken } from "@launch-factory/security/signed-token"
import { CONFIRM_VALID_DAYS, NEWSLETTER_LINK_PATHS, confirmToken, newsletterLinks, readConfirmToken, readUnsubscribeToken, unsubscribeToken } from "../src/tokens.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const ID = "0b6f1c1e-7a52-4a43-9c7e-0f3e5a1b2c3d"
const consentAt = new Date("2026-10-01T00:00:00.000Z")
const day = 86_400_000

test("확인 토큰: 구독자 id 와 신청 시각을 싣고, 7일 안에서만 열린다", () => {
  assert.equal(CONFIRM_VALID_DAYS, 7)
  const token = confirmToken({ id: ID, consentAt }, SECRET, consentAt)
  assert.deepEqual(readConfirmToken(token, SECRET, new Date(consentAt.getTime() + 6 * day)), { id: ID, consentAt })
  assert.equal(readConfirmToken(token, SECRET, new Date(consentAt.getTime() + 7 * day + 1000)), null, "7일이 지나면 닫힌다")
})

test("수신거부 토큰: 만료가 없다 — 몇 년 지난 메일의 링크도 열린다", () => {
  const token = unsubscribeToken(ID, SECRET)
  assert.equal(readUnsubscribeToken(token, SECRET), ID)
  assert.equal(JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()).exp, undefined)
})

test("용도가 다른 토큰·다른 비밀·깨진 값은 통하지 않는다 — 수신거부 토큰으로 구독을 확인할 수 없다", () => {
  const unsub = unsubscribeToken(ID, SECRET)
  const confirm = confirmToken({ id: ID, consentAt }, SECRET, consentAt)
  assert.equal(readConfirmToken(unsub, SECRET, consentAt), null)
  assert.equal(readUnsubscribeToken(confirm, SECRET), null)
  assert.equal(readUnsubscribeToken(unsub, `${SECRET}-other`), null)
  // 마케팅 수신거부 토큰(@launch-factory/consent)과도 섞이지 않는다
  assert.equal(readUnsubscribeToken(signToken({ u: ID, c: "email" }, { secret: SECRET, purpose: "marketing-unsubscribe" }), SECRET), null)
  for (const bad of [undefined, "", "abc", `${unsub}x`, 5]) assert.equal(readUnsubscribeToken(bad, SECRET), null, String(bad))
  // 본문 모양이 틀린 서명 토큰(id 가 문자열이 아님)
  assert.equal(readUnsubscribeToken(signToken({ s: 7 }, { secret: SECRET, purpose: "newsletter-unsubscribe" }), SECRET), null)
  assert.equal(readConfirmToken(signToken({ s: ID }, { secret: SECRET, purpose: "newsletter-confirm" }), SECRET, consentAt), null, "신청 시각이 없는 확인 토큰")
})

test("newsletterLinks: 앱 주소 끝 슬래시를 정리해 두 주소를 만든다 — 토큰에 이메일 주소가 없다", () => {
  const l = newsletterLinks({ baseUrl: "https://sampleco.test/", secret: SECRET, id: ID, consentAt, now: consentAt })
  assert.ok(l.confirmUrl.startsWith(`https://sampleco.test${NEWSLETTER_LINK_PATHS.confirm}?t=`))
  assert.ok(l.unsubscribeUrl.startsWith(`https://sampleco.test${NEWSLETTER_LINK_PATHS.unsubscribe}?t=`))
  const t = (u) => new URL(u).searchParams.get("t")
  assert.equal(readConfirmToken(t(l.confirmUrl), SECRET, consentAt)?.id, ID)
  assert.equal(readUnsubscribeToken(t(l.unsubscribeUrl), SECRET), ID)
  const body = Buffer.from(t(l.confirmUrl).split(".")[0], "base64url").toString()
  assert.ok(!body.includes("@"), "본문에 이메일 주소 없음")
})
