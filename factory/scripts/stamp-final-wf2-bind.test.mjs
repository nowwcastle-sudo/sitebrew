// FINAL-WF2 06 binder 고침(감사 B P1): AB10 요금제 버튼 글 · AB13 자리표시 링크 · AB14 마지막 행동 보조 버튼 도착지.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-bind.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindSection } from '../stamp/gen-pages.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { join } from 'node:path'
import { loadTs } from '../stamp/ts-eval.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const bind = (block, content, { key = 'home/x', copy = {}, routes = { home: '/', pricing: '/pricing', signup: '/signup' } } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes, locale: content.locale ?? 'ko', navLinks: () => [{ label: '홈', href: '/' }], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing' })

test('AB10 pricing: 유료 요금제 버튼 글에 「무료로 시작」이 없다 · 금액 0 은 무료로 시작 · 문의형은 문의', async () => {
  const content = { archetype: 'saas', locale: 'ko', business: { name: '견적노트' }, plans: [{ name: '무료', monthlyPrice: 0, currency: 'KRW', features: ['한 지점'] }, { name: '팀', monthlyPrice: 12900, currency: 'KRW', features: ['세 지점'] }, { name: '여러 지점', monthlyPrice: null, currency: 'KRW', features: ['무제한'] }] }
  const r = await bind('block-pricing-three-tier-cards', content)
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.planCtas.map((c) => c.label), ['무료로 시작', '선택하기', '문의하기'])
  const paid = await bind('block-pricing-three-tier-cards', { ...content, plans: content.plans.slice(1, 2) })
  assert.equal(paid.props.copy.cta.label, '선택하기')
  assert.equal(JSON.stringify(paid.props).includes('무료로 시작'), false)
})

test('AB14 마지막 행동 띠: 보조 버튼 글이 말하는 행동과 도착지가 같다(메일→mailto·전화→tel·요금제→요금제 쪽) · 아니면 예전 그대로', async () => {
  const content = (text) => ({ archetype: 'saas', locale: 'ko', business: { name: '견적노트', email: 'hello@example.com', phone: '02-1234-5678' }, slots: { copy: [{ id: 'headline', text: '지금 시작해요' }, { id: 'primaryCta', text: '무료로 써 보기' }, { id: 'secondaryCta', text }] } })
  const copy = { 'home/final-cta/headline#0': 0, 'home/final-cta/primaryCta#0': 1, 'home/final-cta/secondaryCta#0': 2 }
  const block = 'block-final-cta-full-band'
  const dest = async (text) => {
    const c = content(text)
    const r = await bind(block, c, { key: 'home/final-cta', copy })
    return r.props?.copy?.secondary ? resolveRefs(r.props.copy.secondary.href, c) : `(없음) ${r.why ?? ''}`
  }
  assert.equal(await dest('메일로 문의'), 'mailto:hello@example.com')
  assert.match(String(await dest('전화로 문의')), /^tel:/)
  assert.equal(await dest('요금제 보기'), '/pricing')
  assert.equal(await dest('둘러보기'), '/pricing', '글이 어느 행동도 가리키지 않으면 예전 도착지')
  const noMail = content('메일로 문의')
  delete noMail.business.email
  const r = await bind(block, noMail, { key: 'home/final-cta', copy })
  assert.equal(resolveRefs(r.props.copy.secondary.href, noMail), '/pricing', '쓸 수 있는 메일이 없으면 메일 링크를 지어내지 않는다')
})

const render = async (rel, name, props) => renderToStaticMarkup(h((await loadTs(join(root, 'registry', 'factory', 'blocks', rel)))[name], props))

