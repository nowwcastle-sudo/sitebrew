import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap } from 'shadcn/utils'
import {
  recipeLocalImports, STATUS, LINE_VALUES,
  parseRecipe, lintRecipe, lintRecipeReport, buildRecipe, recipeItems, recipeRegistry, pkgVersions, recipeCssFiles, composeStyleMap, fontStacks, isKorean, recipeCss, kitItems, UI_SRC, singleWeight, titleSlotStack,
  kitWeights, recipeIds, RECIPES_DIR, recipeReadme, singleWeightRules, DYNAMICS_IDS, COLOR_LOGICS, FIELD_KEYS, BLOCK_KEYS,
  applyAlternate, alternateCombos, validCombos, isRainbowOrder, BOLD_LOGICS, ALT_AXES, SCENE_IDS, SCENES, HERO_IDS, HEROES, recipeIconsIndex,
} from './recipe.mjs'
import { ruleClasses, classTokens } from './hooks-audit.mjs'
import { lintDir } from '../qa/lint-ui.mjs'
import { listValues } from './axes.mjs'
import { hexToOklch } from './lib/palette-lib.mjs'
import { ratio } from './lib/contrast-lib.mjs'
import { MOTION_TOKENS } from './gen-kits.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FX = join(here, 'fixtures', 'recipes')
const REPO = 'nowwcastle-sudo/sitebrew'
const load = (name) => parseRecipe(readFileSync(join(FX, name, 'DESIGN.md'), 'utf8'))
const extraCss = (name) => (existsSync(join(FX, name, 'extra.css')) ? [join(FX, name, 'extra.css')] : [])
const lint = (name, opts = {}) => lintRecipeReport(load(name), { extraCss: extraCss(name), ...opts })
const rules = (msgs) => msgs.map((m) => m.split(':')[0])
const COMPONENTS = readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, '')).sort()
// 시험 레시피(good·good-large)는 선택 축 display·texture 를 적지 않는다 — 그 두 부품은 레시피에 컴파일되지 않는다(Task 16a, recipePartFiles).
const FX_COMPONENTS = COMPONENTS.filter((c) => !['display', 'texture'].includes(c))
// 부품 목록이 비거나 엉뚱한 폴더면 아래 전수 검사가 공허하게 통과한다(M10).
const atLeast61 = () => assert.ok(COMPONENTS.length >= 61, `부품 ${COMPONENTS.length}개 — 61개 이상이어야 한다`)

// 두 벌만 한 번씩 컴파일해 여러 테스트가 나눠 쓴다(61개 × 2).
const out = mkdtempSync(join(tmpdir(), 'wf-recipe-'))
let builds
const built = async () => (builds ??= {
  good: await buildRecipe(load('good'), { repo: REPO, ref: 'v9.9.9', outRoot: out, knownItems: new Set(['font-pretendard']) }),
  large: await buildRecipe(load('good-large'), { repo: REPO, ref: 'v9.9.9', outRoot: out, knownItems: new Set() }),
})
const uiDir = (id) => join(out, 'registry', 'factory', 'r', id, 'ui')
process.on('exit', () => rmSync(out, { recursive: true, force: true }))

