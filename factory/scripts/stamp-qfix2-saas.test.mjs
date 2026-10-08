// FV1 Task 6.3 2차(QFIX2) — saas 의 후기(social-proof)·연동(integrations) 섹션.
// 원인: binder 는 콘텐츠 testimonials[]·integrations[] 를 읽어 맞게 묶는다. 그런데 04 요청이 이 두 칸을 구조 칸으로 요청한 적이 없고(STRUCTURE_FACTS 에 saas 는 changelog 뿐),
//   골든 saas 브리프의 integrations 사실은 「CSV 가져오기 · 이메일 알림」 같은 기능 이름이라 주소가 있는 연동 항목이 될 수 없었으며 후기 사실은 없었다 → 04 가 칸을 비워 두고 06 이 「자료 연결 안 됨」을 낸다.
// 고침: ① 두 칸을 04 구조 칸으로 요청한다(사실로만 — 사실이 없으면 칸을 비우고 지어내지 않는다) ② 골든 saas 브리프에 가상 후기·일반 범주 연동 사실을 채운다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix2-saas.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkStructure } from '../stamp/content-structure.mjs'
import { bindSection } from '../stamp/gen-pages.mjs'
import { goldenOf, goldenRequest } from './lib/stamp-structure-fixtures.mjs'

const without = (id, ...names) => { const b = structuredClone(goldenOf(id).brief); for (const n of names) delete b.facts[n]; return b }
const slotOf = (request, path) => (request.structureSlots ?? []).find((s) => s.path === path)
const cells = (s) => s.split('|').map((x) => x.trim())
const items = (s) => s.split(' ; ').map((x) => x.trim())

test('[saas] 04 요청이 testimonials·integrations 구조 칸을 싣는다 — 사실이 있으면 empty 가 아니고 없으면 empty(지어내지 않는다)', () => {
  for (const id of ['saas-1', 'saas-2']) {
    const { request } = goldenRequest(id)
    for (const path of ['testimonials', 'integrations']) {
      const s = slotOf(request, path)
      assert.ok(s, `${id}: 구조 칸 ${path} 가 요청에 없다`)
      assert.equal(s.empty, false, `${id}.${path}`)
    }
    const bare = goldenRequest(id, { brief: without(id, 'testimonials', 'integrations') }).request
    assert.equal(slotOf(bare, 'testimonials')?.empty ?? true, true)
    assert.equal(slotOf(bare, 'integrations')?.empty ?? true, true)
  }
})

test('[saas] 골든 saas 사실: 후기는 이름·직함·소속·결과 넷 · 연동은 일반 범주 이름 + 주소 + 방식 — 사실만 옮긴 콘텐츠는 검사 0건, 사실에 없는 후기는 떨어진다', () => {
  for (const id of ['saas-1', 'saas-2']) {
    const { request } = goldenRequest(id)
    const t = items(request.facts.testimonials).map((x) => { const [name, title, company, result] = cells(x); return { name, title, company, result } })
    const i = items(request.facts.integrations).map((x) => { const [name, url, kind] = cells(x); return { name, url, kind } })
    assert.ok(t.length >= 2 && t.every((x) => x.name && x.title && x.company && x.result), `${id} 후기 사실 모양`)
    assert.ok(i.length >= 2 && i.every((x) => x.name && /^https:\/\//.test(x.url) && ['native', 'api', 'webhook'].includes(x.kind)), `${id} 연동 사실 모양`)
    assert.deepEqual(checkStructure(request, { testimonials: t, integrations: i }).filter((l) => !l.includes('changelog')), [], id)
    assert.ok(checkStructure(request, { testimonials: [{ ...t[0], name: '사실에 없는 사람' }], integrations: i }).some((l) => l.startsWith('[structure-trace]')), id)
    assert.ok(checkStructure(request, { integrations: i }).some((l) => l.startsWith('[structure-missing]')), id)
  }
})

test('[saas] 구조 칸이 채워지면 binder 가 후기 벽·연동 아이콘을 묶는다 — 예시 글이 남지 않는다', async () => {
  const { request } = goldenRequest('saas-1')
  const t = items(request.facts.testimonials).map((x) => { const [name, title, company, result] = cells(x); return { name, title, company, result } })
  const i = items(request.facts.integrations).map((x) => { const [name, url, kind] = cells(x); return { name, url, kind } })
  const content = { archetype: 'saas', locale: 'ko', business: { name: '견적노트' }, testimonials: t, integrations: i, slots: { copy: [], images: [] } }
  const routes = { home: '/', signup: '/signup' }
  const bind = (key, block) => bindSection({ key, block, content, copyIndex: new Map(), routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '#' })
  const quotes = await bind('home/social-proof', 'block-social-proof-quote-wall')
  assert.ok(quotes.props, quotes.why)
  assert.deepEqual(quotes.issues.filter((x) => x.why !== 'leak'), [], JSON.stringify(quotes.issues))
  const grid = await bind('home/integrations', 'block-integrations-icon-grid')
  assert.ok(grid.props, grid.why)
  assert.equal(grid.props.copy.items.length, i.length)
})
