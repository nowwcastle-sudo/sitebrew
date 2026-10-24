// 레시피 갤러리 준비: node factory/scripts/gen-recipes-gallery.mjs  (npm run qa:recipes — prebuild·predev·pretypecheck 에서도 돈다)
// 만드는 것(.tmp/recipes, gitignore):
//   gallery.tsx  페이지가 읽는 레시피 목록. 부품은 컴파일본 registry/factory/r/<id>/ui 를 그대로 import 한다
//                (컴파일본끼리의 import 가 이미 레시피 폴더를 가리킨다 — recipe.mjs recipeLocalImports, T7-c1).
//   fonts.ts     레시피 YAML 의 서체마다 next/font/google 로더 한 번(--<항목>-wf, registry-lib `fontVar`). 레시피 id → 변수 클래스(T7-I5).
//                Google Fonts 에 없는 서체는 missingFonts 로 돌려주고 페이지가 칸 위에 드러낸다(조용히 폴백하지 않는다).
//   recipes.css  레시피마다 [data-recipe] 로 가둔 색(K6~K8 면·칸 키 포함)·서체·모션 토큰(motion 값별) 변수(css 로 싣는 키트 서체의 변수 --<항목>-wf 포함).
//   kit-fonts.ts Google 밖 키트 서체(font-pretendard 처럼 registry:item + css @import)의 패키지 CSS import — app/qa/recipes/layout.tsx 가 읽는다(T8-c3).
//                키트의 그런 항목을 전부 싣는다(@font-face 선언뿐이라 쓰지 않는 서체는 파일을 받지 않는다) — 그래서 빌드가 import 경로를 늘 검사한다.
//   kit-fonts.css 1차 CDN 에서 싣는 키트 서체(Task 10c — @import url(…) 항목, 원천 fontFace 의 @font-face — Task 15)를 그대로 옮긴 CSS. kit-fonts.ts 가 import 한다.
//   B안 서체(alternates.fonts, Task 10c): 로더는 A·B 서체를 모두 부르고(레시피 칸에 변수 클래스가 같이 붙는다 — 쓰지 않는 쪽은 변수만 정의된다),
//                recipes.css 의 [data-alt-fonts] 블록이 B의 --font-heading 을 덮는다(altCss). alt 가 없으면 A 스택 그대로다.
// 입력(레시피 원천과 next 의 Google Fonts 목록)이 작아 캐시 없이 매번 새로 만든다(수십 ms).
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { ALT_AXES, HERO_IDS, recipeIds, parseRecipe, fontStacks, recipeMarkers, R_DIR, RECIPES_DIR, isKorean, FONT_ROLES, singleWeightRules, singleWeightFaces, titleSlotStack, TITLE_SLOTS, headingWeightVars, HEADING_WEIGHT_VAR, HEADING_WEIGHT_DEFAULT, HEADING_WEIGHT_KO_VAR, HEADING_WEIGHT_VALUE, headingWeightKo, faceRules, faceKeys, applyAlternate, shapeVars, spacingVarsOf, recipeMotionLevel } from './recipe.mjs'
import { loadSources, faces, faceRule } from './gen-fonts.mjs'
import { iconVars, iconAdapter, STROKE_SELECTOR, STROKE_DECLS, motionVars } from './gen-kits.mjs'
import { fontVar } from './lib/registry-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(root, '.tmp', 'recipes')
const BANNER = '// 생성물 — factory/scripts/gen-recipes-gallery.mjs 로 다시 만든다. 손으로 고치지 않는다.'

// 견본이 쓰는 부품 모듈. app/qa/recipes/specimen.tsx 가 r.ui[<이름>] 으로 읽는다.
export const MODULES = ['alert-dialog', 'badge', 'button', 'card', 'chart', 'checkbox', 'dialog', 'field', 'input', 'label',
  'icon-button', 'native-select', 'navigation-menu', 'table', 'tabs', 'textarea', 'toast', 'toggle-group']
