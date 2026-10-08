// marketing-gate total-first-screen 의 총액·세금 문구 판정(totalRe)이 영어 표기도 안다(P3-3 Task 14b — 영어 상세페이지 골든이 「VAT included」를 두고도
// 「첫 가격($48.00) 구역에 총액·VAT 문구 없음」으로 떨어졌다). 이 정규식은 브라우저 안에서 도는 코드(page.evaluate)라 밖에서 부를 수 없어, 소스에서 리터럴을 꺼내 시험한다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/marketing-total-en.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = readFileSync(join(root, 'factory', 'qa', 'marketing-gate.mjs'), 'utf8')
const literal = src.match(/const totalRe = (\/.*\/i)\n/)?.[1]
assert.ok(literal, 'marketing-gate.mjs 에서 totalRe 리터럴을 찾지 못했다')
const totalRe = new RegExp(literal.slice(1, literal.lastIndexOf('/')), literal.slice(literal.lastIndexOf('/') + 1))

test('totalRe: 한국어 총액·세금 문구는 예전대로 잡는다', () => {
  for (const t of ['총 결제 금액 9,900원(VAT 포함)', '합계 12,000원', '부가세 별도', '세금 포함 가격']) assert.ok(totalRe.test(t), t)
})

test('totalRe: 영어 총액·세금 문구도 잡는다 — VAT included · incl. VAT · tax extra · total', () => {
  for (const t of ['$48.00 VAT included', 'Price $48.00 incl. VAT', 'including tax', 'excluding VAT', 'VAT is included', 'tax extra', 'Total $53.00']) assert.ok(totalRe.test(t), t)
})

test('totalRe: 세금·총액을 말하지 않는 영어 글은 잡지 않는다(음성 대조)', () => {
  for (const t of ['$48.00', 'Hand-thrown ceramic pour-over dripper', 'Ships within 3 business days', 'Add to cart']) assert.equal(totalRe.test(t), false, t)
})
