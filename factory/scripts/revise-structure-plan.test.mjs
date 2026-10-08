// 구획 구조 조작(FIT-1)의 순수 부분 — 사이트맵 기준 판정(planStructure)과 04 문구 칸 다시 맞추기(realign). 실행 폴더·Chrome 없음.
// realign 의 핵심: 문구 항목은 id 와 나온 차례로 칸에 짝지어지므로(bindCopy) 같은 id 를 쓰는 구획이 둘 이상이면 칸이 빠지거나 자리가 바뀔 때 글이 밀린다 — 실제 사이트에서는 title·headline·primaryCta 가 구획마다 겹친다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bindCopy } from '../stamp/content.mjs'
import { newSlotsFor, planStructure, realign } from '../stamp/revise-structure.mjs'
import { archetypes } from './lib/stamp-site-fixtures.mjs'

const sec = (kind, extra = {}) => ({ kind, required: false, status: 'block', allowedVariants: [`block-${kind}-x`], ...extra })
const sitemapOf = (kinds, extra = {}) => ({ archetype: 'local', pages: [{ id: 'home', route: '/', sections: kinds.map((k) => (typeof k === 'string' ? sec(k) : k)) }, { id: 'privacy', route: '/privacy', legal: true, sections: [] }], globals: [{ kind: 'footer', required: true, status: 'block', allowedVariants: ['block-footer-x'] }], excluded: [], blockers: [], ...extra })

// ── realign ─────────────────────────────────────────────────────────────────

const slotOf = (key, id) => ({ path: `${key}/${id}`, id, role: 'r', maxChars: null, block: 'b', factsUsed: [] })
const requestOf = (keys) => ({ locale: 'ko', slots: keys.map((k) => slotOf(k, 'title')), sections: keys, skipped: [] })
const contentOf = (texts) => ({ locale: 'ko', slots: { copy: texts.map((t) => ({ id: 'title', role: 'r', text: t })), images: [] }, copyVariants: { 'home/b': 'v1', 'home/a': 'v2' } })
const texts = (request, content) => request.slots.map((s) => bindCopy(request, content).get(s.path)?.entry.text)

test('realign 빼기: 같은 id 의 칸이 셋일 때 가운데를 빼면 남은 칸이 제 글을 읽는다(글이 밀리지 않는다)', () => {
  const request = requestOf(['home/a', 'home/b', 'home/c'])
  const content = contentOf(['A', 'B', 'C'])
  const sitemap = sitemapOf(['a', 'c'])
  const r = realign({ request, content, sitemap, removedKey: 'home/b', preview: false, locale: 'ko' })
  assert.deepEqual(r.request.slots.map((s) => s.path), ['home/a/title', 'home/c/title'])
  assert.deepEqual(texts(r.request, r.content), ['A', 'C'], '밀렸다면 [A, B]')
  assert.deepEqual(r.content.slots.copy.map((e) => e.text), ['A', 'C'], '남은 항목이 없다(요청에 없는 칸이 남으면 콘텐츠 검사가 막는다)')
  assert.deepEqual(r.content.copyVariants, { 'home/a': 'v2' }, '뺀 구획의 문구 변형 태그도 지운다')
  assert.deepEqual(r.request.sections, ['home/a', 'home/c'])
  assert.deepEqual(content.slots.copy.map((e) => e.text), ['A', 'B', 'C'], '받은 값은 바꾸지 않는다')
})

test('realign 순서: 칸과 항목이 함께 움직여 구획마다 제 글을 읽는다', () => {
  const request = requestOf(['home/a', 'home/b', 'home/c'])
  const content = contentOf(['A', 'B', 'C'])
  const r = realign({ request, content, sitemap: sitemapOf(['c', 'a', 'b']), preview: false, locale: 'ko' })
  assert.deepEqual(r.request.slots.map((s) => s.path), ['home/c/title', 'home/a/title', 'home/b/title'])
  assert.deepEqual(texts(r.request, r.content), ['C', 'A', 'B'], '항목을 옮기지 않았다면 [A, B, C] 를 그대로 읽는다')
  assert.deepEqual(r.request.sections, ['home/c', 'home/a', 'home/b'])
})

