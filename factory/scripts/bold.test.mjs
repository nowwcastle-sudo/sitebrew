// 대담안(factory v1 Task 4.2 · 합의안 D5·D20) — 3안 중 정확히 1안이 대담안, 출처 구성은 그대로, 대담안 안전 판정(judgeBold)·증거 읽기·깜빡임 상한·후보 어댑터.
// Chrome·서버 없음(동작 줄이기 정지 확인의 실제 Chrome 시험은 bold-safety.browser.test.mjs). 07-qa 묶음 배선 시험은 stamp-qa.test.mjs 끝에 있다.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { loadArchetypes } from './archetypes.mjs'
import { listPresets, pickPalettes, loadPalettePool, presetToRecipeHead, hintPair, loadPairs, loadLibrary, novelty } from './style-presets.mjs'
import { checkCompat } from './compat.mjs'
import { lintRecipe } from './recipe.mjs'
import { DirectionsShortError, MIN_AXES, SeedRequiredError, axisDistance, diversityOrder, loadWeights, matchedConditions, mulberry32, paletteKey, pickDirections } from '../stamp/directions.mjs'
import { BOLD_LAYOUT_ARCHETYPES, BOLD_THRESHOLDS, boldModeFor, boldSafetyForCandidate, evidenceFromGates, judgeBold, staticFlashRate } from '../qa/bold-safety.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(ROOT, '.tmp', 'bold-test')
mkdirSync(TMP, { recursive: true })

const archetypes = await loadArchetypes()
const ARCHS = ['brand', 'commerce', 'dashboard', 'detail', 'landing', 'local', 'portfolio', 'public', 'pwa', 'saas']
const sampleBrief = (archetype, extra = {}) => ({ topic: '시험 주제(예시)', archetype, locale: 'ko', facts: { name: '시험 상점' }, seed: 7, ...extra })
const pick = (fn, archetype, extra) => fn({ brief: sampleBrief(archetype, extra), archetype: archetypes[archetype], seed: 7 })
const withoutBold = (c) => { const rest = { ...c }; delete rest.boldness; delete rest.boldMode; return rest }

// ── 1. 방향 3안: 정확히 1안이 대담안 ─────────────────────────────────────────────

test('3안 중 대담안은 정확히 1개, 출처 구성은 바뀌지 않는다', async () => {
  const d = (await pick(pickDirections, 'brand')).candidates
  assert.equal(d.filter((x) => x.boldness === 'bold').length, 1)
  assert.deepEqual(d.map((x) => x.source), (await pick(pickDirectionsV0, 'brand')).candidates.map((x) => x.source))
})

// 브랜드 입력은 색이 안 맞으면 두 구현 모두 같은 DirectionsShortError 로 막힌다 — 막힌 것도 「같은 결과」로 비교한다.
// 두 구현이 같은 lint 기억(_lint)을 써서 같은 머리를 두 번 검사하지 않는다(시험 시간 절반) — lint 는 순수 함수다.
const lintMemo = new Map()
const memoLint = (head) => { const k = JSON.stringify(head); if (!lintMemo.has(k)) lintMemo.set(k, lintRecipe(head)); return lintMemo.get(k) }
const settle = async (fn, a, extra) => {
  try { return { ok: await fn({ brief: sampleBrief(a, extra), archetype: archetypes[a], seed: 7, _lint: memoLint }) } } catch (e) { if (!(e instanceof DirectionsShortError)) throw e; return { blocked: e.message } }
}

