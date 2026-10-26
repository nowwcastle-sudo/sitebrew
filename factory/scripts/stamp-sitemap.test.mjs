// 02-sitemap · 03-variants (P3-3 Task 6) — 저장소의 실제 원형·블록·라이브러리 레시피를 쓴다(녹화 없음).
// 계획 테스트와 다른 곳: 「리뷰 사실 없으면 review-list 없음」은 실제 원형에서 detail review-list 가 필수라(Task 1) 성립하지 않는다 —
//   필수는 사실이 없어도 넣고 화면이 「확인 필요」로 그린다(Global Constraints). 같은 규칙을 선택 섹션 local external-reviews 로 검사한다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArchetypes } from './archetypes.mjs'
import { loadLibrary } from './style-presets.mjs'
import { openRun } from '../stamp/run-dir.mjs'
import { buildSitemap, sitemapBlockers, writeCandidateBlockers, runSitemapStage, hasFact, FACT_GATED, BLOCKER_PREFIX } from '../stamp/sitemap.mjs'
import { DEMOTED, chooseVariants, runVariantStages, densityOf, blockDensities } from '../stamp/variants.mjs'

const archetypes = await loadArchetypes()
const library = loadLibrary()
const briefOf = (archetype, facts = {}, extra = {}) => ({ topic: `${archetype} 시험(예시)`, archetype, locale: 'ko', facts, ...extra })
const sm = (id, facts, extra) => buildSitemap(archetypes[id], briefOf(id, facts, extra))
const kinds = (s, pageId) => s.pages.find((p) => p.id === pageId)?.sections.map((x) => x.kind) ?? []
// FV1 Task 5.9 뒤 실제 원형에는 필수 pending 이 없다 — blocker 장치를 보는 시험은 dashboard 사본의 한 섹션을 pending 으로 돌려 쓴다.
const pendingDashboard = () => {
  const d = structuredClone(archetypes.dashboard)
  Object.assign(d.pages.find((p) => p.id === 'operational').sections.find((x) => x.kind === 'filter-bar'), { blockKinds: [], allowedVariants: [], noBlock: { mode: 'pending', reason: '시험용', register: ['A87'] } })
  return buildSitemap(d, briefOf('dashboard', {}))
}
const cands = library.slice(0, 3).map((r, i) => ({ id: 'abc'[i], recipe: r.id }))
const allowedOf = (s, key) => {
  const [page, kind] = key.split('/')
  return page === 'global' ? s.globals.find((g) => g.kind === kind).allowedVariants : s.pages.find((p) => p.id === page).sections.find((x) => x.kind === kind).allowedVariants
}
const blockSlots = (s) => [
  ...s.pages.flatMap((p) => p.sections.filter((x) => x.status === 'block').map((x) => [`${p.id}/${x.kind}`, x])),
  ...s.globals.filter((g) => g.status === 'block').map((g) => [`global/${g.kind}`, g]),
]

// ─── 사이트맵 ───

test('sitemap: optional section only when its facts exist (local external-reviews, hours-table)', () => {
  const bare = sm('local', { name: '예시 의원' })
  assert.ok(!kinds(bare, 'home').includes('external-reviews'), '리뷰 사실 없음 → 없음')
  assert.ok(!kinds(bare, 'home').includes('hours-table'))
  const withFacts = sm('local', { name: '예시 의원', reviews: '네이버 4.6 (예시)', hours: '평일 9-18' })
  assert.ok(kinds(withFacts, 'home').includes('external-reviews'))
  assert.ok(kinds(withFacts, 'home').includes('hours-table'))
  const blank = sm('local', { name: '예시 의원', reviews: '   ' })
  assert.ok(!kinds(blank, 'home').includes('external-reviews'), '공백 사실은 사실이 아니다')
  assert.ok(bare.excluded.some((e) => e.page === 'home' && e.kind === 'external-reviews' && e.why === 'no-facts'))
})

test('sitemap: fact names match loosely (camelCase, kebab, case), ALWAYS_INCLUDED sections need none', () => {
  assert.ok(hasFact({ facts: { ExternalReviews: 'x' } }, ['externalReviews']))
  assert.ok(hasFact({ facts: { 'key-facts': 'x' } }, ['keyFacts']))
  assert.ok(!hasFact({ facts: { reviews: '' } }, ['reviews']))
  const c = sm('commerce', { name: '예시 몰' })
  assert.ok(kinds(c, 'home').includes('hero'), 'hero 는 사실 없이도')
})

