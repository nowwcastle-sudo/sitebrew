// 알림 페이로드: 검사 · 같은 출처 경로 · UTF-8 바이트 한도 · 직렬화.
import { test } from "node:test"
import assert from "node:assert/strict"
import { PAYLOAD_MAX_BYTES, isSameOriginPath, preparePayload } from "../src/index.ts"

test("최소 페이로드: 제목만", () => {
  const r = preparePayload({ title: "예약이 확정됐어요" })
  assert.equal(r.ok, true)
  assert.equal(r.value.json, JSON.stringify({ title: "예약이 확정됐어요" }))
  assert.equal(r.value.bytes, Buffer.byteLength(r.value.json))
})

test("전체 칸 + 모르는 칸은 버리고 알려진 칸만 직렬화", () => {
  const r = preparePayload({ title: " 안내 ", body: "내일 10시", url: "/bookings?ref=B-1#top", tag: "booking:B-1", icon: "/icon-192.png", secret: "x", requireInteraction: true })
  assert.equal(r.ok, true)
  assert.deepEqual(JSON.parse(r.value.json), { title: "안내", body: "내일 10시", url: "/bookings?ref=B-1#top", tag: "booking:B-1", icon: "/icon-192.png" })
})

test("같은 출처 경로만: 바깥으로 닿는 모양은 모두 거절", () => {
  for (const ok of ["/", "/a", "/a/b?x=1#y", "/한글/경로"]) assert.equal(isSameOriginPath(ok), true, ok)
  for (const bad of ["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "\\\\evil", "javascript:alert(1)", "a/b", "", "/a\nb", "/a\\b", "/a\u0000b", "data:text/html,x", "/" + "a".repeat(1100)]) {
    assert.equal(isSameOriginPath(bad), false, JSON.stringify(bad))
    assert.equal(preparePayload({ title: "t", url: bad }).ok, false, `url ${JSON.stringify(bad)}`)
    assert.equal(preparePayload({ title: "t", icon: bad }).ok, false, `icon ${JSON.stringify(bad)}`)
  }
})

test("칸 검사: 제목 필수·길이·제어 문자, 태그 모양", () => {
  assert.ok(preparePayload({}).fieldErrors.title)
  assert.ok(preparePayload({ title: "   " }).fieldErrors.title)
  assert.ok(preparePayload({ title: "가".repeat(121) }).fieldErrors.title)
  assert.ok(preparePayload({ title: "a\nb" }).fieldErrors.title)
  assert.ok(preparePayload({ title: "t", body: "x".repeat(1001) }).fieldErrors.body)
  assert.equal(preparePayload({ title: "t", body: "줄\n바꿈" }).ok, true)
  assert.ok(preparePayload({ title: "t", tag: "a b" }).fieldErrors.tag)
  assert.ok(preparePayload({ title: "t", tag: "" }).fieldErrors.tag)
  for (const bad of [null, "x", 1, undefined]) assert.equal(preparePayload(bad).ok, false)
  assert.match(preparePayload({}, "en").fieldErrors.title[0], /title/i)
})

test("크기 한도는 글자 수가 아니라 UTF-8 바이트다: 한글 1000자(3000바이트)는 통과, 거기에 URL 을 더해 3500 을 넘으면 거절", () => {
  const body = "가".repeat(1000)
  const ok = preparePayload({ title: "제목", body })
  assert.equal(ok.ok, true)
  assert.ok(ok.value.bytes > 3000 && ok.value.bytes <= PAYLOAD_MAX_BYTES)
  // 글자 수로는 한도(3500) 아래지만 바이트로는 넘는다
  const over = preparePayload({ title: "가".repeat(120), body, url: `/${"가".repeat(300)}` })
  assert.equal(over.ok, false)
  assert.ok(over.fieldErrors.payload?.length)
})

test("한도 경계: 정확히 3500 바이트는 통과, 3501 은 거절", () => {
  // body 는 1000자(한글 3000바이트)까지라, 나머지 바이트는 url 의 ASCII 로 맞춘다
  const body = "가".repeat(1000)
  const fixed = Buffer.byteLength(JSON.stringify({ title: "t", body, url: "/" }))
  const urlAt = (extra) => `/${"a".repeat(extra)}`
  const remaining = PAYLOAD_MAX_BYTES - fixed
  const exact = preparePayload({ title: "t", body, url: urlAt(remaining) })
  assert.equal(exact.ok, true)
  assert.equal(exact.value.bytes, PAYLOAD_MAX_BYTES)
  assert.equal(preparePayload({ title: "t", body, url: urlAt(remaining + 1) }).ok, false)
})