test('원형 10종(+브랜드 입력 몇 가지): 대담안은 bold 칸(c) 하나·boldMode 는 원형이 정하고, 대담안 표시를 빼면 고정 사본과 한 글자도 다르지 않다(후보·탈락 모두)', async () => {
  assert.deepEqual([...BOLD_LAYOUT_ARCHETYPES].sort(), ['dashboard', 'public'])
  const cases = [...ARCHS.map((a) => [a, {}]), ...['brand', 'saas'].flatMap((a) => [['#0B5FFF', '#FFFFFF'], ['#7A2E1D', '#FFFFFF']].map((colors) => [a, { brand: { colors } }]))]
  let brandRuns = 0
  for (const [a, extra] of cases) {
    const tag = `${a}${extra.brand ? `+brand${extra.brand.colors[0]}` : ''}`
    const now = await settle(pickDirections, a, extra)
    const v0 = await settle(pickDirectionsV0, a, extra)
    if (v0.blocked !== undefined) { assert.deepEqual(now, v0, `${tag}: 막힌 이유도 그대로다`); continue }
    if (extra.brand) brandRuns++
    const c = now.ok.candidates
    assert.deepEqual(c.map((x) => [x.id, x.slot, x.boldness]), [['a', 'safe', 'standard'], ['b', 'new', 'standard'], ['c', 'bold', 'bold']], tag)
    assert.equal(c[2].boldMode, BOLD_LAYOUT_ARCHETYPES.includes(a) ? 'layout' : 'motion', tag)
    assert.equal(c[2].boldMode, boldModeFor(a), tag)
    assert.ok(!('boldMode' in c[0]) && !('boldMode' in c[1]), `${tag}: 대담안이 아닌 칸에는 boldMode 가 없다`)
    assert.deepEqual(c.map(withoutBold), v0.ok.candidates, `${tag}: 출처 구성·레시피·팔레트·서체가 그대로다`)
    assert.deepEqual(now.ok.rejected, v0.ok.rejected, `${tag}: 탈락 기록도 그대로다`)
    assert.deepEqual(c.map((x) => x.source), v0.ok.candidates.map((x) => x.source), tag)
    assert.equal(c[2].source, extra.brand ? 'brand' : 'generated', tag)
  }
  assert.ok(brandRuns >= 2, `브랜드 입력이 실제로 통과한 경우가 ${brandRuns}개뿐이다 — 시험이 비어 간다`)
})

test('씨앗·원형 인자 오류는 예전 그대로 던진다(고정 사본과 같은 예외)', async () => {
  await assert.rejects(() => pickDirections({ brief: { ...sampleBrief('saas'), seed: undefined }, archetype: archetypes.saas }), SeedRequiredError)
  await assert.rejects(() => pickDirections({ brief: sampleBrief('saas'), archetype: archetypes.local, seed: 7 }), /원형이 브리프와 다르다/)
})

// ── 2. D20 판정 ─────────────────────────────────────────────────────────────────

test('bold-safety: 동작 줄이기에서 정지 아니면 실패, public 은 motion 대담 금지', () => {
  assert.equal(judgeBold({ archetype: 'saas', reducedMotionStatic: false, lcpMs: 1800, cls: 0.02, flashesPerSec: 0, contrastOk: true }).ok, false)
  assert.equal(judgeBold({ archetype: 'public', boldMode: 'motion', reducedMotionStatic: true, lcpMs: 1800, cls: 0, flashesPerSec: 0, contrastOk: true }).ok, false)
  assert.equal(judgeBold({ archetype: 'saas', boldMode: 'motion', reducedMotionStatic: true, lcpMs: 2400, cls: 0.05, flashesPerSec: 2, contrastOk: true }).ok, true)
})

const GOOD = { archetype: 'saas', boldMode: 'motion', reducedMotionStatic: true, lcpMs: 2400, cls: 0.05, flashesPerSec: 2, contrastOk: true }
const ids = (m) => judgeBold(m).failures.map((f) => f.id)

test('judgeBold 경계값: LCP 2500 은 통과·2501 은 실패, CLS 0.1 은 실패(< 0.1), 깜빡임 3 은 통과·3.1 은 실패', () => {
  assert.deepEqual(BOLD_THRESHOLDS, { lcpMs: 2500, cls: 0.1, flashesPerSec: 3 })
  assert.deepEqual(ids({ ...GOOD, lcpMs: 2500 }), [])
  assert.deepEqual(ids({ ...GOOD, lcpMs: 2501 }), ['lcp'])
  assert.deepEqual(ids({ ...GOOD, cls: 0.0999 }), [])
  assert.deepEqual(ids({ ...GOOD, cls: 0.1 }), ['cls'])
  assert.deepEqual(ids({ ...GOOD, flashesPerSec: 3 }), [])
  assert.deepEqual(ids({ ...GOOD, flashesPerSec: 3.1 }), ['flashes'])
  assert.deepEqual(ids({ ...GOOD, contrastOk: false }), ['contrast'])
})