test('sitemap: every required v0 section of every archetype is present, in archetype order', () => {
  for (const [id, a] of Object.entries(archetypes)) {
    const s = sm(id, {})
    for (const p of a.pages.filter((p) => (p.phase ?? 'v0') === 'v0')) {
      // 사실 없이는 지어내야 그릴 수 있는 필수 섹션(FACT_GATED)은 사실 없는 브리프에서 빠진다(QFIX2) — stamp-qfix2-local.test.mjs 가 그 사실이 있으면 들어오는 것을 본다
      const want = p.sections.filter((x) => x.required && !FACT_GATED[`${id}/${p.id}/${x.kind}`]).map((x) => x.kind)
      const got = kinds(s, p.id)
      assert.deepEqual(got.filter((k) => want.includes(k)), want, `${id}/${p.id}`)
    }
  }
})

test('sitemap: legal pages come from the archetype (privacy always; saas has /cancel + retention)', () => {
  const local = sm('local', {})
  assert.deepEqual(local.pages.filter((p) => p.legal).map((p) => p.route), ['/privacy'])
  const saas = sm('saas', {})
  assert.deepEqual(saas.pages.filter((p) => p.legal).map((p) => p.route), ['/privacy', '/terms', '/refund', '/withdrawal'])
  assert.ok(saas.pages.some((p) => p.route === '/cancel'))
  assert.ok(kinds(saas, 'cancel').includes('retention'))
  for (const p of saas.pages.filter((p) => p.legal)) assert.deepEqual(p.sections, [])
})

test('sitemap C75: required pending sections stay (status pending + register), blockers name them', () => {
  // FV1 Task 5.9 로 네 원형(commerce·dashboard·detail·pwa)의 필수 pending 이 모두 블록·부품에 묶였다 — 장치(pending 은 사라지지 않고 blocker 로 남는다)는 다시 pending 으로 돌린 사본으로 본다.
  const d = structuredClone(archetypes.dashboard)
  const s = d.pages.find((p) => p.id === 'operational').sections.find((x) => x.kind === 'filter-bar')
  Object.assign(s, { blockKinds: [], allowedVariants: [], noBlock: { mode: 'pending', reason: '시험용', register: ['A87'] } })
  const sitemap = buildSitemap(d, briefOf('dashboard', {}))
  const filter = sitemap.pages.find((p) => p.id === 'operational').sections.find((x) => x.kind === 'filter-bar')
  assert.equal(filter.status, 'pending')
  assert.deepEqual(filter.register, ['A87'])
  assert.deepEqual(sitemap.blockers, [`${BLOCKER_PREFIX}operational/filter-bar (A87)`])
  assert.deepEqual(sitemapBlockers(sitemap), sitemap.blockers)
  // 진짜 dashboard 는 막히는 섹션이 없다
  assert.deepEqual(sm('dashboard', {}).blockers, [])
})

test('sitemap C75: required pending sections are all bound now (3a — the cart blocks) and the v0.2 shop pages stay out of the sitemap = 0 blockers', () => {
  let requiredPending = 0
  for (const a of Object.values(archetypes)) for (const p of a.pages) for (const s of p.sections) if (s.required && s.noBlock?.mode === 'pending') requiredPending++
  assert.equal(requiredPending, 0, '장바구니 쪽 필수 pending 셋(A60)은 3a 에서 cart 블록에 묶였다')
  const total = Object.keys(archetypes).reduce((n, id) => n + sm(id, {}).blockers.length, 0)
  assert.equal(total, 0)
  const c = sm('commerce', {})
  assert.ok(!c.pages.some((p) => p.id === 'cart'), 'v0.2 쪽은 뺀다')
  assert.deepEqual(c.excluded.filter((e) => e.page === 'cart'), [{ page: 'cart', why: 'phase-v0.2' }])
  // 상점 쪽 다섯(장바구니·결제·주문 완료·주문 내역·주문 상세)은 모두 v0.2 라 사이트맵에 들지 않는다 — 지금 commerce 사이트(외부 판매처 링크형)의 출력은 그대로다
  for (const id of ['cart', 'checkout', 'order-complete', 'orders', 'order-detail']) assert.ok(!c.pages.some((p) => p.id === id), id)
  assert.deepEqual(c.excluded.filter((e) => e.why === 'phase-v0.2').map((e) => e.page).sort(), ['cart', 'checkout', 'order-complete', 'order-detail', 'orders'])
  assert.deepEqual(c.blockers, [])
  assert.deepEqual(sm('local', {}).blockers, [])
})
test('sitemap C75: optional pending section comes in only with facts, and never blocks', () => {
  const none = sm('detail', { name: 'x' })
  assert.ok(!kinds(none, 'product-detail').includes('related'))
  const withRelated = sm('detail', { name: 'x', related: '같은 시리즈 3개' })
  const related = withRelated.pages[0].sections.find((x) => x.kind === 'related')
  assert.equal(related.status, 'pending')
  assert.ok(!withRelated.blockers.some((b) => b.includes('related')))
  assert.equal(withRelated.blockers.length, none.blockers.length)
})

