// FV1 Task 6.3 원인 고치기(QFIX) [1] — 사실이 있는데 binder 가 못 묶던 선택 섹션(미룬 일 C389)과 SLOT_FACTS `link` 어긋남.
// 판단 규칙: 묶을 수 있으면 묶고(사실이 없으면 null — 지어내지 않는다), 선택 섹션이 사실 없이는 그릴 수 없는 모양이면 omit(공개 불가로 막지 않고 뺀다 — 까닭은 why)으로 둔다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindSection } from '../stamp/gen-pages.mjs'
import { slotFacts, PLACEHOLDER } from '../stamp/content.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'
import { bindingAudit } from '../stamp/binding-audit.mjs'

const routes = { home: '/', pricing: '/pricing', signup: '/signup' }
const navLinks = () => [{ label: '홈', href: '/' }]
const primaryCta = () => ({ href: '/signup' })
const secondaryHref = () => '/pricing'
const bind = (block, content, { key = 'home/x', copy = {}, locale = 'ko', nav = navLinks, routes: r = routes } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes: r, locale, navLinks: nav, primaryCta, secondaryHref })
const slots = (...pairs) => ({ copy: pairs.map(([id, text]) => ({ id, role: '', text })), images: [] })

// ── [1] 로고 줄 — 수상·인증(recognition)·고객(client-roster)은 04 가 쓴 문구 칸(award·client)이 증거 한 줄이다 ──────────────────
test('[1] brand home/recognition 로고 줄: 수상·인증 문구 칸(award)이 근거 한 줄(claim)로 묶인다 — 로고 이름 없이도 그리고, 「이런 곳이 씁니다」라고 하지 않는다', async () => {
  const brand = { archetype: 'brand', locale: 'ko', organization: { name: '솔결재' }, slots: slots(['award', '2024 한옥 보존 우수 업장']) }
  const r = await bind('block-social-proof-logo-rail', brand, { key: 'home/recognition', copy: { 'home/recognition/award#0': 0 } })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.claim, { $ref: 'slots.copy.0.text' })
  assert.deepEqual(r.props.copy.logos, [])
  assert.equal(resolveRefs(r.props.copy.claim, brand), '2024 한옥 보존 우수 업장')
  assert.notEqual(r.props.copy.title, '이런 곳이 씁니다')
  assert.match(r.props.copy.title, /수상|인증/, '수상 줄의 제목은 수상·인증을 말한다')
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
})

test('[1] portfolio home/client-roster·recognition 로고 줄: 고객(client)·수상(award) 문구 칸이 각각 근거 한 줄이 된다 · 영어 사이트의 제목은 영어', async () => {
  const pf = { archetype: 'portfolio', locale: 'ko', facts: { name: '하은 사진' }, slots: slots(['client', '솔빛출판 · 나들길 잡지 · 한뼘 카페'], ['award', '2025 사진 공모전 입선']) }
  const roster = await bind('block-social-proof-logo-rail', pf, { key: 'home/client-roster', copy: { 'home/client-roster/client#0': 0 } })
  assert.ok(roster.props, roster.why)
  assert.deepEqual(roster.props.copy.claim, { $ref: 'slots.copy.0.text' })
  assert.match(roster.props.copy.title, /함께한/)
  const rec = await bind('block-social-proof-logo-rail', pf, { key: 'home/recognition', copy: { 'home/recognition/award#0': 1 } })
  assert.deepEqual(rec.props.copy.claim, { $ref: 'slots.copy.1.text' })
  assert.notEqual(roster.props.copy.title, rec.props.copy.title)
  const en = await bind('block-social-proof-logo-rail', { ...pf, locale: 'en' }, { key: 'home/client-roster', copy: { 'home/client-roster/client#0': 0 }, locale: 'en' })
  assert.doesNotMatch(en.props.copy.title, /[가-힣]/)
})

