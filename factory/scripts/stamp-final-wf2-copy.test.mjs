// FINAL-WF2 AB5 — 04 화면 문구 칸(`ui:`)이 블록 예시 글을 그대로 베끼지 못하게.
// 감사 B P0: commerce 히어로에 다른 업종 블록 예시 글(「물때 작업장」·「썰물 가마」)이 그대로 나갔다 — 04 가 예시 「물때 작업장(예시)」에서 표지 「(예시)」만 떼어 썼다.
// 왜 06 이 못 잡았나: 06 의 누설 검사(leakIssues)는 콘텐츠($ref)로 안 묶이고 literal 로 남은 글만 본다. 이 글은 문구 칸 $ref 로 묶여 「콘텐츠가 말한 글」이 됐고,
//   누설 검사는 「콘텐츠에 있는 글은 누설이 아니다」로 면제한다(contentTexts) — 04 가 베낀 글이 콘텐츠 안으로 들어오면 06 은 그 출처를 몰랐다.
//   그래서 04 검사를 표지 뗀 글까지 보게 하고(uiSameAsExample), 06 도 문구 칸이 예시와 같은 글이면 「예시 문구 남음(copied)」으로 막는다(이미 쓴 04 콘텐츠의 안전망).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-copy.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { validateContent, uiSameAsExample, stripExampleMarker } from '../stamp/content.mjs'
import { makeRun, SAAS_BRIEF, saasContent, root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'final-wf2-copy-test')
const R = await makeRun(TMP, SAAS_BRIEF, saasContent)

// ── AB2 05 미디어 검색어 ─────────────────────────────────────────────────────────────────
import { mediaPlan, stockQuery } from '../stamp/media.mjs'
import { goldenOf } from './lib/stamp-structure-fixtures.mjs'
import { archetypes } from './lib/stamp-site-fixtures.mjs'

test('AB2 stockQuery: 북페어 브리프 주제 낱말이 검색어에 들고 구조 이름(hero·visual)과 가상·예시 표지는 빠진다', () => {
  const topic = goldenOf('landing-1').brief.topic
  const q = stockQuery({ topic, section: { kind: 'hero' }, img: { id: 'hero-visual' } })
  assert.match(q, /북페어/)
  assert.equal(/hero|visual|가상|예시/.test(q), false, q)
  assert.ok(q.split(' ').length <= 6)
  assert.match(stockQuery({ topic, section: { kind: 'social-proof' }, img: { id: 'customer-logo' } }), /북페어.*customer logo$/, '뜻 있는 칸 이름 낱말은 주제 뒤에 붙는다')
  assert.equal(stockQuery({ topic: undefined, section: { kind: 'hero' }, img: { id: 'hero-visual' } }), 'hero hero visual', '주제가 없으면 예전 그대로')
})

test('AB2 mediaPlan: landing 북페어 스톡 칸의 검색어에 레시피 이름이 없고 주제 낱말이 있다 · 운영자가 준 검색어(content.media[칸].query)가 먼저', () => {
  const brief = goldenOf('landing-1').brief
  const plan = mediaPlan(archetypes.landing, { locale: 'ko' }, { id: 'a', recipe: 'r14-concrete' }, { topic: brief.topic })
  const stock = plan.filter((r) => r.source === 'pexels')
  assert.ok(stock.length > 0, '스톡 칸이 있다')
  for (const r of stock) {
    assert.match(r.query, /북페어/, r.slot)
    assert.equal(/concrete|r14/i.test(r.query), false, r.query)
  }
  const given = mediaPlan(archetypes.landing, { locale: 'ko', media: { [stock[0].slot]: { query: '책 전시 부스' } } }, { id: 'a', recipe: 'r14-concrete' }, { topic: brief.topic })
  assert.equal(given.find((r) => r.slot === stock[0].slot).query, '책 전시 부스')
})

test('uiSameAsExample: 공백 차이·예시 표지만 뗀 글도 같은 글이다 · 다시 쓴 글은 아니다', () => {
  assert.equal(uiSameAsExample('물때 작업장', '물때 작업장(예시)'), true)
  assert.equal(uiSameAsExample('물때  작업장', '물때 작업장 (예시)'), true)
  assert.equal(uiSameAsExample('썰물 가마', '썰물 가마 · 예시'), true)
  assert.equal(uiSameAsExample('Tide workshop', 'Tide workshop (example)'), true)
  assert.equal(uiSameAsExample('우리 가게 작업실', '물때 작업장(예시)'), false)
  assert.equal(stripExampleMarker('물때 작업장(예시)'), '물때 작업장')
})

test('AB5 06 안전망: 문구 칸이 예시 문장을 그대로 베낀 잎은 「예시 문구 남음(copied)」으로 막는다 · 다시 쓴 글이면 이슈 없음', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const { uiLeavesOf } = await import('../stamp/ui-copy.mjs')
  const block = 'block-auth-sign-in'
  const leaves = (await uiLeavesOf(block)).filter((l) => l.why !== 'digits' && !/\{[A-Za-z_]+\}/.test(l.example))
  assert.ok(leaves.length > 0)
  const bound = (texts) => {
    const content = { archetype: 'saas', locale: 'ko', product: { name: '견적노트' }, business: { name: '견적노트' }, site: { name: '견적노트' }, slots: { copy: leaves.map((l, i) => ({ id: `ui:${l.path}`, role: '', text: texts[i] })) } }
    return bindSection({ key: 'login/auth', block, content, copyIndex: new Map(), routes: { home: '/', login: '/login', signup: '/signup' }, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing', uiLeaves: leaves.map((l, i) => ({ path: l.path, ref: `slots.copy.${i}.text`, example: l.example })) })
  }
  const copied = await bound(leaves.map((l) => stripExampleMarker(l.example)))
  assert.ok(copied.issues.some((i) => i.why === 'copied'), JSON.stringify(copied.issues.slice(0, 3)))
  const rewritten = await bound(leaves.map((_, i) => `견적노트 안내 문장 ${'가나다라마바사아자차'.repeat(1)} ${i}번`))
  assert.equal(rewritten.issues.some((i) => i.why === 'copied'), false)
})

test('AB5 validateContent: 예시 표지만 뗀 문구 칸을 거절한다(예전엔 통과) · 다시 쓴 글은 통과', () => {
  const idx = R.request.slots.findIndex((x) => x.ui && /[(（][^)）]*예시[^)）]*[)）]/.test(x.ui.example) && !/\{[A-Za-z_]+\}/.test(x.ui.example))
  assert.ok(idx >= 0, '표지가 든 예시 잎이 하나는 있다')
  const slot = R.request.slots[idx]
  const withText = (t) => ({ ...R.content, slots: { ...R.content.slots, copy: R.content.slots.copy.map((c, i) => (i === idx ? { ...c, text: t } : c)) } })
  const problems = (t) => validateContent(R.request, withText(t)).filter((x) => x.startsWith('[ui-copy]'))
  assert.match(problems(stripExampleMarker(slot.ui.example)).join('\n'), /예시 문장 그대로/, '표지만 뗀 글')
  assert.match(problems(`  ${stripExampleMarker(slot.ui.example).replace(' ', '   ')}  `).join('\n'), /예시 문장 그대로/, '공백만 바꾼 글')
  assert.deepEqual(problems('우리 서비스에서 쓰는 안내 문장이에요'), [])
})
