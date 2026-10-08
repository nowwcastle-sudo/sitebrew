// FV1 Task 6.3 2차(QFIX2) 원인 5 — portfolio 히어로 주 버튼의 블록 예시 글(「주문 문의하기」)이 사이트에 남던 길.
// portfolio 는 가입·요금제·예약 채널이 없어 주 버튼이 갈 곳이 없었다(href '#') → 이름표도 못 만들어 필수 칸의 예시 글이 그대로 나갔다.
// 판단: 포트폴리오의 행동은 「문의 메일 보내기」다 — 갈 곳은 콘텐츠 문의 메일(contact.email → mailto:), 글은 04 가 쓴 협업 제안 칸(cta)이고 없으면 「문의하기」.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix2-portfolio.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindSection, ctaTargetOf, withSiteName } from '../stamp/gen-pages.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'

const routes = { home: '/', 'case-study': '/work', privacy: '/privacy' }
const slots = (...pairs) => ({ copy: pairs.map(([id, text]) => ({ id, role: '', text })), images: [] })
const portfolio = (extra = {}) => ({ archetype: 'portfolio', locale: 'ko', statement: '골목과 시장을 필름에 담는 사진가', works: [], contact: { email: 'hello@example.com' }, facts: { name: '하은 사진' }, slots: slots(['h1', '골목과 시장을 필름에 담는 사진가'], ['cta', '촬영 의뢰 메일 보내기'], ['body', '새벽 시장을 사흘 걸어 다니며 동선을 익혔어요.']), ...extra })
const HERO = 'block-hero-object-3d-orbit'
const hero = (content, { locale = 'ko', copy } = {}) =>
  bindSection({ key: 'home/statement', block: HERO, content, copyIndex: new Map(Object.entries(copy ?? { 'home/statement/h1#0': 0, 'home/contact-cta/cta#0': 1, 'case-study/process/body#0': 2 })), routes, locale, navLinks: () => [], primaryCta: () => ctaTargetOf(content, routes), secondaryHref: () => '#' })

test('[5] 주 버튼이 갈 곳: portfolio 는 가입·요금제가 없으면 문의 메일(mailto)로 간다 · 메일이 없으면 갈 곳 없음 그대로', () => {
  const t = ctaTargetOf(portfolio(), routes)
  assert.deepEqual(t.href, { $ref: 'contact.email', as: 'mailto' })
  assert.equal(resolveRefs(t.href, portfolio()), 'mailto:hello@example.com')
  assert.deepEqual(ctaTargetOf(portfolio({ contact: {} }), routes), { href: '#' })
  assert.deepEqual(ctaTargetOf(portfolio({ contact: { email: '확인 필요' } }), routes), { href: '#' })
  // 다른 원형 순서는 그대로: 가입 쪽이 있으면 그쪽이 먼저
  assert.deepEqual(ctaTargetOf(portfolio(), { ...routes, signup: '/signup' }), { href: '/signup' })
})

test('[5] 히어로 주 버튼: 글은 04 의 협업 제안 칸(cta) · 갈 곳은 mailto — 블록 예시 글이 남지 않는다', async () => {
  const r = await hero(portfolio())
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.primaryCta.label, { $ref: 'slots.copy.1.text' })
  assert.deepEqual(r.props.copy.primaryCta.href, { $ref: 'contact.email', as: 'mailto' })
  assert.deepEqual(r.issues.filter((i) => i.path.startsWith('copy.primaryCta')), [], JSON.stringify(r.issues))
})

test('[5] 협업 제안 칸이 없으면 생성기 이름표(문의하기)로 쓴다 · 영어 사이트는 영어 · 메일이 없으면 예시 글이 남아 막는다(음성 대조)', async () => {
  const noCta = portfolio({ slots: slots(['h1', '골목과 시장을 필름에 담는 사진가'], ['body', '새벽 시장을 사흘 걸어 다니며 동선을 익혔어요.']) })
  const r = await hero(noCta, { copy: { 'home/statement/h1#0': 0, 'case-study/process/body#0': 1 } })
  assert.equal(r.props.copy.primaryCta.label, '문의하기')
  const en = await hero({ ...noCta, locale: 'en' }, { locale: 'en', copy: { 'home/statement/h1#0': 0, 'case-study/process/body#0': 1 } })
  assert.equal(en.props.copy.primaryCta.label, 'Contact us')
  const none = await hero(portfolio({ contact: {} }))
  assert.ok(none.issues.some((i) => i.path === 'copy.primaryCta.label'), '갈 곳이 없으면 예시 글이 남는 것을 막아야 한다')
})

