// 스타일 프리셋 — 찍어내기(P3-3) ② 「새 조합」이 부르는 입구(P3-2 Task 16a, 접합면 J4·J5). 재료 풀 = 스타일 사전(references/styles/styles.json 의
// allow·allow-with-rules 스타일) + 검증된 레시피 10벌을 분해한 것(대표 2026-09-29 「검증된 레시피에 사용된 스타일 종류와 팔레트, 서체도 포함해」).
//
//   recipeToMaterials(recipeHead)            → { preset, palette, fontPair } — 레시피 머리 하나를 재료 셋으로 분해(source "recipe:<id>"). 승격된 레시피도 같은 길로 풀에 든다.
//   listPresets({ archetype, source })       → rank_score × 원형 적합도(fit) 순 프리셋 목록(각 원소에 fit·score·novelty)
//   presetToRecipeHead(preset, palette, fonts) → lintRecipe 를 통과하는 레시피 초안 머리(+ 본문 초안 body). (recipeToMaterials(r)) 한 인자로도 받는다.
//   pickPalettes(preset, { archetype, n })   → 프리셋에 맞는 팔레트 후보(use "recipe" 부분집합 안에서만 순위 — 전체 순위 위쪽은 decor-only 수상 팔레트다)
//   hintPair(preset)                         → 프리셋 서체 힌트(references/fonts id)에서 만든 서체 짝(키트 항목만)
//   derivePalette(palette, { colorLogic, axes }) → 역할 몇 개뿐인 팔레트에서 레시피 색 두 벌(light·dark, COLOR_KEYS 전부 + K6~K8 면·칸 키)
//
// 새로움(novelty, Q7 ③ 「과감한 안 = 생성 중 새로움 점수가 가장 높은 것」): 프리셋의 11개 속성(축 9 = B·I·C·T·H·R·S·D·X + motion + colorLogic 첫 값)을
// 라이브러리 레시피 10벌과 하나씩 비교해 다른 속성의 비율을 내고, 그중 가장 가까운 레시피와의 값(최솟값)을 쓴다. 0 = 라이브러리 레시피와 같은 조합,
// 1 = 모든 레시피와 11개 모두 다름. 머리에 없는 D·X 는 기본값(D1·X0)으로 비교한다. 레시피에서 나온 프리셋은 자기 자신과 같아 0 이다.
//
// 만드는 곳(생성물): factory/scripts/build-presets.mjs(gen:all) → references/styles/presets.json · references/palettes/recipe-derived.json ·
// references/fonts/pairs.json. palettes.json 은 build-palettes.mjs 가 recipe-derived.json 을 입력으로 받아 싣는다(손으로 고치면 다음 빌드가 지운다).
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AXIS_ORDER, AXIS_DEFAULTS, axisValue } from './axes.mjs'
import { checkCompat, checkRecipeRules, COMPAT } from './compat.mjs'
import {
  lintRecipe, mixOklch, dynamicsAllowed, recipeIds, parseRecipe, kitFont,
  LINE_VALUES, C6_FILL, TEXTURE_ALPHA, textureContrastProblems,
} from './recipe.mjs'
import { ratio, oklchToLinearSrgb } from './lib/contrast-lib.mjs'
import { hexToOklch, hueDist, ACCENT_C } from './lib/palette-lib.mjs'
import { parseOklch, tailwindCopy, isCreamBackground, FIELD_CREAM, DUO } from './lib/palette-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PRESETS_FILE = join(ROOT, 'references', 'styles', 'presets.json')
export const RECIPE_PALETTES_FILE = join(ROOT, 'references', 'palettes', 'recipe-derived.json')
export const PALETTES_FILE = join(ROOT, 'references', 'palettes', 'palettes.json')
export const PAIRS_FILE = join(ROOT, 'references', 'fonts', 'pairs.json')
export const FONTS_FILE = join(ROOT, 'references', 'fonts', 'fonts.json')
export const STYLES_FILE = join(ROOT, 'references', 'styles', 'styles.json')

const CORE_AXES = AXIS_ORDER.filter((a) => !(a in AXIS_DEFAULTS))
export const NOVELTY_KEYS = [...AXIS_ORDER, 'motion', 'colorLogic']
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'))
const round = (x, d = 4) => Number(x.toFixed(d))

