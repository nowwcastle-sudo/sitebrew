// 손잡이 블록(factory/stamp/handles/) — 읽기 하나로 레시피 머리를 한 칸 옮긴다. 재료는 라이브러리 레시피 머리와 그 레시피의 팔레트다.
//   후보 머리 r1-measure(원형 saas)와 그 01 팔레트(pal-recipe-r1-measure)는 revise-fixtures 의 saas 후보와 같다 — 사이트 빌드(약 4초) 없이 같은 데이터를 쓴다.
//   같은 값이 둘 이상일 때 고르는 규칙(바뀐 축 수 → repair 앞 축을 덜 바꿈 → compat 값 순서 · rank 표 순서)은 시험이 값을 고정해 확인한다.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { GRAMMAR_FILE, grammar, loadGrammar } from '../vocab/grammar.mjs'
import { fill } from '../vocab/fill.mjs'
import { COMPAT, checkCompat } from './compat.mjs'
import { AXIS_DEFAULTS } from './axes.mjs'
import { SPACING_DEFAULT, lintRecipeReport } from './recipe.mjs'
import { derivePalette, loadLibrary, loadPalettePool, recipeToMaterials } from './style-presets.mjs'
import { hexToOklch } from './lib/palette-lib.mjs'
import { loadHandles } from '../stamp/handles.mjs'
import { BLOCKS, stepHead } from '../stamp/handles/index.mjs'
import { compatible, isSafe, moveToValue, repaint } from '../stamp/handles/common.mjs'
import { koreanKitFonts } from '../stamp/revise-values.mjs'

const lex = loadLexicon()
const handles = loadHandles(lex)
const G = grammar.text.step
const LIB = loadLibrary()
const POOL = loadPalettePool().filter((p) => p.use === 'recipe')

const headOf = (id, patch = {}) => ({ ...structuredClone(LIB.find((r) => r.id === id)), ...patch })
async function ctxOf(head, archetype = head.archetypes[0], palette) {
  return { lex, archetype, palette: palette === undefined ? (await recipeToMaterials(head)).palette : palette, site: {} }
}
const read = (axis, o = {}) => ({ axis, scope: 'site', strength: 1, ...o })
const step = (head, reading, ctx) => stepHead(head, reading, ctx)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** 머리에서 달라진 레시피 칸 이름들(axes.<축>은 풀어서). */
function diffFields(a, b) {
  const out = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'axes') for (const x of new Set([...Object.keys(a.axes), ...Object.keys(b.axes)])) { if (a.axes[x] !== b.axes[x]) out.push(`axes.${x}`) }
    else if (!same(a[k], b[k])) out.push(k)
  }
  return out
}
/** 새 머리의 색이 어느 풀 팔레트에서 왔는지(색 논리·축 그대로 펼쳐 같은 것). */
const paletteOf = (before, after) => POOL.find((p) => same(derivePalette({ ...p, theme: undefined }, { colorLogic: before.colorLogic, axes: before.axes }).light, after.color.light))
const paletteBgL = (p) => hexToOklch(p.roles.background.slice(1))[0]
const familyOf = (item) => koreanKitFonts().find((f) => f.item === item)?.category