test('AB11·25 항목이 0개면 빈 목록을 그리지 않는다 — 로고 줄의 빈 <ul>·요금제 카드의 빈 기능 목록 · 항목이 있으면 그린다(양성 대조)', async () => {
  const proof = (logos) => render('social-proof/logo-rail.tsx', 'SocialProofLogoRail', { copy: { title: '숫자로 보기', claim: '참가 출판사 40곳', logos } })
  assert.equal(/<ul/.test(await proof([])), false)
  assert.match(await proof([{ name: '한결출판' }]), /<ul[^>]*data-count="1"/)
  const tiers = (features) => render('pricing/three-tier-cards.tsx', 'PricingThreeTierCards', { copy: { title: '요금제', plans: [{ name: '일반', monthlyPrice: 8000, currency: 'KRW', features }], planIds: ['a'], recommendedLabel: '추천', perMonth: '', contactLabel: '문의', cta: { label: '선택하기', href: '/x' }, vat: { included: '부가세 포함', excluded: '부가세 별도' } } })
  assert.equal(/cn-block-tier-features|<ul[^>]*tier-features/.test(await tiers([])), false)
  assert.match(await tiers(['입장 가능']), /입장 가능/)
})

test('#21 local 하단 예약 줄: 예약 수단이 전화뿐이면 [예약하기]를 주지 않는다(전화하기와 같은 곳) · 예약 쪽이 있으면 둘 다', async () => {
  const content = { archetype: 'local', locale: 'ko', business: { name: '달빛', phone: '02-1234-5678' }, booking: { primary: { kind: 'tel', value: '02-1234-5678' } } }
  const go = (primaryCta) => bindSection({ key: 'global/sticky-booking-bar', block: 'block-bottom-tab-split-booking-bar', content, copyIndex: new Map(), routes: { home: '/' }, locale: 'ko', navLinks: () => [], primaryCta, secondaryHref: () => '#' })
  const tel = await go(() => ({ href: { $ref: 'booking.primary.value', as: 'tel' } }))
  assert.ok(tel.props, tel.why)
  assert.equal('booking' in tel.props.copy, false)
  const html = await render('bottom-tab/split-booking-bar.tsx', 'BottomTabSplitBookingBar', { copy: { ...resolveRefs(tel.props.copy, content), regionLabel: '예약 줄' } })
  assert.equal((html.match(/<a /g) ?? []).length, 1, '링크가 하나뿐이다')
  const page = await go(() => ({ href: '/booking' }))
  assert.equal(page.props.copy.booking.href, '/booking')
})

test('#24 commerce /products: 결과 수 상태 알림은 한 쪽에 하나 — 도구 줄이 있으면 칩·목록은 알리지 않고, 도구 줄이 없으면 칩이 알리고 목록은 알리지 않는다', async () => {
  const content = { archetype: 'commerce', locale: 'ko', business: { name: '달빛상점' }, products: [{ slug: 'a', name: '식빵', price: 4800, category: '빵', options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '식빵' }] }, { slug: 'b', name: '쿠키', price: 2500, category: '과자', options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '쿠키' }] }] }
  const go = (block, pageKinds) => bindSection({ key: 'category-list/x', block, content, copyIndex: new Map(), routes: { home: '/', 'category-list': '/products' }, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/products' }), secondaryHref: () => '#', pageKinds })
  const withTool = ['list-toolbar', 'filter-chips', 'product-grid']
  assert.equal('count' in (await go('block-filter-bar-chips', withTool)).props.copy, false)
  assert.equal((await go('block-product-list-grid-cards', withTool)).props.copy.countTemplate, '')
  assert.ok((await go('block-filter-bar-chips', ['filter-chips', 'product-grid'])).props.copy.count)
  assert.equal((await go('block-product-list-grid-cards', ['filter-chips', 'product-grid'])).props.copy.countTemplate, '')
  assert.equal((await go('block-product-list-grid-cards', ['product-grid'])).props.copy.countTemplate, '{n}개 상품', '거르기 줄이 없으면 목록이 알린다(예전 그대로)')
  assert.ok((await go('block-filter-bar-toolbar', withTool)).props.copy.count, '도구 줄이 알린다')
})