// ── 색 도우미 ────────────────────────────────────────────────────────────
const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
export const oklchToHex = (v) => '#' + oklchToLinearSrgb(v).map((c) => Math.round(Math.min(1, Math.max(0, encode(c))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const lchOf = (v) => (typeof v === 'string' && v.startsWith('#') ? hexToOklch(v.slice(1)) : parseOklch(v))
export const css = ([L, C, H]) => `oklch(${round(Math.min(1, Math.max(0, L)), 4)} ${round(Math.max(0, C), 4)} ${round(((H % 360) + 360) % 360, 2)})`
const cr = (a, b) => ratio(css(a), css(b))
const withL = ([, C, H], L) => [L, C, H]
// L 만 움직여(색상각·채도 유지 — 대표 판단 「명도만 조정」) 상대 색과의 대비가 min 이상이 되는 가장 가까운 L. 바탕이 밝으면 어둡게, 어두우면 밝게.
function fitL(c, against, min) {
  if (cr(c, against) >= min) return c
  const down = against[0] >= 0.5
  for (let L = c[0]; down ? L >= 0 : L <= 1; L += down ? -0.005 : 0.005) { const x = withL(c, round(L, 4)); if (cr(x, against) >= min) return x }
  return withL(c, down ? 0 : 1)
}
const mix = (a, b, w) => lchOf(mixOklch(css(a), css(b), w))
const tailwindSafe = (c) => { let x = c; for (let i = 0; i < 6 && tailwindCopy(x); i++) x = withL(x, round(x[0] - 0.012, 4)); return x }

// ── 팔레트 → 레시피 색 두 벌 ─────────────────────────────────────────────
const STATUS_HUES = { success: [150, 0.14], warning: [65, 0.15], info: [245, 0.13] }
const MARGIN = 0.15 // 계산 대비에 여유(렌더 반올림)
function themeFrom({ bg, fg, primary, pf, accent }, { dark, logic, axes }) {
  const t = {}
  t.background = bg
  t.foreground = fitL(fg, bg, 7 + MARGIN)
  t.card = bg; t.popover = bg
  t['card-foreground'] = t.foreground; t['popover-foreground'] = t.foreground
  let p = primary
  if (logic === 'K7' && p[1] < DUO.minC + 0.01) p = [p[0], DUO.minC + 0.02, p[2]]
  p = tailwindSafe(fitL(p, bg, 4.5 + MARGIN))
  t.primary = p
  const pfCands = [pf, bg, dark ? [0.16, 0.01, p[2]] : [0.99, 0.004, p[2]], [0.99, 0, 0], [0.16, 0, 0]].filter(Boolean)
  t['primary-foreground'] = pfCands.find((c) => cr(c, p) >= 4.5 + MARGIN) ?? fitL(dark ? [0.16, 0, 0] : [0.99, 0, 0], p, 4.5 + MARGIN)
  t.secondary = mix(t.foreground, bg, 6); t['secondary-foreground'] = t.foreground
  t.muted = mix(t.foreground, bg, 5)
  let w = 60
  while (w < 100 && !(cr(mix(t.foreground, bg, w), bg) >= 7 + MARGIN && cr(mix(t.foreground, bg, w), t.muted) >= 4.5 + MARGIN)) w += 2
  t['muted-foreground'] = mix(t.foreground, bg, w)
  // accent: 기본은 주색이 옅게 스민 면(hover 면). C6 채움이면 평면 유채색(채도 0.05 이상, 잉크 테두리 3:1).
  if (axes?.surface === 'C6') {
    const src = accent && accent[1] >= C6_FILL.minC + 0.02 && hueDist(accent[2], p[2]) > 30 ? accent : [0, Math.max(0.12, p[1]), (p[2] + 60) % 360]
    let a = [dark ? 0.46 : 0.86, Math.max(src[1], C6_FILL.minC + 0.03), src[2]]
    a = fitL(a, t.foreground, C6_FILL.border + MARGIN)
    t.accent = tailwindSafe(a)
  } else t.accent = logic === 'K9' ? mix(p, bg, 14) : mix(p, bg, 12)
  t['accent-foreground'] = [t.foreground, t['primary-foreground'], dark ? [0.97, 0, 0] : [0.16, 0, 0]].find((c) => cr(c, t.accent) >= 4.5 + MARGIN) ?? fitL(t.foreground, t.accent, 4.5 + MARGIN)
  t.destructive = fitL([dark ? 0.7 : 0.55, 0.19, 27], bg, 4.5 + MARGIN)
  const line = (min) => { let v = 20; while (v < 100 && cr(mix(t.foreground, bg, v), bg) < min + MARGIN) v += 2; return mix(t.foreground, bg, v) }
  const lineAxes = Object.values(axes ?? {}).some((x) => LINE_VALUES.includes(x))
  t.border = lineAxes ? line(3) : mix(t.foreground, bg, 16)
  t.input = line(3)
  t.ring = cr(p, bg) >= 3 + MARGIN ? p : t.foreground
  // 질감(X1·X2)이 있으면 글자 대비를 무늬 위에서 다시 맞춘다(lint texture-contrast 와 같은 합성) — 본문·보조 글자는 더 짙게(밝게), 주색은 명도만.
  if (TEXTURE_ALPHA[axisValue(axes, 'texture')]) {
    const theme = dark ? 'dark' : 'light'
    const probs = (re) => textureContrastProblems({ axes, color: { [theme]: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, css(v)])) } }).some((m) => re.test(m))
    const step = dark ? 0.01 : -0.01
    for (let i = 0; i < 40 && probs(/ foreground\//); i++) t.foreground = withL(t.foreground, round(t.foreground[0] + step, 4))
    for (const k of ['card-foreground', 'popover-foreground', 'secondary-foreground']) t[k] = t.foreground
    while (w < 100 && probs(/ muted-foreground\//)) { w += 2; t['muted-foreground'] = mix(t.foreground, bg, w) }
    for (let i = 0; i < 40 && probs(/ primary\//); i++) t.primary = withL(t.primary, round(t.primary[0] + step, 4))
    if (cr(t['primary-foreground'], t.primary) < 4.5 + MARGIN) t['primary-foreground'] = fitL(t['primary-foreground'], t.primary, 4.5 + MARGIN)
    t.ring = t.primary
  }
  for (const [k, [h, c]] of Object.entries(STATUS_HUES)) {
    let s = fitL([dark ? 0.74 : 0.52, c, h], bg, 3 + MARGIN)
    const white = [0.99, 0.005, h], black = [0.19, 0.02, h]
    let on = [white, black].sort((x, y) => cr(y, s) - cr(x, s))[0]
    for (let i = 0; i < 40 && cr(on, s) < 4.5 + MARGIN; i++) { s = withL(s, round(s[0] + (on === white ? -0.01 : 0.01), 4)); on = [white, black].sort((x, y) => cr(y, s) - cr(x, s))[0] }
    t[k] = s; t[`${k}-foreground`] = on
  }
  return t
}
// 면·칸 키(K6·K7·K8): 색상각은 팔레트 강조·주색에서, 명도·채도는 규칙 대역 안(FIELD_BANDS·DUO·BLOCKS)에서.
function faceKeys(t, { dark, logic, primary, accent, hues }) {
  const fg = t.foreground
  const on = (c) => [fg, dark ? [0.97, 0.005, c[2]] : [0.18, 0.015, c[2]]].sort((x, y) => cr(y, c) - cr(x, c))[0]
  const put = (k, c) => { t[k] = c; let f = on(c); if (cr(f, c) < 7 + MARGIN) f = fitL(f, c, 7 + MARGIN); t[`${k}-foreground`] = f }
  if (logic === 'K6') {
    const h = (accent && accent[1] >= ACCENT_C ? accent : primary)[2]
    const warm = h >= FIELD_CREAM.hueFrom && h <= FIELD_CREAM.hueTo
    put('field-1', dark ? [0.36, 0.1, h] : [0.9, warm ? 0.11 : 0.08, h])
  }
  if (logic === 'K7') {
    const h = accent && accent[1] >= ACCENT_C && hueDist(accent[2], primary[2]) >= DUO.minGap + 5 ? accent[2] : (primary[2] + 180) % 360
    put('field-1', dark ? [0.42, 0.11, h] : [0.88, 0.12, h])
  }
  if (logic === 'K8') {
    const hs = hues.length >= 3 ? hues.slice(0, 3) : [primary[2], (primary[2] + 120) % 360, (primary[2] + 240) % 360]
    const Cs = [0.15, 0.11, 0.09]
    hs.forEach((h, i) => put(`block-${i + 1}`, dark ? [0.44, Cs[i], h] : [0.86, Cs[i], h]))
  }
}
// 색상각 묶음이 45° 넘게 떨어진 강조 후보(K8 칸 색)
const distinctHues = (cols) => {
  const out = []
  for (const c of cols.filter((x) => x[1] >= ACCENT_C).sort((a, b) => b[1] - a[1])) if (out.every((h) => hueDist(h, c[2]) > 50)) out.push(c[2])
  return out
}
export const paletteIsDark = (p) => lchOf(p.roles.background)[0] < 0.5
export function derivePalette(palette, { colorLogic = 'K1', axes = {} } = {}) {
  if (palette.theme) return { light: structuredClone(palette.theme.light), dark: structuredClone(palette.theme.dark), defaultTheme: palette.defaultTheme ?? 'light', derived: false }
  const r = Object.fromEntries(Object.entries(palette.roles).map(([k, v]) => [k, lchOf(v)]))
  const isDark = r.background[0] < 0.5
  const cols = palette.colors.map((c) => lchOf(c.hex))
  // K9: 글자·바탕을 주색 색상각의 무채 가까이로(강조색 없음 — 한 색상각).
  const mono = (c) => (colorLogic === 'K9' ? [c[0], Math.min(c[1], 0.03), r.primary[2]] : c)
  const lightBg = isDark ? [0.975, Math.min(0.008, r.foreground[1]), r.foreground[2]] : r.background
  const darkBg = isDark ? r.background : [0.18, Math.min(0.02, Math.max(0.012, r.background[1])), r.background[2]]
  const lightFg = isDark ? [0.22, Math.min(0.03, r.background[1] + 0.01), r.background[2]] : r.foreground
  const darkFg = isDark ? r.foreground : [0.95, Math.min(0.01, r.background[1]), r.background[2]]
  const base = { primary: r.primary, accent: r.accent, logic: colorLogic, axes }
  const light = themeFrom({ bg: mono(isCreamBackground(lightBg) ? [lightBg[0], 0.01, lightBg[2]] : lightBg), fg: mono(lightFg), primary: r.primary, pf: isDark ? null : r['primary-foreground'], accent: r.accent }, { ...base, dark: false })
  const dark = themeFrom({ bg: mono(darkBg), fg: mono(darkFg), primary: r.primary, pf: isDark ? r['primary-foreground'] : null, accent: r.accent }, { ...base, dark: true })
  const hues = distinctHues(cols)
  faceKeys(light, { dark: false, logic: colorLogic, primary: light.primary, accent: r.accent, hues })
  faceKeys(dark, { dark: true, logic: colorLogic, primary: dark.primary, accent: r.accent, hues })
  const str = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, css(v)]))
  return { light: str(light), dark: str(dark), defaultTheme: isDark ? 'dark' : 'light', derived: true }
}

// ── 레시피 → 재료 ────────────────────────────────────────────────────────
const ROLE_OF = { background: 'background', foreground: 'foreground', primary: 'primary', 'primary-foreground': 'primary-foreground', accent: 'accent', muted: 'muted', border: 'border' }
// 레시피에서 온 팔레트: 대비·금지는 build-palettes 와 같은 식으로(bansOf) 다시 판정한다 — 단 보라 금지(ai-tell-violet)는 라이브러리 레시피에서 온 팔레트에 걸지 않는다(컨트롤러 판정 23:08).
export async function recipePalette(r, { suffix = '', note } = {}) {
  const { bansOf, ROLE_KEYS } = await import('./build-palettes.mjs')
  const light = r.color.light, dark = r.color.dark
  const themeName = r.defaultTheme === 'dark' ? 'dark' : 'light'
  const face = r.color[themeName]
  const lch = (v) => { const p = parseOklch(v); return [round(p[0], 4), round(p[1], 4), round(p[2], 1)] }
  const colors = [], roles = {}
  const add = (k) => {
    const v = face[ROLE_OF[k]]
    if (!v) return
    const c = lch(v)
    if ((k === 'muted' || k === 'border') && c[1] > 0.06) return // 역할 채도 상한(palettes README I3)
    const hex = oklchToHex(css(c))
    if (!colors.some((x) => x.hex === hex)) colors.push({ hex, oklch: c })
    roles[k] = hex
  }
  for (const k of ROLE_KEYS) add(k)
  const cssOf = (hex) => { const c = colors.find((x) => x.hex === hex).oklch; return `oklch(${c[0]} ${c[1]} ${c[2]})` }
  const contrast = { fg_bg: round(ratio(cssOf(roles.foreground), cssOf(roles.background)), 2), primaryFg_primary: round(ratio(cssOf(roles['primary-foreground']), cssOf(roles.primary)), 2) }
  const withExact = colors.map((c) => ({ ...c, exact: c.oklch }))
  const byHex = (h) => withExact.find((c) => c.hex === h)
  const brand = withExact.filter((c) => c.hex !== roles.background && c.hex !== roles.foreground)
  const { bans, detail } = bansOf({ roles: Object.fromEntries(Object.entries(roles).map(([k, h]) => [k, byHex(h)])), cols: withExact, brand, brandDerived: false, exemptViolet: true })
  const use = contrast.fg_bg >= 7 && contrast.primaryFg_primary >= 4.5 && bans.length === 0 ? 'recipe' : 'decor-only'
  return {
    id: `pal-recipe-${r.id}${suffix}`, source: `recipe:${r.id}`, weight: 1, mood: [...(r.mood ?? [])], harmony: null, role_source: 'recipe',
    roles, colors, contrast, bans, ...(detail.length ? { ban_detail: detail } : {}), use,
    colorLogic: r.colorLogic, defaultTheme: r.defaultTheme ?? 'light', ...(note ? { note } : {}),
    theme: { light: { ...light }, dark: { ...dark } },
  }
}
export const recipePair = (r, suffix = '') => ({ id: `pair-recipe-${r.id}${suffix}`, source: `recipe:${r.id}`, fonts: structuredClone(r.fonts) })
export function recipePreset(r) {
  return {
    id: `preset-recipe-${r.id}`, styleId: null, source: `recipe:${r.id}`, name: r.name, verdict: 'library',
    axes: { ...r.axes },
    recipeHints: { fonts: [], paletteMoods: [...(r.mood ?? [])], motion: r.motion, colorLogic: [r.colorLogic], dynamics: [...r.dynamics], ...(r.defaultTheme ? { defaultTheme: r.defaultTheme } : {}) },
    archetypes: [...r.archetypes], rules: [`라이브러리 레시피 ${r.id} 의 축 조합(선택 보드에서 승인된 한 벌) — 재료 풀에 그대로 넣었다`],
    rank_score: 0.5, novelty: 0,
    recipe: { id: r.id, name: r.name, mood: [...r.mood], hero: r.hero, icons: { ...r.icons }, references: [...r.references], ...(r.signature ? { signature: [...r.signature] } : {}), ...(r.archetypeConditions ? { archetypeConditions: { ...r.archetypeConditions } } : {}), body: r.body },
  }
}
// 레시피 머리 하나 → { preset, palette, fontPair } (J5). 비동기: 팔레트 금지 판정에 build-palettes 를 늦게 불러온다.
export async function recipeToMaterials(r) {
  return { preset: recipePreset(r), palette: await recipePalette(r), fontPair: recipePair(r) }
}
export const loadLibrary = (root = ROOT) => recipeIds(root).map((id) => parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8')))

// ── 사전 스타일 → 프리셋 ─────────────────────────────────────────────────
const ZERO = { button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S0' }
const MID = { button: 'B3', input: 'I1', surface: 'C1', table: 'T2', header: 'H1', radius: 'R1', shadow: 'S0' }
const familyOf = (v) => Object.keys(COMPAT.families).find((f) => COMPAT.families[f].includes(v))
// 반경: 스타일 축에 없으면 시각 규칙에서 고르고, 규칙이 정하지 않으면 R1(브리프 16a — 기록한다).
function pickRadius(style, isZero) {
  if (style.axes.radius) return { radius: style.axes.radius }
  if (isZero) return { radius: 'R0', rule: '반경: 0 계열 축 값(모서리 0)과 섞이지 않게 R0' }
  const text = [...style.visualRules, style.name].join(' ')
  if (/알약|pill|캡슐/i.test(text)) return { radius: 'R2', rule: '반경: 시각 규칙의 「알약」에서 R2' }
  if (/모서리\s*0|각진|직각|sharp|square/i.test(text)) return { radius: 'R0', rule: '반경: 시각 규칙의 「각진·모서리 0」에서 R0' }
  if (/둥근|라운드|부드러운|rounded|soft|말랑|클레이/i.test(text)) return { radius: 'R1', rule: '반경: 시각 규칙의 「둥근·부드러운」에서 R1' }
  return { radius: 'R1', rule: '반경: 스타일 사전과 시각 규칙이 정하지 않아 기본 R1(브리프 16a)' }
}
const FONT_CATS = [
  [/editorial|magazine|luxury|classic|heritage|serif|elegant|vintage|retro-vintage|art-deco|literary/i, ['editorial-serif', 'serif-display']],
  [/brutal|blueprint|terminal|technical|swiss|grid|data|dashboard|bento|document|mono/i, ['mono', 'wide', 'condensed']],
  [/pixel|8bit|retro-os|y2k|arcade|game/i, ['pixel', 'retro-techno']],
  [/sticker|playful|memphis|dopamine|kitsch|clay|toy|cute|webtoon|illustrat|pop|candy/i, ['rounded', 'display-heavy']],
  [/hand|doodle|collage|scrapbook|organic|craft|imperfect|zine/i, ['script-handwriting', 'brush', 'rounded']],
  [/oversized|kinetic|typographic|maximal|poster|bold/i, ['display-heavy', 'condensed', 'wide']],
]
let fontsCache
const refFonts = () => (fontsCache ??= readJson(FONTS_FILE).fonts)
const kitOf = (id) => (kitFont(`font-${id}`) ? `font-${id}` : null)
export function fontHints(style) {
  const text = `${style.id} ${style.name}`
  const cats = FONT_CATS.find(([re]) => re.test(text))?.[1] ?? ['geometric', 'wide', 'editorial-serif']
  const pool = refFonts().filter((f) => !f.reject && !f.aiOverused && cats.includes(f.category))
  // 키트 항목이 있는 서체 먼저(설치할 수 있다), 그 안에서 스타일 범주 순서(앞 범주가 그 스타일의 결), 그다음 서체 순위.
  const score = (f) => (kitOf(f.id) ? 100 : 0) - cats.indexOf(f.category) * 10 + (f.rank_score ?? 0.5)
  return pool.sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1)).slice(0, 4).map((f) => f.id)
}
export function paletteMoods(style) {
  const t = `${style.id} ${style.name} ${(style.recipeFields.colorLogic ?? []).join(' ')}`
  const out = new Set()
  if (style.recipeFields.defaultTheme === 'dark' || /dark|night|neon|noir/i.test(t)) ['dark', 'night', 'deep'].forEach((m) => out.add(m))
  if (/K9|K3|monochrome|minimal|swiss|document|krds|corporate/i.test(t)) ['monochrome', 'muted', 'balanced'].forEach((m) => out.add(m))
  if (/K8|K6|dopamine|memphis|maximal|pop|sticker|brutal|kitsch/i.test(t)) ['bold', 'warm'].forEach((m) => out.add(m))
  if (/pastel|soft|clay|cute|kawaii/i.test(t)) out.add('pastel')
  if (/earthy|organic|handmade|craft|natural/i.test(t)) ['earthy', 'warm'].forEach((m) => out.add(m))
  if (/retro|vintage|y2k|pixel|8bit|risograph/i.test(t)) ['retro', 'vintage'].forEach((m) => out.add(m))
  if (/editorial|luxury|elegant|magazine|serif/i.test(t)) ['editorial', 'luxe', 'muted'].forEach((m) => out.add(m))
  if (!out.size) out.add('balanced')
  return [...out]
}
// 스타일 → 프리셋. 기본 벌에 없는 축은 스타일의 반경 계열에 맞는 값(0 계열이면 B1·I3·C2·T4·H3, 아니면 B3·I1·C1·T2·H1)으로 채우고 rules 에 적는다.
// 스타일이 기본 벌 밖의 변형 벌에만 새 축 값(D·X·R3 등)을 두면 그 변형 벌을 쓴다(웹툰 컷처럼 기본 벌이 이미 그 값을 가진 경우는 기본 벌).
export function catalogPreset(style) {
  const rules = []
  const set = { ...style.axes }
  const isZero = Object.values(set).some((v) => familyOf(v) === 'zero')
  const { radius, rule } = pickRadius(style, isZero)
  set.radius = radius
  if (rule) rules.push(rule)
  const fill = isZero ? ZERO : MID
  for (const a of CORE_AXES) if (!set[a]) { set[a] = fill[a]; if (a !== 'radius') rules.push(`${a}: 사전에 없어 ${isZero ? '0 계열' : '중간 계열'} 기본값 ${fill[a]}`) }
  // 채운 값이 호환표에 걸리면(예: T1 은 C1·C2 와만) 표를 통과하는 가장 가까운 값으로 바꾼다.
  const fixes = [['table', ['T2', 'T3', 'T4']], ['input', ['I1', 'I2', 'I3']], ['header', ['H1', 'H3']], ['shadow', ['S0', 'S1']], ['button', ['B3', 'B2', 'B1']]]
  for (const [axis, alts] of fixes) if (checkCompat(set).length && !style.axes[axis]) {
    const ok = alts.find((x) => !checkCompat({ ...set, [axis]: x }).length)
    if (ok && ok !== set[axis]) { rules.push(`${axis}: 채운 ${set[axis]} 가 호환표에 걸려 ${ok}`); set[axis] = ok }
  }
  if (checkCompat(set).length && !style.axes.radius) {
    const ok = ['R1', 'R2', 'R0'].find((x) => !checkCompat({ ...set, radius: x }).length)
    if (ok && ok !== set.radius) { rules.push(`반경: ${set.radius} 가 호환표에 걸려 ${ok}`); set.radius = ok }
  }
  const axes = Object.fromEntries(AXIS_ORDER.map((a) => [a, set[a] ?? AXIS_DEFAULTS[a]]))
  const logic = style.recipeFields.colorLogic ?? ['K1']
  if (!style.recipeFields.colorLogic) rules.push('색 논리: 사전에 없어 K1(단일 액센트·중립 우세)')
  const motion = style.recipeFields.motion ?? 'M1'
  if (!style.recipeFields.motion) rules.push('모션: 사전에 없어 M1')
  const archetypes = style.archetypes.filter((a) => !checkCompat(axes, a).length && logic.some((k) => !checkRecipeRules({ motion, colorLogic: k }, a).violations.length))
  return {
    id: `preset-${style.id}`, styleId: style.id, source: `catalog:${style.id}`, name: style.name, verdict: style.verdict,
    axes,
    recipeHints: { fonts: fontHints(style), paletteMoods: paletteMoods(style), motion, colorLogic: logic, ...(style.recipeFields.defaultTheme ? { defaultTheme: style.recipeFields.defaultTheme } : {}) },
    archetypes, rules: [...style.visualRules.map((v) => `시각: ${v}`), ...(style.verdict === 'allow-with-rules' ? [`조건: ${style.verdictReason}`] : []), ...rules],
    rank_score: style.rank_score, novelty: null,
    evidence: style.evidence.filter((e) => e.url).slice(0, 3).map((e) => e.url),
  }
}
const attrs = (p) => [...AXIS_ORDER.map((a) => axisValue(p.axes, a)), p.motion ?? p.recipeHints?.motion, Array.isArray(p.colorLogic) ? p.colorLogic[0] : p.colorLogic ?? p.recipeHints?.colorLogic?.[0]]
// 새로움 = 라이브러리 레시피 중 가장 가까운 것과 다른 속성의 비율(11개 기준, 위 머리말).
export function novelty(preset, library) {
  const a = attrs(preset)
  return round(Math.min(...library.map((r) => attrs(r).filter((x, i) => x !== a[i]).length / NOVELTY_KEYS.length)), 3)
}

// ── 풀 읽기 ──────────────────────────────────────────────────────────────
export function loadPresets() { return readJson(PRESETS_FILE).presets }
export function loadPairs() { return readJson(PAIRS_FILE).pairs }
// 팔레트 풀 = palettes.json + recipe-derived.json(같은 id 는 recipe-derived 가 이긴다 — 레시피 머리가 원천이고, 승격 직후 build-palettes 전에도 풀에 든다).
export function loadPalettePool() {
  const byId = new Map(readJson(PALETTES_FILE).map((p) => [p.id, p]))
  if (existsSync(RECIPE_PALETTES_FILE)) for (const p of readJson(RECIPE_PALETTES_FILE).palettes) byId.set(p.id, p)
  return [...byId.values()]
}
const fitOf = (p, archetype) => {
  if (!archetype) return 1
  if (checkCompat(p.axes, archetype).length) return 0
  if (!(p.recipeHints.colorLogic ?? ['K1']).some((k) => !checkRecipeRules({ motion: p.recipeHints.motion, colorLogic: k }, archetype).violations.length)) return 0
  return p.archetypes.includes(archetype) ? 1 : 0.5
}
// 프리셋 목록: rank_score × 원형 적합도(1 = 스타일이 맞다고 적은 원형, 0.5 = 적지 않았지만 호환표·레시피 규칙을 통과, 0 = 걸림 → 뺀다). 같으면 새로움이 큰 쪽.
// 분위기 가산(FIT-3 F1): 사용자가 고른 분위기의 무드 낱말 집합 `mood`(Set — factory/stamp/mood.mjs moodSet)가 프리셋 무드(recipeHints.paletteMoods)와 겹친 수 하나마다 더한다.
// 원형 적합도(fit)가 0 인 프리셋은 그대로 빠지고, 겹침이 없으면 점수가 그대로다 — 순위를 뒤집는 힘이 아니라 근소 차이를 가르는 힘이다(rank_score 범위 0.13~0.80 에 0.03).
export const MOOD_PRESET_W = 0.03
// 팔레트 쪽 가산: pickPalettes 의 rank_score(0.33~0.66) 위에 겹침 하나마다 더한다(프리셋 무드 겹침 0.06 의 두 배 — 사용자가 직접 말한 분위기라서).
export const MOOD_PALETTE_W = 0.12
const moodHits = (list, set) => { let n = 0; for (const m of new Set(list ?? [])) if (set.has(m)) n++; return n }

export function listPresets({ archetype, source = 'all', presets = loadPresets(), mood = null } = {}) {
  return presets
    .filter((p) => source === 'all' || p.source.startsWith(`${source}:`))
    .map((p) => { const fit = fitOf(p, archetype); return { ...p, fit, score: round((p.rank_score ?? 0.5) * fit + (mood && fit > 0 ? MOOD_PRESET_W * moodHits(p.recipeHints?.paletteMoods, mood) : 0), 6) } })
    .filter((p) => p.fit > 0)
    .sort((a, b) => b.score - a.score || (b.novelty ?? 0) - (a.novelty ?? 0) || (a.id < b.id ? -1 : 1))
}
// 팔레트 후보: use "recipe" 만(전체 순위 위쪽은 decor-only 수상 팔레트라 레시피에 못 쓴다 — T15m 우려 3), 그 안에서 rank_score(없으면 사전값 0.5) + 무드 겹침 하나마다 0.06.
// 프리셋이 다크 기본이면 어두운 바탕 팔레트를 먼저, 아니면 밝은 바탕을 먼저 둔다.
// `mood`(Set, FIT-3 F1)를 주면 팔레트 무드가 사용자의 분위기 낱말 집합과 겹친 수 하나마다 MOOD_PALETTE_W 를 더한다 — 안 주면 점수식이 그대로다.
export function pickPalettes(preset, { n = 20, pool = loadPalettePool(), mood = null } = {}) {
  const moods = new Set(preset.recipeHints?.paletteMoods ?? [])
  const wantDark = preset.recipeHints?.defaultTheme === 'dark'
  const score = (p) => (p.rank_score ?? 0.5) + 0.06 * (p.mood ?? []).filter((m) => moods.has(m)).length + (paletteIsDark(p) === wantDark ? 1 : 0) + (mood ? MOOD_PALETTE_W * moodHits(p.mood, mood) : 0)
  return pool.filter((p) => p.use === 'recipe' && p.roles).sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1)).slice(0, n)
}
// 서체 짝: 프리셋 힌트(references/fonts id) 중 키트 항목이 있는 첫 서체를 제목으로, 본문은 한글 키트 서체(Pretendard), 고정폭 IBM Plex Mono.
export function hintPair(preset) {
  const id = (preset.recipeHints?.fonts ?? []).find((f) => kitOf(f))
  const ref = id && refFonts().find((f) => f.id === id)
  const display = ref ? { family: ref.family, item: kitOf(id) } : { family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' }
  return { id: `pair-hint-${id ?? 'default'}`, source: 'hint', fonts: { display, body: { family: 'Pretendard', item: 'font-pretendard' }, mono: { family: 'IBM Plex Mono', item: 'font-ibm-plex-mono' } } }
}

// ── 프리셋 → 레시피 초안 ─────────────────────────────────────────────────
const MOOD_KO = { bold: '대담한', warm: '따뜻한', cool: '차분한', dark: '어두운', night: '밤', deep: '깊은', muted: '절제된', pastel: '부드러운', earthy: '흙빛', retro: '복고', vintage: '빈티지', monochrome: '단색', editorial: '편집', luxe: '고급', neon: '선명한', balanced: '균형' }
function heroFor(axes, logic, theme) {
  if (axes.display === 'D2') return 'grid-lines-baseline-word'
  if (axes.display === 'D3') return 'crop-marks-typed-title'
  if (axes.texture === 'X3') return 'framed-card-outline-title'
  if (axes.header === 'H5') return 'baseline-news-app-window'
  if (logic === 'K8') return 'twin-panels'
  if (logic === 'K6') return 'banded-full-bleed'
  if (theme === 'dark') return 'narrow-title-wide-window'
  return 'centered-proof-panel'
}
function dynamicsFor(motion, axes) {
  const ok = dynamicsAllowed(motion)
  const want = motion === 'M0' ? [axes.display === 'D2' ? 'oversize-crop' : axes.texture === 'X1' ? 'grain' : 'blend'] : ['clip-reveal', ...(axes.display === 'D3' ? ['split-text'] : [])]
  return want.filter((d) => ok.includes(d))
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// preset·palette·fonts(서체 짝 { fonts } 또는 레시피 fonts 객체). palette 는 use "recipe" 만 받는다. 한 인자로 recipeToMaterials 결과를 받아도 된다.
// 돌려주는 값은 레시피 머리 + body(본문 초안) — lintRecipe 에 그대로 넣는다. opts.archetype 이 있으면 그 원형 하나로 좁힌다.
export function presetToRecipeHead(preset, palette, fonts, opts = {}) {
  if (preset && preset.preset && !palette) ({ preset, palette, fontPair: fonts } = preset)
  if (!palette) throw new Error('presetToRecipeHead: palette 가 없다 — pickPalettes(preset) 로 고른다')
  if (palette.use !== 'recipe') throw new Error(`presetToRecipeHead: ${palette.id} 는 use "${palette.use}" — 레시피에는 use "recipe" 팔레트만 쓴다(J4)`)
  const pair = fonts ?? hintPair(preset)
  const fontSet = structuredClone(pair.fonts ?? pair)
  const lib = preset.recipe
  const hints = preset.recipeHints
  const logic = hints.colorLogic.includes(palette.colorLogic) ? palette.colorLogic : hints.colorLogic[0]
  const axes = lib ? { ...preset.axes } : Object.fromEntries(AXIS_ORDER.filter((a) => !(a in AXIS_DEFAULTS) || preset.axes[a] !== AXIS_DEFAULTS[a]).map((a) => [a, preset.axes[a]]))
  const colors = palette.theme && palette.colorLogic === logic ? derivePalette(palette) : derivePalette(palette.theme ? { ...palette, theme: undefined, roles: palette.roles, colors: palette.colors } : palette, { colorLogic: logic, axes })
  const defaultTheme = lib ? preset.recipeHints.defaultTheme : (hints.defaultTheme ?? colors.defaultTheme)
  const archetypes = opts.archetype ? [opts.archetype] : preset.archetypes.length ? preset.archetypes : ['brand', 'portfolio', 'saas'].filter((a) => !checkCompat(preset.axes, a).length)
  const head = lib ? {
    id: lib.id, name: lib.name, mood: [...lib.mood], axes, motion: hints.motion, colorLogic: logic, ...(defaultTheme ? { defaultTheme } : {}), dynamics: [...hints.dynamics],
    ...(lib.signature ? { signature: [...lib.signature] } : {}), hero: lib.hero, icons: { ...lib.icons }, fonts: fontSet,
    color: { light: colors.light, dark: colors.dark }, references: [...lib.references], archetypes: opts.archetype ? [opts.archetype] : [...preset.archetypes],
    ...(lib.archetypeConditions && !opts.archetype ? { archetypeConditions: { ...lib.archetypeConditions } } : {}), body: lib.body,
  } : (() => {
    const theme = defaultTheme === 'dark' ? 'dark' : 'light'
    const moodKo = [...new Set([...(hints.paletteMoods ?? []).map((m) => MOOD_KO[m]).filter(Boolean), '초안', '생성'])].slice(0, 3)
    const full = { ...preset.axes }
    return {
      id: `gen-${slug(preset.styleId ?? preset.id)}-${slug(palette.id).replace(/^pal-/, '').slice(0, 24)}`.replace(/-+$/, ''),
      name: `${preset.name} 초안(생성)`, mood: moodKo, axes, motion: hints.motion, colorLogic: logic, ...(theme === 'dark' ? { defaultTheme: 'dark' } : {}),
      dynamics: dynamicsFor(hints.motion, full), signature: ['hero'], hero: heroFor(full, logic, theme), icons: { library: 'lucide', weight: familyOf(full.button) === 'zero' ? 'G5' : 'G1' },
      fonts: fontSet, color: { light: colors.light, dark: colors.dark },
      references: [...new Set([...(preset.evidence ?? []), `palette:${palette.id}`, `preset:${preset.id}`])].slice(0, 4), archetypes,
      body: draftBody(preset, palette, logic),
    }
  })()
  return head
}
function draftBody(preset, palette, logic) {
  const vis = preset.rules.filter((r) => r.startsWith('시각:')).map((r) => r.slice(3).trim())
  const cond = preset.rules.filter((r) => !r.startsWith('시각:'))
  return [
    '## 분위기', '', `${preset.name} 스타일 프리셋(${preset.id})에서 만든 초안이다. ${vis.join(' · ') || '스타일 사전의 시각 규칙을 따른다'}.`, '',
    '## 쓰는 법', '', `- 팔레트 ${palette.id}(use recipe)를 색 논리 ${logic} 로 두 테마에 펼쳤다(명도만 조정 — 색상각·채도 유지).`, ...cond.map((c) => `- ${c}`), '',
    '## 하지 말 것', '', '- 스타일 사전의 조건(verdictReason)을 어기는 장식을 더하지 않는다.', ...(logic === 'K7' ? ['- 두 색 사이에 그라디언트를 넣지 않는다(K7 듀오톤).'] : []), '',
    '## 레퍼런스에서 가져온 기법', '', ...(preset.evidence ?? []).map((u) => `- ${u}`), `- 팔레트 ${palette.id}`, '',
  ].join('\n')
}
// 프리셋 하나의 대표 초안: 팔레트 후보를 순위대로 돌려 lint 가 깨끗한 첫 조합. 없으면 { head: null, tried }.
export function representative(preset, { pool = loadPalettePool(), n = 30, archetype } = {}) {
  const tried = []
  for (const palette of pickPalettes(preset, { n, pool })) {
    const head = presetToRecipeHead(preset, palette, undefined, { archetype })
    const v = lintRecipe(head)
    if (!v.length) return { head, palette, tried }
    tried.push({ palette: palette.id, first: v[0] })
  }
  return { head: null, tried }
}
