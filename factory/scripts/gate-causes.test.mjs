// FV1 Task 5.13 (C5 관문 실패 — 골든 1차 18줄·10안) — 관문 실패의 원인마다 고친 곳 하나와 시험 하나.
//   · ux bodyChecked 0 (H08): 앱 쪽 본문이 비면 빈 상태 안내(20자 이상 + 첫 행동 하나)를 그린다
//   · marketing total-first-screen·price-notation (C121): 가격 곁 부가세·합계 한 줄을 사실에서
//   · a11y 쿠키 띠 초점 (C323): 띠 밑에 가린 초점 — 이 시험은 지금 구조를 고정한다(원인 재현은 보고서 참조)
//   · 필수 칸 표시·오류 요약 (H06)
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/gate-causes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bindSection } from '../stamp/gen-pages.mjs'
import * as SB from '../stamp/site-bind.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const blocks = (...p) => join(root, 'registry', 'factory', 'blocks', ...p)
const src = (...p) => readFileSync(blocks(...p), 'utf8')
const routes = { home: '/', pricing: '/pricing', signup: '/signup' }
const bind = (block, content, { key = 'home/x', copy = {}, locale = 'ko' } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes, locale, navLinks: () => [{ label: '홈', href: '/' }], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing' })
const visibleText = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
const render = async (kind, variant, name, fx) => {
  const mod = await loadTs(blocks(kind, `${variant}.tsx`))
  const fixture = await loadTs(blocks(kind, `${variant}.fixture.ts`))
  return renderToStaticMarkup(h(mod[name], fixture[fx]))
}

// ── H08 · ux bodyChecked 0 ──────────────────────────────────────────────────────────────
test('빈 상태 블록은 20자 이상 안내와 첫 행동 하나를 그린다(H08) — 최소 예시도', async () => {
  const html = await render('state-screen', 'empty-guide', 'StateScreenEmptyGuide', 'fixtureMin')
  const body = [...html.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map((m) => m[1]).filter((t) => t.trim().length >= 20)
  assert.ok(body.length >= 1, `20자 이상 안내 글이 없다: ${visibleText(html)}`)
  assert.equal((html.match(/data-slot="button"/g) ?? []).length, 1, '첫 행동은 하나')
})

test('본문이 하나도 안 그려진 쪽 판정: 머리·공지·동의·하단 바·떠 있는 행동·푸터·현재 위치·뼈대는 본문이 아니다', () => {
  for (const chrome of ['block-nav-app-bar-tabs', 'block-announcement-top-bar', 'block-consent-bottom-banner', 'block-bottom-tab-icon-tabs', 'block-floating-action-call-bar', 'block-footer-compact-strip', 'block-content-breadcrumb', 'block-content-skeleton']) {
    assert.match(chrome, SB.CHROME_BLOCK, chrome)
  }
  assert.equal(SB.hasBodyBlock(['block-nav-app-bar-tabs', 'block-content-skeleton']), false)
  assert.equal(SB.hasBodyBlock([]), false)
  assert.equal(SB.hasBodyBlock(['block-nav-app-bar-tabs', 'block-state-screen-empty-guide']), true)
  assert.equal(SB.hasBodyBlock(['block-hero-punch-in-statement']), true)
  assert.equal(SB.hasBodyBlock(['block-dashboard-panel-kpi-first']), true, '대시보드 패널은 빈 상태여도 본문이다')
})

test('빈 쪽 안내 props: 20자 이상 안내 글 + 첫 행동 하나, 영어에는 한글이 없다', () => {
  for (const locale of ['ko', 'en']) {
    const p = SB.emptyGuideProps(locale)
    assert.ok([...p.copy.body].length >= 20, locale)
    assert.equal(typeof p.copy.primary.href, 'string')
    assert.equal('secondary' in p.copy, false, '첫 행동은 하나')
  }
  assert.doesNotMatch(JSON.stringify(SB.emptyGuideProps('en')), /[가-힣]/)
  assert.ok(Object.keys(SB.EMPTY_PAGE_UI).join() === 'ko,en')
})

test('통합: pwa 사이트 — 앱 쪽 본문(주 화면·상세·결과)이 콘텐츠에 없어도 쪽마다 본문 블록이 하나 이상 있다(빈 상태 안내)', async () => {
  const { loadBrief } = await import('../stamp/brief.mjs')
  const { GOLDEN_DIR } = await import('../stamp/golden.mjs')
  const { makeRun, gen, text } = await import('./lib/stamp-site-fixtures.mjs')
  const { maxContent } = await import('../stamp/binding-audit.mjs')
  const { PLACEHOLDER } = await import('../stamp/content.mjs')
  const brief = loadBrief(join(GOLDEN_DIR, 'pwa-1.json'))
  const R = await makeRun(join(root, '.tmp', 'gate-causes-test'), brief, (request) => {
    const c = maxContent('pwa', 'ko')
    Object.assign(c, { facts: { ...request.seedContent.facts }, slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] } })
    delete c.site
    for (const k of ['homeItems', 'detailBody', 'resultBody']) delete c[k] // QFIX [3]: 앱 안내 글 칸이 없는 콘텐츠 — 사실이 없으면 섹션은 예전처럼 안 그려진다
    return c
  })
  const s = await gen(R)
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  // 쪽마다(법정 쪽 뺀) 본문 블록이 하나 이상 — 안 그려진 섹션의 blocker 는 그대로 남는다
  const byPage = {}
  for (const [key, v] of Object.entries(site.sections)) (byPage[key.split('/')[0]] ??= []).push(v.block)
  for (const [page, list] of Object.entries(byPage)) assert.equal(SB.hasBodyBlock(list), true, `${page}: ${list.join(', ')}`)
  assert.ok(s.blockers.some((b) => b.includes('home/primary-content')), '앱 고유 주 화면이 안 그려진 사유는 그대로 남는다')
  assert.ok(Object.values(site.sections).some((v) => v.block === 'block-state-screen-empty-guide'), '본문이 비는 쪽에 빈 상태 안내가 들어갔다')
})

