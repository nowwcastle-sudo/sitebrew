// 금액 계산(pricing) — 소계·배송비·합계. 순수 함수, 최소 단위 정수(원).
import { test } from "node:test"
import assert from "node:assert/strict"
import { defineShipping, totalsOf } from "../src/pricing.ts"

const rule = defineShipping({ fee: 3000, freeOver: 50000 })
const line = (unitAmount, quantity = 1) => ({ unitAmount, quantity })

test("소계는 단가 × 수량의 합, 합계는 소계 + 배송비", () => {
  assert.deepEqual(totalsOf([line(12000, 2), line(8000)], rule), { subtotal: 32000, shipping: 3000, total: 35000 })
})

test("무료 배송 경계: 기준 직전은 배송비, 기준 이상은 무료", () => {
  assert.equal(totalsOf([line(49999)], rule).shipping, 3000)
  assert.equal(totalsOf([line(50000)], rule).shipping, 0)
  assert.equal(totalsOf([line(50001)], rule).shipping, 0)
  assert.equal(totalsOf([line(25000, 2)], rule).total, 50000)
})

test("줄이 없으면 전부 0(배송비도 없다)", () => {
  assert.deepEqual(totalsOf([], rule), { subtotal: 0, shipping: 0, total: 0 })
})

test("freeOver 가 null 이면 무료 배송이 없다", () => {
  const never = defineShipping({ fee: 2500, freeOver: null })
  assert.equal(totalsOf([line(1_000_000)], never).shipping, 2500)
})

test("배송비 0 이면 늘 무료", () => {
  assert.equal(totalsOf([line(100)], defineShipping({ fee: 0, freeOver: null })).shipping, 0)
})

test("설정 검사: 음수·소수·안전하지 않은 정수는 던진다", () => {
  assert.throws(() => defineShipping({ fee: -1, freeOver: null }))
  assert.throws(() => defineShipping({ fee: 100.5, freeOver: null }))
  assert.throws(() => defineShipping({ fee: 100, freeOver: 0 }), /freeOver/)
  assert.throws(() => defineShipping({ fee: 100, freeOver: 1.5 }))
})

test("줄 값 검사: 소수 단가·0 이하 수량은 던진다(계산 입력은 서버 값만이지만 안전하게)", () => {
  assert.throws(() => totalsOf([line(100.5)], rule))
  assert.throws(() => totalsOf([line(100, 0)], rule))
  assert.throws(() => totalsOf([line(100, 1.5)], rule))
})
