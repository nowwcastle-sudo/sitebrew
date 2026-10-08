// QFIX3-LAYOUT — 머리글 행동 폴백(Task 6.3 4차). brand·public 은 가입·예약 전환이 없어 primaryCta 문구 칸이 없고, 머리글 행동도 비었다 →
//   brand-cta-nav(주 행동이 2.5화면째)·public-contact-services(연락처가 푸터 3화면째)가 걸렸다. 연락 길이 콘텐츠에 있으면 머리글에 하나 둔다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindableContent, headerContactActionOf, SHELL_ACTION_MAX, validatedContent } from '../stamp/gen-pages.mjs'
import { vatStatusOf } from '../stamp/site-bind.mjs'
import { brand1, goldenRequest } from './lib/stamp-structure-fixtures.mjs'

const brand = (o = {}) => ({ archetype: 'brand', organization: { name: '솔결', email: 'hi@solgyeol.kr', phone: '063-123-4567', ...o } })
const pub = (o = {}) => ({ archetype: 'public', agency: { name: '해오름구립도서관', mainPhone: '02-1234-5678', ...o }, facts: { email: 'lib@haeoreum.kr' } })

test('brand: 쓸 수 있는 메일이 있으면 「문의하기」 → mailto(영어는 Contact), 메일이 없으면 전화, 둘 다 없으면 행동 없음', () => {
  assert.deepEqual(headerContactActionOf(brand(), 'ko'), { label: '문의하기', href: { $ref: 'organization.email', as: 'mailto' } })
  assert.equal(headerContactActionOf(brand(), 'en').label, 'Contact')
  assert.deepEqual(headerContactActionOf(brand({ email: '확인 필요' }), 'ko'), { label: '전화 문의', href: { $ref: 'organization.phone', as: 'tel' } })
  assert.equal(headerContactActionOf(brand({ email: undefined, phone: undefined }), 'ko'), null)
  assert.equal(headerContactActionOf(brand({ email: '확인 필요', phone: '확인 필요' }), 'ko'), null)
})

test('public: 대표 전화가 있으면 번호가 글자인 tel 링크, 없으면 메일 → 「문의하기」', () => {
  assert.deepEqual(headerContactActionOf(pub(), 'ko'), { label: { $ref: 'agency.mainPhone' }, href: { $ref: 'agency.mainPhone', as: 'tel' } })
  assert.deepEqual(headerContactActionOf(pub({ mainPhone: undefined }), 'ko'), { label: '문의하기', href: { $ref: 'facts.email', as: 'mailto' } })
})

test('B6: 대표 전화가 머리글 행동 상한(14자)을 넘으면 짧은 문구로 — href 는 그 번호의 tel 링크 그대로, 영어는 Call us', () => {
  const long = '+82-2-1234-5678 (내선 120)'
  assert.ok([...long].length > SHELL_ACTION_MAX)
  assert.deepEqual(headerContactActionOf(pub({ mainPhone: long }), 'ko'), { label: '전화 문의', href: { $ref: 'agency.mainPhone', as: 'tel' } })
  assert.equal(headerContactActionOf(pub({ mainPhone: long }), 'en').label, 'Call us')
  assert.deepEqual(headerContactActionOf(pub({ mainPhone: '02-1234-5678' }), 'ko').label, { $ref: 'agency.mainPhone' }, '상한 안이면 번호가 글자(양성 대조)')
})

// FINAL-WF B5: 엄격 검사를 통과한 콘텐츠는 스키마가 봉투 칸 facts 를 떼어 낸다 → vatStatusOf·headerContactActionOf 의 facts 갈래가 죽었다. 실제 골든(brand-1)으로 확인한다.
test('B5: 엄격 경로(brand-1)에서 validatedContent 는 facts 를 버리지만 bindableContent 가 되살린다 — facts 로 읽는 부가세·연락 갈래가 산다', () => {
  const { request } = goldenRequest('brand-1')
  const raw = { ...brand1(request), facts: { ...request.facts, price: '월 9,900원 (부가세 포함)' } }
  const v = validatedContent(raw, request)
  assert.equal(v.strict, true, 'brand-1 은 엄격 경로다')
  assert.equal(v.content.facts, undefined, '확인: 스키마가 facts 를 떼어 낸다')
  assert.equal(vatStatusOf(v.content), null, '버려진 content 로는 부가세 갈래가 죽는다(음성 대조)')
  const { content, factsRestored } = bindableContent(v, raw)
  assert.equal(factsRestored, true)
  assert.deepEqual(content.facts, raw.facts)
  assert.equal(vatStatusOf(content), 'included')
  // 엄격이 아닌 경로·facts 없는 콘텐츠는 그대로
  assert.equal(bindableContent({ strict: false, content: { facts: { a: 1 } } }, { facts: { a: 1 } }).factsRestored, false)
  assert.equal(bindableContent(v, { ...raw, facts: undefined }).factsRestored, false)
})

test('다른 원형은 폴백이 없다(출력이 글자 하나 안 바뀐다)', () => {
  for (const archetype of ['saas', 'landing', 'commerce', 'detail', 'local', 'portfolio', 'dashboard', 'pwa']) {
    assert.equal(headerContactActionOf({ archetype, organization: { email: 'a@b.kr' }, business: { email: 'a@b.kr', phone: '02-1234-5678' } }, 'ko'), null, archetype)
  }
})