test('type-scale: larger 1 은 D1→D2 · larger 2 는 D1→D3 · 끝(D3)에서는 grammar.atEnd', async () => {
  const head = headOf('r5-celadon')
  assert.equal(head.axes.display ?? AXIS_DEFAULTS.display, 'D1')
  const ctx = await ctxOf(head)
  const one = step(head, read('type-scale', { direction: 'larger' }), ctx)
  assert.equal(one.head.axes.display, 'D2')
  assert.deepEqual(diffFields(head, one.head), ['axes.display'])
  assert.deepEqual([one.from, one.to], [G.current, fill(G.move, { count: G.counts[0], end: '크게' })])
  assert.equal(one.to, '한 칸 더 크게')
  const two = step(head, read('type-scale', { direction: 'larger', strength: 2 }), ctx)
  assert.equal(two.head.axes.display, 'D3')
  assert.equal(two.to, '두 칸 더 크게')
  const top = headOf('r5-celadon', { axes: { ...head.axes, display: 'D3' } })
  assert.deepEqual(step(top, read('type-scale', { direction: 'larger' }), ctx), { ask: G.atEnd })
  const mid = headOf('r5-celadon', { axes: { ...head.axes, display: 'D2' } })
  const clamped = step(mid, read('type-scale', { direction: 'larger', strength: 2 }), ctx)
  assert.equal(clamped.head.axes.display, 'D3', '끝을 넘으면 끝')
  assert.equal(clamped.to, '한 칸 더 크게', '실제로 옮긴 칸 수로 말한다')
  const down = step(top, read('type-scale', { direction: 'smaller', strength: 2 }), ctx)
  assert.equal(down.head.axes.display, 'D1')
  assert.equal(down.to, '두 칸 더 작게')
  assert.deepEqual(step(head, read('type-scale', { direction: 'smaller' }), ctx), { ask: G.atEnd })
})

test('motion: static 1 은 M2→M1', async () => {
  const head = headOf('r14-concrete')
  assert.equal(head.motion, 'M2')
  const r = step(head, read('motion', { direction: 'static' }), await ctxOf(head))
  assert.equal(r.head.motion, 'M1')
  assert.deepEqual(diffFields(head, r.head), ['motion'])
  assert.equal(r.to, '한 칸 더 정적으로')
})

test('shape: round 1 은 R0→R1 — 0 계열 묶음 머리는 호환을 지키려 바뀐 축이 가장 적은 조합으로 함께 옮긴다', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  const r = step(head, read('shape', { direction: 'round' }), ctx)
  assert.equal(r.head.axes.radius, 'R1')
  assert.deepEqual(checkCompat(r.head.axes, 'saas'), [])
  assert.deepEqual(lintRecipeReport(r.head).violations, [])
  const repair = handles.axes.shape.repair
  // 전수 대조: repair 축 값의 곱 중 호환을 지키는 조합의 최소 변경 수
  const grid = repair.reduce((rows, a) => rows.flatMap((row) => COMPAT.axes[a].map((v) => ({ ...row, [a]: v }))), [{}])
  const cost = (axes) => repair.filter((a) => axes[a] !== head.axes[a]).length
  const best = Math.min(...grid.map((g) => ({ ...head.axes, ...g, radius: 'R1' })).filter((axes) => checkCompat(axes, 'saas').length === 0).map(cost))
  assert.equal(cost(r.head.axes), best)
  assert.equal(best, 5, '0 계열(B1·I3·C2·T4·H3)은 큰 반경 R1 과 함께 둘 수 없어 다섯 칸이 모두 옮겨진다')
  // 같은 변경 수 안에서는 compat.json 값 순서의 앞 값
  assert.deepEqual(r.head.axes, { ...head.axes, radius: 'R1', button: 'B2', input: 'I1', surface: 'C1', table: 'T1', header: 'H1' })
})

test('depth: lifted 1 은 S0→S1(등급 1 의 S1·S2 중 호환 복구가 같으면 rank 표 앞 값) · S2 머리는 S3 으로', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  const r = step(head, read('depth', { direction: 'lifted' }), ctx)
  assert.equal(r.head.axes.shadow, 'S1')
  assert.deepEqual(diffFields(head, r.head), ['axes.shadow'])
  assert.deepEqual(checkCompat({ ...head.axes, shadow: 'S2' }, 'saas'), [], 'S2 도 복구 없이 되는 같은 값이다')
  assert.ok(Object.keys(lex.axes.depth.rank).indexOf('S1') < Object.keys(lex.axes.depth.rank).indexOf('S2'))
  const s2 = headOf('r3-woodblock')
  assert.equal(s2.axes.shadow, 'S2')
  const up = step(s2, read('depth', { direction: 'lifted' }), await ctxOf(s2))
  assert.equal(up.head.axes.shadow, 'S3')
  assert.deepEqual(checkCompat(up.head.axes, s2.archetypes[0]), [])
  assert.deepEqual(lintRecipeReport(up.head).violations, [])
  assert.deepEqual(step(up.head, read('depth', { direction: 'lifted' }), await ctxOf(up.head)), { ask: G.atEnd })
})