test('realign 더하기: 새 구획의 칸을 순서 자리에 끼우고, 사실이 있는 칸은 비우고 사실이 없는 칸은 자리 표시를 놓는다 — 기존 글은 그대로', () => {
  const request = requestOf(['home/a', 'home/c'])
  const content = contentOf(['A', 'C'])
  const sitemap = sitemapOf(['a', 'b', 'c'])
  const added = { key: 'home/b', slots: [{ ...slotOf('home/b', 'title'), factsUsed: ['name'] }, { ...slotOf('home/b', 'note'), placeholder: true, factsWanted: ['x'], factsUsed: [] }, { ...slotOf('home/b', 'ui:copy.caption'), ui: { path: 'copy.caption', example: 'e', why: 'example' } }] }
  const r = realign({ request, content, sitemap, added, preview: false, locale: 'ko' })
  assert.deepEqual(r.request.slots.map((s) => s.path), ['home/a/title', 'home/b/title', 'home/b/note', 'home/b/ui:copy.caption', 'home/c/title'])
  const entries = r.content.slots.copy
  assert.deepEqual(entries.map((e) => [e.id, e.text]), [['title', 'A'], ['title', ''], ['note', '확인 필요'], ['title', 'C']], '안내 문구 칸(ui)은 에이전트가 쓸 때까지 항목이 없다')
  const bound = bindCopy(r.request, r.content)
  assert.equal(bound.get('home/a/title').entry.text, 'A')
  assert.equal(bound.get('home/c/title').entry.text, 'C', '새 title 칸이 끼어도 C 가 밀리지 않는다')
  assert.equal(bound.get('home/b/title').entry.text, '')
  // 미리보기(제안 사본)는 06 이 그릴 수 있게 모든 새 문구 칸을 자리 표시로 채운다
  const p = realign({ request, content, sitemap, added, preview: true, locale: 'ko' })
  assert.deepEqual(p.content.slots.copy.map((e) => e.text), ['A', '확인 필요', '확인 필요', 'C'])
})

test('newSlotsFor: 원형이 적은 문구 칸에 사실이 있는지로 자리 표시 칸을 가른다(local 후기 — 사실 reviews 가 있으면 글을 써야 하는 칸)', () => {
  const withFact = newSlotsFor({ archetype: archetypes.local, kind: 'external-reviews', key: 'home/external-reviews', block: 'block-x', facts: { reviews: '네이버 4.8' } })
  const without = newSlotsFor({ archetype: archetypes.local, kind: 'external-reviews', key: 'home/external-reviews', block: 'block-x', facts: {} })
  assert.deepEqual(withFact.map((s) => s.path), ['home/external-reviews/link'])
  assert.equal(withFact[0].placeholder, false)
  assert.equal(without[0].placeholder, true)
  assert.deepEqual(without[0].factsWanted, withFact[0].factsWanted)
  const ui = newSlotsFor({ archetype: archetypes.local, kind: 'faq', key: 'home/faq', block: 'block-x', facts: {}, uiLeaves: [{ path: 'copy.caption', example: '예시 문장', why: 'example' }] })
  assert.equal(ui.at(-1).path, 'home/faq/ui:copy.caption')
  assert.equal(ui.at(-1).ui.example, '예시 문장')
})

// ── planStructure ───────────────────────────────────────────────────────────

const L = archetypes.local
const plan = (sitemap, op, facts = {}) => planStructure({ sitemap, archetype: L, op, facts })
const base = () => sitemapOf([sec('hero-visit-info', { required: true }), sec('notice', { required: true }), sec('hours-table'), sec('menu-price', { required: true }), sec('directions', { required: true }), sec('faq')])

