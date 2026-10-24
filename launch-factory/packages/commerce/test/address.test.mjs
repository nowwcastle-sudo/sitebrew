// 배송지 검사(address) — 순수. 칸마다 문제 이름을 돌려준다(문구는 포트가 i18n 에서 읽는다).
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAddress } from "../src/address.ts"

const good = { recipient: " 김예시 ", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1", address2: "101호", note: "문 앞에 놓아 주세요" }

test("올바른 배송지: 앞뒤 공백을 자르고 알려진 칸만 남긴다", () => {
  const r = checkAddress({ ...good, extra: "x", __proto__: { admin: true } })
  assert.equal(r.ok, true)
  assert.deepEqual(r.address, { ...good, recipient: "김예시" })
})

test("선택 칸(address2·note)은 비어도 되고 빈 값은 키를 싣지 않는다", () => {
  const r = checkAddress({ ...good, address2: "  ", note: "" })
  assert.equal(r.ok, true)
  assert.equal("address2" in r.address, false)
  assert.equal("note" in r.address, false)
})

test("필수 칸이 비면 칸 이름과 required", () => {
  const r = checkAddress({ recipient: "", phone: "", postcode: "", address1: "" })
  assert.equal(r.ok, false)
  assert.deepEqual(r.fields, { recipient: "required", phone: "required", postcode: "required", address1: "required" })
})

test("문자열이 아닌 값·객체가 아닌 입력은 거절", () => {
  assert.equal(checkAddress(null).ok, false)
  assert.equal(checkAddress("x").ok, false)
  assert.deepEqual(checkAddress({ ...good, recipient: 5 }).fields, { recipient: "required" })
})

test("전화번호: 숫자 8~15개와 + - 공백 ( ) 만", () => {
  assert.equal(checkAddress({ ...good, phone: "+82 10-1234-5678" }).ok, true)
  assert.deepEqual(checkAddress({ ...good, phone: "abc" }).fields, { phone: "invalid" })
  assert.deepEqual(checkAddress({ ...good, phone: "1234" }).fields, { phone: "invalid" })
})

test("우편번호: 3~10자 영숫자·하이픈·공백", () => {
  assert.equal(checkAddress({ ...good, postcode: "SW1A 1AA" }).ok, true)
  assert.deepEqual(checkAddress({ ...good, postcode: "<script>" }).fields, { postcode: "invalid" })
})

test("길이 상한: 받는 사람 60·주소 200·메모 200", () => {
  assert.deepEqual(checkAddress({ ...good, recipient: "가".repeat(61) }).fields, { recipient: "too_long" })
  assert.deepEqual(checkAddress({ ...good, address1: "a".repeat(201) }).fields, { address1: "too_long" })
  assert.deepEqual(checkAddress({ ...good, note: "a".repeat(201) }).fields, { note: "too_long" })
  assert.equal(checkAddress({ ...good, note: "a".repeat(200) }).ok, true)
})
