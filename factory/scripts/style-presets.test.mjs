// 스타일 프리셋·레시피 분해 재료(P3-2 Task 16a, 접합면 J4·J5) 검사. 모듈은 style-presets.mjs, 생성은 build-presets.mjs(gen:all).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AXIS_ORDER, AXIS_DEFAULTS } from './axes.mjs'
import { checkCompat, COMPAT } from './compat.mjs'
import { lintRecipe, composeStyleMap, UI_SRC, applyAlternate } from './recipe.mjs'
import { compileSource } from './compile-styles.mjs'
import { rulesIntact } from './hooks-audit.mjs'
import { loadStyles } from './styles-ref.mjs'
import {
  loadPresets, loadPairs, loadPalettePool, loadLibrary, listPresets, presetToRecipeHead, recipeToMaterials, pickPalettes, hintPair, novelty, NOVELTY_KEYS, derivePalette,
} from './style-presets.mjs'
import { buildAll } from './build-presets.mjs'


const presets = loadPresets()
const pool = loadPalettePool()
const palette = (id) => pool.find((p) => p.id === id)
const library = loadLibrary()
const catalog = presets.filter((p) => p.source.startsWith('catalog:'))
const fromRecipe = presets.filter((p) => p.source.startsWith('recipe:'))

test('generated files are current (build-presets.mjs output = committed presets.json · recipe-derived.json · pairs.json)', async () => {
  const { files } = await buildAll()
  for (const [f, text] of files) assert.equal(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'), text, `${f} is stale — node factory/scripts/build-presets.mjs`)
})

test('one preset per allow / allow-with-rules style (none for ban) plus one per library recipe', () => {
  const { styles } = loadStyles()
  const want = styles.filter((s) => s.verdict !== 'ban').map((s) => `preset-${s.id}`).sort()
  assert.deepEqual(catalog.map((p) => p.id).sort(), want)
  assert.equal(catalog.length, 53)
  assert.deepEqual(fromRecipe.map((p) => p.source).sort(), library.map((r) => `recipe:${r.id}`).sort())
  for (const s of styles.filter((x) => x.verdict === 'ban')) assert.ok(!presets.some((p) => p.styleId === s.id), s.id)
})

test('every preset passes compat.json: all 9 axes valid, and every listed archetype', () => {
  for (const p of catalog) {
    assert.deepEqual(Object.keys(p.axes), AXIS_ORDER, p.id)
    assert.deepEqual(checkCompat(p.axes), [], p.id)
    for (const a of p.archetypes) assert.deepEqual(checkCompat(p.axes, a), [], `${p.id} × ${a}`)
  }
  for (const p of fromRecipe) assert.deepEqual(checkCompat(p.axes), [], p.id)
})

test('presets whose style has no radius choose one from the visual rules or default to R1, and record it in rules', () => {
  const { styles } = loadStyles()
  const noRadius = styles.filter((s) => s.verdict !== 'ban' && !s.axes.radius)
  assert.ok(noRadius.length >= 25, `${noRadius.length}`)
  for (const s of noRadius) {
    const p = presets.find((x) => x.styleId === s.id)
    assert.ok(p.rules.some((r) => r.startsWith('반경:')), p.id)
    if (p.rules.some((r) => /기본 R1/.test(r))) assert.equal(p.axes.radius, 'R1', p.id)
  }
})

test('every catalog preset combined with its representative palette gives a head that passes lintRecipe (the preset sample)', () => {
  const bad = []
  for (const p of catalog) {
    assert.ok(p.sample?.palette, `${p.id}: no representative palette`)
    const pal = palette(p.sample.palette)
    assert.equal(pal.use, 'recipe', p.id)
    const head = presetToRecipeHead(p, pal, hintPair(p))
    const v = lintRecipe(head)
    if (v.length) bad.push(`${p.id}: ${v[0]}`)
  }
  assert.deepEqual(bad, [])
})

test('every preset compiles through the style compiler (axis gallery path): base + its axis values over button · card · navigation-menu · display · texture keep every rule', async () => {
  const parts = ['button.tsx', 'card.tsx', 'navigation-menu.tsx', 'display.tsx', 'texture.tsx']
  const src = Object.fromEntries(parts.map((f) => [f, readFileSync(join(UI_SRC, f), 'utf8')]))
  const bad = []
  for (const p of presets) {
    const map = composeStyleMap(p.axes)
    for (const f of parts) {
      const out = await compileSource(src[f], map)
      const r = rulesIntact(src[f], out)
      if (r.missing.length || r.fighting.length) bad.push(`${p.id}/${f}: ${r.missing.join(' ')} ${r.fighting.join(' ')}`)
    }
  }
  assert.deepEqual(bad, [])
})

test('round trip: presetToRecipeHead(recipeToMaterials(r)) reproduces the axes, colors and fonts of every library recipe (and lints clean)', async () => {
  assert.ok(library.length >= 10)
  for (const r of library) {
    const m = await recipeToMaterials(r)
    assert.equal(m.preset.source, `recipe:${r.id}`)
    assert.equal(m.palette.source, `recipe:${r.id}`)
    assert.equal(m.palette.use, 'recipe', r.id)
    assert.equal(m.fontPair.source, `recipe:${r.id}`)
    const head = presetToRecipeHead(m)
    assert.deepEqual(head.axes, r.axes, `${r.id} axes`)
    assert.deepEqual(head.color, r.color, `${r.id} color`)
    assert.deepEqual(head.fonts, r.fonts, `${r.id} fonts`)
    assert.equal(head.colorLogic, r.colorLogic)
    assert.deepEqual(head.dynamics, r.dynamics)
    const rest = { ...r }
    delete rest.alternates
    assert.deepEqual(head, rest, `${r.id}: whole head minus alternates`)
    assert.deepEqual(lintRecipe(head), [], r.id)
    // 저장된 풀과 같은 재료다(생성물 = 분해 함수).
    assert.deepEqual(presets.find((p) => p.id === m.preset.id), m.preset)
    assert.deepEqual(pool.find((p) => p.id === m.palette.id), m.palette)
    assert.deepEqual(loadPairs().find((p) => p.id === m.fontPair.id), m.fontPair)
  }
})

test('board B alternates enter the pool as palettes and font pairs (verified materials), not as extra presets', () => {
  for (const r of library.filter((x) => x.alternates)) {
    const b = applyAlternate(r)
    if (r.alternates.color || r.alternates.colorLogic) assert.deepEqual(palette(`pal-recipe-${r.id}-b`).theme, { light: b.color.light, dark: b.color.dark }, r.id)
    if (r.alternates.fonts) assert.deepEqual(loadPairs().find((p) => p.id === `pair-recipe-${r.id}-b`).fonts, b.fonts, r.id)
  }
  assert.equal(fromRecipe.length, library.length, '레시피 프리셋은 라이브러리 레시피 수와 같다')
})

// 재조합: 재료 하나를 바꾼 머리는 lint 를 통과하거나, 이름 붙은 규칙으로 실패한다(조용히 깨진 머리가 나오지 않는다).
const NAMED = /^(compat|color-logic-keys|k[6-9]-[a-z]+|field-contrast|block-contrast|face-contrast|contrast|primary-surface|line-border|input-contrast|palette-[a-z]+|font-[a-z-]+|banlist|c6-fill|texture-contrast|axis-recipe|recipe-compat|dynamics-motion|dark-neon|hero-[a-z]+|alternates): /
test('recombination: r3 preset with r7 font pair passes lint; swapping palettes and pairs across all 10 recipes gives lint-clean heads or named rule failures', async () => {
  const mats = Object.fromEntries(await Promise.all(library.map(async (r) => [r.id, await recipeToMaterials(r)])))
  const r3r7 = presetToRecipeHead(mats['r3-woodblock'].preset, mats['r3-woodblock'].palette, mats['r7-docs'].fontPair)
  const v = lintRecipe(r3r7)
  assert.ok(v.length === 0 || v.every((m) => NAMED.test(m)), v.join('\n'))
  assert.deepEqual(r3r7.fonts, library.find((r) => r.id === 'r7-docs').fonts)
  let clean = 0, named = 0
  for (const a of library) for (const b of library) {
    const head = presetToRecipeHead(mats[a.id].preset, mats[b.id].palette, mats[a.id].fontPair)
    const vs = lintRecipe(head)
    if (!vs.length) clean++
    else { assert.ok(vs.every((m) => NAMED.test(m)), `${a.id} × palette ${b.id}: ${vs.find((m) => !NAMED.test(m))}`); named++ }
  }
  assert.ok(clean > 10 && named > 0, `clean ${clean} named ${named}`)
  // 이름 붙은 호환 실패의 대표: r3(K8 칸 색)의 프리셋에 r7(K6 면 색) 팔레트를 대면 K8 이 없는 면 키로 color-logic-keys 가 아니라 K6 로 다시 편다
  const r3p7 = presetToRecipeHead(mats['r3-woodblock'].preset, mats['r7-docs'].palette, mats['r3-woodblock'].fontPair)
  assert.equal(r3p7.colorLogic, 'K8')
  assert.ok(Object.keys(r3p7.color.light).includes('block-1'))
})

test('listPresets ranks by rank_score × archetype fit; archetype rules drop presets (negative controls); source filter', () => {
  const all = listPresets()
  assert.equal(all.length, presets.length)
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].score >= all[i].score)
  const dash = listPresets({ archetype: 'dashboard' })
  for (const p of dash) { assert.deepEqual(checkCompat(p.axes, 'dashboard'), [], p.id); assert.ok(p.fit === 1 || p.fit === 0.5) }
  for (const id of ['preset-oversized-typographic', 'preset-kinetic-typography', 'preset-webtoon-panel', 'preset-editorial-magazine', 'preset-grain-texture']) assert.ok(!dash.some((p) => p.id === id), id)
  assert.ok(dash.length < all.length)
  const brand = listPresets({ archetype: 'brand' })
  for (const p of brand) assert.equal(p.fit, p.archetypes.includes('brand') ? 1 : 0.5, p.id)
  assert.ok(brand.some((p) => p.fit === 1) && brand.every((p, i) => i === 0 || brand[i - 1].score >= p.score))
  assert.ok(listPresets({ source: 'recipe' }).every((p) => p.source.startsWith('recipe:')))
  assert.equal(listPresets({ source: 'catalog' }).length, catalog.length)
})