test('judgeBold: 하나라도 재지 못했으면(null·undefined) 통과가 아니라 실패 · 사유마다 규칙 id 와 문장이 있다', () => {
  for (const k of ['reducedMotionStatic', 'lcpMs', 'cls', 'flashesPerSec', 'contrastOk']) {
    for (const v of [null, undefined]) assert.equal(judgeBold({ ...GOOD, [k]: v }).ok, false, `${k}=${v}`)
  }
  const j = judgeBold({ archetype: 'public', boldMode: 'motion', reducedMotionStatic: false, lcpMs: 3000, cls: 0.2, flashesPerSec: 9, contrastOk: false })
  assert.deepEqual(j.failures.map((f) => f.id).sort(), ['cls', 'contrast', 'flashes', 'lcp', 'layout-only', 'reduced-motion-static'].sort())
  assert.ok(j.failures.every((f) => f.message.length > 10))
  assert.deepEqual(judgeBold({}).failures.length > 0, true, '빈 입력도 던지지 않고 실패로 읽는다')
})

test('judgeBold: boldMode 를 안 주면 원형이 정한다 — public·dashboard 는 layout 이라 통과, 그 밖은 motion 이라 통과 · layout 인 public 은 통과', () => {
  const m = { reducedMotionStatic: true, lcpMs: 1000, cls: 0, flashesPerSec: 0, contrastOk: true }
  for (const a of ARCHS) assert.equal(judgeBold({ archetype: a, ...m }).ok, true, a)
  assert.equal(judgeBold({ archetype: 'public', boldMode: 'layout', ...m }).ok, true)
  assert.equal(judgeBold({ archetype: 'dashboard', boldMode: 'motion', ...m }).ok, false)
})

// ── 3. 이미 돈 관문 결과 읽기 ───────────────────────────────────────────────────

test('evidenceFromGates: ops 의 LCP·CLS 는 쪽 중 가장 나쁜 값, 대비는 a11y 의 color-contrast 실패 유무', () => {
  const ops = { checks: [
    { id: 'lcp', status: 'pass', value: 1800, route: '/' }, { id: 'lcp', status: 'fail', value: 2900, route: '/pricing' }, { id: 'lcp', status: 'na', route: '/x' },
    { id: 'cls', status: 'pass', value: 0.02, route: '/' }, { id: 'cls', status: 'pass', value: 0.04, route: '/pricing' },
  ] }
  const a11y = (failures) => ({ verdict: failures.length ? 'fail' : 'pass', routes: { '/': { verdict: 'pass', failures: [] }, '/pricing': { verdict: failures.length ? 'fail' : 'pass', failures } } })
  assert.deepEqual(evidenceFromGates({ ops, a11y: a11y([]) }), { lcpMs: 2900, cls: 0.04, contrastOk: true })
  assert.equal(evidenceFromGates({ ops, a11y: a11y(['axe color-contrast(serious) light·1440px 3곳']) }).contrastOk, false)
  assert.equal(evidenceFromGates({ ops, a11y: a11y(['axe region(moderate) light·375px 1곳']) }).contrastOk, true, '다른 규칙 실패는 대비 실패가 아니다')
})

test('evidenceFromGates: 결과가 없거나 도구 실패·na 뿐이면 null(재지 못함)', () => {
  assert.deepEqual(evidenceFromGates({}), { lcpMs: null, cls: null, contrastOk: null })
  assert.deepEqual(evidenceFromGates({ ops: { checks: [{ id: 'lcp', status: 'na' }, { id: 'cls', status: 'warn', value: 0.05 }] }, a11y: { verdict: 'tool', routes: {} } }), { lcpMs: null, cls: null, contrastOk: null })
  assert.equal(evidenceFromGates({ a11y: { verdict: 'pass', routes: { '/': { verdict: 'tool', note: 'x' } } } }).contrastOk, null, '쪽 하나라도 도구 실패면 대비는 모른다')
})

