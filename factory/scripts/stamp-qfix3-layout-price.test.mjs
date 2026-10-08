// QFIX3-LAYOUT — 가격 곁 총액·부가세(marketing MUST price-notation·total-first-screen, Task 6.3 4차). 정적 시험(브라우저 없음).
//   ① 부가세 면세: 가격 사실이 「부가세 면세」를 말하면 그 말을 가격 곁에 싣는다(말하지 않으면 짐작하지 않는다 — 면세 여부는 사업자가 안다).
//      게이트의 총액 식이 읽는 글(결제 금액·total)을 같이 든다.
//   ② 히어로 제목에 첫 가격이 있으면(commerce 「상품 + 가격」) 그 구획 안에 총액·부가세 한 줄을 lede 뒤에 붙인다 — 첫 가격 구획에 총액 문구가 없고 배송비가 구획 밖에서 처음 나오던 길.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindSection, ctaTargetOf } from '../stamp/gen-pages.mjs'
import { PRICE_NOTE_UI, PRICE_TEXT, resolveRefs, vatStatusOf } from '../stamp/site-bind.mjs'

test('① vatStatusOf: 면세를 말하면 exempt · 포함·별도와 섞이거나 말이 없으면 null · 「면세점」은 면세가 아니다', () => {
  assert.equal(vatStatusOf({ facts: { menu: '점심 식사 4,500원, 간식 1,500원 (부가세 면세)' } }), 'exempt')
  assert.equal(vatStatusOf({ facts: { price: '월 9,900원 VAT exempt' } }), 'exempt')
  assert.equal(vatStatusOf({ facts: { price: '4,500원 부가세 면세, 일부는 부가세 포함' } }), 'included', 'S1 회귀: 「부가세 포함」과 면세 낱말이 섞이면 포함')
  assert.equal(vatStatusOf({ facts: { price: 'Prices include VAT; VAT-exempt items are marked' } }), 'included')
  // B3: 부분 면세는 단정하지 않는다
  assert.equal(vatStatusOf({ facts: { menu: '일부 면세 상품 포함 4,500원' } }), null)
  assert.equal(vatStatusOf({ facts: { menu: '면세 상품과 과세 상품이 함께 있어요' } }), null)
  assert.equal(vatStatusOf({ facts: { price: 'Some items are VAT exempt, 4,500 KRW' } }), null)
  assert.equal(vatStatusOf({ facts: { price: 'All items are VAT exempt' } }), 'exempt')
  assert.equal(vatStatusOf({ facts: { menu: '4,500원' } }), null)
  assert.equal(vatStatusOf({ facts: { menu: '공항 면세점 입점 상품 4,500원' } }), null)
  assert.equal(vatStatusOf({ facts: { price: '4,500원 VAT 포함' } }), 'included')
})

test('① 면세 안내 글: 면세만 말하고 「표시한 금액이 그대로 결제 금액」은 말하지 않는다(배송비 문장과 모순 — FINAL-WF B3)', () => {
  assert.equal(PRICE_NOTE_UI.ko.vatExempt, '부가세 면세예요')
  assert.equal(PRICE_NOTE_UI.en.vatExempt, 'VAT exempt')
  for (const loc of ['ko', 'en']) assert.doesNotMatch(PRICE_NOTE_UI[loc].vatExempt, /결제\s?금액|\btotal\b/i)
})

const routes = { home: '/', 'category-list': '/products' }
const slots = (...pairs) => ({ copy: pairs.map(([id, text]) => ({ id, role: '', text })), images: [] })
const commerce = (o = {}) => ({
  archetype: 'commerce', locale: 'ko', business: { name: '하루볶음' }, products: [], facts: { price: '13,000원부터(부가세 포함)', name: '하루볶음' },
  shipping: { fee: 3500, freeThreshold: 40000, courier: '택배 협력사', leadDays: 1 },
  slots: slots(['text', '4만원 이상 주문하면 배송비가 무료예요. 오늘 볶아 내일 출발해요'], ['headline', '하루 블렌드 200g 13,000원']), ...o,
})
const HERO = 'block-hero-kinetic-type-video'
const copyIndex = new Map([['home/notice-bar/text#0', 0], ['home/hero/headline#0', 1]])
const hero = (content, locale = 'ko') =>
  bindSection({ key: 'home/hero', block: HERO, content, copyIndex, routes, locale, navLinks: () => [], primaryCta: () => ctaTargetOf(content, routes), secondaryHref: () => '#' })