const ident = (s) => s.replace(/[^a-z0-9]+/g, '_')

// [data-recipe="<id>"] 안에서만 레시피 색·서체가 산다(나란히 놓인 레시피가 서로 섞이지 않는다). 다크는 html.dark 아래.
// 모달·토스트는 body 로 포털되어 칸 밖에 뜬다 — 페이지가 마지막으로 만진 레시피 id 를 html 요소의 data-recipe 에도
// 달아 포털도 그 레시피 변수를 받게 한다(선택자가 html 자신에도 맞도록 `.dark[data-recipe]` 를 함께 적는다).
// font-heading 은 전역 @theme inline 이 var(--font-sans) 로 굳혀 두어서 가둔 칸 안에서 레시피 제목 스택으로 다시 잇는다.
// 키트에서 css 로 싣는 서체 항목(Google 밖): 이름 → { imports: 패키지 CSS 경로[], css: 1차 CDN CSS 문장[], vars: cssVars.theme }.
// 패키지 경로(@import "pretendard/…")는 kit-fonts.ts 가 JS import 로, 원격(@import url("https://…")·@font-face, Task 10c)은 kit-fonts.css 가 싣는다.
export function cssKitFonts(items = loadSources()) {
  const kit = new Map()
  for (const i of items) {
    if (i.type === 'registry:font') continue
    const keys = Object.keys(i.css ?? {})
    const imports = keys.map((k) => k.match(/^@import\s+"([^"]+)"$/)?.[1]).filter(Boolean)
    // 원격 @import url(…) 과, 파일만 있는 서체의 면(원천 fontFace — 소비자에게는 registry:file CSS 로 가는 것과 같은 규칙, gen-fonts faceRule, Task 15 M8).
    // 면은 하나(객체) 또는 굵기마다 여럿(배열 — 펴진고딕 300·400·700, fix 1 I3).
    const css = [...keys.filter((k) => /^@import\s+url\(/.test(k)).map((k) => `${k};`), ...faces(i).map(faceRule)]
    if (imports.length || css.length) kit.set(i.name, { imports, css, vars: i.cssVars?.theme ?? {} })
  }
  return kit
}
const kitVars = (r, kit) => Object.assign({}, ...FONT_ROLES.map((k) => kit.get(r.fonts?.[k]?.item)?.vars ?? {}))

export function scopedCss(r, kit = cssKitFonts()) {
  const sel = `[data-recipe="${r.id}"]`
  const dark = `.dark${sel}, .dark ${sel}`
  const block = (s, vars) => `${s} {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`
  return [
    block(sel, { ...r.color.light, ...kitVars(r, kit), ...fontStacks(r.fonts), ...iconVars(r.icons?.weight), ...motionVars(r.motion), ...recipeMarkers(r), ...headingWeightVars(r), ...spacingVarsOf(r), ...shapeVars(r) }),
    // 제목 굵기(recipe.mjs headingWeightRules): 소비자와 같은 기본 층 — 부품 제목 칸의 굵기 유틸리티가 이긴다.
    `@layer base { ${sel} .font-heading { font-weight: ${HEADING_WEIGHT_VALUE}; } }`,
    `@layer base { ${sel} .font-heading-ko { font-weight: ${HEADING_WEIGHT_VALUE}; } }`,
    block(dark, r.color.dark),
    `${sel} { color-scheme: light; background-color: var(--background); color: var(--foreground); font-family: var(--font-sans); }`,
    `${dark} { color-scheme: dark; }`,
    `${sel} .font-heading { font-family: var(--font-heading); }`,
    // 한글 제목 스택(recipe.mjs fontStacks font-heading-ko, Task 14c) — 전역 @theme inline 이 var(--font-sans) 로 굳혀 둔 것을 칸 안에서 다시 잇는다.
    `${sel} .font-heading-ko { font-family: var(--font-heading-ko); }`,
    `${sel} .font-mono { font-family: var(--font-mono); }`,
    `${sel} .font-prose { font-family: var(--font-prose, var(--font-sans)); }`,
    // 단일 굵기 제목 서체(recipe.mjs singleWeightRules): 굵기 합성 끄기 · 부품 제목 칸은 본문 스택 — 칸 안의 var(--font-sans) 가 레시피 본문 스택이다.
    ...singleWeightCss(r, sel),
    // 면 스코프(recipe.mjs faceRules, Task 7 fix 1): 칸 안의 [data-face] 구획 — 다크는 html.dark 아래 두 모양 모두.
    ...Object.entries(faceRules(r, { scope: sel, darkScopes: [`.dark${sel}`, `.dark ${sel}`] })).map(([s, d]) => `@layer base { ${s} { ${Object.entries(d).map(([k, v]) => `${k}: ${v};`).join(' ')} } }`),
    // 아이콘 결(T9): 소비자에서는 icons-<library> 항목 css 가 싣는 규칙을 칸 안에 가둬 싣는다.
    `${Object.values(STROKE_SELECTOR).map((s) => `${sel} ${s}`).join(', ')} { ${Object.entries(STROKE_DECLS).map(([k, v]) => `${k}: ${v};`).join(' ')} }`,
  ].join('\n')
}

// 단일 굵기 제목 서체 규칙(recipe.mjs singleWeightRules)을 칸 선택자 아래로 — 부품 제목 칸의 본문 스택은 칸 안의 var(--font-sans).
// reset: B안처럼 A 규칙을 덮어야 할 때 — 단일 굵기가 아니게 된 쪽을 되돌린다(합성 auto, 부품 제목 칸은 제목 스택).
// 부품 제목 칸 값(recipe.mjs titleSlotStack): display 단일 굵기면 칸 안의 var(--font-sans), displayKo 만 단일 굵기면 한글 제목체를 뺀 제목 스택(글자 그대로).
function singleWeightCss(r, sel, { reset = null } = {}) {
  const faces = singleWeightFaces(r.fonts), was = reset ? singleWeightFaces(reset.fonts) : []
  const out = []
  if (faces.length || was.length) out.push(`${sel} .font-heading { font-synthesis-weight: ${faces.length ? 'none' : 'auto'}; }`)
  // font-heading-ko 는 displayKo 로 시작한다 — 한글 제목체가 굵기 하나일 때만 합성을 끈다(recipe.mjs singleWeightRules).
  const koNow = faces.includes('displayKo'), koWas = was.includes('displayKo')
  if (koNow || koWas) out.push(`${sel} .font-heading-ko { font-synthesis-weight: ${koNow ? 'none' : 'auto'}; }`)
  const slot = faces.includes('display') ? 'var(--font-sans)' : titleSlotStack(r.fonts) ?? (was.length ? 'var(--font-heading)' : null)
  if (slot) out.push(`${sel} ${TITLE_SLOTS} { font-family: ${slot}; }`)
  return out
}

// 보드 B안(Task 8): 대표 장면을 B로도 그린다 — /qa/recipes?r=<id>&scene=<장면>&alt=<picks>. 페이지가 칸에 data-alt-color(colorLogic 을 고름)·
// data-alt-motion(motion 을 고름)을 달면 이 규칙이 A 값을 덮는다. 색은 B 덮어쓰기 키만(나머지는 A 그대로 — applyAlternate 와 같다),
// 다크는 .dark 아래 두 모양, 면 스코프는 B를 적용한 머리로 다시 만든다. dynamics 는 CSS 가 아니라 장면(React)이 고른다.
// 갤러리 행의 alt(보드 B안) 모양 — 키 목록 하나에서 값(altOf)과 TS 타입(RECIPE_ALT_TYPE)을 함께 만든다(Task 9 fix 1 — 리뷰 M4).
// gallery.tsx 는 `(값 satisfies RecipeAlt | null) as RecipeAlt | null` 로 싣는다: satisfies 가 키가 빠지거나 더해진 객체를 tsc 에서 막고,
// as 는 모든 레시피가 null 일 때 추론 타입이 null 로 좁혀져 장면 코드의 r.alt?.faces 가 never 가 되는 것만 넓힌다.
export const ALT_FIELDS = [
  ['colorLogic', 'string | null', (r) => r.alternates.colorLogic ?? null],
  ['motion', 'string | null', (r) => r.alternates.motion ?? null],
  ['dynamics', 'string[] | null', (r) => r.alternates.dynamics ?? null],
  ['fonts', 'Record<string, { family: string; item: string; weight?: number; tuned?: string }> | null', (r) => r.alternates.fonts ?? null],
  // hero(Task 10d): B안의 첫 화면 구성(HEROES id) — 장면이 고른다(CSS 속성 없음).
  ['hero', 'string | null', (r) => r.alternates.hero ?? null],
  ['faces', 'string[]', (r) => faceKeys(applyAlternate(r, ['colorLogic']))],
]
export const RECIPE_ALT_TYPE = `export type RecipeAlt = { ${ALT_FIELDS.map(([k, t]) => `${k}: ${t}`).join('; ')} }`
export const altOf = (r) => (r.alternates ? Object.fromEntries(ALT_FIELDS.map(([k, , get]) => [k, get(r)])) : null)
export const altLiteral = (r) => `(${JSON.stringify(altOf(r))} satisfies RecipeAlt | null) as RecipeAlt | null`

// 축 → 칸 속성(Task 10c fix 1 — 리뷰 M4). 장면(app/qa/recipes/scenes.tsx)이 이 속성을 달고 altCss 가 같은 이름으로 고른다.
// dynamics 는 CSS 가 아니라 장면이 고르므로 속성이 없다. gallery.tsx 가 ALT_AXES 와 함께 내보낸다(scenes.tsx parseAlt 가 읽는다).
// hero 는 속성이 없다 — 장면(scenes.tsx HeroScene)이 구성을 고른다.
export const ALT_ATTR = { colorLogic: 'data-alt-color', motion: 'data-alt-motion', fonts: 'data-alt-fonts' }
export const altAxesModule = () => [
  `export const ALT_AXES = ${JSON.stringify(ALT_AXES)} as const`,
  `export const ALT_ATTR = ${JSON.stringify(ALT_ATTR)} as const`,
].join('\n')

export function altCss(r, kit = cssKitFonts()) {
  const alt = r.alternates
  if (!alt) return ''
  const sel = `[data-recipe="${r.id}"]`
  const block = (s, vars) => `${s} {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`
  const out = []
  if (alt.colorLogic) {
    const c = `${sel}[${ALT_ATTR.colorLogic}]`
    if (alt.color) out.push(block(c, alt.color.light), block(`.dark${c}, .dark ${c}`, alt.color.dark))
    const b = applyAlternate(r, ['colorLogic'])
    out.push(...Object.entries(faceRules(b, { scope: c, darkScopes: [`.dark${c}`, `.dark ${c}`] })).map(([s, d]) => `@layer base { ${s} { ${Object.entries(d).map(([k, v]) => `${k}: ${v};`).join(' ')} } }`))
  }
  // B 모션(Task 8, 대장 A10): 모션 토큰과 함께 장면 단계 --wf-motion(0~3)도 B 값으로 — 장면 훅이 뿌리 계산값으로 읽는다(recipeMarkers 와 같은 값).
  if (alt.motion) out.push(block(`${sel}[${ALT_ATTR.motion}]`, { ...motionVars(alt.motion), 'wf-motion': recipeMotionLevel(alt.motion) }))
  // B안 서체(Task 10c): 칸에 data-alt-fonts 가 있으면 B 의 제목 스택·제목 굵기·css 키트 변수를 받는다. 본문 스택은 A 그대로.
  if (alt.fonts) {
    const b = applyAlternate(r, ['fonts'])
    const f = `${sel}[${ALT_ATTR.fonts}]`
    // 한글 제목 굵기(Task 10b·14c — 머리 display.weightKo): B 가 가지면 싣고, A 만 가지면 initial 로 되돌려 B 칸이 B 의 제목 굵기를 한글에도 쓴다.
    const koB = headingWeightKo(b.fonts), koA = headingWeightKo(r.fonts)
    const ko = koB ? { [HEADING_WEIGHT_KO_VAR]: String(koB) } : koA ? { [HEADING_WEIGHT_KO_VAR]: 'initial' } : {}
    out.push(block(f, { ...kitVars(b, kit), 'font-heading': fontStacks(b.fonts)['font-heading'], 'font-heading-ko': fontStacks(b.fonts)['font-heading-ko'], [HEADING_WEIGHT_VAR]: String(b.fonts.display?.weight ?? HEADING_WEIGHT_DEFAULT), ...ko }))
    out.push(...singleWeightCss(b, f, { reset: r }))
  }
  return out.join('\n')
}

// 히어로 카탈로그(Task 10d, recipe.mjs HEROES) → 구성 컴포넌트 목록. 카탈로그 id 마다 app/qa/recipes/heroes/<id>.tsx 의 기본 내보내기를 잇는다 —
// 묶음 2 는 카탈로그 id 와 컴포넌트 파일만 더하면 된다. 파일이 없으면 생성이 멈춘다(조용히 빈 장면을 그리지 않는다).
export const HEROES_DIR = join(root, 'app', 'qa', 'recipes', 'heroes')
export function heroesModule(ids = HERO_IDS, dir = HEROES_DIR) {
  const missing = ids.filter((id) => !existsSync(join(dir, `${id}.tsx`)))
  if (missing.length) throw new Error(`히어로 컴포넌트가 없다: ${missing.map((id) => `app/qa/recipes/heroes/${id}.tsx`).join(', ')} — recipe.mjs HEROES 의 id 마다 한 벌`)
  return [BANNER, '// 히어로 카탈로그(recipe.mjs HEROES) → 구성 컴포넌트. app/qa/recipes/scenes.tsx 의 hero 장면이 읽는다.',
    'import type { HeroComponent } from "@/app/qa/recipes/heroes/types"',
    ...ids.map((id) => `import ${ident(`hero_${id}`)} from "@/app/qa/recipes/heroes/${id}"`), '',
    `export const heroes: Record<string, HeroComponent> = {\n${ids.map((id) => `  ${JSON.stringify(id)}: ${ident(`hero_${id}`)},`).join('\n')}\n}`, ''].join('\n')
}

// next/font/google 이 아는 서체 목록(설치된 next 의 데이터). 레시피 서체 → 로더 호출 한 줄.
const require = createRequire(import.meta.url)
export const GOOGLE = require('next/dist/compiled/@next/font/dist/google/font-data.json')
// 굵기·subsets 는 키트 항목(registry/factory/fonts/<항목>.json 의 font.weight·subsets)이 원천이다 — 검수대가 소비자가 받는
// 굵기로 그린다(최종 리뷰 M1). 키트가 굵기를 적지 않은 가변 서체는 굵기 없이 부른다. 키트에 없는 서체만 Google 목록에서 고른다.
export function fontLoader(font, items = loadSources()) {
  const g = GOOGLE[font.family]
  if (!g) return null
  const fn = font.family.replace(/[^A-Za-z0-9]+/g, '_')
  const kit = items.find((i) => i.name === font.item && i.type === 'registry:font')?.font
  const weights = kit ? kit.weight ?? null
    : g.weights.includes('variable') ? null : ['300', '400', '700'].filter((w) => g.weights.includes(w))
  const opts = {
    // subsets 가 0개인 서체(Song Myung)는 비운다 — next/font 가 preload 를 스스로 끈다(gen-fonts 와 같은 규칙).
    ...(g.subsets.length ? { subsets: kit?.subsets ?? [g.subsets.includes('latin') ? 'latin' : g.subsets[0]] } : {}),
    ...(weights ? { weight: weights.length ? weights : [g.weights[0]] } : {}),
    variable: fontVar(font.item),
    display: 'swap',
    // 한글 서체는 글리프가 커서 미리 받지 않는다 — 쓰는 글자의 unicode-range 조각만 받는다.
    // subsets 가 0개인 서체에는 preload 키를 쓰지 않는다(fix 1 — 리뷰 I1): next/font 가 그때 preload 를 스스로 끄고, 생성 타입에 preload 가 없어
    // 적으면 tsc 가 TS2353 으로 멈춘다(빌드 실패). 그 밖의 한글 서체만 preload: false.
    ...(isKorean(font.family) && g.subsets.length ? { preload: false } : {}),
  }
  // next/font 는 호출 인자를 정적으로 읽는다 — 키를 따옴표 없는 객체 리터럴로 쓴다.
  return { fn, item: font.item, call: `${fn}(${JSON.stringify(opts).replace(/"([a-z]+)":/g, "$1: ")})` }
}

export function fontsModule(recipes, kit = cssKitFonts(), items = loadSources()) {
  const loaders = new Map(), byRecipe = {}, missing = {}
  // A 서체와 B안 서체(alternates.fonts — 갤러리가 &alt= 로 B를 그린다) 모두.
  const faces = (r) => [r.fonts, r.alternates?.fonts ? applyAlternate(r, ['fonts']).fonts : null].filter(Boolean)
  for (const r of recipes) for (const fonts of faces(r)) for (const role of FONT_ROLES) {
    const f = fonts?.[role]
    if (!f?.family || !f?.item) continue
    if (kit.has(f.item)) continue // css 키트 서체는 kit-fonts.ts·kit-fonts.css 가 싣는다(Google 에 같은 이름이 있어도)
    const l = fontLoader(f, items)
    if (!l) { if (!(missing[r.id] ?? []).includes(f.family)) (missing[r.id] ??= []).push(f.family); continue }
    if (!loaders.has(f.item)) loaders.set(f.item, l)
    ;(byRecipe[r.id] ??= []).push(`v_${ident(f.item)}`)
  }
  const fns = [...new Set([...loaders.values()].map((l) => l.fn))].sort()
  return [
    BANNER,
    '// 레시피 서체 변수(--<항목>-wf). 소비자에게는 Task 8 폰트 항목이 같은 변수 이름으로 준다.',
    ...(fns.length ? [`import { ${fns.join(', ')} } from "next/font/google"`] : []),
    '',
    ...[...loaders.values()].map((l) => `const f_${ident(l.item)} = ${l.call}\nconst v_${ident(l.item)} = f_${ident(l.item)}.variable`),
    '',
    `export const recipeFonts: Record<string, string> = {\n${Object.entries(byRecipe).map(([id, vs]) => `  ${JSON.stringify(id)}: [${[...new Set(vs)].join(', ')}].join(" "),`).join('\n')}\n}`,
    `export const missingFonts: Record<string, string[]> = ${JSON.stringify(missing)}`,
    '',
  ].join('\n')
}

// Google 밖 키트 서체의 패키지 CSS — 레이아웃이 전역 CSS 로 한 번 싣는다.
export function kitFontsModule(kit = cssKitFonts()) {
  const lines = [...kit].flatMap(([name, { imports }]) => imports.map((p) => `import ${JSON.stringify(p)} // ${name}`))
  const cdn = [...kit.values()].some((k) => k.css?.length)
  return [BANNER, '// Google 밖 키트 서체(registry/factory/fonts 의 css @import 항목) — app/qa/recipes/layout.tsx 가 읽는다.', ...lines, ...(cdn ? ['import "./kit-fonts.css" // 1차 CDN 서체(@import url·@font-face)'] : []), 'export {}', ''].join('\n')
}
// 1차 CDN 키트 서체의 CSS(Task 10c) — @import url(…) 은 파일 맨 앞(CSS 규칙), 그다음 @font-face.
export function kitFontsCss(kit = cssKitFonts()) {
  const all = [...kit].flatMap(([name, { css }]) => (css ?? []).map((c) => ({ name, c })))
  const order = [...all.filter((x) => x.c.startsWith('@import')), ...all.filter((x) => !x.c.startsWith('@import'))]
  return [`/* ${BANNER.slice(3)} */`, ...order.map(({ name, c }) => `${c} /* ${name} */`), ''].join('\n')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const t0 = Date.now()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const imports = [], rows = [], css = [`/* ${BANNER.slice(3)} */`], recipes = []
  for (const id of recipeIds()) {
    const ui = join(R_DIR, id, 'ui')
    if (!existsSync(ui)) throw new Error(`r/${id}/ui 가 없다 — 먼저 npm run gen:all`)
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    recipes.push(r)
    for (const m of MODULES) {
      if (!existsSync(join(ui, `${m}.tsx`))) throw new Error(`r/${id}/ui/${m}.tsx 가 없다`)
      imports.push(`import * as ${ident(`${id}_${m}`)} from "@/registry/factory/r/${id}/ui/${m}"`)
    }
    // 견본이 직접 그리는 아이콘도 그 레시피의 어댑터로(부품과 같은 라이브러리·굵기, T9-M5).
    imports.push(`import * as ${ident(`${id}_glyphs`)} from "@/registry/factory/icons/${iconAdapter(r.icons)}"`)
    const meta = { id: r.id, name: r.name, mood: r.mood, axes: r.axes, motion: r.motion, colorLogic: r.colorLogic, defaultTheme: r.defaultTheme ?? "light", dynamics: r.dynamics, icons: r.icons, fonts: r.fonts, references: r.references, archetypes: r.archetypes, faces: faceKeys(r), signature: r.signature ?? [], hero: r.hero ?? null }
    rows.push(`  { ...${JSON.stringify(meta)}, alt: ${altLiteral(r)}, ui: { ${MODULES.map((m) => `${JSON.stringify(m)}: ${ident(`${id}_${m}`)}`).join(', ')} }, glyphs: ${ident(`${id}_glyphs`)} },`)
    css.push(scopedCss(r), altCss(r))
  }
  const fonts = fontsModule(recipes)
  writeFileSync(join(OUT, 'gallery.tsx'), [BANNER, '// 레시피 목록 — app/qa/recipes 가 읽는다. 부품은 레시피 컴파일본(r/<id>/ui) 그대로.', ...imports, '', RECIPE_ALT_TYPE, '', altAxesModule(), '', `export const recipes = [\n${rows.join('\n')}\n]`, ''].join('\n'))
  writeFileSync(join(OUT, 'fonts.ts'), fonts)
  writeFileSync(join(OUT, 'recipes.css'), css.join('\n') + '\n')
  writeFileSync(join(OUT, 'kit-fonts.ts'), kitFontsModule())
  writeFileSync(join(OUT, 'kit-fonts.css'), kitFontsCss())
  writeFileSync(join(OUT, 'heroes.ts'), heroesModule())
  const miss = Object.entries(JSON.parse(fonts.match(/missingFonts[^=]*= (.*)$/m)[1]))
  for (const [id, fams] of miss) console.warn(`gen-recipes-gallery: ${id} 서체 로더 없음(Google Fonts 밖) — ${fams.join(', ')}. 갤러리는 칸 위에 이 사실을 표시한다(Task 8 폰트 항목 전까지)`)
  console.log(`gen-recipes-gallery: 레시피 ${rows.length}벌 → gallery.tsx(r/<id>/ui 직접), fonts.ts, recipes.css, kit-fonts.ts, kit-fonts.css, heroes.ts(히어로 ${HERO_IDS.length}개) (${Date.now() - t0}ms)`)
}