// ── 4. 깜빡임 상한(CSS) ─────────────────────────────────────────────────────────

test('staticFlashRate: 무한 반복하는 불투명도·색 키프레임만 센다 — 0.2초 주기는 초당 5회, 회전·1회성·유한 반복은 0', () => {
  const css = (anim) => `@keyframes pulse { 0% { opacity: 1 } 50% { opacity: 0.2 } 100% { opacity: 1 } }\n@keyframes spin { to { transform: rotate(360deg) } }\n${anim}`
  assert.equal(staticFlashRate(css('.a { animation: pulse 0.2s ease-in-out infinite; }')), 5)
  assert.equal(staticFlashRate(css('.a { animation: 200ms ease 0s infinite normal none running pulse; }')), 5)
  assert.equal(staticFlashRate(css('.a { animation-name: pulse; animation-duration: 500ms; animation-iteration-count: infinite; }')), 2)
  assert.equal(staticFlashRate(css('.a { animation: pulse 2s infinite; }')), 0.5)
  assert.equal(staticFlashRate(css('.a { animation: spin 0.2s linear infinite; }')), 0, '회전은 깜빡임이 아니다')
  assert.equal(staticFlashRate(css('.a { animation: pulse 0.2s ease 1; }')), 0, '1회성')
  assert.equal(staticFlashRate(css('.a { animation: pulse 0.2s ease 3; }')), 0, '유한 반복')
  assert.equal(staticFlashRate(css('.a { animation: pulse 0.2s infinite; } .b { animation: pulse 0.1s infinite; }')), 10, '가장 빠른 것')
  assert.equal(staticFlashRate('.a { color: red }'), 0)
  assert.equal(staticFlashRate(''), 0)
})

test('staticFlashRate: @media 안의 규칙도 읽고, 키프레임 이름이 없는 animation 은 건너뛴다', () => {
  const css = '@keyframes blink { from { background-color: #fff } to { background-color: #000 } } @media (min-width: 1px) { .x { animation: blink .25s steps(2) infinite } } .y { animation: other .1s infinite }'
  assert.equal(staticFlashRate(css), 4)
})

// ── 5. 후보 어댑터 ──────────────────────────────────────────────────────────────

const OPS = { checks: [{ id: 'lcp', status: 'pass', value: 1800, route: '/' }, { id: 'cls', status: 'pass', value: 0.02, route: '/' }] }
const A11Y = { verdict: 'pass', routes: { '/': { verdict: 'pass', failures: [] } } }
const staticPages = async (origin, routes) => routes.map((route) => ({ route, static: true, problems: [], flashesPerSec: 0 }))
const run = () => mkdtempSync(join(TMP, 'run-'))
const adapter = (cand, over = {}) => boldSafetyForCandidate(over.runDir ?? run(), cand, { origin: 'http://x.test', routes: ['/'], archetype: 'saas', ops: OPS, a11y: A11Y, measure: staticPages, ...over })

test('boldSafetyForCandidate: 전부 통과면 pass · 결과 파일에 잰 값과 판정을 남긴다', async () => {
  const runDir = run()
  const r = await adapter({ id: 'c' }, { runDir })
  assert.deepEqual([r.id, r.tool, r.exit, r.verdict, r.toolFailure], ['bold-safety', 'bold-safety', 0, 'pass', false])
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.measured, { lcpMs: 1800, cls: 0.02, flashesPerSec: 0, reducedMotionStatic: true, contrastOk: true })
  assert.equal(r.resultFile, '07-qa/bold-safety/bold-safety.json')
  const saved = JSON.parse(readFileSync(join(runDir, 'c', r.resultFile), 'utf8'))
  assert.equal(saved.judge.ok, true)
  assert.equal(saved.archetype, 'saas')
})