// ── C121 · 부가세 표기 · 합계 ────────────────────────────────────────────────────────────
test('부가세 상태는 가격 사실이 말할 때만 읽는다 — 말하지 않거나 포함·별도가 섞이면 짐작하지 않는다(null)', () => {
  assert.equal(SB.vatStatusOf({ facts: { price: '아메리카노 4,500원(VAT 포함)' } }), 'included')
  assert.equal(SB.vatStatusOf({ facts: { price: '월 9,900원 부가세 별도' } }), 'excluded')
  assert.equal(SB.vatStatusOf({ facts: { price: 'USD 48 including VAT' } }), 'included')
  assert.equal(SB.vatStatusOf({ facts: { price: '4,500원' } }), null)
  assert.equal(SB.vatStatusOf({ facts: { price: 'VAT 포함, 일부는 부가세 별도' } }), null)
  assert.equal(SB.vatStatusOf({ slots: { copy: [{ id: 'price', text: '세금 포함 가격이에요' }] } }), 'included')
  assert.equal(SB.vatStatusOf({}), null)
})

test('menu-price binder(C121): 가격 사실이 부가세 포함이면 각주에 싣고, 각주 칸이 없는 변형은 머리말 아래 줄에 싣는다 · 사실이 없으면 싣지 않는다', async () => {
  const local = (price) => ({ archetype: 'local', locale: 'ko', menu: [{ name: '아메리카노', price: 4500 }], facts: price ? { price } : {}, slots: { copy: [], images: [] } })
  const withVat = await bind('block-menu-price-photo-rows', local('아메리카노 4,500원(VAT 포함)'), { key: 'home/menu-price' })
  assert.equal(withVat.props.copy.footnote, '가격은 모두 부가세 포함이에요')
  const boardRaw = await bind('block-menu-price-board-columns', local('아메리카노 4,500원(VAT 포함)'), { key: 'home/menu-price' })
  assert.match(JSON.stringify(boardRaw.props.copy), /부가세 포함/)
  const excluded = await bind('block-menu-price-category-tabs', local('4,500원 부가세 별도'), { key: 'home/menu-price' })
  assert.equal(excluded.props.copy.footnote, '가격은 모두 부가세 별도예요')
  const none = await bind('block-menu-price-photo-rows', local(null), { key: 'home/menu-price' })
  assert.equal('footnote' in none.props.copy, false, '사실이 없으면 각주를 싣지 않는다(예시 각주도 지운다)')
  const en = await bind('block-menu-price-photo-rows', { ...local('Americano $4.5, VAT included'), locale: 'en' }, { key: 'home/menu-price', locale: 'en' })
  assert.equal(en.props.copy.footnote, 'All prices include VAT')
})

test('commerce 상품 목록(첫 화면 합계): 배송비가 있으면 「합계는 상품 가격에 배송비를 더한 금액」, 없으면 「표시된 가격이 합계」 + 부가세 상태 · 숫자는 적지 않는다', async () => {
  const commerce = (fee, price) => ({ archetype: 'commerce', locale: 'ko', products: [{ slug: 'a', name: '소금빵', price: 3200, options: [], thumbs: [{ id: 't', aspect: '1:1', source: 'real-required', alt: '소금빵' }] }], shipping: { fee, courier: '한진택배', leadDays: 2 }, facts: price ? { price } : {}, slots: { copy: [], images: [] } })
  const r = await bind('block-product-list-grid-cards', commerce(3000, '소금빵 3,200원, 부가세 포함'), { key: 'home/products' })
  assert.equal(r.props.copy.lead, '합계는 상품 가격에 배송비를 더한 금액이에요. 가격은 모두 부가세 포함이에요.')
  assert.doesNotMatch(r.props.copy.lead, /\d/)
  const free = await bind('block-product-list-grid-cards', commerce(0, null), { key: 'home/products' })
  assert.equal(free.props.copy.lead, '배송비는 없어요. 표시된 가격이 합계예요.')
  const en = await bind('block-product-list-grid-cards', { ...commerce(3000, 'Price includes VAT'), locale: 'en' }, { key: 'home/products', locale: 'en' })
  assert.match(en.props.copy.lead, /total is the product price plus shipping.*include VAT/i)
  // marketing 관문의 합계 판정 식(marketing-gate totalRe)을 지난다
  assert.match(r.props.copy.lead, /합계|총액|부가세\s?포함/)
})