test('#27 3D 히어로: 사진·모델이 없으면 빈 무대에 「실제 사진 필요」가 보인다(설명 없는 회색 빈칸 아님) · binder 가 그 글을 잇는다', async () => {
  const copy = { label: '첫 화면', title: '제목', lede: '부제', primaryCta: { label: '시작', href: '/x' }, stageLabel: '무대' }
  const html = await render('hero/object-3d-orbit.tsx', 'HeroObject3dOrbit', { copy: { ...copy, emptyLabel: '실제 사진 필요' } })
  assert.match(html, /실제 사진 필요/)
  assert.equal(/실제 사진 필요/.test(await render('hero/object-3d-orbit.tsx', 'HeroObject3dOrbit', { copy })), false, '글을 안 주면 예전 그대로')
  const saas = { archetype: 'saas', locale: 'ko', product: { name: '견적노트' }, business: { name: '견적노트' }, slots: { copy: [{ id: 'headline', text: '견적을 한 번에 정리해요' }, { id: 'subhead', text: '받은 견적을 한 곳에서 비교해요' }, { id: 'primaryCta', text: '무료로 써 보기' }] } }
  const r = await bind('block-hero-object-3d-orbit', saas, { key: 'home/hero', copy: { 'home/hero/headline#0': 0, 'home/hero/subhead#0': 1, 'home/hero/primaryCta#0': 2 } })
  assert.ok(r.props, r.why)
  assert.equal(r.props.copy.emptyLabel, '실제 사진 필요')
})

test('#28 local 가격표 제목: 「오늘의 메뉴」(카페 말)가 아니라 어느 사업에나 맞는 이름표 · 항목 이름은 콘텐츠', async () => {
  const content = { archetype: 'local', locale: 'ko', business: { name: '햇살 주야간보호' }, menu: [{ name: '비급여 식사', price: 3000 }] }
  for (const block of ['block-menu-price-board-columns', 'block-menu-price-photo-rows']) {
    const r = await bind(block, content, { key: 'home/menu-price' })
    if (!r.props) continue
    assert.equal(JSON.stringify(r.props).includes('오늘의 메뉴'), false, block)
    assert.equal(r.props.copy.title, '가격 안내')
  }
})

test('AB19 문의 폼: 완료 문구가 「받았어요」(거짓 성공)가 아니라 메일 창을 열었다는 말이다 · en 대응', async () => {
  for (const locale of ['ko', 'en']) {
    const r = await bind('block-contact-form-inline-short', { archetype: 'local', locale, business: { name: 'Bakery', phone: '02-1234-5678' } }, { key: 'home/contact' })
    if (!r.props) continue
    const done = r.props.copy.form.done
    assert.equal(/받았어요|received/i.test(`${done.title} ${done.body}`), false, JSON.stringify(done))
    assert.match(locale === 'ko' ? done.title : done.title, locale === 'ko' ? /메일 창을 열었어요/ : /email app/i)
    assert.match(done.title, locale === 'ko' ? /보내기를 눌러야/ : /press send/)
  }
  const ko = await bind('block-contact-form-inline-short', { archetype: 'local', locale: 'ko', business: { name: '달빛', phone: '02-1234-5678' } }, { key: 'home/contact' })
  assert.ok(ko.props, ko.why)
})

test('AB13 푸터: 값이 자리표시인 바깥 링크(공정위 조회 주소)는 링크를 그리지 않는다 · 값이 있으면 그린다', async () => {
  const c = (url) => ({ archetype: 'commerce', locale: 'ko', business: { name: '달빛상점', representative: '이서윤', bizRegNo: '123-45-67890', mailOrderNo: '2026-서울마포-0001', address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678', email: 'hello@example.com', ftcLookupUrl: url } })
  const without = await bind('block-footer-stacked-legal', c('확인 필요'), { key: 'global/footer' })
  assert.ok(without.props, without.why)
  assert.equal('ftcLookupUrl' in without.props.copy.business, false)
  const withUrl = await bind('block-footer-stacked-legal', c('https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890'), { key: 'global/footer' })
  assert.deepEqual(withUrl.props.copy.business.ftcLookupUrl, { $ref: 'business.ftcLookupUrl' })
})