test('boldSafetyForCandidate: 동작 줄이기에서 움직이면 fail — 사유에 쪽·폭·요소가 들어간다 · public 이 motion 이면 fail', async () => {
  const moving = async (o, routes) => routes.map((route) => ({ route, static: false, problems: [`${route} 375px: 동작 줄이기에서 값이 바뀌는 요소 2개 — div[hero-a]`], flashesPerSec: 0 }))
  const r = await adapter({ id: 'c' }, { measure: moving })
  assert.equal(r.verdict, 'fail')
  assert.equal(r.exit, 1)
  assert.ok(r.problems.some((p) => p.includes('div[hero-a]')), r.problems.join('|'))
  assert.match(r.note, /reduced-motion-static/)
  const pub = await adapter({ id: 'c' }, { archetype: 'public', boldMode: 'motion' })
  assert.equal(pub.verdict, 'fail')
  assert.match(pub.note, /layout-only/)
  const publicLayout = await adapter({ id: 'c' }, { archetype: 'public', boldMode: 'layout' })
  assert.equal(publicLayout.verdict, 'pass')
})

test('boldSafetyForCandidate: LCP 초과·깜빡임 초과·대비 실패는 각각 fail', async () => {
  assert.match((await adapter({ id: 'c' }, { ops: { checks: [{ id: 'lcp', status: 'fail', value: 3100, route: '/' }, ...OPS.checks.slice(1)] } })).note, /lcp/)
  assert.match((await adapter({ id: 'c' }, { measure: async (o, rs) => rs.map((route) => ({ route, static: true, problems: [], flashesPerSec: 5 })) })).note, /flashes/)
  assert.match((await adapter({ id: 'c' }, { a11y: { verdict: 'fail', routes: { '/': { verdict: 'fail', failures: ['axe color-contrast(serious) light·1440px 1곳'] } } } })).note, /contrast/)
})

test('boldSafetyForCandidate: 재사용할 ops·a11y 결과가 없으면 Chrome 을 부르지 않고 도구 실패 · 측정기가 던져도 도구 실패', async () => {
  let called = 0
  const r = await adapter({ id: 'c' }, { ops: null, measure: async () => { called++; return [] } })
  assert.deepEqual([r.verdict, r.toolFailure, called], ['tool', true, 0])
  assert.match(r.note, /^도구 실패: 재사용할 LCP·CLS 결과가 없다/)
  const noA11y = await adapter({ id: 'c' }, { a11y: { verdict: 'tool', routes: {} } })
  assert.equal(noA11y.toolFailure, true)
  const boom = await adapter({ id: 'c' }, { measure: async () => { throw new Error('탐색 실패(net::ERR_CONNECTION_REFUSED)') } })
  assert.deepEqual([boom.verdict, boom.toolFailure], ['tool', true])
  assert.match(boom.note, /ERR_CONNECTION_REFUSED/)
  const empty = await adapter({ id: 'c' }, { measure: async () => [] })
  assert.equal(empty.toolFailure, true)
  await assert.rejects(() => boldSafetyForCandidate(run(), { id: 'c' }, { origin: '', routes: ['/'], archetype: 'saas' }), /origin·routes·archetype/)
})

// ──────────────────────────────────────────────────────────────────────────────

// ── 고정 사본: 대담안 표시를 더하기 전(main a54f1da)의 directions.mjs pickDirections ──────────────────────────────
// 출처 구성(라이브러리·생성·브랜드)이 한 글자도 안 바뀌었음을 이 사본과의 비교로 고정한다. 고치지 않는다(원본이 바뀌어도 이 사본은 그대로다).
// 바뀐 점은 이름(pickDirections → pickDirectionsV0)·기억 장소(V0_LINT_CACHE)·brand.mjs 상대 경로·상수 복사뿐이다(MIN_AXES 는 복사하지 않고 directions.mjs 에서 가져온다).
const TOP_PRESETS = 20
const PALETTES_PER_PRESET = 3
const PALETTE_WINDOW = 24
const MIN_CONVERSIONS = 30