test('contrast: crisp 1 은 C3→C1 — 같은 등급의 C1·C4 중 바뀐 축이 같으면 rank 표 앞 값 · 바뀐 축이 더 적은 값이 표 순서를 이긴다', async () => {
  const head = headOf('r5-celadon')
  assert.equal(head.axes.surface, 'C3')
  const ctx = await ctxOf(head)
  const r = step(head, read('contrast', { direction: 'crisp' }), ctx)
  assert.equal(r.head.axes.surface, 'C1')
  assert.deepEqual(checkCompat(r.head.axes, ctx.archetype), [])
  const keys = Object.keys(lex.axes.contrast.rank)
  assert.ok(keys.indexOf('C1') < keys.indexOf('C4'), '표 순서 C1 이 앞')
  const handle = handles.axes.contrast
  const costOf = (value) => diffFields(head, moveToValue(head, handle, [value], ctx).head).length
  assert.equal(costOf('C1'), costOf('C4'), '두 값의 바뀐 칸 수가 같아 표 순서가 정한다')
  // 표 순서와 반대로 [C4, C1] 을 줘도, C4 가 더 많이 바뀌는 머리(표 T1 은 C1·C2 와만)에서는 적게 바뀌는 C1 이 이긴다
  const tight = { ...head, axes: { ...head.axes, table: 'T1' } }
  const pick = moveToValue(tight, handle, ['C4', 'C1'], ctx)
  assert.equal(pick.value, 'C1')
  assert.equal(pick.head.axes.table, 'T1')
  assert.equal(moveToValue(tight, handle, ['C4'], ctx).head.axes.table !== 'T1', true, 'C4 는 표(T1)까지 옮겨야 한다')
})

test('compatible: 바뀐 축 수가 같으면 repair 앞 축을 덜 바꾼 것, 그다음 compat 값 순서 앞', async () => {
  const head = headOf('r6-civic')
  const ctx = await ctxOf(head)
  const [a, b] = COMPAT.forbidden[0].values // I4 × T1 — 입력 또는 표 하나만 바꾸면 풀린다
  const bad = { ...head, axes: { ...head.axes, input: a, table: b } }
  assert.equal(checkCompat(bad.axes, ctx.archetype).length > 0, true)
  const first = (repair) => compatible(bad, repair, ctx).next().value
  const byInput = first(['input', 'table'])
  assert.deepEqual([byInput.changed, byInput.head.axes.input, byInput.head.axes.table], [1, a, 'T2'], '앞 축(input)을 덜 바꾸려고 뒤 축(table)을 바꾼다')
  const byTable = first(['table', 'input'])
  assert.deepEqual([byTable.changed, byTable.head.axes.input, byTable.head.axes.table], [1, 'I1', b], '목록이 바뀌면 입력을 바꾼다')
  const clean = compatible(head, ['input', 'table'], ctx).next().value
  assert.deepEqual([clean.changed, clean.head], [0, head], '이미 지키는 머리는 그대로 하나')
  assert.equal(compatible(bad, [], ctx).next().done, true, 'repair 가 없으면 복구 후보가 없다')
})

