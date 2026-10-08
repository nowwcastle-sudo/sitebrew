// P3-2 Task 8: 레시피 B안 설치 항목 <id>-alt(대장 A10) · 레시피 모양 토큰(A11) · 히어로 × 새 축 D·X(A20).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseRecipe, recipeIds, RECIPES_DIR, recipeItems, recipeRegistry, recipeCss, recipeReadme, applyAlternate, validCombos, altAxesOf, kitItems, knownRegistryItems,
  shapeVars, surfaceShadow, SHAPE_VARS, heroTitleWidth, heroAxisParts, displayHeroReport, lintRecipeReport, HERO_IDS,
} from './recipe.mjs'
import { radiusToken, maskRadiusToken, BLOB } from './gen-radius-axis.mjs'
import { altCss, scopedCss } from './gen-recipes-gallery.mjs'
import { heroAxisProblems, blockProblems, loadBlocks, BlockMeta, MOTION_HEROES, FV1_HEROES } from './blocks.mjs'
import { axisPartsModule } from './gen-blocks-gallery.mjs'

const REPO = 'nowwcastle-sudo/sitebrew'
const load = (id) => parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
const itemsOf = (r) => recipeItems(r, [{ name: 'button', source: 'export const X = 1\n' }], { repo: REPO, knownItems: knownRegistryItems() }).items

// ── A10 ────────────────────────────────────────────────────────────────
test('A10: r1 has r1-measure-alt (registry:base) with B fonts, B colors, B hero meta, A parts; r5 has no -alt', () => {
  const r1 = load('r1-measure')
  const items = itemsOf(r1)
  const alt = items.find((i) => i.name === 'r1-measure-alt')
  assert.ok(alt, 'r1-measure-alt 가 없다')
  assert.equal(alt.type, 'registry:base')
  const b = applyAlternate(r1)
  // B 서체 항목(펴진고딕 등 B display·displayKo 키트)이 의존에 있다.
  for (const k of ['display', 'displayKo']) {
    const item = r1.alternates.fonts?.[k]?.item
    if (item) assert.ok(alt.registryDependencies.includes(`${REPO}/${item}`), `${k} ${item}`)
  }
  assert.ok(alt.registryDependencies.some((d) => /pyeojin/.test(d)), '펴진고딕 서체 항목')
  assert.deepEqual(alt.registryDependencies.filter((d) => d.includes('font-')).sort(), kitItems(b).filter((n) => n.startsWith('font-') && knownRegistryItems().has(n)).map((n) => `${REPO}/${n}`).sort())
  // 색은 applyAlternate 한 머리의 색이다(두 테마).
  assert.equal(alt.cssVars.light.primary, b.color.light.primary)
  assert.equal(alt.cssVars.dark.primary, b.color.dark.primary)
  assert.notEqual(alt.cssVars.light.primary, items.find((i) => i.name === 'r1-measure').cssVars.light.primary)
  // 부품은 다시 컴파일하지 않는다 — A 부품 항목에 의존한다.
  assert.ok(alt.registryDependencies.includes(`${REPO}/r1-measure-button`))
  assert.equal(alt.meta.recipe.alternateOf, 'r1-measure')
  assert.equal(alt.meta.recipe.hero, r1.alternates.hero)
  assert.ok(!('alternates' in alt.meta.recipe))
  // A 는 그대로 첫 항목, B 는 theme 뒤.
  assert.deepEqual(items.slice(0, 3).map((i) => i.name), ['r1-measure', 'r1-measure-theme', 'r1-measure-alt'])
  const r5 = load('r5-celadon')
  assert.ok(!itemsOf(r5).some((i) => i.name.endsWith('-alt')))
})

test('A10: every recipe with alternates gets exactly one -alt, all names are unique across layers (recipeRegistry collision check)', () => {
  const items = recipeRegistry({ repo: REPO })
  const alts = items.filter((i) => i.name.endsWith('-alt'))
  const withAlt = recipeIds().filter((id) => load(id).alternates)
  assert.equal(alts.length, withAlt.length)
  // B안이 없는 레시피는 r5-celadon 하나뿐이다(선택 보드 2판에서 B를 버렸다) — 벌 수는 레시피 목록에서 읽는다(r12~r16 확정 뒤 15벌 중 14벌).
  assert.deepEqual(recipeIds().filter((id) => !load(id).alternates), ['r5-celadon'])
  assert.equal(withAlt.length, recipeIds().length - 1)
  for (const a of alts) {
    const id = a.meta.recipe.alternateOf
    const r = load(id)
    assert.ok(validCombos(r).some((p) => p.length === altAxesOf(r.alternates).length), `${id} B 전체 조합이 lint 통과`)
    assert.deepEqual(lintRecipeReport(applyAlternate(r)).violations, [], id)
  }
  const known = knownRegistryItems()
  for (const a of alts) assert.ok(!known.has(a.name), a.name)
})