test('novelty (Q7 ③): min over the library recipes of the share of 11 attributes that differ; recipe presets are 0; a preset that differs everywhere is 1', () => {
  assert.equal(NOVELTY_KEYS.length, 11)
  for (const p of fromRecipe) assert.equal(p.novelty, 0, p.id)
  for (const p of catalog) { assert.equal(p.novelty, novelty(p, library), p.id); assert.ok(p.novelty >= 0 && p.novelty <= 1) }
  // 어느 라이브러리 레시피도 쓰지 않는 값만(라이브러리가 15벌이 되며 R3·B4·I4·H5·K9 도 쓰이기 시작했다) — 모든 속성이 모든 레시피와 다르다.
  const far = { axes: { radius: 'R9', button: 'B9', input: 'I9', surface: 'C9', table: 'T9', header: 'H9', shadow: 'S9', display: 'D9', texture: 'X9' }, recipeHints: { motion: 'M9', colorLogic: ['K99'] } }
  assert.equal(novelty(far, library), 1)
  const r1 = library.find((r) => r.id === 'r1-measure')
  assert.equal(novelty({ axes: { ...r1.axes, display: 'D2' }, recipeHints: { motion: r1.motion, colorLogic: [r1.colorLogic] } }, library), 0.091)
  assert.ok(catalog.some((p) => p.novelty >= 0.4), 'some catalog presets are far from the library')
})

