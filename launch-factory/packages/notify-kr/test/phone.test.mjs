// 한국 휴대전화 정규화 표.
import assert from "node:assert/strict"
import { test } from "node:test"
import { last4, normalizeKrMobile } from "../src/phone.ts"

const OK = [
  ["010-1234-5678", "01012345678"],
  ["01012345678", "01012345678"],
  ["010 1234 5678", "01012345678"],
  ["010.1234.5678", "01012345678"],
  ["(010) 1234-5678", "01012345678"],
  ["+82 10-1234-5678", "01012345678"],
  ["+821012345678", "01012345678"],
  ["+82 010-1234-5678", "01012345678"], // 0 을 또 쓴 흔한 입력
  ["0082 10 1234 5678", "01012345678"],
  ["  011-234-5678 ", "0112345678"], // 011·016~019 는 10자리 번호도 있다
  ["011-234-5678", "0112345678"],
  ["016-1234-5678", "01612345678"],
]
const BAD = [
  ["", "빈 값"],
  ["02-1234-5678", "서울 지역번호"],
  ["031-123-4567", "경기 지역번호"],
  ["080-123-4567", "수신거부 번호"],
  ["1588-1234", "대표번호"],
  ["010-12-345", "너무 짧음"],
  ["010-123-4567", "010 은 11자리만"],
  ["010-1234-56789", "너무 김"],
  ["+1 415 555 0100", "다른 나라"],
  ["+82 2 1234 5678", "+82 지역번호"],
  ["abc010-1234-5678", "글자 섞임"],
  ["010-1234-5678; drop", "덧붙은 글"],
  ["012-1234-5678", "없는 식별번호"],
]

for (const [input, want] of OK) {
  test(`normalizeKrMobile: ${JSON.stringify(input)} → ${want}`, () => assert.equal(normalizeKrMobile(input), want))
}
for (const [input, why] of BAD) {
  test(`normalizeKrMobile 거절: ${JSON.stringify(input)} (${why})`, () => assert.equal(normalizeKrMobile(input), null))
}
test("normalizeKrMobile: 문자열이 아니면 거절", () => {
  for (const v of [undefined, null, 1012345678, {}, []]) assert.equal(normalizeKrMobile(v), null)
})
test("last4: 끝 4자리", () => {
  assert.equal(last4("01012345678"), "5678")
  assert.equal(last4("0101234567"), "4567")
})