test('sitemap C75: candidate.json gets the blockers — merged, idempotent, other fields kept, only its own lines replaced', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-'))
  mkdirSync(join(dir, 'a'), { recursive: true })
  writeFileSync(join(dir, 'a', 'candidate.json'), JSON.stringify({ source: 'library', recipe: 'r1-measure', blockers: ['법률 검토 미완'] }))
  const d = pendingDashboard()
  writeCandidateBlockers(dir, 'a', d)
  writeCandidateBlockers(dir, 'a', d)
  const j = JSON.parse(readFileSync(join(dir, 'a', 'candidate.json'), 'utf8'))
  assert.equal(j.source, 'library')
  assert.deepEqual(j.blockers, ['법률 검토 미완', ...d.blockers])
  writeCandidateBlockers(dir, 'a', sm('local', {}))
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'a', 'candidate.json'), 'utf8')).blockers, ['법률 검토 미완'])
})

test('sitemap stage: 02-sitemap.json written per J7, skipped on same inputs, redone when brief changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-'))
  const a = archetypes.dashboard
  const brief = briefOf('dashboard', { name: 'x' })
  const first = await runSitemapStage(openRun(dir), 'a', { archetype: a, brief })
  const file = join(dir, 'a', '02-sitemap.json')
  const t0 = statSync(file).mtimeMs
  const at0 = JSON.parse(readFileSync(file, 'utf8')).producedAt
  await new Promise((r) => setTimeout(r, 15))
  assert.deepEqual(await runSitemapStage(openRun(dir), 'a', { archetype: a, brief }), first)
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).producedAt, at0)
  assert.equal(statSync(file).mtimeMs, t0)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'a', 'candidate.json'), 'utf8')).blockers, first.blockers)
  const again = await runSitemapStage(openRun(dir), 'a', { archetype: a, brief: briefOf('dashboard', { name: 'x', metrics: 'y' }) })
  assert.notEqual(JSON.parse(readFileSync(file, 'utf8')).producedAt, at0)
  assert.ok(again.pages.find((p) => p.id === 'operational').sections.some((s) => s.kind === 'trend-charts'))
})

test('sitemap: wrong archetype throws', () => {
  assert.throws(() => buildSitemap(archetypes.local, briefOf('saas')), /원형이 브리프와 다르다/)
})

test('sitemap C77: global sections bind to blocks that list this archetype; the rest are status none', () => {
  const local = sm('local', {})
  const g = Object.fromEntries(local.globals.map((x) => [x.kind, x]))
  // C110(Task 9b): 머리글은 SiteShell 이 그리므로 nav 블록을 고르지 않는다 — 고르면 쓰이지 않는다
  assert.equal(g.header.status, 'shell')
  assert.equal(g.header.allowedVariants, undefined)
  assert.ok(g['sticky-booking-bar'].allowedVariants.includes('block-bottom-tab-split-booking-bar') && g['sticky-booking-bar'].allowedVariants.every((n) => n.startsWith('block-bottom-tab-')))
  assert.equal(g['kakao-channel-button'].status, 'none')
  assert.equal(sm('public', {}).globals.find((x) => x.kind === 'header').status, 'shell', '어느 원형이든 머리글은 SiteShell — nav 블록을 적은 원형이 없어도 같다')
  // 03-variants 는 셸이 그리는 머리글에 블록을 고르지 않는다(쓰이지 않을 nav 블록)
  for (const id of ['local', 'saas', 'brand']) {
    const s = sm(id, {})
    const picked = chooseVariants(s, cands, { seed: 1, weights: [] })
    for (const c of cands) assert.equal(Object.keys(picked[c.id]).some((k) => k === 'global/header'), false, `${id}: 머리글 블록이 골라졌다`)
  }
})