test('palette-count: more 1 은 K1→K4(K4·K7 중 rank 표 앞 값) · 색이 다시 만들어진다 · ctx.palette 가 null 이면 ask', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  assert.equal(head.colorLogic, 'K1')
  const r = step(head, read('palette-count', { direction: 'more' }), ctx)
  assert.equal(r.head.colorLogic, 'K4')
  const keys = Object.keys(lex.axes['palette-count'].rank)
  assert.ok(keys.indexOf('K4') < keys.indexOf('K7') && lex.axes['palette-count'].rank.K4 === lex.axes['palette-count'].rank.K7)
  assert.notDeepEqual(r.head.color, head.color)
  assert.equal(r.head.defaultTheme, head.defaultTheme)
  assert.equal(r.head.alternates, undefined, '옛 색 기준의 B안은 뺀다')
  assert.deepEqual(diffFields(head, r.head).sort(), ['alternates', 'color', 'colorLogic'])
  assert.equal(r.to, '한 칸 더 많게')
  assert.deepEqual(step(head, read('palette-count', { direction: 'more' }), { ...ctx, palette: null }), { ask: G.noPalette })
  const fewer = step(head, read('palette-count', { direction: 'fewer' }), ctx)
  assert.equal(fewer.head.colorLogic, 'K3', '등급 0 의 K3·K9 중 표 앞 값')
  const wide = step(head, read('palette-count', { direction: 'more', strength: 2 }), ctx)
  assert.equal(lex.axes['palette-count'].rank[wide.head.colorLogic], 3, '두 등급 위')
})

test('palette-count: 끝(K8)에서 more 는 atEnd — 색 정보가 없어도 끝이 먼저다', async () => {
  const head = headOf('r9-clay')
  assert.equal(head.colorLogic, 'K8')
  const ctx = await ctxOf(head)
  assert.deepEqual(step(head, read('palette-count', { direction: 'more' }), ctx), { ask: G.atEnd })
  assert.deepEqual(step(head, read('palette-count', { direction: 'more' }), { ...ctx, palette: null }), { ask: G.atEnd })
})

test('color-temperature: warm 1 은 mood 에 warm 이 든 다른 팔레트 · 지금 팔레트와 색조 계열이 같은 것을 먼저', async () => {
  const head = headOf('r1-measure')
  const plain = await ctxOf(head, 'saas')
  const r = step(head, read('color-temperature', { direction: 'warm' }), plain)
  const used = paletteOf(head, r.head)
  assert.ok(used, '풀 팔레트에서 만든 색이다')
  assert.ok(used.mood.includes('warm'))
  assert.equal(r.head.defaultTheme, head.defaultTheme, '온도 요청은 기본 테마를 바꾸지 않는다')
  assert.equal(r.to, '따뜻하게 바꾼 색')
  // 지금 팔레트에 색조 계열이 있으면 같은 계열의 warm 팔레트가 먼저다
  const family = 'orange/brown 30-75'
  const current = POOL.find((p) => p.hue_family === family && !p.mood.includes('warm')) ?? POOL.find((p) => p.hue_family === family)
  const kin = step(head, read('color-temperature', { direction: 'warm' }), { ...plain, palette: current })
  const kinUsed = paletteOf(head, kin.head)
  assert.equal(kinUsed.hue_family, family)
  assert.notEqual(kinUsed.id, current.id)
  const cool = paletteOf(head, step(head, read('color-temperature', { direction: 'cool' }), plain).head)
  assert.ok(cool.mood.includes('cool'))
  const two = paletteOf(head, step(head, read('color-temperature', { direction: 'warm', strength: 2 }), plain).head)
  const hits = (p) => p.mood.filter((m) => handles.palette.temperature.warm.includes(m)).length
  assert.ok(hits(two) >= hits(used), '세기 2 는 mood 가 더 많이 겹치는 쪽')
})

test('color-saturation: vivid 는 bold·neon · muted 는 muted·earthy 꼬리표 팔레트', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  const vivid = paletteOf(head, step(head, read('color-saturation', { direction: 'vivid' }), ctx).head)
  assert.ok(vivid.mood.some((m) => handles.palette.saturation.vivid.includes(m)))
  const muted = paletteOf(head, step(head, read('color-saturation', { direction: 'muted' }), ctx).head)
  assert.ok(muted.mood.some((m) => handles.palette.saturation.muted.includes(m)))
})