const seededOrder = (list, rand) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

const liftOf = (weights, archetype, keys) => {
  const rows = weights.filter((w) => w.scope === 'recipe' && keys.includes(w.key) && (!w.archetype || w.archetype === archetype) && (w.conversions ?? 0) >= MIN_CONVERSIONS)
  return rows.reduce((s, w) => s + (Number(w.lift) || 0), 0)
}

const V0_LINT_CACHE = new Map()

const ruleIds = (violations) => [...new Set(violations.map((v) => `lint:${String(v).split(':')[0].trim()}`))]

function librarySafePool(arch, rand, w, library, conditions = []) {
  const fitOf = (r) => (r.archetypes?.includes(arch) ? (r.archetypeConditions?.[arch] ? (matchedConditions(r, arch, conditions).length ? 1 : 0.9) : 1) : checkCompat(r.axes, arch).length ? 0 : 0.5)
  const libOrder = seededOrder(library, rand)
    .map((r) => ({ r, fit: fitOf(r), lift: liftOf(w, arch, [r.id]) }))
    .filter((x) => x.fit > 0)
  const bestFit = Math.max(0, ...libOrder.map((x) => x.fit))
  const safePool = libOrder.filter((x) => x.fit === bestFit).sort((a, b) => b.fit * (1 + b.lift) - a.fit * (1 + a.lift))
  return { libOrder, bestFit, safePool }
}