test('A10: README install block names -alt only for recipes with B; altCss carries B --wf-motion with the motion tokens', () => {
  assert.match(recipeReadme(load('r1-measure'), { ref: 'v0.0.6' }), /add nowwcastle-sudo\/sitebrew\/r1-measure-alt#v0\.0\.6/)
  assert.doesNotMatch(recipeReadme(load('r5-celadon'), { ref: 'v0.0.6' }), /-alt#/)
  const r = load('r2-signal')
  const withMotion = { ...r, motion: 'M1', alternates: { ...r.alternates, motion: 'M3' } }
  const css = altCss(withMotion)
  const block = css.slice(css.indexOf('[data-recipe="r2-signal"][data-alt-motion] {'))
  assert.match(block.slice(0, block.indexOf('}')), /--wf-motion: 3;/)
  assert.doesNotMatch(altCss(r), /data-alt-motion/, '모션 B안이 없으면 규칙도 없다')
})

// ── A11 ────────────────────────────────────────────────────────────────
test('A11: radius token follows the radius axis (least squares over sm·md·lg·xl), R3 = R1 for controls, R2 = shadcn default 0.625rem', () => {
  assert.equal(radiusToken('R0'), '0px')
  assert.equal(radiusToken('R1'), '13px')
  assert.equal(radiusToken('R2'), '10px')
  assert.equal(radiusToken('R3'), radiusToken('R1'))
  assert.equal(maskRadiusToken('R3'), BLOB.slice(1, -1).replaceAll('_', ' '))
  for (const v of ['R0', 'R1', 'R2']) assert.equal(maskRadiusToken(v), 'calc(infinity * 1px)')
  assert.throws(() => radiusToken('R9'))
})

test('A11: surface shadow token is the shadow axis card shadow as one value (S0 none · S2 ink offset · S1/S3 without the --sh helper)', () => {
  assert.equal(surfaceShadow('S0'), 'none')
  assert.equal(surfaceShadow('S2'), '4px 4px 0 0 var(--foreground)')
  for (const v of ['S1', 'S3']) {
    const s = surfaceShadow(v)
    assert.ok(!s.includes('var(--sh)') && !s.includes('_'), `${v}: ${s}`)
    assert.match(s, /color-mix\(in oklch,color-mix\(in oklch,var\(--background\),black 72%\)/)
  }
  assert.ok(surfaceShadow('S3').startsWith('inset '))
})

test('A11: every library recipe ships the shape tokens in the base item (A and B), its pure CSS :root and the gallery scope — and nothing else changes in cssVars.light order', () => {
  for (const id of recipeIds()) {
    const r = load(id)
    const want = shapeVars(r)
    assert.deepEqual(Object.keys(want), SHAPE_VARS)
    for (const it of itemsOf(r).filter((i) => i.type === 'registry:base')) {
      const keys = Object.keys(it.cssVars.light)
      assert.deepEqual(keys.slice(-3), SHAPE_VARS, `${it.name}: 모양 토큰은 맨 뒤`)
      for (const k of SHAPE_VARS) assert.equal(it.cssVars.light[k], want[k], `${it.name} ${k}`)
    }
    const root = recipeCss(r).match(/:root \{\n([\s\S]*?)\n\}/)[1]
    for (const k of SHAPE_VARS) assert.ok(root.includes(`  --${k}: ${want[k]};`), `${id} :root --${k}`)
    const scoped = scopedCss(r, new Map())
    for (const k of SHAPE_VARS) assert.ok(scoped.includes(`  --${k}: ${want[k]};`), `${id} gallery --${k}`)
  }
  // R3·S 조합: 컨트롤 반경은 R1 과 같고 이미지 마스크만 블롭.
  const g = load('r9-clay')
  const r3 = shapeVars({ ...g, axes: { ...g.axes, radius: 'R3' } })
  assert.equal(r3.radius, shapeVars(g).radius)
  assert.notEqual(r3['wf-mask-radius'], shapeVars(g)['wf-mask-radius'])
})

// ── A20 ────────────────────────────────────────────────────────────────
test('A20: every hero block declares titleWidth; the full-width set is the twelve whose title spans the hero width (the original seven + the five heroes r12~r16 took from the block catalog)', () => {
  const full = HERO_IDS.filter((id) => heroTitleWidth(id) === 'full').sort()
  assert.deepEqual(full, ['banded-full-bleed', 'centered-proof-panel', 'crop-marks-typed-title', 'grid-lines-baseline-word', 'identity-strip-banner', 'illustration-scene', 'inline-chip-title', 'ken-burns-stills', 'map-first', 'punch-in-statement', 'staggered-oval-frame', 'video-montage'])
  for (const id of HERO_IDS) assert.ok(['full', 'column'].includes(heroTitleWidth(id)), id)
  // 메타 스키마: hero 는 titleWidth 필수, 다른 kind 는 금지.
  const base = { variant: 'x', title: 't', layout: 'x', density: 'compact', archetypes: ['brand'], archetypeKinds: ['hero'], states: [], media: [], motion: [] }
  assert.equal(BlockMeta.safeParse({ ...base, kind: 'hero' }).success, false)
  assert.equal(BlockMeta.safeParse({ ...base, kind: 'hero', titleWidth: 'full' }).success, true)
  assert.equal(BlockMeta.safeParse({ ...base, kind: 'faq', titleWidth: 'full' }).success, false)
  // 히어로 옆 띠(레인 D2 합류 뒤): hero 가 아닌 kind 는 column 만 — 질감 배선을 받는다.
  assert.equal(BlockMeta.safeParse({ ...base, kind: 'announcement', titleWidth: 'column' }).success, true)
  const bands = loadBlocks().filter((b) => b.kind !== 'hero' && b.meta.success && b.meta.data.titleWidth)
  assert.deepEqual(bands.map((b) => `${b.kind}/${b.variant}`), ['announcement/launch-banner'])
  assert.deepEqual(blockProblems(bands, { minVariants: 1, reserved: new Map() }), [])
})

test('A20: recipe lint display-hero-width — D2 fails on a column hero (A and B heads), passes on a full hero; D3 on a column hero only warns', () => {
  const r = load('r1-measure') // hero step-band-orbit(column), B hero baseline-split(column)
  assert.equal(heroTitleWidth(r.hero), 'column')
  const d2 = { ...r, axes: { ...r.axes, display: 'D2' } }
  assert.ok(displayHeroReport(d2).violations.some((m) => m.startsWith('display-hero-width:')))
  assert.ok(lintRecipeReport(d2).violations.some((m) => m.startsWith('display-hero-width:')), 'lint 가 막는다')
  // B 머리(alternates.hero)도 본다 — A 히어로만 전폭으로 바꿔도 B 가 좁으면 막힌다.
  const aFull = { ...d2, hero: 'grid-lines-baseline-word' }
  assert.deepEqual(displayHeroReport(aFull).violations, [])
  assert.ok(lintRecipeReport(aFull).violations.some((m) => m.startsWith('alternates: B안 적용 시 — display-hero-width:') && m.includes(r.alternates.hero)), 'B 히어로 좁음')
  const d3 = { ...r, axes: { ...r.axes, display: 'D3' } }
  assert.deepEqual(displayHeroReport(d3).violations, [])
  assert.equal(displayHeroReport(d3).warnings.length, 1)
  assert.deepEqual(displayHeroReport(r), { violations: [], warnings: [] }, '기본 D1 은 대상 아님')
  // 조립 규칙(heroAxisParts): 전폭 히어로 + D2·D3 일 때만 display, X1~X3 이면 texture.
  assert.deepEqual(heroAxisParts(r), { display: false, texture: false })
  assert.deepEqual(heroAxisParts({ ...aFull, axes: { ...aFull.axes, texture: 'X1' } }), { display: true, texture: true })
  assert.deepEqual(heroAxisParts({ ...d3, axes: { ...d3.axes, texture: 'X0' } }), { display: false, texture: false })
})

test('A20: block check — heroes lay HeroTexture, full heroes render <Display as="h1">, column heroes never touch display (negative controls)', () => {
  const src = (body) => `export function HeroX({ header, texture }) { return (<div data-block="hero-x">${body}{header}</div>) }`
  assert.deepEqual(heroAxisProblems('hero/x', src('<HeroTexture texture={texture} />'), 'column'), [])
  assert.equal(heroAxisProblems('hero/x', src(''), 'column').length, 1, 'HeroTexture 없음')
  assert.equal(heroAxisProblems('hero/x', src('<HeroTexture texture={texture} />'), 'full').length, 1, '전폭인데 Display 없음')
  const narrowD = src('<HeroTexture texture={texture} />{Display ? <Display as="h1">t</Display> : <h1>t</h1>}')
  assert.equal(heroAxisProblems('hero/x', narrowD, 'column').length, 1, '좁은 히어로가 Display 를 쓴다')
  assert.deepEqual(heroAxisProblems('hero/x', narrowD, 'full'), [])
  assert.equal(heroAxisProblems('hero/x', src('<HeroTexture texture={texture} />').replace('texture }', 'texture, display }'), 'column').length, 1, '좁은 히어로가 display 를 받는다')
  // 저장소 히어로(레시피 19 + 모션 그래픽 MOTION_HEROES + FV1_HEROES)는 0건.
  const heroes = loadBlocks().filter((b) => b.kind === 'hero')
  assert.equal(heroes.length, 19 + MOTION_HEROES.length + FV1_HEROES.length)
  assert.deepEqual(blockProblems(heroes, { reserved: new Map() }), [])
})

test('A20: gallery axis-parts module maps D2·D3 to DisplayTitle and X1~X3 to Texture from the per-value axis compiles', () => {
  const m = axisPartsModule()
  assert.match(m, /D2: \(\) => import\("@\/\.tmp\/axes\/d2-oversized\/ui\/display"\)\.then\(\(m\) => m\.DisplayTitle as AxisPart\)/)
  assert.match(m, /X3: \(\) => import\("@\/\.tmp\/axes\/x3-collage\/ui\/texture"\)\.then\(\(m\) => m\.Texture as AxisPart\)/)
  assert.doesNotMatch(m, /D1:|X0:/)
})