// ── 소개(home/about, 브랜드 사실표) ───────────────────────────────────────────────────────────────────────────────
// 허용 변형이 brand-fact-sheet 하나뿐인데 이 블록은 설립일(필수)·수치 차별점·대표 역할을 요구하고 portfolio 콘텐츠에는 그 칸이 없다(C111) — 사진가 한 사람의 포트폴리오에서 지어내야 그릴 수 있다.
// 판단: 설립일 사실(founded)이 있는 브리프에서만 사이트맵에 둔다. 사실이 없으면 섹션을 빼고(거짓 사실표를 그리지 않는다), 사실이 있는데 못 그리면 C111 이 그대로 막는다.
test('[5] portfolio 소개 섹션은 설립일 사실(founded)이 있을 때만 사이트맵에 든다', async () => {
  const { buildSitemap } = await import('../stamp/sitemap.mjs')
  const { archetypes } = await import('./lib/stamp-site-fixtures.mjs')
  const { goldenOf } = await import('./lib/stamp-structure-fixtures.mjs')
  const keys = (b) => buildSitemap(archetypes.portfolio, b).pages.flatMap((p) => p.sections.map((s) => `${p.id}/${s.kind}`))
  for (const id of ['portfolio-1', 'portfolio-2']) {
    const b = goldenOf(id).brief
    assert.equal(keys(b).includes('home/about'), false, id)
    assert.ok(keys({ ...b, facts: { ...b.facts, founded: '2019년에 문을 열었어요' } }).includes('home/about'), id)
  }
})

// ── 이름이 facts 에만 있는 원형(portfolio·dashboard)의 푸터 ──────────────────────────────────────────────────
// 스키마 검사(validatedContent)가 봉투 칸 facts 를 버려서 binder(brandPathOf 의 마지막 후보 facts.name)가 이름을 못 읽었다 → portfolio 푸터가 「자료 연결 안 됨」, 머리글 이름이 자리 표시.
// 고침: 회사 정보 칸이 없는 원형은 브리프 이름 사실을 사이트 이름 칸(site.name — 공개 값)에 싣는다.
test('[5] 이름 칸이 없는 원형은 브리프 이름 사실을 site.name 에 싣는다 · 이미 이름이 있거나 사실이 자리 표시면 건드리지 않는다', () => {
  const c = withSiteName({ archetype: 'portfolio', contact: { email: 'hello@example.com' } }, { name: '하은 사진' })
  assert.deepEqual(c.site, { name: '하은 사진' })
  const keep = withSiteName({ archetype: 'commerce', business: { name: '달빛' } }, { name: '다른 이름' })
  assert.equal(keep.site, undefined)
  const withUrl = withSiteName({ archetype: 'portfolio', site: { url: 'https://x.kr', locale: 'ko' } }, { name: '하은 사진' })
  assert.deepEqual(withUrl.site, { url: 'https://x.kr', locale: 'ko', name: '하은 사진' })
  assert.equal(withSiteName({ archetype: 'portfolio' }, { name: '확인 필요' }).site, undefined)
  assert.equal(withSiteName({ archetype: 'portfolio' }, undefined).site, undefined)
})

test('[5] 푸터(compact-strip): site.name 이 있으면 이름·문의 메일로 묶인다 — portfolio 푸터가 자료 없음으로 막히지 않는다', async () => {
  const c = withSiteName(portfolio({ facts: undefined }), { name: '하은 사진' })
  const r = await bindSection({ key: 'global/footer', block: 'block-footer-compact-strip', content: c, copyIndex: new Map(), routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.business.name, { $ref: 'site.name' })
  assert.deepEqual(r.props.copy.business.email, { $ref: 'contact.email' })
  assert.deepEqual(r.issues, [], JSON.stringify(r.issues))
})