test('sitemap C77: sectionOrderTemplates names resolve to a section or global section (known gaps pinned)', () => {
  const unresolved = []
  for (const a of Object.values(archetypes)) {
    const own = new Set(a.pages.flatMap((p) => p.sections.flatMap((s) => [s.kind, `${p.id}:${s.kind}`])))
    for (const g of a.globalSections) own.add(g.kind)
    for (const t of a.sectionOrderTemplates) for (const n of t.order) if (!own.has(n)) unresolved.push(`${a.id}/${t.id}:${n}`)
  }
  // 대장 C92 — 원형 데이터(Task 1 산출물)의 이름을 고치면 이 목록을 비운다.
  assert.deepEqual(unresolved, [
    'dashboard/V1-operational:app-shell', 'dashboard/V2-analytics:app-shell', 'dashboard/V3-admin:app-shell',
    'pwa/V3-offline-first:app-shell-cached', 'pwa/V3-offline-first:offline-ready-toast', 'pwa/V3-offline-first:saved-pending-queue', 'pwa/V3-offline-first:sync-complete',
  ])
})

test('sitemap C51: no v0 section binds order-complete, so no guest-lookup link exists to point nowhere', () => {
  for (const a of Object.values(archetypes)) for (const p of a.pages.filter((p) => (p.phase ?? 'v0') === 'v0')) for (const s of p.sections) {
    assert.ok(!s.allowedVariants.includes('block-confirmation-order-complete'), `${a.id}/${p.id}/${s.kind}`)
  }
})

// ─── 변형 고르기 ───

test('variants: every block slot gets one allowed block per candidate; non-block sections get none', () => {
  const s = sm('saas', { name: 'x', price: '월 9,900원', faq: 'q' })
  const v = chooseVariants(s, cands, { seed: 1, weights: [] })
  const slots = blockSlots(s)
  assert.ok(slots.length > 8)
  for (const c of cands) {
    assert.deepEqual(Object.keys(v[c.id]).sort(), slots.map(([k]) => k).sort())
    for (const [k, sec] of slots) assert.ok(sec.allowedVariants.includes(v[c.id][k]), `${c.id} ${k}`)
  }
  assert.ok(!('home/changelog' in v.a), 'content 섹션에는 블록이 없다')
})

test('variants: the three candidates get three different hero blocks', () => {
  const v = chooseVariants(sm('saas', {}), cands, { seed: 3, weights: [] })
  assert.equal(new Set(cands.map((c) => v[c.id]['home/hero'])).size, 3)
})

test('variants: as different as the slot allows — never all three the same unless one variant only', () => {
  for (const id of Object.keys(archetypes)) {
    const s = sm(id, {})
    const v = chooseVariants(s, cands, { seed: 5, weights: [] })
    for (const [k, sec] of blockSlots(s)) {
      const picked = cands.map((c) => v[c.id][k])
      const n = new Set(picked).size
      // 운영자 판정(FB9)으로 기본에서 내린 블록(DEMOTED)은 후보 수를 채우자고 뽑지 않는다 — 다름의 상한은 내리지 않은 변형 수다(내릴 것밖에 없으면 그대로)
      const kept = sec.allowedVariants.filter((b) => !(DEMOTED[s.archetype] ?? []).includes(b))
      const cap = Math.min(3, (kept.length || sec.allowedVariants.length))
      assert.equal(n, cap, `${id} ${k}: ${sec.allowedVariants.length}개 중 ${n}개 다름`)
    }
  }
})

test('variants: same seed → same result; the seed reorders ties', () => {
  const s = sm('saas', {})
  const a = chooseVariants(s, cands, { seed: 11, weights: [] })
  assert.deepEqual(chooseVariants(s, cands, { seed: 11, weights: [] }), a)
  const other = [12, 13, 14, 15].map((seed) => chooseVariants(s, cands, { seed, weights: [] }))
  assert.ok(other.some((o) => JSON.stringify(o) !== JSON.stringify(a)), '씨앗이 결과에 닿는다')
})

test('variants: works with no weights file (J11 absence handled)', () => {
  const v = chooseVariants(sm('local', {}), cands, { seed: 1 })
  assert.ok(v.a['home/hero-visit-info'])
})

test('variants J11: a block with >= 30 conversions comes first in its slot; 29 changes nothing; other archetype and disallowed keys ignored', () => {
  const s = sm('saas', { faq: 'q' })
  const base = chooseVariants(s, cands, { seed: 2, weights: [] })
  const target = allowedOf(s, 'home/faq').find((b) => b !== base.a['home/faq'])
  const row = (over) => ({ scope: 'block', key: target, archetype: 'saas', lift: 0.4, conversions: 30, samples: 900, updatedAt: '2026-09-30', ...over })
  const lifted = chooseVariants(s, cands, { seed: 2, weights: [row()] })
  assert.equal(lifted.a['home/faq'], target, '첫 후보가 가중치 블록을 받는다')
  assert.notDeepEqual(lifted, base)
  assert.deepEqual(chooseVariants(s, cands, { seed: 2, weights: [row({ conversions: 29 })] }), base)
  assert.deepEqual(chooseVariants(s, cands, { seed: 2, weights: [row({ archetype: 'local' })] }), base)
  assert.deepEqual(chooseVariants(s, cands, { seed: 2, weights: [row({ scope: 'recipe' })] }), base)
  const outside = chooseVariants(s, cands, { seed: 2, weights: [{ ...row(), key: 'block-faq-grouped-by-topic', lift: 9 }] })
  for (const [k, sec] of blockSlots(s)) for (const c of cands) assert.ok(sec.allowedVariants.includes(outside[c.id][k]), '허용 밖 블록이 끼어들지 않는다')
  assert.ok(!allowedOf(s, 'home/faq').includes('block-faq-grouped-by-topic'))
})