test('② commerce 히어로 제목에 가격이 있으면 lede 뒤에 총액·부가세 한 줄이 붙는다(원문은 $ref 그대로, template 으로)', async () => {
  const content = commerce()
  const r = await hero(content)
  assert.ok(r.props, r.why)
  const lede = r.props.copy.lede
  assert.equal(lede.$ref, 'slots.copy.0.text')
  const shown = resolveRefs(lede, content)
  assert.match(shown, /^4만원 이상 주문하면 배송비가 무료예요\. 오늘 볶아 내일 출발해요\. /)
  assert.match(shown, /합계는 상품 가격에 배송비를 더한 금액이에요/)
  assert.match(shown, /부가세 포함/)
})

test('② B7: 한국어 단위 가격(9천원·1만원대·3만 5천원)도 가격으로 본다 — 히어로 총액 줄이 붙고, 가격 아닌 글은 그대로', async () => {
  for (const t of ['9천원', '1만원대', '3만 5천원', '하루 블렌드 3만5천원부터', '13,000원', '$9', '9.5 USD']) assert.match(t, PRICE_TEXT, t)
  for (const t of ['하루 블렌드 200g', '3만 개 판매', '천원 단위로 고르세요', '5천 명이 쓰는 곳']) assert.doesNotMatch(t, PRICE_TEXT, t)
  for (const headline of ['하루 블렌드 9천원', '하루 블렌드 1만원대', '하루 블렌드 3만 5천원']) {
    const content = commerce({ slots: slots(['text', '4만원 이상 주문하면 배송비가 무료예요. 오늘 볶아 내일 출발해요'], ['headline', headline]) })
    const shown = resolveRefs((await hero(content)).props.copy.lede, content)
    assert.match(shown, /합계는 상품 가격에 배송비를 더한 금액이에요/, headline)
  }
})

test('② 배송비 없음 · 영어 사이트 · 제목에 가격이 없음 · 사실이 없음 — 각각 바른 글이거나 붙이지 않는다', async () => {
  const free = commerce({ shipping: { fee: 0, courier: 'x', leadDays: 1 } })
  assert.match(resolveRefs((await hero(free)).props.copy.lede, free), /배송비는 없어요/)
  const en = commerce({ locale: 'en', facts: { price: 'From 13 USD (VAT included)' }, slots: slots(['text', 'Free shipping over 40 USD.'], ['headline', 'House blend 200g 13,000 KRW']) })
  const enText = resolveRefs((await hero(en, 'en')).props.copy.lede, en)
  assert.match(enText, /^Free shipping over 40 USD\. The total is the product price plus shipping/)
  assert.match(enText, /VAT/)
  const noPrice = commerce({ slots: slots(['text', '4만원 이상 주문하면 배송비가 무료예요'], ['headline', '하루 블렌드 두 번째 로트']) })
  assert.deepEqual((await hero(noPrice)).props.copy.lede, { $ref: 'slots.copy.0.text' })
  const noFacts = commerce({ shipping: undefined, facts: { name: '하루볶음' } })
  assert.deepEqual((await hero(noFacts)).props.copy.lede, { $ref: 'slots.copy.0.text' })
})

test('② 다른 원형 히어로는 그대로다(commerce 가 아니면 붙이지 않는다)', async () => {
  const brand = { archetype: 'brand', locale: 'ko', organization: { name: '솔결' }, facts: { price: '13,000원' }, shipping: { fee: 3500 }, slots: slots(['text', '한옥에서 차를 내요'], ['headline', '월 13,000원에 만나요']) }
  const r = await bindSection({ key: 'home/hero', block: HERO, content: brand, copyIndex, routes: { home: '/' }, locale: 'ko', navLinks: () => [], primaryCta: () => ctaTargetOf(brand, { home: '/' }), secondaryHref: () => '#' })
  assert.ok(!r.props || !r.props.copy.lede?.template, JSON.stringify(r.props?.copy?.lede))
})