test('[1] 로고 줄 음성 대조: 자리 표시·칸 없음은 증거가 아니다 · saas 의 claim 은 그대로 안 묶인다 · 수상 칸이 클라이언트 줄에 섞이지 않는다', async () => {
  const ph = { archetype: 'brand', locale: 'ko', slots: slots(['award', PLACEHOLDER.ko]) }
  assert.equal((await bind('block-social-proof-logo-rail', ph, { key: 'home/recognition', copy: { 'home/recognition/award#0': 0 } })).props, null)
  const none = { archetype: 'brand', locale: 'ko', slots: slots() }
  const r = await bind('block-social-proof-logo-rail', none, { key: 'home/recognition' })
  assert.equal(r.props, null)
  assert.match(r.why, /수상|증거/)
  // client-roster 에 award 만 있으면(칸을 잘못 짚으면) 묶이지 않는다
  const cross = { archetype: 'portfolio', locale: 'ko', slots: slots(['award', '2025 사진 공모전 입선']) }
  assert.equal((await bind('block-social-proof-logo-rail', cross, { key: 'home/client-roster', copy: { 'home/client-roster/award#0': 0 } })).props, null)
  // saas: 제품 약속일 수 있는 claim 은 증거 칸에 싣지 않는다(5.11 그대로)
  const saas = { archetype: 'saas', locale: 'ko', testimonials: [], slots: slots(['claim', '견적이 빨라져요']) }
  assert.equal((await bind('block-social-proof-logo-rail', saas, { key: 'home/social-proof', copy: { 'home/social-proof/claim#0': 0 } })).props, null)
})

// ── [1] 공지 띠 — 끝나는 날이 있는 공지만 그린다(A8). 날짜 없는 공지를 끝나는 날 지어내서 그리지 않는다 ──────────────────────────────
test('[1] commerce home/notice-bar: 두 변형 모두 끝나는 날(endsAt)이 필수라 날짜 붙은 공지가 없으면 선택 섹션을 뺀다(omit) — 지어낸 날짜 없이, 까닭을 남긴다', async () => {
  const commerce = { archetype: 'commerce', locale: 'ko', facts: { notice: '추석 연휴에는 9월 26일까지 주문한 상품만 연휴 전에 도착해요' }, slots: slots(['text', '4만원 이상 주문하면 배송비가 무료예요']) }
  for (const block of ['block-announcement-top-bar', 'block-announcement-dismissible-inline']) {
    const r = await bind(block, commerce, { key: 'home/notice-bar' })
    assert.equal(r.props, null, block)
    assert.equal(r.omit, true, `${block}: 선택 섹션은 막지 않고 뺀다`)
    assert.match(r.why, /끝나는 날/, block)
  }
})

test('[1] 날짜 붙은 공지(notices)가 있으면 top-bar 는 예전처럼 묶인다 — 회귀 방지', async () => {
  const local = { archetype: 'local', locale: 'ko', notices: [{ date: '2026-10-20', text: '10월 20일은 쉬어요' }], slots: slots() }
  const r = await bind('block-announcement-top-bar', local, { key: 'home/notice' })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.message, { $ref: 'notices.0.text' })
})

// ── [1] 하단 탭 — 최상위 목적지 3~5개일 때만(pwa 원형 조건) ──────────────────────────────────────────────────────────────────────
const PWA_ROUTES = { home: '/', 'sub-detail': '/detail', offline: '/offline', settings: '/settings', completion: '/done' }
const links = (...ids) => () => ids.map((id) => ({ label: id === 'home' ? '홈' : id, href: PWA_ROUTES[id] ?? `/${id}` }))
test('[1] pwa global/bottom-tab-bar 아이콘 탭: 최상위 목적지가 3개 미만이면 뺀다(omit) — 하위 화면·오프라인·완료 화면은 목적지가 아니다', async () => {
  const pwa = { archetype: 'pwa', locale: 'ko', manifest: { name: '달림장' }, slots: slots() }
  const r = await bind('block-bottom-tab-icon-tabs', pwa, { key: 'global/bottom-tab-bar', routes: PWA_ROUTES, nav: links('home', 'sub-detail', 'offline', 'settings', 'completion') })
  assert.equal(r.props, null)
  assert.equal(r.omit, true)
  assert.match(r.why, /최상위 목적지/)
})