test('color-lightness: bright 2 는 배경이 가장 크게 밝아진 팔레트 · dark 1 은 지금보다 어두운 팔레트 · 기본 테마가 따라온다', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  const now = hexToOklch((await recipeToMaterials(head)).palette.roles.background.slice(1))[0]
  const r = step(head, read('color-lightness', { direction: 'bright', strength: 2 }), ctx)
  const used = paletteOf(head, r.head)
  assert.ok(paletteBgL(used) > now)
  // 더 크게 밝은 팔레트는 모두 안전한 머리를 못 만들어 건너뛴 것뿐이다
  for (const p of POOL.filter((q) => paletteBgL(q) > paletteBgL(used))) {
    assert.equal(isSafe(repaint(head, p, { followTheme: true }), ctx), false, `${p.id} 가 더 밝은데 건너뛰었다`)
  }
  assert.equal(r.head.defaultTheme, 'light')
  const dark = step(head, read('color-lightness', { direction: 'dark' }), ctx)
  const darkUsed = paletteOf(head, dark.head)
  assert.ok(paletteBgL(darkUsed) < now)
  assert.equal(dark.head.defaultTheme, 'dark')
})

test('color-hue: 이름 값은 색이 바뀐다(sky) · 맞출 수 없는 색은 revise-values 의 되묻는 글 · away-from-indigo-violet 는 보라·남색 계열이 아닌 팔레트', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  const sky = step(head, read('color-hue', { value: 'sky' }), ctx)
  assert.notDeepEqual(sky.head.color, head.color)
  assert.deepEqual([sky.from, sky.to], [G.current, '하늘색'])
  assert.deepEqual(diffFields(head, sky.head).filter((f) => !['id', 'name', 'color', 'colorLogic', 'alternates'].includes(f)), [], '색 말고는 그대로')
  const off = step(head, read('color-hue', { value: 'yellow' }), ctx)
  assert.equal(typeof off.ask, 'string')
  assert.equal(off.head, undefined)
  const away = step(head, read('color-hue', { value: 'away-from-indigo-violet' }), ctx)
  const used = paletteOf(head, away.head)
  assert.ok(used.hue_family, '색조 계열을 아는 팔레트만 쓴다')
  assert.equal(used.hue_family.toLowerCase().split(/[^a-z]+/).some((f) => ['indigo', 'violet', 'purple'].includes(f)), false)
  assert.equal(away.to, '보라·남색에서 먼 색')
  assert.equal(away.head.defaultTheme, head.defaultTheme)
})

test('color-hue: 대표 색 hex 가 있는 값은 모두 라이브러리 레시피에서 주색 규칙을 맞춘다', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  for (const [name, spec] of Object.entries(handles.values['color-hue']).filter(([, v]) => v.hex)) {
    const r = step(head, read('color-hue', { value: name }), ctx)
    assert.ok(r.head, `${name}(${spec.hex}): ${r.ask}`)
  }
})

test('type-family: distinctive 는 지금 범주가 아닌 범주 · serif-or-thin-sans 는 serif', async () => {
  const serif = headOf('r4-evidence') // 한글 제목체 마루부리 = serif
  assert.equal(familyOf(serif.fonts.displayKo.item), 'serif')
  const ctx = await ctxOf(serif)
  const d = step(serif, read('type-family', { value: 'distinctive' }), ctx)
  assert.equal(familyOf(d.head.fonts.display.item), 'handwriting', 'serif 를 건너뛴 첫 범주')
  assert.equal(d.to, '흔하지 않은 글꼴')
  const rounded = headOf('r7-docs') // 한글 제목체 = rounded
  const e = step(rounded, read('type-family', { value: 'distinctive' }), await ctxOf(rounded))
  assert.equal(familyOf(e.head.fonts.display.item), 'serif')
  const thin = step(serif, read('type-family', { value: 'serif-or-thin-sans' }), ctx)
  assert.equal(familyOf(thin.head.fonts.display.item), 'serif')
  assert.notEqual(thin.head.fonts.display.item, serif.fonts.display.item)
  const sans = step(serif, read('type-family', { value: 'clear-sans' }), ctx)
  assert.equal(familyOf(sans.head.fonts.display.item), 'sans')
})