test('planStructure 빼기: 선택 구획만, 쪽에 하나뿐이면 거절, 전역 필수(푸터)는 거절 — 받은 사이트맵은 바꾸지 않는다', () => {
  const sm = base()
  const before = JSON.stringify(sm)
  const ok = plan(sm, { scope: 'remove', target: 'home/faq' })
  assert.deepEqual(ok.plan.after, ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions'])
  assert.deepEqual(ok.plan.sitemap.excluded, [{ page: 'home', kind: 'faq', why: 'revise-removed' }])
  assert.equal(JSON.stringify(sm), before)
  assert.match(plan(sm, { scope: 'remove', target: 'home/menu-price' }).ask, /꼭 있어야/)
  assert.match(plan(sm, { scope: 'remove', target: 'global/footer' }).ask, /꼭 있어야/)
  assert.ok(plan(sm, { scope: 'remove', target: 'home/nothing' }).ask)
  assert.match(plan(sitemapOf([sec('faq')]), { scope: 'remove', target: 'home/faq' }).ask, /하나도 안 남아요/)
  assert.match(planStructure({ sitemap: sm, archetype: L, op: { scope: 'remove', target: 'home/menu-price' }, lang: 'en' }).ask, /must stay/i)
})

test('planStructure 순서: after·before·start·end · 이미 그 순서면 거절 · 히어로 위/히어로 자체/전역은 거절', () => {
  const sm = base()
  const after = (r) => r.plan.after
  assert.deepEqual(after(plan(sm, { scope: 'order', target: 'home/directions', anchor: 'home/hero-visit-info', place: 'after' })), ['hero-visit-info', 'directions', 'notice', 'hours-table', 'menu-price', 'faq'])
  assert.deepEqual(after(plan(sm, { scope: 'order', target: 'home/faq', anchor: 'home/hours-table', place: 'before' })), ['hero-visit-info', 'notice', 'faq', 'hours-table', 'menu-price', 'directions'])
  assert.deepEqual(after(plan(sm, { scope: 'order', target: 'home/hours-table', anchor: null, place: 'end' })), ['hero-visit-info', 'notice', 'menu-price', 'directions', 'faq', 'hours-table'])
  assert.match(plan(sm, { scope: 'order', target: 'home/faq', anchor: null, place: 'start' }).ask, /히어로/)
  assert.match(plan(sm, { scope: 'order', target: 'home/faq', anchor: 'home/hero-visit-info', place: 'before' }).ask, /히어로/)
  assert.match(plan(sm, { scope: 'order', target: 'home/hero-visit-info', anchor: 'home/faq', place: 'after' }).ask, /히어로/)
  assert.match(plan(sm, { scope: 'order', target: 'home/notice', anchor: 'home/hero-visit-info', place: 'after' }).ask, /이미/)
  assert.match(plan(sm, { scope: 'order', target: 'home/faq', anchor: null, place: 'end' }).ask, /이미/)
  assert.match(plan(sm, { scope: 'order', target: 'global/footer', anchor: 'home/faq', place: 'before' }).ask, /푸터/)
  assert.ok(plan(sm, { scope: 'order', target: 'home/faq', anchor: 'privacy/nothing', place: 'before' }).ask)
})

test('planStructure 더하기: 원형이 적은 순서대로 끼운다 · 이미 있음/필수/본문 구획/없는 구획은 거절 · 사실이 필요한 구획은 사실이 있을 때만', () => {
  const sm = base()
  sm.pages[0].sections = sm.pages[0].sections.filter((s) => s.kind !== 'faq')
  const kinds = (r) => r.plan.after
  // 원형 순서: hero-visit-info, notice, hours-table, menu-price, departments, doctors, gallery, directions, branches, external-reviews, faq, contact-form
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/external-reviews' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions', 'external-reviews'])
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/faq' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions', 'faq'])
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/contact-form' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions', 'contact-form'])
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/branches' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions', 'branches'])
  // 자리를 말하면 그 자리
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/faq', anchor: 'home/menu-price', place: 'after' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'faq', 'directions'])
  assert.deepEqual(kinds(plan(sm, { scope: 'add', target: 'home/faq', anchor: null, place: 'end' })), ['hero-visit-info', 'notice', 'hours-table', 'menu-price', 'directions', 'faq'])
  assert.match(plan(sm, { scope: 'add', target: 'home/faq', anchor: null, place: 'start' }).ask, /히어로/)
  // 거절
  assert.match(plan(sm, { scope: 'add', target: 'home/menu-price' }).ask, /이미/)
  assert.match(plan(base(), { scope: 'add', target: 'home/faq' }).ask, /이미/)
  assert.match(plan(sm, { scope: 'add', target: 'home/gallery' }).ask, /더할 수 있는/)
  assert.match(plan(sm, { scope: 'add', target: 'home/nothing' }).ask, /더할 수 있는/)
  assert.match(plan(sm, { scope: 'add', target: 'booking-complete/confirmation' }).ask, /더할 수 있는/)
  // 사실 없이는 지어내야 그려지는 구획(sitemap.mjs FACT_GATED)은 사실이 있을 때만 더한다. 지금 원형 JSON 에는 이 표의 구획이 모두 필수라, portfolio 의 about 을 선택으로 바꾼 사본으로 본다.
  const P = structuredClone(archetypes.portfolio)
  P.pages.find((p) => p.id === 'home').sections.find((s) => s.kind === 'about').required = false
  const psm = { archetype: 'portfolio', pages: [{ id: 'home', route: '/', sections: [{ kind: 'statement', required: true, status: 'block', allowedVariants: ['b'] }, { kind: 'contact-cta', required: true, status: 'block', allowedVariants: ['b'] }] }], globals: [], excluded: [], blockers: [] }
  assert.match(planStructure({ sitemap: psm, archetype: P, op: { scope: 'add', target: 'home/about' }, facts: {} }).ask, /사실/)
  const withFact = planStructure({ sitemap: psm, archetype: P, op: { scope: 'add', target: 'home/about' }, facts: { founded: '2020' } })
  assert.deepEqual(withFact.plan.after, ['statement', 'about', 'contact-cta'])
})