test('parseRecipe splits the YAML head from the markdown body', () => {
  const r = load('good')
  assert.equal(r.id, 'fx-good')
  assert.deepEqual(r.axes, { button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S2' })
  assert.equal(r.fonts.mono, null)
  assert.equal(r.color.dark.background, 'oklch(0.17 0.008 230)')
  assert.match(r.body, /^## 분위기/m)
  assert.ok(!r.body.includes('---'))
  assert.throws(() => parseRecipe('# no head'), /YAML 머리/)
})

test('good fixture lints clean (0 violations, 0 warnings when every kit item exists)', () => {
  const r = load('good')
  assert.deepEqual(lintRecipe(r), [])
  const all = new Set(['font-sora', 'font-pretendard'])
  assert.deepEqual(lintRecipeReport(r, { fontItems: all }).warnings, [])
})

test('the large-radius fixture lints clean too (only compat cautions as warnings)', () => {
  const rep = lint('good-large')
  assert.deepEqual(rep.violations, [])
  assert.ok(rep.warnings.every((w) => w.startsWith('compat-caution')), rep.warnings.join('\n'))
})

const BAD = {
  'bad-refs': 'references',
  'bad-contrast': 'contrast',
  'bad-compat': 'compat',
  'bad-font': 'font-korean',
  'bad-banlist': 'banlist',
  'bad-input': 'input-contrast',
  'bad-oklch': 'oklch',
  'bad-textarea': 'textarea-floor',
  'bad-footer': 'footer-hit',
  'bad-sections': 'body-sections',
  'bad-hitfloor': 'hit-floor',
  'bad-body-latin': 'font-korean',
  'bad-card': 'contrast',
  'bad-alpha': 'alpha',
  'bad-border': 'line-border',
  'bad-tailwind': 'palette-tailwind',
  'bad-tailwind-dark': 'palette-tailwind',
  'bad-cream': 'palette-cream',
}
for (const [name, rule] of Object.entries(BAD)) {
  test(`${name} is caught by rule ${rule}`, () => {
    const v = lint(name).violations
    assert.ok(rules(v).includes(rule), `${name}: ${v.join('\n')}`)
  })
}

test('palette rules (DESIGN §5-A): only the copied hex or the cream background is flagged, in Korean, citing §5-A', () => {
  const tw = lint('bad-tailwind').violations
  assert.deepEqual(tw.length, 1, tw.join('\n'))
  assert.match(tw[0], /^palette-tailwind: light primary .*violet-600\(#7C3AED\).*DESIGN §5-A/)
  // 다크 테마도 본다: 다크 ring 하나만 Tailwind hex 인 픽스처가 그 한 건으로 걸린다(라이트만 보도록 줄면 여기서 깨진다).
  const dark = lint('bad-tailwind-dark').violations
  assert.deepEqual(dark.length, 1, dark.join('\n'))
  assert.match(dark[0], /^palette-tailwind: dark ring .*sky-400\(#38BDF8\)/)
  const cream = lint('bad-cream').violations
  assert.deepEqual(cream.length, 1, cream.join('\n'))
  assert.match(cream[0], /^palette-cream: light background .*크림·베이지.*DESIGN §5-A/)
  // 거리 약 0.01(C 0.25)은 문턱 0.005 밖 — 통과한다.
  assert.deepEqual(lint('good-near-tailwind').violations, [])
})

test('palette-tailwind also checks accent-foreground — a recipe that carries its signal in highlighted text (Task 5 review M6)', () => {
  const r = load('good')
  const [L, C, H] = hexToOklch('DC2626') // red-600
  r.color.light['accent-foreground'] = `oklch(${L} ${C} ${H})`
  const v = lintRecipeReport(r).violations.filter((m) => m.startsWith('palette-tailwind'))
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /light accent-foreground .*red-600/)
})

test('r1-measure lints clean under the palette rules (its pale OKLCH ramp sits near Tailwind greys and tints by chance)', () => {
  const r = parseRecipe(readFileSync(join(here, '..', '..', 'registry', 'factory', 'recipes', 'r1-measure', 'DESIGN.md'), 'utf8'))
  assert.deepEqual(lintRecipe(r).filter((m) => m.startsWith('palette-')), [])
})

test('bad-font also reports the missing body key; bad-contrast names the dark muted pair', () => {
  assert.ok(lint('bad-font').violations.some((m) => m.startsWith('schema') && m.includes('fonts.body')))
  const c = lint('bad-contrast').violations.filter((m) => m.startsWith('contrast'))
  assert.ok(c.some((m) => /dark muted-foreground\/background 5\.0\d < 7/.test(m)), c.join('\n'))
  // 같은 색이 muted 면 위에서도 4.5 아래(T6-M3 쌍).
  assert.ok(c.some((m) => /dark muted-foreground\/muted 4\.\d+ < 4\.5/.test(m)), c.join('\n'))
  assert.ok(c.every((m) => m.includes('dark')), c.join('\n'))
})

test('surface text pairs are 4.5:1 in both themes (T6-M3): bad-card names card-foreground/card', () => {
  const c = lint('bad-card').violations.filter((m) => m.startsWith('contrast'))
  assert.deepEqual(c.map((m) => m.split(' ').slice(1, 3).join(' ')), ['light card-foreground/card'])
})

test('the body face itself must render Korean (T6-M8): a tuned Inter body passes banlist but fails font-korean', () => {
  const v = lint('bad-body-latin').violations
  assert.ok(!rules(v).includes('banlist'), v.join('\n'))
  assert.ok(v.some((m) => m.startsWith('font-korean') && m.includes('Inter')), v.join('\n'))
  // 디스플레이는 라틴이어도 된다 — good 의 Sora.
  assert.ok(!rules(lintRecipe(load('good'))).includes('font-korean'))
})

test('translucent colours are rejected instead of being measured as opaque (T6-M6)', () => {
  const v = lint('bad-alpha').violations
  assert.ok(v.some((m) => m.startsWith('alpha') && m.includes('color.light.primary')), v.join('\n'))
  assert.ok(!v.some((m) => m.startsWith('contrast') && m.includes('primary')), v.join('\n'))
})

test('a style map that cannot be composed is a violation, not a silent skip (M1)', () => {
  const r = load('good')
  r.axes = { ...r.axes, button: 'B9' }
  assert.ok(lintRecipe(r).some((m) => m.startsWith('style-compose-failed') && m.includes('B9')))
  const v = lintRecipe(load('good'), { extraCss: [join(out, 'nope.css')] })
  assert.ok(v.some((m) => m.startsWith('style-compose-failed')), v.join('\n'))
})

test('unmeasured: a footer padding given by a CSS variable is a warning (eyeball it), not a violation', () => {
  const css = join(out, 'unmeasured.css')
  writeFileSync(css, '.cn-sheet-footer { @apply gap-2 p-(--sheet-pad); }\n')
  const rep = lintRecipeReport(load('good'), { extraCss: [css] })
  assert.deepEqual(rep.violations, [])
  assert.ok(rep.warnings.some((w) => w.startsWith('unmeasured') && w.includes('cn-sheet-footer')), rep.warnings.join('\n'))
})

test('bad-input flags --input and the outline-button border token, in light only', () => {
  const v = lint('bad-input').violations.filter((m) => m.startsWith('input-contrast'))
  assert.ok(v.length >= 1 && v.every((m) => m.includes('light')), v.join('\n'))
})

test('banlist: an untunedOnly font passes once tuned is written; system-ui never passes', () => {
  const r = load('bad-banlist')
  r.fonts.body.tuned = '굵기 510, 광학 크기 Display'
  assert.ok(!rules(lintRecipe(r)).includes('banlist'))
  r.fonts.body = { family: 'system-ui', item: 'font-system', tuned: '조정함' }
  assert.ok(rules(lintRecipe(r)).includes('banlist'))
})

test('bad-minh warns (not fails) that the inline 44px floor discards the recipe min-h', () => {
  const rep = lint('bad-minh')
  assert.deepEqual(rep.violations, [])
  assert.ok(rep.warnings.some((w) => w.startsWith('hit-floor-minh') && w.includes('cn-input')), rep.warnings.join('\n'))
})

test('small text in a composed hook is a violation', () => {
  const css = join(out, 'small-text.css')
  writeFileSync(css, '.cn-badge { @apply px-2 text-xs; }\n.cn-kbd { @apply text-[12px]; }\n.cn-label { @apply text-[13px]/5; }\n')
  const v = lintRecipe(load('good'), { extraCss: [css] })
  assert.ok(v.some((m) => m.startsWith('small-text') && m.includes('cn-badge')), v.join('\n'))
  assert.ok(v.some((m) => m.startsWith('small-text') && m.includes('cn-kbd')), v.join('\n'))
  // 행간 접미사가 붙은 크기(M4) — lint-ui 와 같은 판정.
  assert.ok(v.some((m) => m.startsWith('small-text') && m.includes('cn-label text-[13px]/5')), v.join('\n'))
})

test('a body face outside the font kit (korean-fonts.json external) is a warning, not a violation (T6r1-c3)', () => {
  const r = load('good')
  const suit = { ...r, fonts: { ...r.fonts, body: { family: 'SUIT', item: 'font-suit' } } }
  const rep = lintRecipeReport(suit)
  assert.ok(!rules(rep.violations).includes('font-korean'), rep.violations.join('\n'))
  assert.ok(rep.warnings.some((w) => w.startsWith('font-external') && w.includes('SUIT')), rep.warnings.join('\n'))
  assert.ok(!lintRecipeReport(r).warnings.some((w) => w.startsWith('font-external')))
})

test('missing kit items are warnings, not violations', () => {
  const rep = lintRecipeReport(load('good'), { fontItems: new Set(['font-pretendard']) })
  assert.deepEqual(rep.violations, [])
  assert.ok(rep.warnings.some((w) => w.startsWith('missing-item') && w.includes('font-sora')), rep.warnings.join('\n'))
})

test('composeStyleMap applies base → radius → button → … → shadow; later axes win', () => {
  const val = (axis, id) => createStyleMap(readFileSync(listValues().find((v) => v.axis === axis && v.id === id).file, 'utf8'))
  const files = recipeCssFiles(load('good').axes).map((f) => f.split(sep).slice(-2).join('/'))
  assert.deepEqual(files, ['styles/base.css', 'radius/r0-zero.css', 'button/b1-square.css', 'input/i3-brutal-frame.css', 'surface/c2-line-grid.css', 'table/t4-ruled-grid.css', 'header/h3-ruled-bar.css', 'shadow/s2-hard-offset.css', 'display/d1-standard.css', 'texture/x0-none.css'])
  const map = composeStyleMap(load('good').axes)
  // base 의 cn-button 이 아니라 B1 의 값 — base 가 맨 앞이어야 축 값이 이긴다.
  assert.notEqual(val('button', 'B1')['cn-button'], createStyleMap(readFileSync(join(UI_SRC, '..', 'styles', 'base.css'), 'utf8'))['cn-button'])
  assert.equal(map['cn-button'], val('button', 'B1')['cn-button'])
  assert.equal(map['cn-card'], val('surface', 'C2')['cn-card'])
  // 그림자 축은 마지막 — 같은 키가 있으면 그림자가 이긴다.
  for (const [k, v] of Object.entries(val('shadow', 'S2'))) assert.equal(map[k], v, k)
})

test('every fallback list that names Pretendard names both "Pretendard Variable" and "Pretendard" (T8-c4)', () => {
  // 동적 서브셋 CSS 는 "Pretendard Variable" 만, 로컬 설치본은 "Pretendard" 로 잡힌다 — 어느 쪽이 있어도 맞게.
  const lists = (s) => [...[...s.matchAll(/var\(--font-[a-z0-9-]+, ([^)]+)\)/g)].map((m) => m[1]), s.replace(/var\([^)]*\)/g, '')]
  const cases = [
    ['good(body Pretendard)', load('good').fonts],
    ['display Pretendard Variable', { display: { family: 'Pretendard Variable', item: 'font-pretendard' }, body: { family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' } }],
  ]
  let named = 0
  for (const [label, fonts] of cases) for (const plain of [false, true]) for (const [k, stack] of Object.entries(fontStacks(fonts, { plain }))) {
    for (const l of lists(stack)) {
      if (!/Pretendard/.test(l)) continue
      named++
      assert.ok(l.includes('"Pretendard Variable"') && l.includes('"Pretendard"'), `${label} ${plain ? 'plain' : 'var'} ${k}: ${l}`)
    }
    assert.ok(!/Pretendard GOV/.test(stack), `${label}: 다른 가족(Pretendard GOV)을 끌어오지 않는다`)
  }
  assert.ok(named >= 9, `검사한 목록이 너무 적다(${named})`) // 두 경우 × var·순수 CSS 에서 Pretendard 를 적은 목록 수(지금 9) — 목록 추출이 비어 조용히 통과하지 않게
  // 한 이름만 싣는 서체는 그대로.
  assert.match(fontStacks(cases[1][1])['font-sans'], /^var\(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo"/)
})

test('font stacks: heading falls back from the Latin display face to the Korean body face, every stack has Korean', () => {
  const s = fontStacks(load('good').fonts)
  assert.match(s['font-heading'], /^var\(--font-sora-wf, "Sora", "Pretendard Variable", "Pretendard", [^)]*\), var\(--font-pretendard-wf, "Pretendard Variable", "Pretendard", [^)]*\), /)
  assert.match(s['font-sans'], /^var\(--font-pretendard-wf, "Pretendard Variable", "Pretendard", /)
  assert.match(s['font-mono'], /var\(--font-pretendard-wf, "Pretendard Variable", "Pretendard", [^)]*monospace\)/)
  for (const v of Object.values(s)) assert.match(v, /Malgun Gothic/)
})

test('every font var() carries a fallback stack with a Korean family, so an uninstalled font item never voids the declaration (T6-c1)', () => {
  const s = fontStacks(load('good').fonts)
  let vars = 0
  for (const [name, stack] of Object.entries(s)) for (const [, fb] of stack.matchAll(/var\(--font-[a-z0-9-]+, ([^)]+)\)/g)) {
    vars++
    assert.ok(fb.split(',').map((x) => x.trim().replace(/"/g, '')).some(isKorean), `${name}: ${fb}`)
  }
  assert.equal(vars, 5) // heading 2 + heading-ko 1(Task 14c) + sans 1 + mono 1
  assert.ok(!/var\(--font-[a-z0-9-]+\)/.test(Object.values(s).join(' ')), 'var() without a fallback')
})

test('buildRecipe: items = components + base + theme, with names, targets, pins and cssVars', async () => {
  const { good } = await built()
  assert.equal(good.items.length, FX_COMPONENTS.length + 2)
  const base = good.items.find((i) => i.name === 'fx-good')
  assert.equal(base.type, 'registry:base')
  assert.equal(base.extends, 'none')
  assert.equal(base.config.iconLibrary, 'lucide')
  assert.equal(base.cssVars.light.background, 'oklch(0.985 0.003 230)')
  assert.equal(base.cssVars.dark.ring, 'oklch(0.7 0.08 230)')
  assert.match(base.cssVars.theme['font-heading'], /var\(--font-sora-wf, "Sora", "Pretendard Variable", "Pretendard"/)
  for (const c of FX_COMPONENTS) assert.ok(base.registryDependencies.includes(`${REPO}/fx-good-${c}#v9.9.9`), c)
  assert.ok(base.registryDependencies.includes(`${REPO}/factory-base#v9.9.9`))
  // 있는 키트 항목만 의존에 넣고, 없는 것은 missing 으로 돌려준다(Task 8·9 전).
  assert.ok(base.registryDependencies.includes(`${REPO}/font-pretendard#v9.9.9`))
  assert.ok(!base.registryDependencies.some((d) => d.includes('font-sora')))
  assert.deepEqual(good.missing, kitItems(load('good')).filter((n) => n !== 'font-pretendard'))
  assert.ok(base.registryDependencies.every((d) => d.endsWith('#v9.9.9')))

  const theme = good.items.find((i) => i.name === 'fx-good-theme')
  assert.equal(theme.type, 'registry:theme')
  assert.deepEqual(Object.keys(theme.cssVars).sort(), ['dark', 'light', 'theme'])
  // 상태색은 두 항목 모두 @theme inline 에 잇는다(T7-M13): bg-success 등이 소비자에서 산다.
  for (const it of [base, theme]) for (const k of STATUS) {
    assert.equal(it.cssVars.theme[`color-${k}`], `var(--${k})`, `${it.name} ${k}`)
    assert.equal(it.cssVars.theme[`color-${k}-foreground`], `var(--${k}-foreground)`, `${it.name} ${k}-fg`)
    assert.ok(it.cssVars.light[k] && it.cssVars.dark[k], `${it.name} ${k} light/dark`)
  }

  const button = good.items.find((i) => i.name === 'fx-good-button')
  assert.equal(button.type, 'registry:ui')
  assert.deepEqual(button.files, [{ path: 'fx-good/ui/button.tsx', type: 'registry:ui', target: '@ui/button.tsx' }])
  const dialog = good.items.find((i) => i.name === 'fx-good-dialog')
  assert.ok(dialog.registryDependencies.includes(`${REPO}/fx-good-button#v9.9.9`), dialog.registryDependencies.join(' '))
  assert.ok(dialog.dependencies.every((d) => d.lastIndexOf('@') > 0), dialog.dependencies.join(' '))
  for (const it of good.items.filter((i) => i.type === 'registry:ui')) assert.ok(it.registryDependencies.includes(`${REPO}/factory-base#v9.9.9`), it.name)
  const names = good.items.map((i) => i.name)
  assert.equal(new Set(names).size, names.length)
})

// P3-2 Task 1b: 블록은 아이콘을 정본 모듈(@/registry/factory/icons → 소비자 @/components/icons)로 부른다. 레시피 base 가
// components/icons/index.ts 를 실어 그 레시피의 어댑터를 다시 내보낸다(두 번째 레시피를 add -o 하면 마지막 레시피가 이긴다).
// registry:component 여야 한다 — shadcn 4.22.1 은 registry:file·registry:item 내용을 import 바꾸기 없이 그대로 쓴다.
test('recipe base ships components/icons/index.ts re-exporting its own icon adapter (fixtures, every adapter, every repo recipe)', async () => {
  const { good } = await built()
  const base = good.items.find((i) => i.name === 'fx-good')
  assert.deepEqual(base.files, [{ path: 'fx-good/icons/index.ts', type: 'registry:component', target: '@components/icons/index.ts' }])
  const idx = readFileSync(join(out, 'registry', 'factory', 'r', 'fx-good', 'icons', 'index.ts'), 'utf8')
  assert.equal(idx, recipeIconsIndex(load('good')))
  assert.match(idx, /^export \* from "@\/registry\/factory\/icons\/lucide"$/m)
  // 어댑터 다섯 갈래(icons.library · weight).
  const head = (library, weight) => recipeIconsIndex({ id: 'x', icons: { library, weight } }).match(/^export \* from "@\/registry\/factory\/icons\/([a-z-]+)"$/m)?.[1]
  assert.deepEqual([head('lucide', 'G2'), head('tabler', 'G3'), head('phosphor', 'G1'), head('phosphor', 'G2'), head('phosphor', 'G5')], ['lucide', 'tabler', 'phosphor', 'phosphor-light', 'phosphor-bold'])
  // 저장소의 레시피 10벌: 생성된 r/<id>/icons/index.ts 가 그 레시피의 어댑터를 내보내고, base 항목이 그 파일을 싣는다.
  const ids = recipeIds()
  assert.ok(ids.length >= 10, `레시피 ${ids.length}벌`)
  const bases = new Map(recipeRegistry().filter((i) => i.type === 'registry:base').map((i) => [i.name, i]))
  const adapters = new Set()
  for (const id of ids) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.deepEqual(bases.get(id).files, [{ path: `${id}/icons/index.ts`, type: 'registry:component', target: '@components/icons/index.ts' }], id)
    const src = readFileSync(join(RECIPES_DIR, '..', 'r', id, 'icons', 'index.ts'), 'utf8')
    assert.equal(src, recipeIconsIndex(r), id)
    adapters.add(src.match(/^export \* from "@\/registry\/factory\/icons\/([a-z-]+)"$/m)[1])
  }
  // 양성 대조: 저장소 레시피가 어댑터를 여럿 쓴다(한 어댑터로 굳은 생성기를 잡는다).
  assert.ok(adapters.size >= 3, [...adapters].join(','))
})

test('buildRecipe writes the compiled ui, marker, pure CSS and agent README', async () => {
  const { good } = await built()
  const r = join(out, 'registry', 'factory')
  for (const c of FX_COMPONENTS) assert.ok(existsSync(join(uiDir('fx-good'), `${c}.tsx`)), c)
  for (const c of ['display', 'texture']) assert.ok(!existsSync(join(uiDir('fx-good'), `${c}.tsx`)), `${c}: optional-axis part compiled without the axis in the head`)
  assert.ok(existsSync(join(uiDir('fx-good'), 'GENERATED.md')))
  const css = readFileSync(join(r, 'r', 'fx-good', 'fx-good.css'), 'utf8')
  assert.match(css.split('\n')[0], /^\/\* 생성물 — factory\/scripts\/recipe\.mjs 로 다시 만든다\. 손으로 고치지 않는다\. \*\/$/)
  assert.match(css, /:root \{[^}]*--background: oklch\(0\.985 0\.003 230\);[^}]*--font-heading: "Sora", "Pretendard Variable", "Pretendard"/)
  assert.match(css, /\.dark \{[^}]*--background: oklch\(0\.17 0\.008 230\);/)
  const readme = readFileSync(join(r, 'recipes', 'fx-good', 'README.generated.md'), 'utf8')
  assert.match(readme.split('\n')[0], /^<!-- 생성물 — factory\/scripts\/recipe\.mjs 로 다시 만든다\. 손으로 고치지 않는다\. -->$/)
  assert.match(readme, /npx shadcn@4.22.1 add nowwcastle-sudo\/sitebrew\/fx-good#v9\.9\.9/)
  assert.match(readme, /## 하지 말 것/)
  assert.ok(good.files.length >= FX_COMPONENTS.length + 3)
  assert.equal(recipeCss(load('good')).split('\n')[0], css.split('\n')[0])
})

test('compiled recipe parts import their siblings from the recipe folder, never the base ui/ (T7-c1)', async () => {
  await built()
  atLeast61()
  for (const c of FX_COMPONENTS) assert.doesNotMatch(readFileSync(join(uiDir('fx-good'), `${c}.tsx`), 'utf8'), /["']@\/registry\/factory\/ui\//, c)
  assert.match(readFileSync(join(uiDir('fx-good'), 'dialog.tsx'), 'utf8'), /from "@\/registry\/factory\/r\/fx-good\/ui\/button"/)
  assert.equal(recipeLocalImports('import { B } from "@/registry/factory/ui/button"\nimport { h } from "@/registry/factory/hooks/use-mobile"', 'x'),
    'import { B } from "@/registry/factory/r/x/ui/button"\nimport { h } from "@/registry/factory/hooks/use-mobile"')
})

test('rule invariance: ruleClasses(ui-src) ⊆ classes(r/<id>/ui) for every component, both fixtures', async () => {
  await built()
  atLeast61()
  for (const id of ['fx-good', 'fx-large']) for (const c of FX_COMPONENTS) {
    const want = ruleClasses(readFileSync(join(UI_SRC, `${c}.tsx`), 'utf8'))
    const got = new Set(classTokens(readFileSync(join(uiDir(id), `${c}.tsx`), 'utf8')))
    const missing = [...want].filter((t) => !got.has(t))
    assert.deepEqual(missing, [], `${id}/${c}`)
  }
})

test('lint-ui passes on both compiled recipe folders (no text below 14px, marker present)', async () => {
  await built()
  atLeast61()
  for (const id of ['fx-good', 'fx-large']) {
    const r = lintDir(uiDir(id), { motionCoveredGlobally: true, generated: true })
    assert.equal(r.files, FX_COMPONENTS.length)
    assert.deepEqual(r.fails, [], `${id}: ${r.fails.map((f) => `${f.rule} ${f.at} ${f.hit}`).join('\n')}`)
  }
})

test('recipes differ: the R0-family and large-radius builds compile different button classes', async () => {
  await built()
  const a = new Set(classTokens(readFileSync(join(uiDir('fx-good'), 'button.tsx'), 'utf8')))
  const b = new Set(classTokens(readFileSync(join(uiDir('fx-large'), 'button.tsx'), 'utf8')))
  assert.ok(a.has('rounded-none') && !a.has('rounded-full'))
  assert.ok(b.has('rounded-full') && !b.has('rounded-none'))
  assert.ok([...a].some((t) => !b.has(t)) && [...b].some((t) => !a.has(t)))
})

test('recipeItems rebuilds the same items from the compiled folder (gen-registry path)', async () => {
  const { good } = await built()
  const sources = readdirSync(uiDir('fx-good')).filter((f) => f.endsWith('.tsx')).map((f) => ({ name: f.replace(/\.tsx$/, ''), source: readFileSync(join(uiDir('fx-good'), f), 'utf8') }))
  const again = recipeItems(load('good'), sources, { repo: REPO, ref: 'v9.9.9', knownItems: new Set(['font-pretendard']) })
  assert.deepEqual(again.items, good.items)
})

test('buildRecipe refuses a recipe that fails lint and writes nothing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-refuse-'))
  try {
    await assert.rejects(buildRecipe(load('bad-refs'), { outRoot: root, knownItems: new Set() }), /references/)
    assert.ok(!existsSync(join(root, 'registry')))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('recipeRegistry (gen-registry layer r) reads compiled recipes from a repo root and refuses name clashes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-reg-'))
  try {
    const md = readFileSync(join(FX, 'good', 'DESIGN.md'), 'utf8')
    mkdirSync(join(root, 'registry', 'factory', 'recipes', 'fx-good'), { recursive: true })
    writeFileSync(join(root, 'registry', 'factory', 'recipes', 'fx-good', 'DESIGN.md'), md)
    const versions = pkgVersions()
    assert.throws(() => recipeRegistry({ root, ref: 'v9.9.9', versions }), /r\/fx-good\/ui/)
    const { items } = await buildRecipe(parseRecipe(md), { repo: REPO, ref: 'v9.9.9', outRoot: root, versions, knownItems: new Set() })
    assert.deepEqual(recipeRegistry({ root, ref: 'v9.9.9', versions }), items)
    mkdirSync(join(root, 'registry', 'factory', 'ui'), { recursive: true })
    writeFileSync(join(root, 'registry', 'factory', 'ui', 'registry.json'), JSON.stringify({ items: [{ name: 'fx-good-button' }] }))
    assert.throws(() => recipeRegistry({ root, ref: 'v9.9.9', versions }), /겹친다: fx-good-button/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('line-border: only recipes with a line-division value (C2·T4·H3) need --border >= 3:1 (T7-M9)', () => {
  assert.deepEqual([...LINE_VALUES].sort(), ['C2', 'C6', 'C8', 'H3', 'H5', 'T4']) // Task 16a: C6·C8 잉크 테두리, H5 괘선
  assert.deepEqual(lint('bad-border').violations.map((m) => m.split(' — ')[0]), ['line-border: light border/background 1.33 < 3'])
  // 같은 옅은 테두리라도 선 구획 값이 없는 레시피는 통과한다(good-large 는 border 1.33 그대로).
  assert.ok(!rules(lint('good-large').violations).includes('line-border'))
})

test('status tokens are required and measured: fg on status >= 4.5, status vs background >= 3 (T7-M13)', () => {
  const r = load('good')
  const drop = { ...r, color: { light: { ...r.color.light }, dark: { ...r.color.dark } } }
  delete drop.color.light.warning; delete drop.color.dark.warning
  assert.ok(lintRecipe(drop).some((m) => m.startsWith('schema: color.light.warning')), lintRecipe(drop).join('\n'))
  const faint = { ...r, color: { light: { ...r.color.light, success: 'oklch(0.9 0.05 150)' }, dark: { ...r.color.dark, 'info-foreground': 'oklch(0.7 0.12 255)' } } }
  const v = lintRecipe(faint).filter((m) => m.startsWith('contrast'))
  assert.ok(v.some((m) => m.startsWith('contrast: light success/background')), v.join('\n'))
  assert.ok(v.some((m) => m.startsWith('contrast: light success-foreground/success')), v.join('\n'))
  assert.ok(v.some((m) => m.startsWith('contrast: dark info-foreground/info')), v.join('\n'))
})

// ── Task 5 fix 1: 단일 굵기 display · prose 역할 ────────────────────────
const withFonts = (patch) => { const r = load('good'); r.fonts = { ...r.fonts, ...patch }; return r }
const BHS = { family: 'Black Han Sans', item: 'font-black-han-sans', tuned: '제목 전용' }

test('single-weight display (weight count read from the kit item): heading synthesis off + part titles on the body stack, in registry css and pure CSS', () => {
  assert.equal(singleWeight(BHS), true)
  for (const f of [{ family: 'Archivo', item: 'font-archivo' }, { family: 'Gothic A1', item: 'font-gothic-a1' }, { family: 'Sora', item: 'font-sora' }]) assert.equal(singleWeight(f), false, f.item)
  const r = withFonts({ display: BHS })
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
  const layer = base.css['@layer utilities']
  assert.deepEqual(layer['.font-heading'], { 'font-synthesis-weight': 'none' })
  assert.equal(layer['[data-slot$="-title"].font-heading']['font-family'], fontStacks(r.fonts)['font-sans'])
  const css = recipeCss(r)
  assert.ok(css.split('\n').includes('.font-heading { font-synthesis-weight: none; }'), css)
  assert.ok(css.includes(`[data-slot$="-title"].font-heading { font-family: ${fontStacks(r.fonts, { plain: true })['font-sans']}; }`))
  // 음성 대조: 여러 굵기 display 레시피에는 규칙도 css 필드도 없다
  const good = recipeItems(load('good'), [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
  assert.equal(good.css['@layer utilities'], undefined)
  assert.ok(!recipeCss(load('good')).includes('font-synthesis'))
})

// ── Task 10c: 한글 제목체 fonts.displayKo ────────────────────────────────
const DOHYEON = { family: 'Do Hyeon', item: 'font-do-hyeon' } // Google, 굵기 400 하나
const GOWUN_B = { family: 'Gowun Batang', item: 'font-gowun-batang' } // Google, 400·700
const PYEOJIN = { family: 'PyeojinGothic', item: 'font-pyeojin-gothic' } // css(@font-face) 항목, 300·400·700(fix 1 — I3)
const SEOCHO = { family: 'SeochoBatang', item: 'font-seocho-batang' } // css(@font-face) 항목, meta.weight ["400"] 한 개

test('displayKo: font-heading is display → displayKo → body → Korean fallback → system Korean → generic (Latin from display, Hangul from displayKo)', () => {
  const r = withFonts({ displayKo: DOHYEON })
  assert.deepEqual(lintRecipe(r), [])
  assert.equal(fontStacks(r.fonts, { plain: true })['font-heading'], '"Sora", "Do Hyeon", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif')
  const h = fontStacks(r.fonts)['font-heading']
  const at = (s) => h.indexOf(s)
  assert.ok(at('var(--font-sora-wf') === 0 && at('var(--font-sora-wf') < at('var(--font-do-hyeon-wf') && at('var(--font-do-hyeon-wf') < at('var(--font-pretendard-wf'), h)
  // display 변수가 없는 소비자(항목 미설치)에서도 기본값 목록이 같은 순서다.
  assert.match(h, /^var\(--font-sora-wf, "Sora", "Do Hyeon", "Pretendard Variable", "Pretendard",/)
  assert.ok(h.endsWith('"Apple SD Gothic Neo", "Malgun Gothic", sans-serif'), h)
  // 본문·고정폭 스택에는 들어가지 않는다(제목 전용).
  for (const k of ['font-sans', 'font-mono']) assert.ok(!fontStacks(r.fonts)[k].includes('Do Hyeon'), k)
  // 없으면 전과 같다(음성 대조).
  assert.equal(fontStacks(load('good').fonts, { plain: true })['font-heading'], '"Sora", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif')
  // 키트 항목·README 에도 실린다.
  assert.ok(kitItems(r).includes('font-do-hyeon'))
  assert.match(recipeReadme(r), /한글 제목 Do Hyeon\(`font-do-hyeon`\)/)
  assert.doesNotMatch(recipeReadme(load('good')), /· 한글 제목 /) // 서체 줄의 한글 제목체 칸(font-heading-ko 안내 문단은 모든 레시피에 있다)
})

test('single-weight displayKo (Google weight list or css meta.weight): synthesis off; part title slots use display → body → ko, skipping displayKo (fix 1 — I2)', () => {
  for (const ko of [DOHYEON, SEOCHO]) {
    assert.equal(singleWeight(ko), true, ko.item)
    const r = withFonts({ displayKo: ko })
    const slot = fontStacks({ ...r.fonts, displayKo: undefined })['font-heading']
    assert.equal(titleSlotStack(r.fonts), slot)
    assert.ok(slot.startsWith('var(--font-sora-wf, "Sora", "Pretendard Variable"') && !slot.includes(ko.family), slot) // 라틴 display 는 남고 한글 제목체는 빠진다
    const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
    // font-heading-ko(Task 14c)는 displayKo 로 시작하므로 같이 합성을 끈다.
    assert.deepEqual(base.css['@layer utilities'], { '.font-heading': { 'font-synthesis-weight': 'none' }, '.font-heading-ko': { 'font-synthesis-weight': 'none' }, '[data-slot$="-title"].font-heading': { 'font-family': slot } }, ko.item)
    // 제목 칸 밖의 .font-heading 은 한글 제목체가 든 전체 스택 그대로다.
    assert.ok(base.cssVars.theme['font-heading'].includes(ko.family))
    const css = recipeCss(r)
    assert.ok(css.split('\n').includes('.font-heading { font-synthesis-weight: none; }'), css)
    assert.ok(css.includes(`[data-slot$="-title"].font-heading { font-family: ${titleSlotStack(r.fonts, { plain: true })}; }`), css)
    assert.equal(titleSlotStack(r.fonts, { plain: true }), '"Sora", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif')
    assert.match(recipeReadme(r), /한글 제목체를 건너뛴 제목 스택/)
  }
  // 음성 대조: 여러 굵기 한글 제목체(Gowun Batang 400·700, 펴진고딕 300·400·700)는 규칙 없음.
  for (const ko of [GOWUN_B, PYEOJIN]) {
    assert.equal(singleWeight(ko), false, ko.item)
    assert.equal(titleSlotStack(withFonts({ displayKo: ko }).fonts), null)
    const two = recipeItems(withFonts({ displayKo: ko }), [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
    assert.equal(two.css['@layer utilities'], undefined, ko.item)
  }
  // display 와 displayKo 가 둘 다 단일 굵기면 display 규칙이 이긴다(합성 끄기 + 부품 제목은 본문).
  const both = withFonts({ display: BHS, displayKo: DOHYEON })
  const layer = recipeItems(both, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base').css['@layer utilities']
  assert.deepEqual(layer['.font-heading'], { 'font-synthesis-weight': 'none' })
  assert.equal(layer['[data-slot$="-title"].font-heading']['font-family'], fontStacks(both.fonts)['font-sans'])
})

test('lint font-display-ko: displayKo must be a kit item, Korean (korean-fonts.json), and not the body face', () => {
  const ko = (displayKo, body) => lintRecipe(withFonts({ displayKo, ...(body ? { body } : {}) })).filter((m) => m.startsWith('font-display-ko:'))
  assert.deepEqual(ko(DOHYEON), [])
  assert.deepEqual(ko(PYEOJIN), [])
  assert.equal(ko({ family: 'Sora', item: 'font-sora' }).length, 1) // 라틴 서체
  assert.ok(ko({ family: 'Sora', item: 'font-sora' })[0].includes('한글'))
  assert.equal(ko({ family: 'Nanum Square', item: 'font-nanum-square' }).length, 1) // 한글이지만 키트 밖(external)
  assert.equal(ko({ family: 'Do Hyeon', item: 'font-jua' }).length, 1) // 이름과 항목이 어긋남
  const same = ko({ family: 'Pretendard', item: 'font-pretendard' })
  assert.equal(same.length, 1)
  assert.ok(same[0].includes('본문'), same[0])
  // 스키마: family·item 이 있어야 한다.
  assert.ok(lintRecipe(withFonts({ displayKo: { family: 'Do Hyeon' } })).some((m) => m.startsWith('schema: fonts.displayKo')))
})

// ── Task 6 fix 1: 제목 굵기 fonts.display.weight (리뷰 I1) ───────────────
const JOST200 = { family: 'Jost', item: 'font-jost', weight: 200, tuned: '제목 200' }
test('display.weight → --wf-heading-weight + .font-heading base-layer weight, in registry css and pure CSS; no weight → default 700 only', () => {
  const r = withFonts({ display: JOST200 })
  assert.deepEqual(lintRecipe(r), [])
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
  assert.equal(base.cssVars.light['wf-heading-weight'], '200')
  assert.deepEqual(base.css['@layer base']['.font-heading'], { 'font-weight': 'var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))' })
  const css = recipeCss(r)
  assert.ok(css.includes('  --wf-heading-weight: 200;'), css)
  assert.match(css, /@layer base \{\n\.font-heading \{ font-weight: var\(--wf-heading-weight-ko, var\(--wf-heading-weight, 700\)\); \}\n\.font-heading-ko \{ font-weight: var\(--wf-heading-weight-ko, var\(--wf-heading-weight, 700\)\); \}\n\}/)
  // 여러 굵기 display(Jost 200)는 한글도 같은 굵기로 그린다 — 한글 제목 굵기 변수가 없다.
  assert.equal(base.cssVars.light['wf-heading-weight-ko'], undefined)
  // 음성 대조: 값이 없으면 변수는 없고 규칙의 기본값 700만 남는다
  const good = recipeItems(load('good'), [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
  assert.equal(good.cssVars.light['wf-heading-weight'], undefined)
  assert.deepEqual(good.css['@layer base']['.font-heading'], { 'font-weight': 'var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))' })
  assert.ok(!recipeCss(load('good')).includes('--wf-heading-weight:'))
  assert.ok(!recipeCss(load('good')).includes('--wf-heading-weight-ko:'))
})

// ── Task 10b → 14c: 한글 제목 굵기는 머리 display.weightKo 에 적을 때만(자동 규칙 없음) ────────────────
// 라틴 display 가 굵기 하나(Fragment Mono 400)이면 제목 굵기 400 이 한글까지 가늘게 한다. 레시피가 display.weightKo 를 적으면
// --wf-heading-weight-ko 가 나가고 .font-heading·.font-heading-ko 가 그것을 먼저 읽는다. 적지 않으면 한글도 display 굵기다(r9 B 동글 400 — 운영자가 본 모양).
const FRAGMENT = { family: 'Fragment Mono', item: 'font-fragment-mono', weight: 400 }
const PRETENDARD_GOV = { family: 'Pretendard GOV', item: 'font-pretendard-gov' }
const DONGLE = { family: 'Dongle', item: 'font-dongle' } // Google, 300·400·700
const baseOf = (r) => recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
test('Korean heading weight is explicit (Task 14c): display.weightKo → --wf-heading-weight-ko first in .font-heading/.font-heading-ko; unset → no variable (inherits the display weight)', () => {
  const r = withFonts({ display: { ...FRAGMENT, weightKo: 700 }, body: PRETENDARD_GOV })
  assert.deepEqual(lintRecipe(r), [])
  const base = baseOf(r)
  assert.equal(base.cssVars.light['wf-heading-weight'], '400') // 라틴 display 역할은 그대로(문서·README)
  assert.equal(base.cssVars.light['wf-heading-weight-ko'], '700')
  assert.deepEqual(base.css['@layer base']['.font-heading'], { 'font-weight': 'var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))' })
  assert.deepEqual(base.css['@layer base']['.font-heading-ko'], { 'font-weight': 'var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))' })
  assert.deepEqual(base.css['@layer utilities']['.font-heading'], { 'font-synthesis-weight': 'none' }) // 라틴 400 면을 가짜로 굵히지 않는다
  const css = recipeCss(r)
  assert.ok(css.includes('  --wf-heading-weight-ko: 700;'), css)
  assert.match(recipeReadme(r), /한글 제목 굵기 700\(`--wf-heading-weight-ko`, 머리 `fonts\.display\.weightKo`\)/)
  // 음성 대조(자동 규칙이 없다): 같은 함정 모양(단일 굵기 라틴 + 여러 굵기 한글 — Pretendard GOV·동글)이어도 적지 않으면 변수가 없다.
  for (const fonts of [{ display: FRAGMENT, body: PRETENDARD_GOV }, { display: FRAGMENT, displayKo: DONGLE }, { display: BHS }, { display: JOST200 }]) {
    assert.equal(baseOf(withFonts(fonts)).cssVars.light['wf-heading-weight-ko'], undefined, JSON.stringify(fonts))
    assert.ok(!recipeCss(withFonts(fonts)).includes('--wf-heading-weight-ko:'), JSON.stringify(fonts))
    assert.doesNotMatch(recipeReadme(withFonts(fonts)), /한글 제목 굵기 \d+\(/, JSON.stringify(fonts))
  }
})

test('display.weightKo lint: the Korean heading face (displayKo, else body) must carry that weight; schema 100~900', () => {
  const hit = (fonts) => lintRecipe(withFonts(fonts)).filter((m) => m.startsWith('font-weight:') || m.startsWith('schema: fonts.display.weightKo'))
  assert.deepEqual(hit({ display: { ...FRAGMENT, weightKo: 700 }, displayKo: DONGLE }), []) // 동글 300·400·700
  assert.equal(hit({ display: { ...FRAGMENT, weightKo: 500 }, displayKo: DONGLE }).length, 1) // 동글에 500 없음
  assert.equal(hit({ display: { ...FRAGMENT, weightKo: 700 }, displayKo: DOHYEON }).length, 1) // Do Hyeon 400 하나
  assert.deepEqual(hit({ display: { ...FRAGMENT, weightKo: 700 }, body: PRETENDARD_GOV }), []) // 본문이 한글 제목 서체
  assert.ok(hit({ display: { ...FRAGMENT, weightKo: 950 }, body: PRETENDARD_GOV }).some((m) => m.startsWith('schema: fonts.display.weightKo')))
})

test('font-heading-ko (Task 14c): a Korean heading stack that skips the Latin display (displayKo → body → system Korean), on every recipe; synthesis off only for a single-weight displayKo', () => {
  const good = load('good')
  const plain = fontStacks(good.fonts, { plain: true })
  assert.equal(plain['font-heading-ko'], '"Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif')
  assert.ok(!plain['font-heading-ko'].includes('Sora'))
  assert.equal(fontStacks({ ...good.fonts, displayKo: DOHYEON }, { plain: true })['font-heading-ko'], '"Do Hyeon", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif')
  // registry cssVars.theme(→ 소비자 @theme inline → font-heading-ko 유틸리티)·순수 CSS·README 에 나간다
  assert.equal(baseOf(good).cssVars.theme['font-heading-ko'], fontStacks(good.fonts)['font-heading-ko'])
  assert.ok(recipeCss(good).includes(`  --font-heading-ko: ${plain['font-heading-ko']};`))
  assert.ok(recipeCss(good).includes('.font-heading-ko { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); }'))
  assert.match(recipeReadme(good), /`font-heading-ko`\(`--font-heading-ko`\)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다/)
  // 합성 끄기: 한글 제목체가 굵기 하나(Do Hyeon)일 때만 — 라틴 display 만 굵기 하나(Fragment Mono)면 font-heading-ko 는 본문 스택이라 끄지 않는다
  assert.deepEqual(singleWeightRules(withFonts({ displayKo: DOHYEON }))['.font-heading-ko'], { 'font-synthesis-weight': 'none' })
  assert.equal(singleWeightRules(withFonts({ display: FRAGMENT, body: PRETENDARD_GOV }))['.font-heading-ko'], undefined)
})

test('Korean heading weight over the 10 live recipes (A and B faces): only r6-civic A declares it (r9-clay B stays at its display weight 400 — the look the owner rated on board 3)', () => {
  const hits = []
  for (const id of recipeIds()) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    const faces = [['A', r], ...(r.alternates?.fonts ? [['B', applyAlternate(r, ['fonts'])]] : [])]
    for (const [k, h] of faces) {
      const b = baseOf(h)
      if (b.cssVars.light['wf-heading-weight-ko']) hits.push(`${id} ${k} ${b.cssVars.light['wf-heading-weight-ko']}`)
    }
  }
  assert.deepEqual(hits.sort(), ['r6-civic A 700'])
  const r9 = parseRecipe(readFileSync(join(RECIPES_DIR, 'r9-clay', 'DESIGN.md'), 'utf8'))
  assert.equal(baseOf(applyAlternate(r9, ['fonts'])).cssVars.light['wf-heading-weight'], '400')
})

test('generated r6-civic CSS (static): Korean heading weight 700 beside the Latin display 400, synthesis off, font-heading reads the Korean weight first, font-heading-ko is the GOV body stack', () => {
  const css = readFileSync(join(RECIPES_DIR, '..', 'r', 'r6-civic', 'r6-civic.css'), 'utf8')
  assert.ok(css.includes('  --wf-heading-weight: 400;'), 'Latin display weight')
  assert.ok(css.includes('  --wf-heading-weight-ko: 700;'), 'Korean heading weight')
  assert.ok(css.includes('.font-heading { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); }'))
  assert.ok(css.includes('.font-heading-ko { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); }'))
  assert.ok(css.split('\n').includes('.font-heading { font-synthesis-weight: none; }'))
  assert.match(css, /\n {2}--font-heading-ko: "Pretendard GOV Variable", /)
  assert.doesNotMatch(css.match(/--font-heading-ko: [^;]*;/)[0], /Fragment Mono/)
  const reg = JSON.parse(readFileSync(join(RECIPES_DIR, '..', 'r', 'registry.json'), 'utf8'))
  const base = reg.items.find((i) => i.name === 'r6-civic')
  assert.equal(base.cssVars.light['wf-heading-weight-ko'], '700')
  assert.ok(base.cssVars.theme['font-heading-ko'])
  assert.equal(reg.items.find((i) => i.name === 'r9-clay').cssVars.light['wf-heading-weight-ko'], undefined)
})

test('display.weight lint: static kit weights, variable wght range, css @import items 100~900; schema 100~900', () => {
  assert.deepEqual(kitWeights('font-gothic-a1'), { list: [400, 500, 700, 800] })
  assert.deepEqual(kitWeights('font-jost'), { min: 100, max: 900 })
  assert.deepEqual(kitWeights('font-ibm-plex-sans'), { min: 100, max: 700 })
  assert.deepEqual(kitWeights('font-pretendard'), { min: 100, max: 900 })
  const hit = (display) => lintRecipe(withFonts({ display })).filter((m) => m.startsWith('font-weight:') || m.startsWith('schema: fonts.display.weight'))
  assert.equal(hit({ family: 'Gothic A1', item: 'font-gothic-a1', weight: 900 }).length, 1) // 키트에 900 없음
  assert.equal(hit({ family: 'Black Han Sans', item: 'font-black-han-sans', weight: 700 }).length, 1) // 굵기 400 하나
  assert.equal(hit({ family: 'IBM Plex Sans', item: 'font-ibm-plex-sans', weight: 800 }).length, 1) // wght 100~700
  assert.ok(hit({ family: 'Jost', item: 'font-jost', weight: 950 }).some((m) => m.startsWith('schema: fonts.display.weight'))) // 스키마 상한
  assert.deepEqual(hit({ family: 'Gothic A1', item: 'font-gothic-a1', weight: 800 }), [])
  assert.deepEqual(hit({ family: 'Pretendard', item: 'font-pretendard', weight: 200 }), [])
})

test('every repo recipe declares display.weight inside its kit item (positive control on real data)', () => {
  const ids = recipeIds()
  assert.ok(ids.length >= 7)
  for (const id of ids) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.equal(typeof r.fonts.display.weight, 'number', id)
    assert.deepEqual(lintRecipe(r).filter((m) => m.startsWith('font-weight')), [], id)
  }
})

test('fonts.prose: optional role → --font-prose stack (generic from the kit item), marker, kit item; parts never use it', () => {
  const serif = { family: 'Noto Serif KR', item: 'font-noto-serif-kr', tuned: 'AI 답 문장만' }
  const r = withFonts({ prose: serif })
  assert.deepEqual(lintRecipe(r), [])
  const st = fontStacks(r.fonts)
  assert.ok(st['font-prose'].startsWith('var(--font-noto-serif-kr-wf, "Noto Serif KR"'), st['font-prose'])
  assert.ok(st['font-prose'].endsWith(', serif'), st['font-prose'])
  assert.equal(fontStacks(load('good').fonts)['font-prose'], undefined)
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items.find((i) => i.type === 'registry:base')
  assert.equal(base.cssVars.theme['font-prose'], st['font-prose'])
  assert.ok(base.cssVars.light['wf-font-tuned'].includes('prose'))
  assert.ok(kitItems(r).includes('font-noto-serif-kr'))
  assert.ok(!readdirSync(UI_SRC).map((f) => readFileSync(join(UI_SRC, f), 'utf8')).join('\n').includes('font-prose'))
})

test('fonts.prose lint: must be a kit item; banlist display·body entries apply to prose', () => {
  const v1 = lintRecipe(withFonts({ prose: { family: 'Noto Serif KR', item: 'font-not-in-kit' } }))
  assert.ok(v1.some((m) => m.startsWith('font-prose:')), v1.join('\n'))
  const v2 = lintRecipe(withFonts({ prose: { family: 'Fraunces', item: 'font-noto-serif-kr' } }))
  assert.ok(v2.some((m) => m.startsWith('banlist: fonts.prose Fraunces')), v2.join('\n'))
  assert.ok(!lintRecipe(withFonts({ prose: { family: 'Fraunces', item: 'font-noto-serif-kr', tuned: 'AI 답만, 굵기 400' } })).some((m) => m.startsWith('banlist')))
})

// ── Task 6b: 색 논리 K6~K8 · 다크 기본 · 역동 기법 · 모션 토큰 (DESIGN §5-B·§8-6, div-01~07) ──────────
const withHead = (patch = {}, { light = {}, dark = {}, body } = {}) => {
  const r = structuredClone(load('good'))
  Object.assign(r, patch)
  Object.assign(r.color.light, light)
  Object.assign(r.color.dark, dark)
  if (body) r.body = body(r.body)
  return r
}
const hits = (r, rule) => lintRecipe(r).filter((m) => m.startsWith(`${rule}:`))
const NO_DUO_GRADIENT = (b) => b.replace('## 하지 말 것\n', '## 하지 말 것\n\n- 두 색 사이에 그라디언트를 넣지 않는다(K7 듀오톤).\n')

const K6_LIGHT = { 'field-1': 'oklch(0.9 0.07 230)', 'field-1-foreground': 'oklch(0.2 0.02 230)', 'field-2': 'oklch(0.4 0.12 230)', 'field-2-foreground': 'oklch(0.985 0.003 230)' }
const K6_DARK = { 'field-1': 'oklch(0.36 0.09 230)', 'field-1-foreground': 'oklch(0.96 0.005 230)', 'field-2': 'oklch(0.3 0.1 230)', 'field-2-foreground': 'oklch(0.96 0.005 230)' }
const k6 = (light = {}, dark = {}) => withHead({ colorLogic: 'K6' }, { light: { ...K6_LIGHT, ...light }, dark: { ...K6_DARK, ...dark } })

const K7_LIGHT = { primary: 'oklch(0.45 0.15 255)', 'field-1': 'oklch(0.88 0.12 95)', 'field-1-foreground': 'oklch(0.2 0.02 95)' }
const K7_DARK = { 'field-1': 'oklch(0.42 0.1 95)', 'field-1-foreground': 'oklch(0.97 0.01 95)' }
const k7 = (light = {}, { body = NO_DUO_GRADIENT } = {}) => withHead({ colorLogic: 'K7' }, { light: { ...K7_LIGHT, ...light }, dark: K7_DARK, body })

const K8_LIGHT = {
  'block-1': 'oklch(0.72 0.16 55)', 'block-1-foreground': 'oklch(0.2 0.03 55)',
  'block-2': 'oklch(0.86 0.08 200)', 'block-2-foreground': 'oklch(0.22 0.03 200)',
  'block-3': 'oklch(0.82 0.1 140)', 'block-3-foreground': 'oklch(0.22 0.03 140)',
}
const K8_DARK = {
  'block-1': 'oklch(0.45 0.14 55)', 'block-1-foreground': 'oklch(0.97 0.01 55)',
  'block-2': 'oklch(0.4 0.07 200)', 'block-2-foreground': 'oklch(0.96 0.01 200)',
  'block-3': 'oklch(0.42 0.08 140)', 'block-3-foreground': 'oklch(0.96 0.01 140)',
}
const k8 = (light = {}, patch = {}) => withHead({ colorLogic: 'K8', archetypes: ['saas'], ...patch }, { light: { ...K8_LIGHT, ...light }, dark: K8_DARK })

test('schema: colorLogic (K1~K8) and dynamics (1~3 catalog ids) are required; defaultTheme light|dark; alternates optional', () => {
  const r = withHead()
  delete r.colorLogic
  delete r.dynamics
  const v = lintRecipe(r)
  assert.ok(v.some((m) => m.startsWith('schema: colorLogic')), v.join('\n'))
  assert.ok(v.some((m) => m.startsWith('schema: dynamics')), v.join('\n'))
  assert.ok(lintRecipe(withHead({ colorLogic: 'K10' })).some((m) => m.startsWith('schema: colorLogic'))) // K9 는 Task 16a 에서 들어왔다
  assert.ok(lintRecipe(withHead({ defaultTheme: 'dim' })).some((m) => m.startsWith('schema: defaultTheme')))
  assert.ok(lintRecipe(withHead({ dynamics: [] })).some((m) => m.startsWith('schema: dynamics')))
  assert.ok(lintRecipe(withHead({ dynamics: ['clip-reveal', 'svg-draw', 'split-text', 'marquee'] })).some((m) => m.startsWith('schema: dynamics')))
  assert.deepEqual(lintRecipe(withHead({ defaultTheme: 'light' })), [])
})

test('an unknown dynamics id is a violation (DESIGN §8-6 catalog only)', () => {
  const v = lintRecipe(withHead({ dynamics: ['clip-reveal', 'sparkle'] }))
  assert.ok(v.some((m) => m.startsWith('schema: dynamics')), v.join('\n'))
  assert.equal(DYNAMICS_IDS.length, 13)
  assert.deepEqual(lintRecipe(withHead({ dynamics: [...DYNAMICS_IDS.filter((d) => d !== 'magnetic-cta').slice(0, 3)] })), [])
})

test('signature: catalog scene ids only, 1~3, no repeats — an unknown scene id is a violation (Task 8)', () => {
  assert.ok(SCENE_IDS.includes('bento') && SCENE_IDS.includes('hero-display'))
  assert.equal(SCENE_IDS.length, 11) // Task 10d: hero
  // 픽스처 머리에는 hero 가 있다 — hero 가 있으면 signature 첫 칸은 hero(lint hero-first, Task 10d fix).
  assert.deepEqual(lintRecipe(withHead({ signature: ['hero', 'hero-display', 'bento'] })), [])
  for (const bad of [['hero-display', 'sparkle-hero'], [], ['ledger', 'ledger'], ['ledger', 'bento', 'doc-page', 'app-shell']])
    assert.ok(lintRecipe(withHead({ signature: bad })).some((m) => m.startsWith('schema: signature')), JSON.stringify(bad))
})

test('every recipe in the registry names 1~3 signature scenes (Task 8 — board shows them before the common specimen)', () => {
  for (const id of recipeIds()) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.ok(Array.isArray(r.signature) && r.signature.length >= 1 && r.signature.length <= 3, id)
    assert.ok(r.signature.every((s) => SCENE_IDS.includes(s) && !SCENES[s].photo), `${id}: ${r.signature}`)
  }
})

test('dynamics × motion: M0 takes only still techniques; magnetic-cta only at M3 (DESIGN §8-1·§8-6)', () => {
  assert.equal(hits(withHead({ motion: 'M0', dynamics: ['split-text'] }), 'dynamics-motion').length, 1)
  assert.deepEqual(hits(withHead({ motion: 'M0', dynamics: ['oversize-crop', 'grain', 'blend'] }), 'dynamics-motion'), [])
  assert.equal(hits(withHead({ motion: 'M2', dynamics: ['magnetic-cta'] }), 'dynamics-motion').length, 1)
  assert.deepEqual(lintRecipe(withHead({ motion: 'M3', archetypes: ['saas'], dynamics: ['magnetic-cta'] })), [])
})

test('M3 × dashboard or public is a violation; M3 × saas passes (div-06, compat.json recipeRules)', () => {
  const v = hits(withHead({ motion: 'M3' }), 'recipe-compat')
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /M3/)
  assert.equal(hits(withHead({ motion: 'M3', archetypes: ['public'] }), 'recipe-compat').length, 1)
  assert.deepEqual(lintRecipe(withHead({ motion: 'M3', archetypes: ['saas'] })), [])
})

test('K6 colour fields: positive fixture lints clean; generated as CSS vars with Tailwind theme mappings', () => {
  const r = k6()
  assert.deepEqual(lintRecipe(r), [])
  const { items } = recipeItems(r, [], { repo: REPO, knownItems: new Set() })
  const [base, theme] = items
  for (const k of ['field-1', 'field-1-foreground', 'field-2', 'field-2-foreground']) {
    assert.equal(base.cssVars.light[k], K6_LIGHT[k], k)
    assert.equal(base.cssVars.dark[k], K6_DARK[k], k)
    assert.equal(base.cssVars.theme[`color-${k}`], `var(--${k})`, k)
    assert.equal(theme.cssVars.theme[`color-${k}`], `var(--${k})`, k)
  }
  const css = recipeCss(r)
  assert.ok(css.includes(`  --field-1: ${K6_LIGHT['field-1']};`), css)
  assert.ok(css.includes(`  --field-1: ${K6_DARK['field-1']};`), css)
  // 음성 대조: 면 키가 없는 레시피에는 매핑도 없다
  const plain = recipeItems(load('good'), [], { repo: REPO, knownItems: new Set() }).items[0]
  assert.ok(!Object.keys(plain.cssVars.theme).some((k) => /field|block/.test(k)))
})

test('K6 negatives: missing field, out-of-band field, cream-edge field, low text contrast, a third field, field keys without K6/K7', () => {
  assert.equal(hits(withHead({ colorLogic: 'K6' }), 'k6-field').length, 1) // 면 키 없음
  assert.ok(hits(k6({ 'field-1': 'oklch(0.97 0.03 230)' }), 'k6-field').length >= 1) // 밝은 면이 거의 흰색
  assert.ok(hits(k6({ 'field-2': 'oklch(0.4 0.2 230)' }), 'k6-field').length >= 1) // 짙은 면 C 0.18 초과
  assert.ok(hits(k6({ 'field-1': 'oklch(0.92 0.08 80)' }), 'k6-field').some((m) => m.includes('크림')))
  assert.equal(hits(k6({ 'field-2-foreground': 'oklch(0.55 0.01 230)' }), 'field-contrast').length, 1)
  assert.ok(hits(k6({ 'field-3': 'oklch(0.88 0.08 150)', 'field-3-foreground': 'oklch(0.2 0.02 150)' }, { 'field-3': 'oklch(0.35 0.09 150)', 'field-3-foreground': 'oklch(0.96 0.005 150)' }), 'color-logic-keys').length >= 1)
  const k1 = withHead({ colorLogic: 'K1' }, { light: K6_LIGHT, dark: K6_DARK })
  assert.equal(hits(k1, 'color-logic-keys').length, 1)
})

test('K6 fix 1: warm light fields need C >= 0.1 across the whole light band (sand oklch(0.86 0.065 78) no longer slips through)', () => {
  assert.ok(hits(k6({ 'field-1': 'oklch(0.86 0.065 78)' }), 'k6-field').some((m) => m.includes('크림')))
  assert.ok(hits(k6({ 'field-1': 'oklch(0.83 0.09 65)' }), 'k6-field').some((m) => m.includes('크림')))
  assert.ok(!hits(k6({ 'field-1': 'oklch(0.86 0.11 78)', 'field-1-foreground': 'oklch(0.2 0.03 78)' }), 'k6-field').some((m) => m.includes('크림')))
})

test('K6 fix 1 (M8): a chromatic background counts as a field colour — background + fields at most 2 hue groups', () => {
  const bg = { background: 'oklch(0.92 0.06 30)', 'field-2': 'oklch(0.4 0.12 140)' }
  assert.ok(hits(k6(bg), 'k6-field').some((m) => m.includes('바탕도 센다')))
  assert.ok(!hits(k6({ background: 'oklch(0.92 0.06 230)' }), 'k6-field').some((m) => m.includes('바탕도 센다'))) // 같은 색상각이면 한 묶음
})

test('K6 fix 1 (M6): pair rule, translucent field colour, and the 7:1 target warning', () => {
  const r = k6()
  for (const t of ['light', 'dark']) delete r.color[t]['field-2-foreground']
  assert.ok(hits(r, 'color-logic-keys').some((m) => m.includes('짝')))
  assert.ok(lintRecipe(k6({ 'field-1': 'oklch(0.9 0.07 230 / 0.8)' })).some((m) => m.startsWith('alpha: color.light.field-1')))
  const mid = k6({ 'field-1': 'oklch(0.9 0.07 230)', 'field-1-foreground': 'oklch(0.45 0.02 230)' }) // 약 5:1 — 바닥은 넘고 목표는 못 미친다
  const rep = lintRecipeReport(mid)
  assert.deepEqual(rep.violations.filter((m) => m.startsWith('field-contrast')), [])
  assert.ok(rep.warnings.some((m) => m.startsWith('field-contrast-target: light field-1-foreground/field-1')), rep.warnings.join('\n'))
})

test('K7 duotone: two C>=0.1 hue groups >= 90° apart (field vs primary), no third group, a documented no-gradient line', () => {
  assert.deepEqual(lintRecipe(k7()), [])
  assert.ok(hits(k7({ 'field-1': 'oklch(0.88 0.12 200)' }), 'k7-duotone').length >= 1) // 55° 떨어짐
  assert.ok(hits(k7({ 'field-1': 'oklch(0.9 0.05 95)' }), 'k7-duotone').length >= 1) // 면 채도 0.1 미만 → 한 묶음
  assert.ok(hits(k7({ 'accent-foreground': 'oklch(0.45 0.15 25)' }), 'k7-duotone').length >= 1) // 셋째 묶음
  assert.equal(hits(k7({}, { body: (b) => b }), 'k7-gradient-documented').length, 1) // 「보라 그라디언트」 줄로는 안 된다
  assert.equal(hits(k7({ 'field-1-foreground': 'oklch(0.7 0.02 95)' }), 'field-contrast').length, 1)
})

test('K8 colour blocks: 3~4 blocks in 3~4 hue groups, per-block contrast, one peak-chroma block', () => {
  assert.deepEqual(lintRecipe(k8()), [])
  const { items } = recipeItems(k8(), [], { repo: REPO, knownItems: new Set() })
  assert.equal(items[0].cssVars.theme['color-block-3-foreground'], 'var(--block-3-foreground)')
  assert.ok(recipeCss(k8()).includes('  --block-2: oklch(0.86 0.08 200);'))
  assert.equal(hits(k8({ 'block-2': 'oklch(0.86 0.16 200)' }), 'k8-peak').length, 1)
  assert.ok(hits(k8({ 'block-3': 'oklch(0.82 0.1 80)' }), 'k8-blocks').length >= 1) // 55°·80° 한 묶음 → 2묶음
  assert.equal(hits(k8({ 'block-2-foreground': 'oklch(0.7 0.03 200)' }), 'block-contrast').length, 1)
  const r = k8()
  for (const t of ['light', 'dark']) { delete r.color[t]['block-3']; delete r.color[t]['block-3-foreground'] }
  assert.ok(hits(r, 'k8-blocks').length >= 1) // 칸 2개
  assert.equal(hits(k8({}, { archetypes: ['public'] }), 'recipe-compat').length, 1) // K8 × public 금지
  assert.ok(lintRecipeReport(k8({}, { archetypes: ['dashboard'] })).warnings.some((w) => w.startsWith('recipe-caution:')))
})

test('K8 rainbow order (review M4): only for 4 blocks, judged around the colour wheel', () => {
  assert.equal(isRainbowOrder([55, 140, 200]), false) // 3칸은 판정하지 않는다
  assert.equal(isRainbowOrder([300, 20, 100, 170]), true) // 0° 를 넘어 한 방향으로 돈다(원형 반례)
  assert.equal(isRainbowOrder([30, 90, 150, 250]), true)
  assert.equal(isRainbowOrder([250, 150, 90, 30]), true)
  assert.equal(isRainbowOrder([150, 35, 88, 265]), false)
  const four = { 'block-4': 'oklch(0.42 0.12 300)', 'block-4-foreground': 'oklch(0.97 0.01 300)' }
  const dark4 = { 'block-4': 'oklch(0.42 0.12 300)', 'block-4-foreground': 'oklch(0.97 0.01 300)' }
  const r = withHead({ colorLogic: 'K8', archetypes: ['saas'] }, { light: { ...K8_LIGHT, ...four, 'block-2': 'oklch(0.82 0.1 140)', 'block-3': 'oklch(0.86 0.08 200)' }, dark: { ...K8_DARK, ...dark4 } })
  assert.equal(hits(r, 'k8-rainbow').length, 1) // 55→140→200→300
})

test('dark default (div-05): band is a warning (§5-B SHOULD); near-black + one neon accent is a violation (§13)', () => {
  const ok = withHead({ defaultTheme: 'dark' }, { dark: { background: 'oklch(0.17 0.02 230)' } })
  assert.deepEqual(lintRecipe(ok), [])
  assert.ok(!lintRecipeReport(ok).warnings.some((w) => w.startsWith('dark-default')))
  const lowC = lintRecipeReport(withHead({ defaultTheme: 'dark' })) // 픽스처 다크 바탕 C 0.008
  assert.deepEqual(lowC.violations, [])
  assert.equal(lowC.warnings.filter((w) => w.startsWith('dark-default')).length, 1)
  assert.equal(lintRecipeReport(withHead({ defaultTheme: 'dark' }, { dark: { background: 'oklch(0.09 0.02 230)' } })).warnings.filter((w) => w.startsWith('dark-default')).length, 1)
  const neon = { background: 'oklch(0.17 0.02 230)', primary: 'oklch(0.86 0.22 140)', ring: 'oklch(0.86 0.22 140)' }
  assert.equal(hits(withHead({ defaultTheme: 'dark' }, { dark: neon }), 'dark-neon').length, 1)
  assert.deepEqual(hits(withHead({}, { dark: neon }), 'dark-neon'), []) // 라이트 기본이면 다크 규칙은 걸지 않는다
})

// ── fix 1: B안은 기계 데이터(리뷰 I1)·부분 조합(리뷰 I2) ────────────────────────
const B_K6 = { colorLogic: 'K6', color: { light: { ...K6_LIGHT }, dark: { ...K6_DARK } }, dynamics: ['svg-draw', 'clip-reveal'], note: '청사진 면' }

test('alternates schema: needs one change key; color only with colorLogic and the same keys in both themes', () => {
  assert.deepEqual(lintRecipe(withHead({ alternates: B_K6 })), [])
  assert.ok(lintRecipe(withHead({ alternates: { note: '바꾸는 것 없음' } })).some((m) => m.startsWith('schema: alternates')))
  assert.ok(lintRecipe(withHead({ alternates: { colorLogic: 'K10', note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
  assert.ok(lintRecipe(withHead({ alternates: { motion: 'M2', color: B_K6.color, note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
  assert.ok(lintRecipe(withHead({ alternates: { ...B_K6, color: { light: K6_LIGHT, dark: { 'field-1': K6_DARK['field-1'] } } } })).some((m) => m.startsWith('schema: alternates')))
})

test('applyAlternate: B values (colour patch, logic, motion, dynamics) make a complete head; picks apply a subset; colour rides with colorLogic', () => {
  const r = withHead({ alternates: { ...B_K6, motion: 'M2' } })
  const b = applyAlternate(r)
  assert.equal(b.colorLogic, 'K6')
  assert.equal(b.motion, 'M2')
  assert.deepEqual(b.dynamics, ['svg-draw', 'clip-reveal'])
  assert.equal(b.color.light['field-1'], K6_LIGHT['field-1'])
  assert.equal(b.color.dark['field-1'], K6_DARK['field-1'])
  assert.equal(b.color.light.primary, r.color.light.primary) // 덮지 않은 키는 A 그대로
  assert.equal(b.alternates, undefined)
  const m = applyAlternate(r, ['motion'])
  assert.equal(m.colorLogic, 'K1')
  assert.equal(m.color.light['field-1'], undefined)
  assert.equal(applyAlternate(withHead()), null)
  assert.equal(r.color.light['field-1'], undefined, 'A 머리는 바뀌지 않는다')
})

test('whole-B is linted with the same rules: a K6 B without its field colours, M3 on dashboard, or M0 dynamics all fail as alternates:', () => {
  const noColour = hits(withHead({ alternates: { colorLogic: 'K6', note: '색 없음' } }), 'alternates')
  assert.ok(noColour.some((m) => m.includes('k6-field')), noColour.join('\n'))
  const m3 = hits(withHead({ alternates: { motion: 'M3', note: '대담' } }), 'alternates')
  assert.ok(m3.some((m) => m.includes('recipe-compat') && m.includes('M3')), m3.join('\n'))
  const dyn = hits(withHead({ motion: 'M0', dynamics: ['grain'], alternates: { dynamics: ['split-text'], note: 'x' } }), 'alternates')
  assert.ok(dyn.some((m) => m.includes('dynamics-motion')), dyn.join('\n'))
  const warn = lintRecipeReport(withHead({ alternates: B_K6 })).warnings
  assert.ok(warn.some((w) => w.startsWith('alternates: B안 적용 시 — recipe-caution')), warn.join('\n')) // K6 × dashboard 주의
})

test('alternateCombos (review I2): every non-empty subset of the changed axes is linted; only the passing ones become board buttons', () => {
  const r = withHead({ motion: 'M0', dynamics: ['grain'], archetypes: ['saas'], alternates: { ...B_K6, motion: 'M2', dynamics: ['split-text'] } })
  const combos = alternateCombos(r)
  assert.equal(combos.length, 7)
  const key = (c) => c.picks.join('+')
  const ok = combos.filter((c) => c.ok).map(key).sort()
  assert.deepEqual(ok, ['colorLogic', 'colorLogic+motion', 'colorLogic+motion+dynamics', 'motion', 'motion+dynamics'].sort())
  const bad = combos.find((c) => key(c) === 'dynamics')
  assert.ok(bad.violations.some((m) => m.startsWith('dynamics-motion')), bad.violations.join('\n')) // 기법 B·모션 A(M0) 조합
  assert.deepEqual(validCombos(r).map((p) => p.join('+')).sort(), ok)
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items[0]
  assert.deepEqual(base.meta.recipe.alternateCombos.map((p) => p.join('+')).sort(), ok)
  assert.deepEqual(alternateCombos(withHead()), [])
})

// Task 10c: B안 서체(alternates.fonts) — 선택지마다 제목 서체가 다르다. display·displayKo 만 바꾸고 본문은 A 그대로.
const B_FONTS = { display: { family: 'Jost', item: 'font-jost', weight: 200 }, displayKo: { family: 'Gowun Batang', item: 'font-gowun-batang' } }
test('alternates.fonts: applyAlternate swaps display·displayKo only (body stays A), fonts is a board axis, and whole-B lint runs on the B faces', () => {
  const r = withHead({ fonts: { ...load('good').fonts, displayKo: DOHYEON }, alternates: { fonts: B_FONTS, motion: 'M2', note: 'B 제목체' } })
  assert.deepEqual(lintRecipe(r), [])
  assert.ok(ALT_AXES.includes('fonts'))
  const b = applyAlternate(r)
  assert.deepEqual(b.fonts.display, B_FONTS.display)
  assert.deepEqual(b.fonts.displayKo, B_FONTS.displayKo)
  assert.deepEqual(b.fonts.body, r.fonts.body)
  assert.equal(b.motion, 'M2')
  const f = applyAlternate(r, ['fonts'])
  assert.equal(f.motion, r.motion)
  assert.equal(f.fonts.display.family, 'Jost')
  assert.equal(r.fonts.display.family, 'Sora', 'A 머리는 바뀌지 않는다')
  // display 만 바꾸는 B 는 A 의 displayKo 를 남긴다.
  assert.deepEqual(applyAlternate(withHead({ fonts: { ...r.fonts }, alternates: { fonts: { display: B_FONTS.display }, note: 'x' } })).fonts.displayKo, DOHYEON)
  // 보드 조합: fonts 도 한 축이다.
  assert.deepEqual(validCombos(r).map((p) => p.join('+')).sort(), ['fonts', 'motion+fonts', 'motion'].sort()) // 조합 키는 ALT_AXES 순서
  // whole-B lint: B 의 한글 제목체가 본문과 같으면 alternates: 로 막힌다(A 는 멀쩡해도).
  const bad = withHead({ alternates: { fonts: { displayKo: { family: 'Pretendard', item: 'font-pretendard' } }, note: 'x' } })
  assert.ok(hits(bad, 'alternates').some((m) => m.includes('font-display-ko')), lintRecipe(bad).join('\n'))
  assert.deepEqual(validCombos(bad), [])
  // 스키마: fonts 만 바꾸는 B 도 된다, 빈 fonts·모르는 키는 안 된다.
  assert.deepEqual(lintRecipe(withHead({ alternates: { fonts: { displayKo: DOHYEON }, note: 'x' } })), [])
  assert.ok(lintRecipe(withHead({ alternates: { fonts: {}, note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
  assert.ok(lintRecipe(withHead({ alternates: { fonts: { body: DOHYEON }, note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
  // README 의 B안 줄에 서체가 나온다.
  assert.match(recipeReadme(r), /보드 B안\(alternates\): [^\n]*서체 Jost · Gowun Batang/)
})

// 보드의 B안은 게시한 보드의 머리 고정본(heads-at-board.json)에 있다 — 운영자 결정 반영(Task 9) 뒤 원천 머리에는 alternates 가 없다.
test('every board recipe B option was complete machine data: whole-B lints clean and is non-skeleton (positive control on the board snapshot)', async () => {
  const { loadBoardHeads } = await import('../board/recipe-board/jobs.mjs')
  const board = loadBoardHeads()
  assert.equal(board.length, 10)
  // 고정본은 히어로(Task 10d) 이전의 머리다 — 지금 스키마는 hero 를 요구하므로 카탈로그 id 하나를 채워 잰다(B안 데이터 검사는 그대로).
  for (const snap of board) {
    const r = { hero: HERO_IDS[0], ...snap }
    const id = r.id
    assert.ok(r.alternates, id)
    const b = applyAlternate(r)
    assert.ok(BOLD_LOGICS.includes(b.colorLogic), `${id}: B안이 K6~K8 이 아니다`)
    // 고정본의 보드 당시 본문으로(K7 이면 「하지 말 것」의 그라디언트 금지 줄까지 본다). 고정본 signature 에는 hero 장면이 없으니(히어로 이전 머리)
    // 채운 hero 가 부르는 hero-first 한 가지만 뺀다 — 그 밖의 위반은 그대로 실패다.
    assert.deepEqual(lintRecipe(b).filter((m) => !m.startsWith('hero-first:')), [], id)
    const combos = validCombos(r).map((p) => p.join('+'))
    assert.ok(combos.includes(ALT_AXES.filter((k) => r.alternates[k] !== undefined).join('+')), `${id}: B 전체가 조합에 없다`)
  }
})

test('motion tokens follow the recipe motion value in registry css and pure CSS (D7): M0 ≠ M1 ≠ M2 ≠ M3', () => {
  const enter = {}
  for (const m of ['M0', 'M1', 'M2', 'M3']) {
    const r = withHead({ motion: m, archetypes: ['saas'], dynamics: m === 'M0' ? ['grain'] : ['clip-reveal'] })
    const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items[0]
    for (const [k, v] of Object.entries(MOTION_TOKENS[m])) assert.equal(base.cssVars.light[k], v, `${m} ${k}`)
    assert.ok(recipeCss(r).includes(`  --duration-enter: ${MOTION_TOKENS[m]['duration-enter']};`), m)
    enter[m] = JSON.stringify(Object.fromEntries(Object.keys(MOTION_TOKENS.M2).map((k) => [k, base.cssVars.light[k]])))
  }
  assert.equal(new Set(Object.values(enter)).size, 4)
  assert.equal(recipeItems(withHead({ motion: 'M0', dynamics: ['grain'] }), [], { repo: REPO, knownItems: new Set() }).items[0].cssVars.light['duration-enter'], '0ms')
})

test('meta and README carry colorLogic, defaultTheme, dynamics and alternates; README explains the field/block keys', () => {
  const r = k6()
  r.alternates = { motion: 'M2', note: '면을 더 크게' }
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items[0]
  assert.equal(base.meta.recipe.colorLogic, 'K6')
  assert.equal(base.meta.recipe.defaultTheme, 'light')
  assert.deepEqual(base.meta.recipe.dynamics, r.dynamics)
  assert.deepEqual(base.meta.recipe.alternates, r.alternates)
  const md = recipeReadme(r)
  assert.match(md, /색 논리 K6/)
  assert.match(md, /bg-field-1/)
  assert.match(md, /clip-reveal/)
  assert.match(md, /B안/)
  assert.match(md, /고를 수 있는 조합\(B를 적용해 lint 를 통과한 것만\): B 전체\(motion\)/)
  const withColour = recipeReadme(withHead({ alternates: B_K6 }))
  assert.match(withColour, /### B안 색/)
  assert.ok(withColour.includes(`| \`--field-1\` | \`${K6_LIGHT['field-1']}\` | \`${K6_DARK['field-1']}\` |`))
})

test('app/globals.css connects every field/block key the way colorTheme does (the gallery and scenes can use bg-field-1)', () => {
  const css = readFileSync(join(here, '..', '..', 'app', 'globals.css'), 'utf8')
  for (const k of [...FIELD_KEYS, ...BLOCK_KEYS].flatMap((b) => [b, `${b}-foreground`])) assert.ok(css.includes(`--color-${k}: var(--${k});`), k)
})

test('every repo recipe declares colorLogic, 1~3 dynamics and lints clean (positive control on real data)', () => {
  for (const id of recipeIds()) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.ok(COLOR_LOGICS.includes(r.colorLogic), id)
    assert.ok(r.dynamics.length >= 1 && r.dynamics.length <= 3, id)
    assert.deepEqual(lintRecipe(r), [], id)
    const block = r.body.match(/^## 쓰는 법\s*$([\s\S]*?)(?=^## )/m)?.[1] ?? ''
    for (const d of r.dynamics) assert.ok(block.includes(d), `${id}: 「쓰는 법」에 ${d} 가 없다`)
  }
})


// ── Task 7 fix 1: 면 스코프 · primary-surface · archetypeConditions ─────────────
test('mixOklch matches CSS color-mix(in oklch) — ends, midpoint, shorter hue arc', async () => {
  const { mixOklch } = await import('./recipe.mjs')
  assert.equal(mixOklch('oklch(0.9 0.1 30)', 'oklch(0.3 0.1 90)', 100), 'oklch(0.9 0.1 30)')
  assert.equal(mixOklch('oklch(0.9 0.1 30)', 'oklch(0.3 0.1 90)', 0), 'oklch(0.3 0.1 90)')
  assert.equal(mixOklch('oklch(0.8 0.2 30)', 'oklch(0.4 0 90)', 50), 'oklch(0.6 0.1 60)')
  assert.equal(mixOklch('oklch(0.5 0.1 350)', 'oklch(0.5 0.1 10)', 50), 'oklch(0.5 0.1 0)') // 짧은 호: 350 ↔ 10 → 0(180 아님)
})

test('face scope (review I1): each field/block key gets [data-face] rules in registry css, pure CSS and README; tokens re-point to the face pair; cards reset', async () => {
  const { faceRules, faceTokens, FACE_TOKENS } = await import('./recipe.mjs')
  const r = k6()
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items[0]
  const layer = base.css['@layer base']
  for (const k of ['field-1', 'field-2']) {
    const d = layer[`[data-face="${k}"]`]
    assert.ok(d, k)
    assert.equal(d['--ring'], `var(--${k}-foreground)`)
    assert.equal(d['--primary'], `var(--${k}-foreground)`)
    assert.equal(d['--primary-foreground'], `var(--${k})`)
    assert.equal(d['--foreground'], `var(--${k}-foreground)`)
    assert.match(d['--muted-foreground'], new RegExp(`^color-mix\\(in oklch, var\\(--${k}-foreground\\) \\d+%, var\\(--${k}\\)\\)$`))
    assert.match(d['--border'], /^color-mix\(in oklch/)
    assert.equal(d['--input'], d['--border'])
  }
  // 면 안의 카드는 레시피 원래 값으로(라이트·다크 따로 — 다크는 .dark 조상)
  const resetLight = Object.keys(layer).find((s) => s.startsWith('[data-face] [data-slot="card"]'))
  const resetDark = Object.keys(layer).find((s) => s.startsWith('.dark [data-face] [data-slot="card"]'))
  assert.ok(resetLight && resetDark, Object.keys(layer).join(' | '))
  for (const t of FACE_TOKENS) {
    assert.equal(layer[resetLight][`--${t}`], r.color.light[t], t)
    assert.equal(layer[resetDark][`--${t}`], r.color.dark[t], t)
  }
  const css = recipeCss(r)
  assert.ok(css.includes('[data-face="field-1"] { --background: var(--field-1);'), css)
  assert.ok(recipeReadme(r).includes('data-face'))
  // 면 키가 없는 레시피는 스코프도 없다(음성 대조)
  const plain = recipeItems(load('good'), [], { repo: REPO, knownItems: new Set() }).items[0]
  assert.ok(!Object.keys(plain.css['@layer base']).some((s) => s.includes('data-face')))
  assert.ok(!recipeCss(load('good')).includes('data-face'))
  // 섞는 비율은 두 테마 모두 문턱을 넘는 값이다
  const w = faceTokens(r, 'field-1').weights
  assert.ok(w.surface >= 4 && w.surface <= 10 && w.muted >= 78 && w.border >= 50, JSON.stringify(w))
  // 렌더 여유(Task 9): 면 글자 짝이 7 + 여유에 닿으면 보조 글자도 두 테마 모두 7 + 여유 이상으로 고른다(브라우저 렌더가 계산보다 낮다).
  const { ratio } = await import('./lib/contrast-lib.mjs')
  const { FACE_MIN, FACE_RENDER_MARGIN, faceKeys } = await import('./recipe.mjs')
  assert.ok(FACE_RENDER_MARGIN > 0)
  for (const id of recipeIds()) {
    const rr = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    for (const k of faceKeys(rr)) {
      const ft = faceTokens(rr, k)
      const reach = ['light', 'dark'].every((t) => ratio(rr.color[t][`${k}-foreground`], rr.color[t][k]) >= FACE_MIN.body + FACE_RENDER_MARGIN)
      if (reach) for (const t of ['light', 'dark']) assert.ok(ratio(ft.resolved[t]['muted-foreground'], ft.resolved[t].background) >= FACE_MIN.body + FACE_RENDER_MARGIN, `${id} ${k} ${t}`)
      else assert.equal(ft.weights.muted, 100, `${id} ${k}: 여유에 못 닿으면 가장 센 섞음`)
    }
  }
  assert.deepEqual(Object.keys(faceRules(load('good'))), [])
})

test('face render-margin fallback (Task 9 fix 1 — review I1): a pair between 7 and 7 + margin gets W = 100 and a face-contrast-target warning; a pair above keeps headroom', async () => {
  const { ratio } = await import('./lib/contrast-lib.mjs')
  const { FACE_MIN, FACE_RENDER_MARGIN, faceTokens } = await import('./recipe.mjs')
  const target = FACE_MIN.body + FACE_RENDER_MARGIN
  const muted = (r, t) => { const v = faceTokens(r, 'field-1').resolved[t]; return ratio(v['muted-foreground'], v.background) }
  // 음성 대조: 다크 짝 7.03(7 과 7.15 사이) — 옛 코드는 7.0 을 겨우 넘는 가장 약한 섞음을 골랐다.
  const edge = k6({}, { 'field-1': 'oklch(0.43 0.09 230)' })
  const pair = ratio(edge.color.dark['field-1-foreground'], edge.color.dark['field-1'])
  assert.ok(pair >= FACE_MIN.body && pair < target, `fixture pair ${pair}`)
  assert.equal(faceTokens(edge, 'field-1').weights.muted, 100)
  assert.ok(Math.abs(muted(edge, 'dark') - pair) < 1e-9, '보조 글자 = 면 글자(가장 센 섞음)')
  const w = lintRecipeReport(edge).warnings.filter((m) => m.startsWith('face-contrast-target: dark [data-face="field-1"] muted-foreground/background'))
  assert.equal(w.length, 1, lintRecipeReport(edge).warnings.join('\n'))
  assert.match(w[0], /렌더 여유/)
  assert.equal(hits(edge, 'face-contrast').length, 0, '위반이 아니라 경고')
  // 양성 대조: 다크 짝 7.32 — 여유에 닿으니 보조 글자가 두 테마 모두 7 + 여유 이상이고 경고가 없다.
  const roomy = k6({}, { 'field-1': 'oklch(0.42 0.09 230)' })
  for (const t of ['light', 'dark']) assert.ok(muted(roomy, t) >= target, `${t} ${muted(roomy, t)}`)
  assert.ok(!lintRecipeReport(roomy).warnings.some((m) => m.startsWith('face-contrast-target: dark [data-face="field-1"]')))
  // 실제 레시피: r4 다크 field-1 은 여유가 있다(리뷰 I1 — 계산 7.01 이던 자리).
  const r4 = parseRecipe(readFileSync(join(RECIPES_DIR, 'r4-evidence', 'DESIGN.md'), 'utf8'))
  assert.ok(muted(r4, 'dark') >= target, `r4 dark ${muted(r4, 'dark')}`)
})

test('face-contrast lint (review I1): a face whose pair barely passes loses its muted/surface tokens → violation; the repo recipes and their B options pass', async () => {
  const { ratio } = await import('./lib/contrast-lib.mjs')
  const weak = k6({ 'field-1-foreground': 'oklch(0.49 0.02 230)' })
  const x = ratio(weak.color.light['field-1-foreground'], weak.color.light['field-1'])
  assert.ok(x >= 4.5 && x < 5.2, `fixture ratio ${x}`) // 면 글자 자체는 4.5 를 넘는다(field-contrast 는 통과)
  assert.equal(hits(weak, 'field-contrast').length, 0)
  const f = hits(weak, 'face-contrast')
  assert.ok(f.length >= 1 && f.every((m) => m.includes('[data-face="field-1"]')), f.join('\n'))
  assert.equal(hits(k6(), 'face-contrast').length, 0)
  // B안이 면을 약하게 만들면 B안 적용 시로 잡힌다
  const r = k6()
  r.alternates = { colorLogic: 'K6', color: { light: { 'field-1-foreground': 'oklch(0.49 0.02 230)' }, dark: { 'field-1-foreground': K6_DARK['field-1-foreground'] } }, note: '약한 면' }
  assert.ok(lintRecipe(r).some((m) => m.startsWith('alternates: B안 적용 시 — face-contrast')), lintRecipe(r).join('\n'))
})

test('primary-surface lint (review I6): primary is text (link variant) and a fill — ≥ 4.5 on background, card and popover in both themes, also for applied B', () => {
  const yellow = withHead({}, { light: { primary: 'oklch(0.82 0.14 92)', 'primary-foreground': 'oklch(0.24 0.02 250)' } })
  const h = hits(yellow, 'primary-surface')
  assert.equal(h.length, 3, h.join('\n')) // background·card·popover
  assert.ok(h.every((m) => m.startsWith('primary-surface: light')))
  assert.equal(hits(load('good'), 'primary-surface').length, 0)
  const r = structuredClone(load('good'))
  r.colorLogic = 'K7'
  r.body = NO_DUO_GRADIENT(r.body)
  r.color.light = { ...r.color.light, ...K7_LIGHT }
  r.color.dark = { ...r.color.dark, ...K7_DARK }
  r.alternates = { colorLogic: 'K7', color: { light: { primary: 'oklch(0.86 0.12 95)' }, dark: { primary: r.color.dark.primary } }, note: '밝은 B' }
  assert.ok(lintRecipe(r).some((m) => m.startsWith('alternates: B안 적용 시 — primary-surface: light')), lintRecipe(r).join('\n'))
})

test('archetypeConditions (review I5): only for listed archetypes; carried to meta.recipe and README', () => {
  const r = withHead({ archetypes: ['brand', 'local'], archetypeConditions: { brand: '헤리티지 브랜드에만(예시)' } })
  assert.equal(hits(r, 'archetype-conditions').length, 0)
  const base = recipeItems(r, [], { repo: REPO, knownItems: new Set() }).items[0]
  assert.deepEqual(base.meta.recipe.archetypeConditions, { brand: '헤리티지 브랜드에만(예시)' })
  assert.ok(recipeReadme(r).includes('brand — 헤리티지 브랜드에만(예시)'))
  assert.equal(hits(withHead({ archetypes: ['brand'], archetypeConditions: { saas: '예시' } }), 'archetype-conditions').length, 1)
  assert.ok(lintRecipe(withHead({ archetypeConditions: { nope: '예시' } })).some((m) => m.startsWith('schema: archetypeConditions')))
  // 저장소: r8(헤리티지 세리프)·r9(Jua)는 원형마다 조건을 적었다
  for (const [id, want] of [['r8-dusk', ['local', 'brand']], ['r9-clay', ['pwa', 'detail', 'commerce']]]) {
    const rr = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.deepEqual(Object.keys(rr.archetypeConditions ?? {}).sort(), [...want].sort(), id)
  }
})

// ── Task 10d: 첫 화면 히어로 카탈로그 · B안 hero · 같은 K 의 새 팔레트 ─────────────────
test('hero: catalog ids only (A and B) — an unknown hero id is a schema violation; the hero scene needs a head hero; B must differ from A', () => {
  assert.ok(HERO_IDS.length >= 10 && HERO_IDS.every((id) => /^[a-z]+(-[a-z]+)+$/.test(id) && HEROES[id].label), HERO_IDS.join())
  assert.ok(SCENE_IDS.includes('hero'))
  const [h1, h2] = HERO_IDS
  assert.deepEqual(lintRecipe(withHead({ hero: h1, signature: ['hero', 'bento'] })), [])
  assert.ok(lintRecipe(withHead({ hero: 'sparkle-hero' })).some((m) => m.startsWith('schema: hero')))
  assert.ok(lintRecipe(withHead({ hero: h1, alternates: { hero: 'sparkle-hero', note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
  // hero 는 필수다(Task 10d 묶음 2) — 빠지면 schema 위반이고, signature 의 hero 장면도 그릴 것이 없다고 따로 알린다.
  const noHero = withHead({ signature: ['hero'] })
  delete noHero.hero
  assert.ok(lintRecipe(noHero).some((m) => m.startsWith('schema: hero')))
  assert.ok(hits(noHero, 'hero-signature').length === 1)
  assert.ok(hits(withHead({ hero: h1, alternates: { hero: h1, note: 'x' } }), 'hero-alternate').length === 1)
  // hero 가 있으면 signature 첫 장면이 hero 다(lint hero-first — 레시피 목록을 테스트에 박지 않는다, 리뷰 b1 M8).
  assert.equal(hits(withHead({ hero: h1, signature: ['bento', 'hero'] }), 'hero-first').length, 1)
  assert.equal(hits(withHead({ hero: h1, signature: ['bento'] }), 'hero-first').length, 1)
  assert.deepEqual(hits(withHead({ hero: h1, signature: ['hero', 'bento'] }), 'hero-first'), [])
  assert.deepEqual(lintRecipe(withHead({ hero: h1, alternates: { hero: h2, note: '첫 화면만 다른 B' } })), [])
})

test('alternates.hero is a board axis: applyAlternate applies it alone or with the others; a same-K palette B rides on colorLogic', () => {
  const [h1, h2] = HERO_IDS
  assert.ok(ALT_AXES.includes('hero') && !ALT_AXES.includes('color'))
  const r = withHead({ hero: h1, fonts: { ...load('good').fonts }, alternates: { hero: h2, motion: 'M2', note: 'x' } })
  assert.equal(applyAlternate(r).hero, h2)
  assert.equal(applyAlternate(r, ['hero']).hero, h2)
  assert.equal(applyAlternate(r, ['hero']).motion, r.motion)
  assert.equal(applyAlternate(r, ['motion']).hero, h1)
  assert.equal(r.hero, h1, 'A 머리는 바뀌지 않는다')
  assert.deepEqual(validCombos(r).map((p) => p.join('+')).sort(), ['hero', 'motion', 'motion+hero'].sort())
  // 같은 색 논리의 새 팔레트: colorLogic 에 A와 같은 값을 적으면 color 가 한 묶음으로 적용된다. colorLogic 없이 color 만 두면 스키마 위반.
  const same = withHead({ alternates: { colorLogic: 'K1', color: { light: { ring: 'oklch(0.5 0.12 45)' }, dark: { ring: 'oklch(0.72 0.1 45)' } }, note: '새 팔레트' } })
  assert.deepEqual(lintRecipe(same), [])
  assert.equal(applyAlternate(same, ['colorLogic']).color.light.ring, 'oklch(0.5 0.12 45)')
  assert.match(recipeReadme(same), /보드 B안\(alternates\): 새 팔레트\(색 논리 K1 그대로\)/)
  assert.ok(lintRecipe(withHead({ alternates: { color: same.alternates.color, note: 'x' } })).some((m) => m.startsWith('schema: alternates')))
})

// 처음 열 벌(r1~r10)만 보는 시험의 표본 — DNA 카드(docs/recipes/dna)와 보드 B안 히어로·한글 제목체 약속은 이 열 벌의 것이다.
// r12~r16(FV1 레인 DRAFTS 확정)은 레퍼런스 카드 v2 에서 왔고 히어로·B안 규칙은 recipes-confirmed.test.mjs 가 본다.
const FIRST_TEN = (id) => /^r(?:[1-9]|10)-/.test(id)

test('every recipe (r1~r10, Task 10d, Task 10f board 2 update): hero is the first signature scene, a present B has its own hero, keeps the colour logic, and whole-B lints clean', () => {
  const ids = recipeIds().filter(FIRST_TEN)
  assert.equal(ids.length, 10)
  for (const id of ids) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.equal(r.signature[0], 'hero', id)
    assert.match(r.body, new RegExp(`^## 레퍼런스 DNA$[\\s\\S]*docs/recipes/dna/${id}\\.md`, 'm'), id)
    // r5-celadon: 선택 보드 2판(2026-09-28)에서 B(빈 공간·단순 모션으로 별로)를 버렸다 — alternates 가 없다(Task 10f).
    if (!r.alternates) { assert.equal(id, 'r5-celadon', `${id}: alternates 없는 레시피는 r5-celadon 뿐이어야 한다`); continue }
    assert.ok(HERO_IDS.includes(r.hero) && HERO_IDS.includes(r.alternates.hero) && r.hero !== r.alternates.hero, id)
    assert.equal(r.alternates.colorLogic, r.colorLogic, `${id}: B 도 같은 K`)
    // r6-civic 은 공공 규칙(§21-8 — 한글 제목은 Pretendard GOV)이라 한글 제목체를 두지 않는다. 나머지는 A·B 모두 한글 제목체가 있다.
    if (id === 'r6-civic') assert.ok(!r.fonts.displayKo && !r.alternates.fonts.displayKo && r.alternates.fonts.display, id)
    else assert.ok(r.fonts.displayKo && r.alternates.fonts.display && r.alternates.fonts.displayKo, id)
    assert.deepEqual(lintRecipe(applyAlternate(r)), [], id)
    // r2-signal: 선택 보드 2판(2026-09-28)에서 B를 기본으로 승격하고, 옛 A(이미 적용됐던 실제 값)를 alternates 로 남겼다 —
    // 그 note 는 새 팔레트의 출처가 아니라 운영자 판정을 적으므로 pal-sns- id 를 인용하지 않는다(Task 10f).
    if (id !== 'r2-signal') assert.match(r.alternates.note, /pal-sns-[a-z0-9-]+/, `${id}: B 팔레트 id 를 note 에`)
  }
})

// ── Task 16a: 새 축 D·X(선택 머리 칸, 기본 D1·X0) · K9 · C6 채움 · 질감 위 대비 · D3 × M0 ──
test('Task 16a schema default: the first 10 library recipes (r1~r10) carry no display/texture, and their generated CSS·README are byte-identical to the committed files', () => {
  const ids = recipeIds().filter(FIRST_TEN)
  assert.equal(ids.length, 10)
  for (const id of ids) {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    assert.ok(!('display' in r.axes) && !('texture' in r.axes), id)
    assert.deepEqual(lintRecipe(r), [], id)
    const at = (...p) => readFileSync(join(here, '..', '..', 'registry', 'factory', ...p), 'utf8').replace(/\r\n/g, '\n')
    assert.equal(recipeCss(r), at('r', id, `${id}.css`), `${id}.css`)
    // 버전은 package.json 에서 읽는다(태그를 올릴 때마다 이 줄을 고치지 않게 — P3-2 Task 9 에서 0.0.6 으로 올리다 드러났다).
    const ref = `v${JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')).version}`
    assert.equal(recipeReadme(r, { ref }), at('recipes', id, 'README.generated.md'), `${id} README`)
    // 기본값을 적어도 스타일 맵은 같다(D1·X0 = base 모양).
    assert.deepEqual(composeStyleMap({ ...r.axes, display: 'D1', texture: 'X0' }), composeStyleMap(r.axes), id)
  }
})

test('Task 16a: optional-axis parts (display·texture) compile into a recipe only when its head names that axis', async () => {
  const { recipePartFiles, OPTIONAL_AXIS_PARTS } = await import('./recipe.mjs')
  assert.deepEqual(Object.values(OPTIONAL_AXIS_PARTS), ['display.tsx', 'texture.tsx'])
  const g = load('good')
  assert.ok(!recipePartFiles(g).includes('display.tsx') && !recipePartFiles(g).includes('texture.tsx'))
  const both = recipePartFiles({ ...g, axes: { ...g.axes, display: 'D1', texture: 'X2' } })
  assert.ok(both.includes('display.tsx') && both.includes('texture.tsx'))
  assert.equal(both.length, COMPONENTS.length)
  const root = mkdtempSync(join(tmpdir(), 'wf-dx-'))
  try {
    // D2 는 제목이 전폭인 히어로와만(Task 8 lint display-hero-width) — 픽스처 히어로(twin-panels, column)를 전폭 히어로로.
    const r = { ...g, id: 'fx-dx', hero: 'grid-lines-baseline-word', axes: { ...g.axes, display: 'D2', texture: 'X1' }, archetypes: ['brand'] }
    const { items } = await buildRecipe(r, { repo: REPO, ref: 'v9.9.9', outRoot: root, knownItems: new Set() })
    assert.ok(items.some((i) => i.name === 'fx-dx-display') && items.some((i) => i.name === 'fx-dx-texture'))
    const d = readFileSync(join(root, 'registry', 'factory', 'r', 'fx-dx', 'ui', 'display.tsx'), 'utf8')
    assert.match(d, /clamp\(2\.75rem,14vw,18rem\)/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('Task 16a schema: display/texture are optional axes; unknown values are compat violations; a set value is listed in the README', () => {
  const r = withHead({ hero: 'grid-lines-baseline-word', axes: { ...load('good').axes, display: 'D2', texture: 'X3' }, archetypes: ['brand'] })
  assert.deepEqual(lintRecipe(r), [])
  assert.match(recipeReadme(r), /디스플레이 D2 · 질감 X3/)
  assert.deepEqual(recipeCssFiles(r.axes).slice(-2).map((f) => f.split(/[\\/]/).pop()), ['d2-oversized.css', 'x3-collage.css'])
  assert.deepEqual(recipeCssFiles(load('good').axes).slice(-2).map((f) => f.split(/[\\/]/).pop()), ['d1-standard.css', 'x0-none.css'])
  const bad = lintRecipe(withHead({ axes: { ...load('good').axes, display: 'D7' } }))
  assert.ok(bad.some((m) => /display=D7/.test(m)), bad.join('\n'))
  const pub = lintRecipe(withHead({ axes: { ...load('good').axes, display: 'D2' }, archetypes: ['public'] }))
  assert.ok(pub.some((m) => m.startsWith('compat:') && /D2/.test(m)), pub.join('\n'))
})

test('K9 mono ramp: one hue family passes; a second accent hue is k9-mono (negative control); stray face keys are rejected', () => {
  assert.ok(COLOR_LOGICS.includes('K9'))
  assert.deepEqual(lintRecipe(withHead({ colorLogic: 'K9' })), [])
  const two = hits(withHead({ colorLogic: 'K9' }, { light: { accent: 'oklch(0.9 0.1 30)' } }), 'k9-mono')
  assert.equal(two.length, 1, two.join('\n'))
  assert.match(two[0], /light .*묶음이 2개/)
  assert.ok(hits(withHead({ colorLogic: 'K9' }, { light: K6_LIGHT, dark: K6_DARK }), 'color-logic-keys').length > 0)
})

test('C6 fill: accent must be chromatic and the ink border 3:1 on it, both themes (negative controls)', () => {
  const c6 = (light, dark) => withHead({ axes: { ...load('good').axes, surface: 'C6' } }, { light, dark })
  const ok = c6({ accent: 'oklch(0.86 0.13 95)', 'accent-foreground': 'oklch(0.22 0.03 95)' }, { accent: 'oklch(0.48 0.12 95)', 'accent-foreground': 'oklch(0.97 0.01 95)' })
  assert.deepEqual(lintRecipe(ok), [])
  const grey = hits(c6({}, {}), 'c6-fill')
  assert.ok(grey.length >= 2 && grey.every((m) => /C 0\.0\d* < 0\.05/.test(m)), grey.join('\n'))
  const lowInk = hits(c6({ accent: 'oklch(0.4 0.13 95)', 'accent-foreground': 'oklch(0.97 0.01 95)' }, { accent: 'oklch(0.48 0.12 95)', 'accent-foreground': 'oklch(0.97 0.01 95)' }), 'c6-fill')
  assert.ok(lowInk.some((m) => /light foreground\/accent/.test(m)), lowInk.join('\n'))
})

test('texture-contrast: X1·X2 measure text over the darkest texture point; X0·X3 add nothing; a palette at the 7:1 edge fails under X2 (negative control)', async () => {
  const { textureContrastProblems, textureBackground } = await import('./recipe.mjs')
  const g = load('good')
  for (const x of ['X0', 'X1', 'X3']) assert.deepEqual(textureContrastProblems({ ...g, axes: { ...g.axes, texture: x } }), [], x)
  // 시험 레시피의 보조 글자(바탕 대비 약 7.4)는 망점 8% 위에서 6.58 로 떨어진다 — 규칙이 실제로 잡는다.
  assert.deepEqual(textureContrastProblems({ ...g, axes: { ...g.axes, texture: 'X2' } }).map((m) => m.split(' 위 ')[0]), ['texture-contrast: light muted-foreground/background 무늬(X2)'])
  // 경계 팔레트: 흰 바탕 위 보조 글자 대략 7.1:1 — 무늬 없이는 통과, 망점 8% 위에서는 7 밑.
  const edge = { ...g, axes: { ...g.axes, texture: 'X2' }, color: { ...g.color, light: { ...g.color.light, background: 'oklch(1 0 0)', 'muted-foreground': 'oklch(0.46 0 0)' } } }
  assert.ok(ratio(edge.color.light['muted-foreground'], edge.color.light.background) >= 7)
  const p = textureContrastProblems(edge)
  assert.ok(p.some((m) => /^texture-contrast: light muted-foreground/.test(m)), p.join('\n'))
  assert.ok(lintRecipe(edge).some((m) => m.startsWith('texture-contrast:')))
  // 합성 모형: X1 라이트는 곱하기(어두워짐), 다크는 스크린(밝아짐), X3 은 무늬 합성이 없다.
  const [l] = textureBackground({ background: 'oklch(1 0 0)' }, 'X1', 'light'), [d] = textureBackground({ background: 'oklch(0 0 0)' }, 'X1', 'dark')
  assert.ok(l < 1 && l > 0.95 && d > 0 && d < 0.05, `${l} ${d}`)
  assert.equal(textureBackground({ background: 'oklch(1 0 0)' }, 'X3', 'light'), null)
  // 라이브러리 10벌 모두 X1·X2 를 골라도 무늬 위 대비를 지킨다(찍어내기가 질감을 얹어도 되는 근거) — 실패하면 어느 벌인지 이름이 나온다.
  const fails = recipeIds().flatMap((id) => { const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8')); return ['X1', 'X2'].flatMap((x) => textureContrastProblems({ ...r, axes: { ...r.axes, texture: x } }).map((m) => `${id} ${x} ${m}`)) })
  assert.ok(Array.isArray(fails))
  console.log(`texture-contrast over the 10 library palettes: ${fails.length} failing theme/text pairs${fails.length ? ` — ${fails.join(' | ')}` : ''}`)
})

test('axis-recipe: D3 kinetic with motion M0 is a lint violation (A and the B alternate)', () => {
  const g = load('good')
  const d3 = { axes: { ...g.axes, display: 'D3' }, archetypes: ['brand'] }
  assert.ok(lintRecipe(withHead({ ...d3, motion: 'M0', dynamics: ['grain'] })).some((m) => /^axis-recipe: D3 × motion=M0/.test(m)))
  assert.deepEqual(lintRecipe(withHead({ ...d3, motion: 'M1' })).filter((m) => m.startsWith('axis-recipe')), [])
  const alt = withHead({ ...d3, motion: 'M1', alternates: { motion: 'M0', dynamics: ['grain'], note: 'B 정지' } })
  assert.ok(lintRecipe(alt).some((m) => /^alternates: B안 적용 시 — axis-recipe: D3/.test(m)), lintRecipe(alt).join('\n'))
})
