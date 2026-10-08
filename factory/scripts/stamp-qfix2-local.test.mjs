// FV1 Task 6.3 2차(QFIX2) — local 의 남은 품질 사유 셋.
//  ① 날짜 붙은 공지: 맨 위 띠(top-bar)는 끝나는 날(A8)이 필수다. 골든 local 브리프에 날짜가 없어 띠를 못 그렸다 → 가상 공지(날짜 포함)를 사실로 더하고 04 구조 칸(notices)으로 옮긴다.
//     사실이 없는 브리프는 섹션을 사이트맵에서 뺀다(commerce notice-bar 와 같은 방식 — 끝나는 날을 지어내지 않는다).
//  ② 메뉴 가격표: binder 는 맞게 동작했다. 골든 local-1 의 menu 사실에 가격이 없어(「주야간보호 · 방문 상담 · 송영 서비스」) 04 가 menu[].price 를 쓸 수 없었다 → 브리프 사실에 가격을 더한다.
//  ③ 예약 단계 폼(C143): 날짜·시간 칩이 필요한데 자체 예약 시스템이 없어 지어내면 거짓 가능 시간이다(binder 는 null). 가능한 날짜·시간 사실(bookableSlots)이 있는 브리프에서만 사이트맵에 둔다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix2-local.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { checkStructure } from '../stamp/content-structure.mjs'
import { FACT_NAMES } from '../stamp/content.mjs'
import { archetypes } from './lib/stamp-site-fixtures.mjs'
import { goldenOf, goldenRequest } from './lib/stamp-structure-fixtures.mjs'

const keysOf = (sitemap) => sitemap.pages.flatMap((p) => p.sections.map((s) => `${p.id}/${s.kind}`))
const without = (id, ...names) => { const b = structuredClone(goldenOf(id).brief); for (const n of names) delete b.facts[n]; return b }

test('[local ①] 날짜 붙은 공지 사실(notices)이 있으면 공지 섹션이 들어오고, 없으면 빠진다 — 끝나는 날을 지어내지 않는다', () => {
  for (const id of ['local-1', 'local-2']) {
    const keys = keysOf(buildSitemap(archetypes.local, goldenOf(id).brief))
    assert.ok(keys.includes('home/notice'), `${id}: 골든 브리프에 날짜 붙은 공지 사실이 있어야 한다`)
    const none = keysOf(buildSitemap(archetypes.local, without(id, 'notices')))
    assert.equal(none.includes('home/notice'), false, `${id}: 공지 사실이 없는데 공지 섹션이 있다`)
  }
  assert.ok(FACT_NAMES.includes('notices'))
})

test('[local ①] 04 요청이 notices 구조 칸을 싣고, 사실의 날짜·글만 옮긴 콘텐츠는 검사 0건 · 사실에 없는 날짜·문장은 떨어진다', () => {
  const { request } = goldenRequest('local-2')
  const s = request.structureSlots.find((x) => x.path === 'notices')
  assert.ok(s, '구조 칸 notices 가 요청에 없다')
  assert.equal(s.empty, false)
  assert.deepEqual(s.factsUsed, ['notices'])
  const fact = request.facts.notices
  const [date, text] = fact.split('|').map((x) => x.trim())
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(checkStructure(request, { notices: [{ date, text }] }), [])
  assert.ok(checkStructure(request, { notices: [{ date: '2031-01-01', text }] }).some((l) => l.startsWith('[structure-trace]')))
  assert.ok(checkStructure(request, { notices: [{ date, text: '사실에 없는 문장이에요' }] }).some((l) => l.startsWith('[structure-trace]')))
  assert.ok(checkStructure(request, {}).some((l) => l.startsWith('[structure-missing]')))
  // 사실이 없는 브리프에는 칸이 없다(섹션이 사이트맵에 없다)
  assert.equal((goldenRequest('local-2', { brief: without('local-2', 'notices') }).request.structureSlots ?? []).find((x) => x.path === 'notices'), undefined)
})

test('[local ②] 골든 local-1 의 메뉴 사실에 가격이 있다 — 04 가 menu[].price 를 쓸 수 있다', () => {
  for (const id of ['local-1', 'local-2']) {
    const menu = goldenOf(id).brief.facts.menu
    assert.match(menu, /\d[\d,]*\s*원/, `${id}: menu 사실에 금액이 없다`)
  }
})

test('[local ③] 예약 단계 폼(bookable-item)은 가능한 날짜·시간 사실(bookableSlots)이 있을 때만 사이트맵에 든다 — 없으면 거짓 가능 시간을 그리지 않는다(C143)', () => {
  const base = goldenOf('local-1').brief
  assert.equal(keysOf(buildSitemap(archetypes.local, base)).includes('product-detail/bookable-item'), false)
  assert.equal(keysOf(buildSitemap(archetypes.local, base)).includes('product-detail/booking-cta'), true, '실제 예약 행동(전화·채널)은 그대로 둔다')
  const withSlots = { ...base, facts: { ...base.facts, bookableSlots: '영업일 오전 10시와 오후 2시에 상담을 받아요' } }
  assert.ok(keysOf(buildSitemap(archetypes.local, withSlots)).includes('product-detail/bookable-item'))
  assert.ok(FACT_NAMES.includes('bookableSlots'))
})