// ── C323 · 쿠키 띠 초점 ────────────────────────────────────────────────────────────────
test('쿠키 띠: 띠가 떠 있는 동안 문서 뿌리의 scroll-padding-bottom 을 띠 높이로 맞춘다 — useBottomBarSpace(pad)이고 푸터 링크까지 스크롤할 자리를 더한다', () => {
  const s = src('consent', 'bottom-banner.tsx')
  assert.match(s, /useBottomBarSpace\(decided \? none : ref, \{ pad: true \}\)/)
  const kit = src('_shared', 'bottom-bar-space.tsx')
  assert.match(kit, /scrollPaddingBottom = `var\(\$\{BOTTOM_BAR_VAR\}\)`/)
  assert.match(kit, /pad/)
  // 띠가 쪽 한 화면을 넘게 차지하지 않는다(375 에서 20dvh 이하)
  assert.match(readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8'), /\.cn-block-cookie \{\s*@apply fixed inset-x-0 bottom-0 z-40 flex max-h-\[20dvh\]/)
})

// ── H06 · 필수 칸 표시 · 오류 요약 ────────────────────────────────────────────────────────
test('필수 칸은 aria-required 를 갖고(포트 폼) 실패하면 오류 요약이 맨 위에 생긴다(H06)', () => {
  const pf = src('_shared', 'port-form.tsx')
  assert.match(pf, /aria-required/)
  assert.match(pf, /data-error-summary/)
  assert.match(pf, /errorSummary/)
  const ff = src('_shared', 'form-flow.tsx')
  assert.match(ff, /aria-required/)
  assert.match(ff, /data-error-summary/)
})

test('포트 폼 FormAlert: 칸 오류가 있으면 role=alert 칸 안에 칸마다 한 줄(그 칸으로 가는 링크)을 그린다 · 오류가 없으면 비어 있다', async () => {
  const { FormAlert } = await loadTs(blocks('_shared', 'port-form.tsx'))
  const base = { id: 'f', formId: 'f-form', alertId: 'f-alert', formError: null, notices: undefined, cooldown: 0, retry() {} }
  const empty = renderToStaticMarkup(h(FormAlert, { form: { ...base, errorSummary: [] }, fieldTitle: '입력한 내용을 확인해 주세요', serverTitle: '보내지 못했어요' }))
  assert.doesNotMatch(empty, /data-error-summary/)
  assert.match(empty, /role="alert"/)
  const html = renderToStaticMarkup(h(FormAlert, { form: { ...base, errorSummary: [{ name: 'email', message: '이메일을 적어 주세요.' }, { name: 'password', message: '비밀번호는 8자 이상이어야 해요.' }] }, fieldTitle: '입력한 내용을 확인해 주세요', serverTitle: '보내지 못했어요' }))
  assert.match(html, /role="alert"/)
  assert.match(html, /data-error-summary/)
  assert.match(html, /href="#f-email"/)
  assert.match(html, /href="#f-password"/)
  assert.match(html, /입력한 내용을 확인해 주세요/)
})

test('contact 흐름 FormAlert: 같은 요약을 칸 id(`<폼 id>-<칸 이름>`)로 잇는다', async () => {
  const { FormAlert } = await loadTs(blocks('_shared', 'form-flow.tsx'))
  const flow = { formId: 'c-form', alertId: 'c-alert', formError: null, notices: undefined, cooldown: 0, retry() {}, fieldErrors: { name: ['이름을 적어 주세요.'], phone: undefined } }
  const html = renderToStaticMarkup(h(FormAlert, { flow, copy: { fieldErrorTitle: '입력한 내용을 확인해 주세요', errorTitle: '보내지 못했어요' } }))
  assert.match(html, /data-error-summary/)
  assert.match(html, /href="#c-name"/)
  assert.doesNotMatch(html, /href="#c-phone"/)
})

test('대시보드 빈 상태: 콘텐츠에 도움말 주소가 있으면 그것이 첫 행동 하나다', async () => {
  const dash = { archetype: 'dashboard', locale: 'ko', decision: { dashboard_type: 'operational', refresh: '5분마다' }, kpis: [], alerts: [], helpUrl: 'https://help.example.org', slots: { copy: [], images: [] } }
  const r = await bind('block-dashboard-panel-kpi-first', dash, { key: 'operational/kpi-row' })
  assert.deepEqual(r.props.state, { status: 'empty' })
  assert.deepEqual(r.props.copy.empty.action, { label: '도움말 보기', href: { $ref: 'helpUrl' } })
})
