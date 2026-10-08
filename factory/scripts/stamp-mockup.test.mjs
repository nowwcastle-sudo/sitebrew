// 앱 화면 목업 안의 예시 글(대장 C310 부수 발견) — 히어로 앱 창(`copy.window`)·패널·터미널 목업의 글은 블록 예시의 가상 앱 글(「갈피」·「배송 조사」·「봉투 두께 비교」)이라
// 콘텐츠로 묶이지 않고 남으면 사이트에 그대로 실린다. 표지·숫자·가상 이름이 없어 exampleIssues 가 못 잡아 골든 saas-1/b 에서 blockers 가 「실제 사진 필요」뿐이었다.
// 06 은 이런 글이 남으면 「예시 문구 남음」 blocker 를 낸다(또는 같은 섹션의 더 깨끗한 변형으로 폴백한다). 03·04 가 쓰는 exampleIssues 는 바뀌지 않는다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-mockup.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blockItems, fixtureOf, exampleNames, BLOCKER } from '../stamp/gen-pages.mjs'
import { exampleIssues, leaves, mockupIssues, ref } from '../stamp/site-bind.mjs'
import { SAAS_BRIEF, saasContent, makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'

const NARROW = 'block-hero-narrow-title-wide-window'
const TMP = join(root, '.tmp', 'stamp-mockup-test')
const EXAMPLE_WINDOW_TEXT = ['갈피', '배송 조사', '봉투 두께 비교', '가설 판']

test('mockupIssues: 앱 창 안의 literal 글을 잡고, $ref·링크·식별자·창 밖 글은 건너뛴다', () => {
  const props = { copy: { title: '제목', window: { label: '창', root: '갈피', tree: [{ label: '오늘', depth: 0, icon: 'x' }], nodes: [{ title: '카드', id: 'H-07', href: '#a' }], share: ref('x.y') } } }
  const found = mockupIssues(leaves(props))
  // 목업 하나 = 이슈 하나(폴백 비용이 잎 수로 부풀지 않는다), 잎 경로는 leaves 에 든다
  assert.equal(found.length, 1)
  assert.equal(found[0].path, 'copy.window')
  assert.equal(found[0].why, 'mockup')
  assert.deepEqual([...found[0].leaves].sort(), ['copy.window.label', 'copy.window.nodes[0].title', 'copy.window.root', 'copy.window.tree[0].label'])
  // 이미 잡은 경로는 되풀이하지 않는다
  assert.ok(!mockupIssues(leaves(props), ['copy.window.root']).some((i) => i.leaves.includes('copy.window.root')))
  // 앱 창이 둘이면 이슈도 둘
  assert.equal(mockupIssues(leaves({ copy: { window: { root: 'a' }, terminal: { lines: ['b'] } } })).length, 2)
})

test('mockupIssues: 03·04 가 쓰는 exampleIssues 는 이 글을 못 본다(그래서 따로 검사한다) — 양성 대조', async () => {
  const b = blockItems().get(NARROW)
  const props = await fixtureOf(b)
  const all = leaves(props)
  const names = await exampleNames()
  const base = exampleIssues(all, names)
  const mock = mockupIssues(all, base.map((i) => i.path))
  // 표지가 붙은 칸(label·lede·pill)만 잡히고 창 안쪽 글은 하나도 못 잡는다 — 이게 누수의 원인
  assert.ok(base.every((i) => !/window\.(?:root|tree|board|nodes)/.test(i.path)), `exampleIssues 가 창 안쪽을 잡았다: ${base.map((i) => i.path)}`)
  const paths = mock.flatMap((i) => i.leaves)
  assert.equal(mock.length, 1)
  for (const want of ['copy.window.root', 'copy.window.board', 'copy.window.tree[0].label', 'copy.window.nodes[2].title']) assert.ok(paths.includes(want), `${want} 를 못 잡았다`)
})

test('mockupIssues: 앱 화면 목업이 든 히어로 4개 모두 잡고, 목업 칸이 없는 블록은 건드리지 않는다', async () => {
  const withMock = new Set()
  for (const [name, b] of blockItems()) {
    let props
    try { props = await fixtureOf(b) } catch { continue }
    if (mockupIssues(leaves(props)).length) withMock.add(name)
  }
  for (const want of ['block-hero-narrow-title-wide-window', 'block-hero-leaking-app-panel', 'block-hero-baseline-news-app-window', 'block-hero-crop-marks-typed-title']) assert.ok(withMock.has(want), want)
  assert.ok(!withMock.has('block-hero-baseline-split'))
  assert.ok(!withMock.has('block-hero-grid-lines-baseline-word'))
})

test('06: 앱 창 히어로를 골라도 예시 앱 글이 공개 가능으로 새지 않는다 — 사이트에 남았으면 「예시 문구 남음」 blocker, 아니면 더 깨끗한 변형으로 바뀐다', async () => {
  const r = await makeRun(TMP, SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'home/hero': NARROW }) })
  assert.equal(r.runDir && true, true)
  const g = await gen(r)
  const site = JSON.parse(readFileSync(join(g.siteDir, 'content', 'site.json'), 'utf8'))
  const hero = site.sections['home/hero']
  const heroText = JSON.stringify(hero)
  const leaked = EXAMPLE_WINDOW_TEXT.filter((t) => heroText.includes(t))
  const candidate = JSON.parse(readFileSync(join(r.runDir, r.cand.id, 'candidate.json'), 'utf8'))
  const exampleLines = candidate.blockers.filter((b) => b.startsWith(BLOCKER.example) && b.includes('home/hero'))
  if (leaked.length) assert.ok(exampleLines.some((l) => /copy\.window\(mockup\)/.test(l)), `예시 앱 글(${leaked})이 남았는데 blocker 가 없다: ${candidate.blockers.filter((b) => b.includes('hero'))}`)
  else assert.notEqual(hero.block, NARROW, '예시 글이 없는데 앱 창 히어로 그대로다')
})

test('bindSection: 앱 창 히어로의 issues 에 mockup 이 든다 — 폴백할 더 깨끗한 변형이 없으면 이 줄이 「예시 문구 남음」 blocker 가 된다', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const content = { archetype: 'saas', locale: 'ko', business: { name: '예약노트' } }
  const res = await bindSection({ key: 'home/hero', block: NARROW, content, copyIndex: new Map(), routes: {}, locale: 'ko', navLinks: [], primaryCta: () => null, secondaryHref: () => '#' })
  assert.ok(res.props, res.why)
  const mock = res.issues.filter((i) => i.why === "mockup").flatMap((i) => i.leaves)
  assert.ok(mock.includes('copy.window.root') && mock.includes('copy.window.nodes[0].title'), `mockup 이슈: ${mock}`)
  assert.ok(!res.issues.some((i) => i.path === 'copy.title' && i.why !== 'leak'), '제목은 표지·숫자 이슈가 아니다(예시 글이면 EXLEAK 가 leak 으로 따로 잡는다)')
})

test('06: 목업 안의 글이 콘텐츠($ref)로 바뀌어 있으면 blocker 를 내지 않는다(음성 대조) — mockupIssues 는 ref 잎을 보지 않는다', () => {
  const props = { copy: { window: { root: ref('slots.copy.9.text'), tree: [{ label: ref('slots.copy.10.text') }] } } }
  assert.deepEqual(mockupIssues(leaves(props).filter((l) => l.ref === null)), [])
  assert.deepEqual(mockupIssues(leaves(props)), [])
})
