// FINAL-WF2 AB1·AB3·AB15 — 생성 사이트의 내부 링크가 닿는 곳(감사 B 발견).
//   AB1  commerce 상품 카드가 사이트에 없는 상세 쪽(/products/<slug>)으로 링크해 구매 경로가 404 였다 → 상세 쪽이 없으면 카드는 링크가 아니다
//   AB3  landing 주 CTA 가 href="#" — 같은 쪽 신청 폼 id 로 잇는다(머리글 행동은 /#<폼 id>)
//   AB15 saas 로그인·가입·온보딩 블록의 #sign-in·#sign-up·#password-reset … 앵커 — 사이트의 실제 경로로(없으면 링크를 뺀다)
//   + 06 링크 검사(link-check.mjs): 없는 쪽·앵커·빈 앵커(#)는 「공개 불가 — 없는 쪽·앵커로 가는 링크」 품질 사유
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-final-wf2-links.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { bindSection, ctaTargetOf, BLOCKER } from '../stamp/gen-pages.mjs'
import { leaves, resolveRefs } from '../stamp/site-bind.mjs'
import { linkAppRoutes } from '../stamp/site-consistency.mjs'
import { deadLinks, deadLinkSummary, idsOf } from '../stamp/link-check.mjs'
import { blockerClass, QUALITY_PREFIXES } from '../stamp/blocker-class.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const blockModule = (rel) => loadTs(join(root, 'registry', 'factory', 'blocks', rel))
const render = async (rel, name, props) => renderToStaticMarkup(h((await blockModule(rel))[name], props))

// ── 링크 검사(순수) ─────────────────────────────────────────────────────────────────────
test('link-check: 없는 경로·빈 앵커·없는 id 를 잡고, 있는 경로·id·바깥 주소·파일 경로는 통과한다', () => {
  const pages = {
    '/': '<main id="main"><a href="/products/a">상품</a><a href="#">빈</a><a href="#newsletter">신청</a><a href="/#missing">없는 id</a><a href="/products">목록</a><a href="https://x.kr">밖</a><a href="mailto:a@b.kr">m</a><a href="/sitemap.xml">s</a><a href="#main">본문</a></main><section id="newsletter"></section>',
    '/products': '<a href="/">홈</a><a href="/privacy#top">위</a><a class="x" href="/gone/">zz</a>',
    '/privacy': '<h1>p</h1>',
  }
  const dead = deadLinks({ routes: ['/', '/products', '/privacy'], pages })
  assert.deepEqual(dead.map((d) => `${d.route} ${d.href} ${d.why}`).sort(), [
    '/ # empty', '/ /#missing anchor', '/ /products/a route', '/products /gone/ route',
  ].sort())
})

test('link-check: 다른 쪽의 id 도 본다(/쪽#id) · 쪽 HTML 이 없으면 id 는 보지 않는다 · 같은 링크는 쪽마다 한 번', () => {
  const pages = { '/': '<a href="/login#sign-in">a</a><a href="/login#sign-in">b</a><a href="/missing-page#x">c</a>', '/login': '<form id="sign-in"></form>' }
  assert.deepEqual(deadLinks({ routes: ['/', '/login'], pages }).map((d) => d.href), ['/missing-page#x'])
  assert.deepEqual(deadLinks({ routes: ['/', '/login', '/pricing'], pages: { '/': '<a href="/pricing#plans">x</a>' } }), [], '쪽 HTML 을 모르면 id 는 못 본다')
  assert.deepEqual([...idsOf('<div id="a"></div><a name="b"></a>')].sort(), ['a', 'b'])
})