test('spacing: airy 1 은 normal→airy · airy 에서 airy 는 atEnd · tight 쪽도 같다', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  assert.equal(head.spacing ?? SPACING_DEFAULT, 'normal')
  const r = step(head, read('spacing', { direction: 'airy' }), ctx)
  assert.equal(r.head.spacing, 'airy')
  assert.deepEqual(diffFields(head, r.head), ['spacing'])
  assert.equal(r.to, '한 칸 더 시원하게')
  assert.deepEqual(step(r.head, read('spacing', { direction: 'airy' }), ctx), { ask: G.atEnd })
  assert.equal(step(head, read('spacing', { direction: 'tight' }), ctx).head.spacing, 'tight')
  const back = step(r.head, read('spacing', { direction: 'tight', strength: 2 }), ctx)
  assert.equal(back.head.spacing, 'tight')
  assert.equal(back.to, '두 칸 더 빽빽하게')
})

test('strength 0 은 같은 머리 그대로', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  for (const axis of Object.keys(handles.axes)) {
    const reading = lex.axes[axis].ends ? read(axis, { direction: lex.axes[axis].ends[1], strength: 0, cap: true }) : read(axis, { value: Object.keys(lex.axes[axis].valueLabels)[0], strength: 0 })
    const r = step(head, reading, ctx)
    assert.equal(r.head, head, axis)
    assert.deepEqual([r.from, r.to], [G.current, G.keep])
  }
})

test('린트를 통과하는 후보가 없으면 ask 는 grammar.noSafeChange', async () => {
  const broken = headOf('r14-concrete', { references: [] }) // 레퍼런스 2개 미만 — 어떤 새 머리도 린트 위반
  assert.ok(lintRecipeReport(broken).violations.length > 0)
  const ctx = await ctxOf(broken)
  for (const reading of [read('motion', { direction: 'static' }), read('color-temperature', { direction: 'warm' }), read('palette-count', { direction: 'more' })]) {
    assert.deepEqual(step(broken, reading, ctx), { ask: G.noSafeChange }, reading.axis)
  }
  const flat = headOf('r1-measure', { references: [] })
  assert.deepEqual(step(flat, read('depth', { direction: 'lifted' }), await ctxOf(flat, 'saas')), { ask: G.noSafeChange }, '복구 없이 호환을 지키는 값이 린트에서 막혀도 같다')
  const civic = headOf('r6-civic') // 대비를 올리려면 0 계열(C2)이 필요한데 복구 축(반경·그림자·표)만으로는 큰 반경 R2 를 풀 수 없다
  assert.deepEqual(step(civic, read('contrast', { direction: 'crisp' }), await ctxOf(civic)), { ask: G.noSafeChange })
  // 린트 위반이 새 값에서만 생기는 경우: D2 는 dashboard 원형 머리에 쓸 수 없다(복구 축이 없는 order 손잡이)
  const stuck = headOf('r1-measure', { archetypes: ['dashboard'] })
  assert.deepEqual(step(stuck, read('type-scale', { direction: 'larger' }), await ctxOf(stuck, 'dashboard')), { ask: G.noSafeChange }, 'D2 는 dashboard 원형에 쓰지 않는다')
})