async function pickDirectionsV0({ brief, archetype, seed, weights, exclude = [], _presetFilter, _lint = lintRecipe, _paletteDiversity = true } = {}) {
  const arch = typeof archetype === 'string' ? archetype : archetype?.id ?? brief?.archetype
  if (!arch) throw new Error('pickDirections: 원형 id 가 없다')
  if (brief?.archetype && brief.archetype !== arch) throw new Error(`원형이 브리프와 다르다: 브리프 ${brief.archetype} · 넘긴 원형 ${arch}`)
  // 씨앗은 기본값 없이 받는다(P3-4 Task 4) — 「씨앗을 안 줘서 0」이 조용히 골든 세트의 결정성을 깨지 않게. 호출자가 seed 를 넘기거나 브리프가 seed 를 갖고 있어야 한다.
  const s = seed ?? brief?.seed
  if (!Number.isInteger(s)) throw new SeedRequiredError(s)
  const rand = mulberry32(s)
  const w = (weights ?? loadWeights()).filter((x) => (x.conversions ?? 0) >= MIN_CONVERSIONS)
  const library = loadLibrary()
  const rejected = []

  // ① 라이브러리. 이 원형에 archetypeConditions(자연어 조건, 예: r8 local 「헤리티지 업장에만」)가 붙은 레시피는 브리프 conditions 가 그 조건 id 와 맞을 때만 적합도 1, 아니면 조건 없는 레시피가 없을 때만 쓴다.
  const { bestFit, safePool } = librarySafePool(arch, rand, w, library, brief?.conditions ?? [])
  if (!safePool.length) throw new DirectionsShortError([{ id: 'slot:safe', reasons: [`no-library-recipe:${arch}`] }])
  const safeHead = safePool[0].r
  const safe = {
    id: 'a', slot: 'safe', source: 'library', recipe: safeHead.id, palette: `pal-recipe-${safeHead.id}`,
    fonts: { display: safeHead.fonts.display.family, body: safeHead.fonts.body.family }, novelty: 0,
    why: `① 무난 — 라이브러리 레시피 ${safeHead.id}: ${bestFit === 0.5 ? `${arch} 원형을 적은 레시피가 없어 호환표를 통과한` : `${arch} 원형을 archetypes 에 적은`} ${safePool.length}벌 중${safePool[0].lift ? ` 가중치 lift ${safePool[0].lift}로` : ` 씨앗 ${s} 순서로`} 골랐다${safeHead.archetypeConditions?.[arch] ? ` · 조건: ${safeHead.archetypeConditions[arch]}(${matchedConditions(safeHead, arch, brief?.conditions).length ? `브리프 조건 ${matchedConditions(safeHead, arch, brief?.conditions).join('·')} 이 맞아 적합도 1` : '브리프가 맞는지 확인 필요'})` : ''}`,
  }

  // ② ③ 생성 후보 풀
  const pool = loadPalettePool()
  const pairs = loadPairs().filter((p) => p.source !== `recipe:${safeHead.id}`)
  let presets = listPresets({ archetype: arch })
  if (_presetFilter) presets = presets.filter(_presetFilter)
  presets = presets.slice(0, TOP_PRESETS)
  const gens = []
  const randPal = mulberry32((s ^ 0x5bd1e995) >>> 0) // 팔레트 뽑기 전용 줄기(rand 를 건드리지 않는다)
  presets.forEach((preset, pi) => {
    const pairB = pairs.length ? pairs[Math.floor(rand() * pairs.length)] : null
    const fontSets = [hintPair(preset), ...(pairB ? [pairB] : [])]
    const window = pickPalettes(preset, { n: PALETTE_WINDOW, pool })
    // 창에서 씨앗이 PALETTES_PER_PRESET 개를 뽑는다. 뽑힌 순서가 칸 안 동률 순서(ki)라 첫 번째가 창 안에서 고르게 나온다(순위순으로 다시 세우면 위쪽 팔레트로 쏠린다).
    const chosen = seededOrder(window, randPal).slice(0, PALETTES_PER_PRESET)
    chosen.forEach((palette, ki) => fontSets.forEach((pair, fi) => {
      const head = presetToRecipeHead(preset, palette, pair, { archetype: arch })
      gens.push({
        key: `${preset.id}|${palette.id}|${pair.id}`, preset, palette: palette.id, pair: pair.id, head,
        novelty: novelty(head, library), score: preset.score * (1 + liftOf(w, arch, [preset.id, head.id])), order: [pi, ki, fi],
        lift: liftOf(w, arch, [preset.id, head.id]),
      })
    }))
  })
  // 전역 탈락(모든 칸 공통): ①·라이브러리와 축 차이. lint 는 칸 순서대로 필요할 때만 돌리고 기억한다(머리 하나 60ms 안팎).
  // exclude: 뒤 관문(AI 티 등, Task 11)에서 떨어진 후보 — { id: 후보 key 또는 머리 id, reasons: 규칙 id[] }. 같은 칸의 다음 순위로 다시 채운다.
  const excluded = new Map(exclude.map((x) => [x.id, x.reasons ?? ['excluded']]))
  const alive = []
  for (const g of gens) {
    const ex = excluded.get(g.key) ?? excluded.get(g.head.id)
    if (ex) { rejected.push({ id: g.key, reasons: [...ex] }); continue }
    const near = [
      ...(axisDistance(g.head, safeHead) < MIN_AXES ? ['axis-distance:safe'] : []),
      ...library.filter((r) => r.id !== safeHead.id && axisDistance(g.head, r) < MIN_AXES).map((r) => `axis-distance:library:${r.id}`),
    ]
    if (near.length) rejected.push({ id: g.key, reasons: near })
    else alive.push(g)
  }
  const lintMemo = new Map()
  const passes = (g) => {
    if (!lintMemo.has(g.key)) {
      const ck = `${arch}|${g.key}`
      let v
      if (_lint === lintRecipe && V0_LINT_CACHE.has(ck)) v = V0_LINT_CACHE.get(ck)
      else { v = _lint(g.head); if (_lint === lintRecipe) V0_LINT_CACHE.set(ck, v) }
      lintMemo.set(g.key, v)
      if (v.length) rejected.push({ id: g.key, reasons: ruleIds(v) })
    }
    return !lintMemo.get(g.key).length
  }
  const cmpOrder = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]
  const byScore = (a, b) => b.score - a.score || cmpOrder(a, b)
  const byNovelty = (a, b) => b.novelty - a.novelty || b.lift - a.lift || byScore(a, b)
  const firstPassing = (list, avoid) => (_paletteDiversity ? diversityOrder(list, avoid) : list).find(passes)
  const shared = (g, avoid) => [...avoid].map(paletteKey).includes(paletteKey(g.palette))

  // ③ 먼저: 통과한 생성 후보 중 새로움 최고(①과 팔레트가 다른 것 먼저). 그다음 ②: ③과 축 2개 이상 다르고 새로움이 ③ 이하인 것 중 점수 1등.
  let bold, boldHead, brandInfo
  const genBold = firstPassing([...alive].sort(byNovelty), [safe.palette])
  if (brief?.brand) {
    let mod
    try { mod = await import('../stamp/brand.mjs') } catch (e) { throw new Error(`브랜드 입력이 있는데 factory/stamp/brand.mjs(P3-3 Task 4)를 불러오지 못했다 — ${e.message}`) }
    const base = genBold?.preset ?? presets[0]
    if (!base) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: ['brand-no-base-preset'] }])
    const r = mod.brandToRecipeHead(brief.brand, base, { archetype: arch })
    if (r.blocked) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: [`brand-blocked: ${r.blocked}`] }])
    const v = _lint(r.head)
    const near = [...(axisDistance(r.head, safeHead) < MIN_AXES ? ['axis-distance:safe'] : [])]
    if (v.length || near.length) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: [...ruleIds(v), ...near].map((x) => `brand-${x}`) }])
    boldHead = r.head
    brandInfo = { input: brief.brand, adjustments: r.adjustments ?? [], fontSubstitutions: r.fontSubstitutions ?? [], basePreset: base.id }
    bold = {
      id: 'c', slot: 'bold', source: 'brand', recipe: r.head, preset: base.id,
      fonts: { display: r.head.fonts?.display?.family, body: r.head.fonts?.body?.family }, brand: brandInfo,
      novelty: novelty(r.head, library),
      why: `③ 과감 — 브랜드 입력으로 만든 안(바탕 프리셋 ${base.id}, 색 조정 ${brandInfo.adjustments.length}건 · 서체 대체 ${brandInfo.fontSubstitutions.length}건)`,
    }
  } else if (genBold) {
    boldHead = genBold.head
    bold = candidateOf(genBold, 'c', 'bold', `③ 과감 — 통과한 생성 후보 중 새로움 최고 ${genBold.novelty}(프리셋 ${genBold.preset.id}, 팔레트 ${genBold.palette})${shared(genBold, [safe.palette]) ? ' · ①과 팔레트가 같다: 통과한 다른 후보가 없다(C10 예외)' : ''}`)
  }
  if (!bold) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: ['no-passing-generated-candidate'] }])

  const avoidNew = [safe.palette, bold.palette].filter(Boolean)
  const newPool = alive.filter((g) => g !== genBold || bold.source === 'brand')
    .filter((g) => axisDistance(g.head, boldHead) >= MIN_AXES && (bold.source === 'brand' || g.novelty <= bold.novelty))
    .sort(byScore)
  const gNew = firstPassing(newPool, avoidNew)
  if (!gNew) throw new DirectionsShortError([...rejected, { id: 'slot:new', reasons: [alive.length ? 'no-passing-candidate-2-axes-from-bold' : 'no-passing-generated-candidate'] }])
  const newC = candidateOf(gNew, 'b', 'new', `② 새 조합 — 통과한 생성 후보 중 점수 1등(프리셋 ${gNew.preset.id} 점수 ${round(gNew.score)}, 팔레트 ${gNew.palette})${shared(gNew, avoidNew) ? ' · ①·③과 팔레트가 같다: 통과한 다른 후보가 없다(C10 예외)' : ''}`)

  return { candidates: [safe, newC, bold], rejected }
}

const round = (x) => Math.round(x * 1e4) / 1e4
function candidateOf(g, id, slot, why) {
  return {
    id, slot, source: 'generated', recipe: g.head, preset: g.preset.id, palette: g.palette,
    fonts: { display: g.head.fonts.display.family, body: g.head.fonts.body.family }, novelty: g.novelty, why,
  }
}