test('link-check: 요약 한 줄은 같은 링크를 모아 쪽을 적고, 사유는 품질 갈래다', () => {
  const s = deadLinkSummary([{ route: '/', href: '/products/a', why: 'route' }, { route: '/products', href: '/products/a', why: 'route' }, { route: '/', href: '#', why: 'empty' }])
  assert.match(s, /\/products\/a\(\/·\/products\)/)
  assert.match(s, /#\(빈 앵커\)\(\/\)/)
  assert.equal(BLOCKER.deadLink, '공개 불가 — 없는 쪽·앵커로 가는 링크: ')
  assert.ok(QUALITY_PREFIXES.includes(BLOCKER.deadLink))
  assert.equal(blockerClass(`${BLOCKER.deadLink}/products/a(/)`), 'quality')
})

// ── AB1 상품 카드 ────────────────────────────────────────────────────────────────────────
const commerce = { archetype: 'commerce', locale: 'ko', business: { name: '달빛상점' }, products: [{ slug: 'a', name: '하루 블렌드', price: 13000, options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '하루 블렌드 사진' }] }] }
const bindList = (block, routes, content = commerce) => bindSection({ key: 'home/best', block, content, copyIndex: new Map(), routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/products' }), secondaryHref: () => '#' })

for (const [block, rel, name] of [['block-product-list-grid-cards', 'product-list/grid-cards.tsx', 'ProductListGridCards'], ['block-product-list-ranked-list', 'product-list/ranked-list.tsx', 'ProductListRankedList']]) {
  test(`AB1 ${block}: 상세 쪽이 사이트에 없으면 hrefTemplate 가 비고 카드는 링크가 아니다 · 상세 쪽이 있으면 예전 그대로`, async () => {
    const withRank = { ...commerce, products: [{ ...commerce.products[0], salesRank: 1 }] }
    const r = await bindList(block, { home: '/', 'category-list': '/products' }, withRank)
    assert.ok(r.props, r.why)
    assert.equal(r.props.copy.hrefTemplate, '', '상세 쪽이 없는데 /products/{slug} 로 링크하면 404 다')
    const html = await render(rel, name, resolveRefs(r.props, withRank))
    assert.equal(/href="\/products\//.test(html), false, html.slice(0, 400))
    assert.match(html, /하루 블렌드/, '상품 이름은 그대로 보인다')
    const withDetail = await bindList(block, { home: '/', 'category-list': '/products', 'product-detail': '/products/[slug]' }, withRank)
    assert.equal(withDetail.props.copy.hrefTemplate, '/products/{slug}', '상세 쪽이 있으면 블록 예시의 주소 틀을 그대로 쓴다')
    const linked = await render(rel, name, resolveRefs(withDetail.props, withRank))
    assert.match(linked, /href="\/products\/a"/)
  })
}

// ── AB3 landing 주 CTA ───────────────────────────────────────────────────────────────────
test('AB3 ctaTargetOf: landing 은 가입·예약·요금제 쪽이 없으면 같은 쪽 신청 폼 앵커로 간다 · 다른 원형 순서는 그대로', () => {
  const landing = { archetype: 'landing', locale: 'ko', business: { name: '북페어' } }
  const routes = { home: '/' }
  assert.deepEqual(ctaTargetOf(landing, routes, { lead: { page: 'home', id: 'newsletter' } }), { href: '#newsletter', anchorPage: 'home' })
  assert.deepEqual(ctaTargetOf(landing, routes), { href: '#' }, '신청 폼이 없으면 예전 그대로(검사가 막는다)')
  assert.deepEqual(ctaTargetOf(landing, { ...routes, signup: '/signup' }, { lead: { page: 'home', id: 'newsletter' } }), { href: '/signup' }, '가입 쪽이 먼저')
})

// ── AB15 앱 화면 앵커 ────────────────────────────────────────────────────────────────────
test('AB15 linkAppRoutes: #sign-in·#sign-up 은 사이트 경로로, 이어질 쪽이 없는 링크는 선택 칸이면 통째로 뺀다 · 뺄 수 없으면 dead', () => {
  const props = { copy: { forgot: { label: '비밀번호', href: '#password-reset' }, signUp: { label: '가입', href: '#sign-up' }, items: [{ id: 'a', action: { label: '만들기', href: '#create-page' } }, { id: 'b', action: { label: '링크', href: '#share-link' } }], must: { href: '#alerts' } } }
  const r = linkAppRoutes(props, { login: '/login', signup: '/signup' }, new Set(['forgot', 'action']))
  assert.equal(props.copy.signUp.href, '/signup')
  assert.equal('forgot' in props.copy, false, '비밀번호 재설정 쪽이 없으면 링크를 뺀다')
  assert.deepEqual(props.copy.items, [{ id: 'a' }, { id: 'b' }])
  assert.deepEqual(r.dead.map((d) => d.path), ['copy.must.href'], '선택 칸이 아니면 못 빼고 dead 로 남는다')
  assert.equal(r.linked.length, 1)
  const p2 = { copy: { signIn: { label: '로그인', href: '#sign-in' } } }
  linkAppRoutes(p2, { login: '/login' }, new Set())
  assert.equal(p2.copy.signIn.href, '/login')
})

test('AB15 bindSection: saas 로그인·가입·온보딩 블록에 #sign-in·#sign-up·#password-reset·#create-page … 앵커가 남지 않는다', async () => {
  const saas = { archetype: 'saas', locale: 'ko', product: { name: '견적노트' }, business: { name: '견적노트' }, site: { name: '견적노트' } }
  const routes = { home: '/', login: '/login', signup: '/signup', onboarding: '/onboarding', account: '/account' }
  const left = []
  const APP = /^#(?:sign-in|sign-up|password-reset|settings-credentials|create-page|help-start|share-link|alerts|invite-staff)$/
  for (const block of ['block-auth-sign-in', 'block-auth-sign-up-consents', 'block-confirmation-signup-complete', 'block-onboarding-checklist-panel']) {
    const r = await bindSection({ key: 'x/auth', block, content: saas, copyIndex: new Map(), routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing' })
    if (!r.props) continue
    for (const l of leaves(r.props)) if (/(?:^|\.)href$/.test(l.path) && APP.test(String(l.value))) left.push(`${block} ${l.path}=${l.value}`)
  }
  assert.deepEqual(left, [])
})
