// 대장 C296 — 한 낱말 히어로(grid-lines-baseline-word)에 긴 제목이 들어가면 잘리고 캡션과 겹친다.
//   ① 제목 폭 어림·크기 맞추기(_shared/title-fit) — 짧은 낱말은 설계 크기 그대로, 긴 제목은 화면 폭 안에 들어간다.
//   ② 블록 메타 titleMaxUnits 는 블록 원천의 설계 크기에서 나온 값이다(손으로 적은 숫자가 어긋나지 않게).
//   ③ 06-pages 폴백: 제목이 상한을 넘으면 같은 섹션의 다른 변형으로 바꾸고 fallbacks 에 남긴다(음성 대조: 짧은 제목은 그대로).
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-title-fit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadTs } from '../stamp/ts-eval.mjs'
import { BlockMeta } from './blocks.mjs'
import { root, localBrief, localContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'

const FIT = join(root, 'registry', 'factory', 'blocks', '_shared', 'title-fit.tsx')
const BLOCK_DIR = join(root, 'registry', 'factory', 'blocks', 'hero')
const KEY = 'home/hero-visit-info'
const GRID = 'block-hero-grid-lines-baseline-word'
const GOLDEN_TITLE = '마포구 월드컵로의 주야간보호센터' // 골든 local-1 b 에서 잘린 제목(대장 C296)
const fit = await loadTs(FIT)

test('C296 ① titleUnits: 한글은 1em, 로마자는 대문자 0.68em, 공백 0.28em — 골든 제목은 한 줄 상한의 세 배', () => {
  assert.equal(fit.titleUnits('숲'), 1)
  assert.equal(fit.titleUnits('가나다라마'), 5)
  assert.equal(fit.titleUnits('Pine'), 2.72)
  assert.equal(fit.titleUnits('가 나'), 2.28)
  assert.equal(fit.titleUnits(GOLDEN_TITLE), 15.56)
  assert.equal(fit.longestWordUnits(GOLDEN_TITLE), 7)
  assert.equal(fit.maxTitleUnits(17.8), 5.3, '96 ÷ 17.8 = 5.39 → 5.3(소수 첫째 자리 버림)')
})

test('C296 ① titleFit: 설계 한 줄에 들어가는 낱말은 설계 크기·한 줄 그대로(설계 의도 보존)', () => {
  for (const t of ['숲', '달빛식빵', '가나다라마', 'Pine']) assert.deepEqual(fit.titleFit(t, 17.8), { vw: 17.8, lines: 1 }, t)
})

test('C296 ① titleFit: 긴 제목은 글자 크기를 줄이고 줄을 나눠 화면 폭(96vw) 안에 가장 긴 줄이 들어간다', () => {
  const r = fit.titleFit(GOLDEN_TITLE, 17.8)
  assert.equal(r.lines, 2)
  assert.ok(r.vw < 17.8 && r.vw >= 17.8 * fit.TITLE_FIT_MIN_SCALE, `vw ${r.vw}`)
  assert.ok(r.vw * fit.longestWordUnits(GOLDEN_TITLE) <= fit.TITLE_FIT_WIDTH_VW + 0.01, '가장 긴 낱말(7em)이 한 줄 폭 안')
  // 아주 긴 제목·긴 낱말도 어느 입력에서나 (가장 긴 낱말 × 크기) 가 화면 폭을 넘지 않는다 — 줄 수는 최대 3
  for (const t of ['가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하', '주야간보호센터와재가복지서비스통합지원센터', 'An exceedingly long english tagline for a small neighbourhood day care centre']) {
    const x = fit.titleFit(t, 17.8)
    assert.ok(x.lines >= 1 && x.lines <= 3, t)
    if (x.lines === 1) assert.ok(x.vw * fit.titleUnits(t) <= 96.01, t)
    assert.ok(x.vw * fit.longestWordUnits(t) <= 96.01, `${t} — 가장 긴 낱말이 화면 폭 안`)
  }
})

test('C296 ② 블록 메타 titleMaxUnits 는 블록 원천의 DESIGN_VW(=base.css 훅의 17.8vw)에서 나온 값이다', () => {
  const meta = JSON.parse(readFileSync(join(BLOCK_DIR, 'grid-lines-baseline-word.block.json'), 'utf8'))
  const src = readFileSync(join(BLOCK_DIR, 'grid-lines-baseline-word.tsx'), 'utf8')
  const vw = Number(src.match(/const DESIGN_VW = ([\d.]+)/)?.[1])
  assert.ok(vw > 0, 'DESIGN_VW 를 못 찾았다')
  assert.equal(meta.titleMaxUnits, fit.maxTitleUnits(vw))
  const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  assert.match(css, new RegExp(`\\.cn-block-hero-grid-lines-baseline-word-gw-word \\{[^}]*min\\(${vw}vw,var\\(--gw-size,${vw}vw\\)\\)`), '훅의 설계 크기가 블록 원천과 같다')
  assert.equal(BlockMeta.safeParse(meta).success, true)
})

test('C296 ② 메타 스키마: titleMaxUnits 는 양수이고 hero 만 적을 수 있다(음성 대조)', () => {
  const base = JSON.parse(readFileSync(join(BLOCK_DIR, 'grid-lines-baseline-word.block.json'), 'utf8'))
  assert.equal(BlockMeta.safeParse({ ...base, titleMaxUnits: 0 }).success, false)
  assert.equal(BlockMeta.safeParse({ ...base, titleMaxUnits: -1 }).success, false)
  assert.equal(BlockMeta.safeParse({ ...base, kind: 'faq', titleWidth: undefined, titleMaxUnits: 5 }).success, false)
})

const TMP = join(root, '.tmp', 'stamp-title-fit-test')
const makeRun = (title, patchVariants = (v) => ({ ...v, [KEY]: GRID })) => makeRunIn(TMP, localBrief(), localContent, {
  patchVariants,
  patch: (c) => { c.slots.copy.find((s) => s.id === 'tagline').text = title; return c },
})

test('C296 ③ 폴백: 03 이 한 낱말 히어로를 골랐어도 제목이 상한을 넘으면 같은 섹션의 다른 변형으로 바꾸고 fallbacks 에 남긴다', async () => {
  const R = await makeRun(GOLDEN_TITLE)
  assert.equal(R.sitemap.pages[0].sections.find((s) => s.kind === 'hero-visit-info').allowedVariants.includes(GRID), true)
  const s = await gen(R)
  const f = s.fallbacks.find((x) => x.key === KEY)
  assert.ok(f, JSON.stringify(s.fallbacks))
  assert.equal(f.from, GRID)
  assert.notEqual(f.to, GRID)
  assert.match(f.why, /제목 15\.56em 이 이 변형의 상한 5\.3em 을 넘는다/)
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  assert.equal(site.sections[KEY].block, f.to)
})

test('C296 ③ 음성 대조: 제목이 상한 안이면 한 낱말 히어로를 그대로 쓴다(폴백 없음)', async () => {
  const R = await makeRun('달빛식빵')
  const s = await gen(R)
  assert.equal(s.fallbacks.some((x) => x.key === KEY), false, JSON.stringify(s.fallbacks))
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  assert.equal(site.sections[KEY].block, GRID)
})

test('C296 폴백 도착지: vertical-title-slides 는 예시 장면 이름을 서수 UI 이름표로 바꿔 예시 문구 이슈 0 이다(예시 이름 스캔이 다른 블록 예시의 「솔바람」을 모아도)', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const R = await makeRun(GOLDEN_TITLE)
  const copyIndex = new Map(R.request.slots.map((s, i) => [`${s.path}#0`, i]))
  const r = await bindSection({ key: KEY, block: 'block-hero-vertical-title-slides', content: R.content, copyIndex, routes: { home: '/' }, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })
  assert.deepEqual(r.issues, [])
  assert.deepEqual(r.props.copy.slides, ['첫째', '둘째', '셋째'])
})

test('C296 ③ 음성 대조: 상한이 없는 다른 변형은 긴 제목이어도 폴백하지 않는다', async () => {
  const other = 'block-hero-vertical-title-slides'
  const R = await makeRun(GOLDEN_TITLE, (v) => ({ ...v, [KEY]: other }))
  const s = await gen(R)
  assert.equal(s.fallbacks.some((x) => x.key === KEY), false, JSON.stringify(s.fallbacks))
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  assert.equal(site.sections[KEY].block, other)
})