test('잘못된 입력은 던진다: 손잡이 없는 축 · 끝이 아닌 방향 · 순서표에 없는 지금 값', async () => {
  const head = headOf('r1-measure')
  const ctx = await ctxOf(head, 'saas')
  assert.throws(() => step(head, read('nothing', { direction: 'x' }), ctx), /nothing/)
  assert.throws(() => step(head, read('shape', { direction: 'sideways' }), ctx), /sideways/)
  assert.throws(() => step({ ...head, axes: { ...head.axes, display: 'D9' } }, read('type-scale', { direction: 'larger' }), ctx), /D9/)
  assert.throws(() => step({ ...head, axes: { ...head.axes, shadow: 'S9' } }, read('depth', { direction: 'lifted' }), ctx), /S9/)
  assert.throws(() => step(head, read('color-hue', { value: 'nothing' }), ctx), /nothing/)
})

test('등록부: 갈래마다 step 을 내는 블록이 하나 · 배선이 쓰는 갈래와 같다', () => {
  assert.deepEqual(Object.keys(BLOCKS).sort(), [...new Set(Object.values(handles.axes).map((h) => h.kind))].sort())
  for (const [kind, block] of Object.entries(BLOCKS)) assert.equal(typeof block.step, 'function', kind)
})

test('grammar.text.step: 칸 수 글은 strengthMax 만큼 · 틀에 조사가 붙지 않는다 · 모자라면 던진다', () => {
  assert.ok(G.counts.length >= grammar.limits.strengthMax)
  for (const t of [G.move, G.palette]) assert.doesNotMatch(t, /\{\w+\}(은|는|이|가|을|를|와|과|으로)(?![가-힣])/, t)
  const dir = mkdtempSync(join(tmpdir(), 'revise-step-test-'))
  try {
    const f = join(dir, 'grammar.yaml')
    writeFileSync(f, readFileSync(GRAMMAR_FILE, 'utf8').replace(/counts: \[.*?\]/, 'counts: ["한 칸"]'))
    assert.throws(() => loadGrammar(f), /counts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('린트 위반이 호환 밖에 있으면 복구 조합을 린트하지 않고 바로 noSafeChange — 호출마다 2초 안', async () => {
  const broken = headOf('r14-concrete', { references: [] })
  const ctx = await ctxOf(broken)
  for (const reading of [read('shape', { direction: 'round' }), read('depth', { direction: 'lifted' })]) {
    const t0 = Date.now()
    assert.deepEqual(step(broken, reading, ctx), { ask: G.noSafeChange }, reading.axis)
    assert.ok(Date.now() - t0 < 2000, `${reading.axis}: ${Date.now() - t0}ms`)
  }
})

test('호환은 머리에 적힌 원형 모두에서 본다 — 목록이 비면 ctx.archetype 하나', async () => {
  const head = headOf('r1-measure') // 원형 dashboard·saas — D2 는 dashboard 에 쓸 수 없다
  assert.deepEqual(head.archetypes, ['dashboard', 'saas'])
  const d2 = { ...head, axes: { ...head.axes, display: 'D2' } }
  const saas = await ctxOf(head, 'saas')
  assert.deepEqual(checkCompat(d2.axes, 'saas'), [], 'saas 하나만 보면 깨끗하다')
  assert.equal(compatible(d2, ['input'], saas).next().done, true, 'dashboard 에서 깨져 복구 후보가 없다')
  assert.equal(isSafe(d2, saas), false)
  const none = { ...d2, archetypes: [] }
  assert.equal(compatible(none, ['input'], saas).next().done, false, '목록이 비면 ctx.archetype(saas)만 본다')
  assert.equal(compatible(none, ['input'], await ctxOf(head, 'dashboard')).next().done, true)
})

test('color-lightness: 지금 팔레트의 역할 배경과 후보의 역할 배경을 같은 잣대로 견준다 — 기본 테마가 다른 머리에서도', async () => {
  const head = headOf('r10-console') // 다크 기본 — 머리 색의 배경 L 은 0.19
  assert.equal(head.defaultTheme, 'dark')
  const light = POOL.find((p) => paletteBgL(p) > 0.9) // 지금 팔레트가 밝으면 밝게는 이보다 더 밝은 후보(머리 색 기준 0.19 보다 밝은 정도가 아니다)
  const up = step(head, read('color-lightness', { direction: 'bright' }), await ctxOf(head, 'dashboard', light))
  assert.ok(up.head, up.ask)
  assert.ok(paletteBgL(paletteOf(head, up.head)) > paletteBgL(light))
  const dark = POOL.filter((p) => paletteBgL(p) > 0.05 && paletteBgL(p) < 0.15)[0] // 지금 팔레트가 어두우면 어둡게는 이보다 더 어두운 후보
  const down = step(head, read('color-lightness', { direction: 'dark' }), await ctxOf(head, 'dashboard', dark))
  assert.ok(down.head, down.ask)
  assert.ok(paletteBgL(paletteOf(head, down.head)) < paletteBgL(dark))
  // 지금 팔레트가 풀에서 가장 밝으면(어두우면) 더 밝은(어두운) 후보가 없다 — 머리 색(0.19) 기준으로 재면 후보가 남는다
  const extreme = (pick) => POOL.reduce((a, b) => (pick(paletteBgL(b), paletteBgL(a)) ? b : a))
  assert.deepEqual(step(head, read('color-lightness', { direction: 'bright' }), await ctxOf(head, 'dashboard', extreme((x, y) => x > y))), { ask: G.noSafeChange })
  assert.deepEqual(step(head, read('color-lightness', { direction: 'dark' }), await ctxOf(head, 'dashboard', extreme((x, y) => x < y))), { ask: G.noSafeChange })
})

test('type-family notCurrent: 지금 범주가 아닌 범주가 목록에 없으면 noSafeChange', async () => {
  const head = headOf('r4-evidence') // 제목체 범주 serif
  const ctx = await ctxOf(head)
  const only = { ...handles, values: { ...handles.values, 'type-family': { distinctive: { notCurrent: ['serif'] } } } }
  assert.deepEqual(BLOCKS.value.step(head, read('type-family', { value: 'distinctive' }), handles.axes['type-family'], { ...ctx, handles: only }), { ask: G.noSafeChange })
})

test('stepHead 결과의 팔레트 칸: 팔레트 고르기는 고른 팔레트와 뒤 읽기가 지킬 조건 · 보라 피하기도 같다 · 값 색은 null · 색 가짓수는 쓴 팔레트 · 그 밖은 칸이 없다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const warm = step(head, read('color-temperature', { direction: 'warm' }), ctx)
  assert.ok(POOL.some((p) => p.id === warm.palette.id), '풀에서 고른 팔레트')
  assert.equal(warm.keep(warm.palette), true)
  assert.equal(warm.keep({ ...warm.palette, mood: [] }), false, '따뜻한 꼬리표가 없는 팔레트는 조건을 어긴다')
  const bright = step(head, read('color-lightness', { direction: 'bright' }), ctx)
  assert.equal(bright.keep(bright.palette), true)
  assert.equal(bright.keep(ctx.palette), false, '처음과 같은 밝기는 「밝게」가 아니다')
  const away = step(head, read('color-hue', { value: 'away-from-indigo-violet' }), ctx)
  assert.ok(away.palette.hue_family && away.keep(away.palette) && !away.keep({ ...away.palette, hue_family: 'violet' }))
  assert.equal(step(head, read('color-hue', { value: 'blue' }), ctx).palette, null, '값으로 정한 색은 풀 팔레트가 아니다')
  const logic = step(head, read('palette-count', { direction: 'fewer' }), ctx)
  assert.equal(logic.palette, ctx.palette, '색 가짓수는 지금 팔레트를 새 색 논리로 다시 펼친다')
  assert.equal('palette' in step(head, read('type-family', { value: 'distinctive' }), ctx), false, '글꼴은 색을 건드리지 않는다')
  assert.equal('palette' in step(head, read('spacing', { direction: 'airy' }), ctx), false)
})