test('palettes come only from the use "recipe" subset, ranked inside it; a decor-only palette is refused (negative control)', () => {
  for (const p of catalog.slice(0, 10)) for (const pal of pickPalettes(p, { pool })) assert.equal(pal.use, 'recipe')
  const top = [...pool].sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0))[0]
  assert.equal(top.use, 'decor-only', 'global rank top is a decor-only award palette (T15m concern 3)')
  assert.throws(() => presetToRecipeHead(catalog[0], top), /use "decor-only"/)
  assert.throws(() => presetToRecipeHead(catalog[0]), /palette 가 없다/)
})

test('derivePalette fills every recipe colour key for both themes from a 4-role palette, keeping hue (lightness-only adjustments)', () => {
  const pal = palette(catalog[0].sample.palette)
  const d = derivePalette(pal, { colorLogic: 'K1', axes: catalog[0].axes })
  assert.ok(d.derived)
  for (const t of ['light', 'dark']) for (const k of ['background', 'foreground', 'primary', 'primary-foreground', 'muted-foreground', 'input', 'ring', 'success', 'warning-foreground']) assert.match(d[t][k], /^oklch\(/, `${t} ${k}`)
  for (const logic of ['K6', 'K7', 'K8', 'K9']) {
    const x = derivePalette(pal, { colorLogic: logic, axes: catalog[0].axes })
    const keys = Object.keys(x.light).filter((k) => /^(field|block)-/.test(k))
    assert.deepEqual(keys.length > 0, ['K6', 'K7', 'K8'].includes(logic), logic)
  }
  // 재료 풀의 recipe 팔레트 20개를 K1 으로 펴면 모두 lint 를 통과한다(대비·크림·Tailwind 복사 규칙).
  const p = catalog.find((x) => x.id === 'preset-corporate-trust')
  const bad = pickPalettes(p, { pool, n: 20 }).map((pal2) => [pal2.id, lintRecipe(presetToRecipeHead(p, pal2))]).filter(([, v]) => v.length)
  assert.deepEqual(bad.map(([id, v]) => `${id}: ${v[0]}`), [])
})

test('new axes reach presets: C6 · C8 · H5 · R3 · K9 · D2 · D3 · X1~X3 each appear in at least one preset (base set or variant)', () => {
  const { styles } = loadStyles()
  const used = new Set(catalog.flatMap((p) => [...Object.values(p.axes), ...p.recipeHints.colorLogic]))
  for (const s of styles) for (const v of s.axesVariants) for (const x of Object.values(v)) used.add(x)
  for (const v of ['C6', 'C8', 'H5', 'R3', 'K9', 'D2', 'D3', 'X1', 'X2', 'X3']) assert.ok(used.has(v), v)
  assert.deepEqual(Object.keys(AXIS_DEFAULTS), ['display', 'texture'])
  assert.ok(COMPAT.axes.display && COMPAT.axes.texture)
})