test('variants J11: weights reorder but distinctness stays (a heavy row does not give all three the same block)', () => {
  const s = sm('saas', {})
  const key = 'home/hero'
  const top = allowedOf(s, key)[0]
  const v = chooseVariants(s, cands, { seed: 2, weights: [{ scope: 'block', key: top, archetype: 'saas', lift: 5, conversions: 500 }] })
  assert.equal(new Set(cands.map((c) => v[c.id][key])).size, 3)
  assert.equal(v.a[key], top)
})

test('variants: density tendency of the recipe head meets block meta.density', () => {
  const dens = blockDensities()
  assert.equal(dens.get('block-hero-banded-full-bleed'), 'spacious')
  assert.equal(dens.get('block-hero-baseline-news-app-window'), 'compact')
  const one = { archetype: 'saas', pages: [{ id: 'p', sections: [{ kind: 'hero', status: 'block', allowedVariants: ['block-hero-banded-full-bleed', 'block-hero-baseline-news-app-window'] }] }], globals: [] }
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    assert.equal(chooseVariants(one, [{ id: 'x', recipe: { axes: { table: 'T1' } } }], { seed, weights: [] }).x['p/hero'], 'block-hero-baseline-news-app-window', `T1 seed ${seed}`)
    assert.equal(chooseVariants(one, [{ id: 'x', recipe: { axes: { table: 'T3' } } }], { seed, weights: [] }).x['p/hero'], 'block-hero-banded-full-bleed', `T3 seed ${seed}`)
  }
  assert.equal(densityOf({ axes: { table: 'T1', display: 'D2' } }), 'comfortable')
  assert.equal(densityOf({ axes: { display: 'D3' } }), 'spacious')
  assert.equal(densityOf({ axes: {} }), 'comfortable')
})

test('variants: a recipe whose own hero is allowed keeps it (recipe fidelity), the others still differ', () => {
  const s = sm('saas', {})
  const lib = library.find((r) => allowedOf(s, 'home/hero').includes(`block-hero-${r.hero}`))
  assert.ok(lib, '허용 목록에 있는 히어로를 가진 라이브러리 레시피가 있다')
  const c = [{ id: 'a', recipe: lib.id }]
  for (const seed of [1, 2, 3]) assert.equal(chooseVariants(s, c, { seed, weights: [] }).a['home/hero'], `block-hero-${lib.hero}`)
})

test('variants: a candidate whose recipe cannot be found fails loudly', () => {
  assert.throws(() => chooseVariants(sm('saas', {}), [{ id: 'z', recipe: 'no-such-recipe' }], { weights: [] }), /레시피 머리를 찾지 못했다/)
})

test('variants stage: 03-variants.json per candidate (J7); same inputs skip, new seed or weights redo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vr-'))
  const s = sm('saas', {})
  const first = await runVariantStages(openRun(dir), s, cands, { seed: 4, weights: [] })
  for (const c of cands) {
    assert.ok(existsSync(join(dir, c.id, '03-variants.json')))
    assert.deepEqual(first[c.id], chooseVariants(s, cands, { seed: 4, weights: [] })[c.id])
  }
  const at = JSON.parse(readFileSync(join(dir, 'a', '03-variants.json'), 'utf8')).producedAt
  await new Promise((r) => setTimeout(r, 15))
  assert.deepEqual(await runVariantStages(openRun(dir), s, cands, { seed: 4, weights: [] }), first)
  assert.equal(JSON.parse(readFileSync(join(dir, 'a', '03-variants.json'), 'utf8')).producedAt, at)
  await runVariantStages(openRun(dir), s, cands, { seed: 5, weights: [] })
  assert.notEqual(JSON.parse(readFileSync(join(dir, 'a', '03-variants.json'), 'utf8')).producedAt, at)
})