test('[1] pwa 하단 탭: 최상위 목적지 3~5개면 이름·주소는 사이트맵에서, 아이콘은 쪽 뜻에 맞는 이름표(없으면 돌려 쓴 장식) — 6개 넘으면 앞 5개', async () => {
  const pwa = { archetype: 'pwa', locale: 'ko', manifest: { name: '달림장' }, slots: slots() }
  const routes3 = { ...PWA_ROUTES, log: '/log', stats: '/stats' }
  const r = await bind('block-bottom-tab-icon-tabs', pwa, { key: 'global/bottom-tab-bar', routes: routes3, nav: links('home', 'log', 'stats', 'settings') })
  assert.ok(r.props, r.why)
  const tabs = r.props.copy.tabs
  assert.deepEqual(tabs.map((t) => t.href), ['/', '/log', '/stats', '/settings'])
  assert.equal(tabs[0].icon, 'home')
  assert.equal(tabs[3].icon, 'settings')
  const ICONS = ['home', 'search', 'cart', 'user', 'heart', 'calendar', 'bell', 'settings', 'map']
  assert.ok(tabs.every((t) => ICONS.includes(t.icon) && typeof t.label === 'string' && t.label), JSON.stringify(tabs))
  assert.equal(new Set(tabs.map((t) => t.icon)).size, tabs.length, '같은 아이콘이 둘 이상 겹치지 않는다')
  assert.doesNotMatch(r.props.copy.navLabel, /예시/, '예시 이름표가 남지 않는다')
  const many = { ...routes3, a: '/a', b: '/b', c: '/c' }
  const six = await bind('block-bottom-tab-icon-tabs', pwa, { key: 'global/bottom-tab-bar', routes: many, nav: links('home', 'log', 'stats', 'settings', 'a', 'b', 'c') })
  assert.equal(six.props.copy.tabs.length, 5)
})

// ── [1] SLOT_FACTS `link` — local 외부 후기 링크 칸의 사실을 public 히어로 일반 링크 칸에 요구하지 않는다 ──────────────────────────────
test('[1] SLOT_FACTS link: public 히어로의 「바로가기 1개」 칸은 후기 링크 사실을 요구하지 않는다 · local external-reviews 의 link 는 그대로 후기 링크 사실', () => {
  assert.deepEqual(slotFacts('public', 'link', 'hero'), [])
  assert.deepEqual(slotFacts('local', 'link', 'external-reviews'), ['reviews', 'reviewLinks', 'externalReviews'])
  // 같은 이름의 칸이 다른 원형에서 후기 링크를 뜻하는 곳은 없다(원형 JSON 전수: link 칸은 public hero · local external-reviews 둘뿐)
  assert.deepEqual(slotFacts('saas', 'link', 'social-proof'), [])
})

// ── [1] 감사: 이 레인이 고친 자리는 binding-audit(dangling-ref 포함)에서 unbound·dangling 이 아니다 ──────────────────────────────
test('[1] binding-audit --all: 고친 자리(brand recognition · portfolio client-roster·recognition · commerce notice-bar · pwa bottom-tab)에 unbound·dangling-ref·throws 가 없다', async () => {
  const rows = await bindingAudit({ requiredOnly: false })
  const mine = rows.filter((r) => ['brand:home/recognition', 'portfolio:home/client-roster', 'portfolio:home/recognition', 'commerce:home/notice-bar', 'pwa:global/bottom-tab-bar'].includes(`${r.archetype}:${r.section}`))
  assert.deepEqual(mine.map((r) => `${r.issue} ${r.archetype}:${r.section}:${r.variant} ${r.why ?? ''}`), [])
  assert.equal(rows.filter((r) => r.issue === 'dangling-ref' || r.issue === 'throws').length, 0, JSON.stringify(rows.filter((r) => r.issue === 'dangling-ref' || r.issue === 'throws')))
})
