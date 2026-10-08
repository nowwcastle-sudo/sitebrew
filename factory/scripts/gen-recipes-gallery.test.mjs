import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopedCss, altCss, MODULES, fontLoader, fontsModule, cssKitFonts, kitFontsModule, kitFontsCss } from './gen-recipes-gallery.mjs'
import { parseRecipe, fontStacks, recipeIds, R_DIR } from './recipe.mjs'
import { loadSources } from './gen-fonts.mjs'
import { MOTION_TOKENS } from './gen-kits.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const good = parseRecipe(readFileSync(join(root, 'factory', 'scripts', 'fixtures', 'recipes', 'good', 'DESIGN.md'), 'utf8'))

test('scopedCss confines colours and font stacks to [data-recipe], dark under .dark on html and ancestors', () => {
  const css = scopedCss(good)
  const sel = `[data-recipe="${good.id}"]`
  assert.ok(css.startsWith(`${sel} {`))
  assert.ok(css.includes(`.dark${sel}, .dark ${sel} {`))
  for (const [k, v] of Object.entries(good.color.light)) assert.ok(css.includes(`--${k}: ${v};`), `light ${k}`)
  for (const [k, v] of Object.entries(good.color.dark)) assert.ok(css.includes(`--${k}: ${v};`), `dark ${k}`)
  for (const [k, v] of Object.entries(fontStacks(good.fonts))) assert.ok(css.includes(`--${k}: ${v};`), k)
  assert.ok(css.includes(`${sel} .font-heading { font-family: var(--font-heading); }`))
  assert.ok(css.includes(`${sel} .font-prose { font-family: var(--font-prose, var(--font-sans)); }`))
  assert.doesNotMatch(css, /:root/)
  assert.doesNotMatch(css, /font-synthesis/) // Sora(여러 굵기) — 단일 굵기 규칙 없음
})

test('face scopes in the gallery (Task 7 fix 1 — review I1): [data-face] inside [data-recipe], card reset per theme under both dark shapes', () => {
  assert.doesNotMatch(scopedCss(good), /data-face/) // 면 키 없음
  const r = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r8-dusk', 'DESIGN.md'), 'utf8'))
  const css = scopedCss(r)
  const sel = `[data-recipe="${r.id}"]`
  assert.ok(css.includes(`@layer base { ${sel} [data-face="field-1"] { --background: var(--field-1); --foreground: var(--field-1-foreground);`), css)
  assert.ok(css.includes(`${sel} [data-face="field-2"]`))
  assert.ok(css.includes(`${sel} [data-face] [data-slot="card"]:not([data-face])`))
  assert.ok(css.includes(`.dark${sel} [data-face] [data-slot="card"]:not([data-face])`))
  assert.ok(css.includes(`.dark ${sel} [data-face] [data-slot="card"]:not([data-face])`))
  assert.ok(css.includes(`--ring: ${r.color.dark.ring};`))
})

test('single-weight display in the gallery: heading synthesis off and part titles on the body stack, confined to [data-recipe] (Task 5 fix 1)', () => {
  const r = structuredClone(good)
  r.fonts.display = { family: 'Black Han Sans', item: 'font-black-han-sans' }
  const css = scopedCss(r)
  const sel = `[data-recipe="${r.id}"]`
  assert.ok(css.includes(`${sel} .font-heading { font-synthesis-weight: none; }`))
  assert.ok(css.includes(`${sel} [data-slot$="-title"].font-heading { font-family: var(--font-sans); }`))
})

test('heading weight in the gallery: --wf-heading-weight in [data-recipe] + .font-heading weight in the base layer (Task 6 fix 1, I1)', () => {
  const r = structuredClone(good)
  r.fonts.display = { family: 'Jost', item: 'font-jost', weight: 200 }
  const sel = `[data-recipe="${r.id}"]`
  const css = scopedCss(r)
  assert.ok(css.includes('  --wf-heading-weight: 200;'))
  assert.ok(css.includes(`@layer base { ${sel} .font-heading { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); } }`))
  const plain = scopedCss(good) // 값 없음 → 변수 없이 기본 700
  assert.ok(!plain.includes('--wf-heading-weight:'))
  assert.ok(plain.includes(`@layer base { ${sel} .font-heading { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); } }`))
})

test('motion tokens and K6~K8 field/block vars in the gallery [data-recipe] scope follow the recipe (Task 6b, D7)', () => {
  const sel = `[data-recipe="${good.id}"]`
  const r = structuredClone(good)
  r.motion = 'M3'
  r.color.light['field-1'] = 'oklch(0.9 0.07 230)'
  r.color.dark['field-1'] = 'oklch(0.36 0.09 230)'
  const css = scopedCss(r)
  for (const [k, v] of Object.entries(MOTION_TOKENS.M3)) assert.ok(css.includes(`  --${k}: ${v};`), k)
  assert.ok(css.startsWith(`${sel} {`))
  assert.ok(css.includes('  --field-1: oklch(0.9 0.07 230);'))
  assert.ok(css.includes('  --field-1: oklch(0.36 0.09 230);'))
  const m0 = scopedCss({ ...structuredClone(good), motion: 'M0' })
  assert.ok(m0.includes('  --duration-enter: 0ms;'))
  assert.notEqual(m0, scopedCss({ ...structuredClone(good), motion: 'M1' }))
})

test('every gallery module exists in every compiled recipe folder r/<id>/ui (M11)', () => {
  const ids = recipeIds()
  assert.ok(ids.length >= 1, '레시피가 하나 이상 있어야 이 검사가 뜻이 있다')
  for (const id of ids) for (const m of MODULES) assert.ok(existsSync(join(R_DIR, id, 'ui', `${m}.tsx`)), `${id}/${m}`)
})

test('gallery loaders take weight and subsets from the kit item (one source, final review M1): the gallery draws what consumers receive', () => {
  const items = loadSources()
  const google = items.filter((i) => i.type === 'registry:font' && i.font.provider === 'google')
  assert.ok(google.length >= 10)
  for (const i of google) {
    const family = i.title
    const l = fontLoader({ family, item: i.name }, items)
    assert.ok(l, `${family} 가 next/font/google 에 없다`)
    const opts = Function(`return (${l.call.slice(l.fn.length)})`)()
    assert.deepEqual(opts.weight, i.font.weight, `${i.name} 굵기`)
    assert.deepEqual(opts.subsets, i.font.subsets, `${i.name} subsets`)
  }
  // 리뷰가 짚은 두 서체: KR 은 300 없이 400·700, Mono 는 600 을 싣는다.
  assert.match(fontLoader({ family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' }, items).call, /weight: \["400","700"\]/)
  assert.match(fontLoader({ family: 'IBM Plex Mono', item: 'font-ibm-plex-mono' }, items).call, /weight: \["400","600"\]/)
})

test('fonts come from each recipe YAML: one next/font loader per font item, Korean faces not preloaded, unknown faces reported (I5)', () => {
  const kr = fontLoader({ family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' })
  assert.equal(kr.fn, 'IBM_Plex_Sans_KR')
  assert.match(kr.call, /variable: "--font-ibm-plex-sans-kr-wf"/)
  assert.match(kr.call, /preload: false/)
  assert.equal(fontLoader({ family: 'Pretendard', item: 'font-pretendard' }), null)
  const other = { id: 'fx-two', fonts: { display: { family: 'Sora', item: 'font-sora' }, body: { family: 'SUIT', item: 'font-suit' } } }
  const mod = fontsModule([good, other])
  assert.match(mod, /import \{ [^}]*Sora[^}]* \} from "next\/font\/google"/)
  assert.match(mod, /"fx-two": \[v_font_sora\]\.join\(" "\)/)
  // Google 에도 키트에도 없는 서체만 missing 이다.
  assert.match(mod, /missingFonts[^=]*= \{[^}]*"fx-two":\["SUIT"\]/)
  // 같은 항목은 한 번만 부른다(next/font 는 호출마다 파일을 만든다).
  assert.equal(fontsModule([other, { ...other, id: 'fx-three' }]).match(/= Sora\(/g).length, 1)
})

test('a Pretendard-body recipe loads Pretendard from the kit, with no missing-font warning (T8-c3)', () => {
  // 픽스처 good 의 본문은 Pretendard(font-pretendard) — Google Fonts 밖, 키트의 css @import 항목.
  assert.equal(good.fonts.body.item, 'font-pretendard')
  const kit = cssKitFonts()
  assert.deepEqual(kit.get('font-pretendard').imports, ['pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'])
  // 경고 없음: missingFonts 에 이 레시피가 없다.
  const mod = fontsModule([good], kit)
  assert.match(mod, /export const missingFonts: Record<string, string\[\]> = \{\}/)
  // 레이아웃이 읽는 kit-fonts.ts 가 패키지 CSS 를 import 하고, 그 파일이 설치되어 있다(빌드가 풀 수 있는 경로).
  const kf = kitFontsModule(kit)
  assert.match(kf, /^import "pretendard\/dist\/web\/variable\/pretendardvariable-dynamic-subset\.css" \/\/ font-pretendard$/m)
  assert.ok(existsSync(join(root, 'node_modules', 'pretendard', 'dist', 'web', 'variable', 'pretendardvariable-dynamic-subset.css')))
  const layout = readFileSync(join(root, 'app', 'qa', 'recipes', 'layout.tsx'), 'utf8')
  assert.match(layout, /^import "@\/\.tmp\/recipes\/kit-fonts"$/m)
  // 레시피 칸 안에서 키트 변수가 정의된다 — var(--font-pretendard-wf, …) 가 "Pretendard Variable" 로 풀린다.
  const css = scopedCss(good, kit)
  assert.match(css, /--font-pretendard-wf: "Pretendard Variable", Pretendard;/) // 일반형 없이(fix 1 — M6)
  // 키트를 안 쓰는 레시피 칸에는 키트 변수를 넣지 않는다.
  const latin = { ...good, fonts: { display: { family: 'Sora', item: 'font-sora' }, body: { family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' } } }
  assert.doesNotMatch(scopedCss(latin, kit), /--font-pretendard-wf:/)
})

test('B option css (Task 8 — board B screenshots): B colour patch and B face scopes under [data-alt-color], B motion under [data-alt-motion]', async () => {
  assert.equal(altCss(good), '')
  // 보드 당시 r2 의 B안(K4 → K7)은 보드 고정본에 있다. 원천 머리의 B안(Task 10d — 같은 K7 의 DNA 새 팔레트)도 같은 선택자 아래에 색을 싣는다.
  const { loadBoardHeads } = await import('../board/recipe-board/jobs.mjs')
  const r = loadBoardHeads().find((h) => h.id === 'r2-signal')
  const live = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r2-signal', 'DESIGN.md'), 'utf8'))
  assert.equal(live.alternates.colorLogic, live.colorLogic)
  assert.ok(altCss(live).includes(`[data-recipe="r2-signal"][data-alt-color] {\n  --background: ${live.alternates.color.light.background};`))
  const css = altCss(r)
  const c = `[data-recipe="${r.id}"][data-alt-color]`
  for (const [k, v] of Object.entries(r.alternates.color.light)) assert.ok(css.includes(`--${k}: ${v};`), `light ${k}`)
  assert.ok(css.includes(`.dark${c}, .dark ${c} {`))
  for (const [k, v] of Object.entries(r.alternates.color.dark)) assert.ok(css.includes(`--${k}: ${v};`), `dark ${k}`)
  // A(K4)에는 면이 없고 B(K7)에만 면이 있다 — 면 스코프는 B 선택자 아래에만.
  assert.doesNotMatch(scopedCss(r), /data-face/)
  assert.ok(css.includes(`@layer base { ${c} [data-face="field-1"] {`))
  assert.ok(css.includes(`[data-recipe="${r.id}"][data-alt-motion] {`))
  for (const [k, v] of Object.entries(MOTION_TOKENS[r.alternates.motion])) assert.ok(css.includes(`--${k}: ${v};`), k)
})

// ── Task 10c: B안 서체 · 1차 CDN 키트 서체 · subsets 없는 Google 서체 ─────────────────
test('B option fonts (alternates.fonts): B heading stack, weight and css kit vars under [data-alt-fonts]; A untouched; loaders cover B faces', () => {
  const r = structuredClone(good)
  r.fonts.displayKo = { family: 'Do Hyeon', item: 'font-do-hyeon' }
  r.alternates = { fonts: { display: { family: 'Jost', item: 'font-jost', weight: 200 }, displayKo: { family: 'SeochoBatang', item: 'font-seocho-batang' } }, note: 'B 제목체' }
  const sel = `[data-recipe="${r.id}"]`, f = `${sel}[data-alt-fonts]`
  const css = altCss(r)
  const bStack = fontStacks({ ...r.fonts, ...r.alternates.fonts })['font-heading']
  assert.ok(css.includes(`${f} {`), css)
  assert.ok(css.includes(`  --font-heading: ${bStack};`), css)
  assert.ok(bStack.startsWith('var(--font-jost-wf, "Jost", "SeochoBatang"'), bStack)
  assert.ok(css.includes('  --wf-heading-weight: 200;'))
  assert.ok(css.includes('  --font-seocho-batang-wf: "SeochoBatang";'), 'css 키트 서체 변수(일반형 없이 — fix 1 M6)')
  // A(Do Hyeon, 단일 굵기) → B(SeochoBatang, 단일 굵기): B 칸도 합성을 끄고, 부품 제목 칸은 B 의 한글 제목체를 건너뛴 스택(fix 1 — I2).
  assert.ok(css.includes(`${f} .font-heading { font-synthesis-weight: none; }`), css)
  const bSlot = fontStacks({ ...r.fonts, ...r.alternates.fonts, displayKo: undefined })['font-heading']
  assert.ok(css.includes(`${f} [data-slot$="-title"].font-heading { font-family: ${bSlot}; }`), css)
  assert.ok(bSlot.startsWith('var(--font-jost-wf, "Jost", "Pretendard Variable"') && !bSlot.includes('Seocho'), bSlot)
  // A 칸도 같은 규칙(A 의 한글 제목체 Do Hyeon 을 건너뛴다).
  assert.ok(scopedCss(r).includes(`[data-slot$="-title"].font-heading { font-family: ${fontStacks({ ...r.fonts, displayKo: undefined })['font-heading']}; }`))
  // 여러 굵기 한글 제목체(펴진고딕 300·400·700 — I3) B 는 A 의 규칙을 되돌린다.
  const multi = altCss({ ...r, alternates: { fonts: { displayKo: { family: 'PyeojinGothic', item: 'font-pyeojin-gothic' } }, note: 'x' } })
  assert.ok(multi.includes(`${f} .font-heading { font-synthesis-weight: auto; }`) && multi.includes(`${f} [data-slot$="-title"].font-heading { font-family: var(--font-heading); }`), multi)
  // A 는 그대로: scopedCss 의 A 스택에 B 서체가 없다.
  const a = scopedCss(r)
  assert.ok(a.includes(`  --font-heading: ${fontStacks(r.fonts)['font-heading']};`))
  assert.ok(!a.includes('Jost') && !a.includes('SeochoBatang'))
  // 로더: A·B 모두(Jost 는 Google 로더, SeochoBatang 은 kit-fonts.css).
  const mod = fontsModule([r])
  assert.match(mod, /"fx-good": \[[^\]]*v_font_do_hyeon[^\]]*v_font_jost[^\]]*\]/)
  assert.match(mod, /missingFonts[^=]*= \{\}/)
  // 여러 굵기 B 로 바뀌면 A 의 단일 굵기 규칙을 되돌린다.
  const back = structuredClone(r)
  back.fonts.display = { family: 'Black Han Sans', item: 'font-black-han-sans' }
  back.alternates.fonts = { display: { family: 'Jost', item: 'font-jost' }, displayKo: { family: 'Gowun Batang', item: 'font-gowun-batang' } }
  const bc = altCss(back)
  assert.ok(bc.includes(`${f} .font-heading { font-synthesis-weight: auto; }`), bc)
  assert.ok(bc.includes(`${f} [data-slot$="-title"].font-heading { font-family: var(--font-heading); }`), bc)
  // 서체를 바꾸지 않는 B 는 [data-alt-fonts] 블록이 없다.
  assert.doesNotMatch(altCss({ ...structuredClone(good), alternates: { motion: 'M2', note: 'x' } }), /data-alt-fonts/)
})

// ── Task 10b → 14c: 한글 제목 굵기(머리 display.weightKo) — 검수대 A 칸·B 칸 ────────────────────────
test('Korean heading weight in the gallery (Task 14c): r6 A cell carries --wf-heading-weight-ko 700, its B cell resets it; r9 has none in A or B (B stays at its display weight 400)', () => {
  const live = (id) => parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8'))
  const r6 = live('r6-civic'), r9 = live('r9-clay')
  assert.ok(scopedCss(r6).includes('  --wf-heading-weight-ko: 700;'))
  // r6 B(Unbounded 700, 여러 굵기) — A 의 한글 굵기 변수를 되돌려 B 의 제목 굵기 700 이 그대로 한글에도 간다.
  assert.ok(altCss(r6).includes('  --wf-heading-weight-ko: initial;'), altCss(r6))
  assert.ok(!scopedCss(r9).includes('--wf-heading-weight-ko:'))
  const b9 = altCss(r9)
  assert.ok(!b9.includes('--wf-heading-weight-ko'), b9) // 자동 규칙이 없다 — 운영자가 보드 3판에서 본 동글 400
  assert.ok(b9.includes('  --wf-heading-weight: 400;'))
  // 음성 대조: 한글 굵기 변수가 A·B 어디에도 없는 레시피(r2)는 B 칸에도 없다.
  assert.ok(!altCss(live('r2-signal')).includes('--wf-heading-weight-ko'))
})

// Task 14c: 한글 제목 스택 font-heading-ko — 칸 안에서 레시피 스택으로 다시 잇고(전역 @theme inline 은 var(--font-sans)), 굵기는 제목 굵기 토큰, B 칸은 B 스택.
test('font-heading-ko in the gallery (Task 14c): cell rule to the recipe stack, base-layer heading weight, B cell stack; globals.css declares the utility', () => {
  const live = (id) => parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8'))
  const r6 = live('r6-civic'), r9 = live('r9-clay')
  const sel = '[data-recipe="r6-civic"]'
  const a = scopedCss(r6)
  assert.ok(a.includes(`  --font-heading-ko: ${fontStacks(r6.fonts)['font-heading-ko']};`), a)
  assert.ok(a.includes(`${sel} .font-heading-ko { font-family: var(--font-heading-ko); }`))
  assert.ok(a.includes(`@layer base { ${sel} .font-heading-ko { font-weight: var(--wf-heading-weight-ko, var(--wf-heading-weight, 700)); } }`))
  assert.ok(!fontStacks(r6.fonts)['font-heading-ko'].includes('Fragment Mono'))
  const b9 = altCss(r9)
  assert.ok(b9.includes(`  --font-heading-ko: ${fontStacks({ ...r9.fonts, ...r9.alternates.fonts })['font-heading-ko']};`), b9)
  // r9 A 한글 제목체(베이글 팻 원)는 굵기 하나 → 칸 안 font-heading-ko 합성 끔 · B(동글, 여러 굵기) 칸은 되돌린다
  assert.ok(scopedCss(r9).includes('[data-recipe="r9-clay"] .font-heading-ko { font-synthesis-weight: none; }'))
  assert.ok(b9.includes('[data-alt-fonts] .font-heading-ko { font-synthesis-weight: auto; }'), b9)
  assert.match(readFileSync(join(root, 'app', 'globals.css'), 'utf8'), /--font-heading-ko: var\(--font-sans\);/)
})

test('first-party CDN kit fonts (@import url · @font-face) go to kit-fonts.css, imported by kit-fonts.ts; @import rules come first', () => {
  const kit = cssKitFonts()
  assert.deepEqual(kit.get('font-maru-buri').css, ['@import url("https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css");'])
  assert.deepEqual(kit.get('font-maru-buri').imports, [])
  // 굵기마다 면 하나(펴진고딕 Light 300·Regular 400·Bold 700 — fix 1 I3).
  assert.deepEqual(kit.get('font-pyeojin-gothic').css.map((c) => c.match(/PyeojinGothic-(\w+)\.woff2.*font-weight: (\d+);/).slice(1).join(' ')), ['Light 300', 'Regular 400', 'Bold 700'])
  assert.ok(kit.get('font-pyeojin-gothic').css.every((c) => !c.includes('[object Object]')))
  assert.match(kit.get('font-pyeojin-gothic').css[0], /^@font-face \{ font-family: "PyeojinGothic"; src: url\("https:\/\/cdn\.jsdelivr\.net\/gh\/projectnoonnu\/2504-1@[0-9a-f]{40}\/PyeojinGothic-Light\.woff2"\) format\("woff2"\);/)
  const text = kitFontsCss(kit)
  const lines = text.split('\n').filter((l) => l.startsWith('@'))
  assert.equal(lines.length, 14) // @import url 3 + @font-face 11(펴진고딕 3면 · 학교안심 둥근미소 2면, Task 15m 한글 4종 5면 포함)
  const firstFace = lines.findIndex((l) => l.startsWith('@font-face'))
  assert.ok(lines.slice(0, firstFace).every((l) => l.startsWith('@import url(')) && lines.slice(firstFace).every((l) => l.startsWith('@font-face')))
  assert.match(kitFontsModule(kit), /^import "\.\/kit-fonts\.css"/m)
  assert.deepEqual(kit.get('font-pretendard').css, [])
})

test('a Google family without next/font subsets (Song Myung) loads with neither subsets nor a preload key (next/font turns preload off itself)', () => {
  const l = fontLoader({ family: 'Song Myung', item: 'font-song-myung' })
  const opts = Function(`return (${l.call.slice(l.fn.length)})`)()
  assert.equal(opts.subsets, undefined)
  assert.ok(!('preload' in opts), 'preload 키는 생성 타입에 없다(TS2353) — fix 1 I1')
  assert.deepEqual(opts.weight, ['400'])
  // 다른 한글 서체는 여전히 preload: false(쓰는 글자 조각만 받는다).
  assert.equal(Function(`return (${fontLoader({ family: 'Do Hyeon', item: 'font-do-hyeon' }).call.slice('Do_Hyeon'.length)})`)().preload, false)
})

// Task 10c fix 1(리뷰 I1): 생성한 fonts.ts 를 next/font 의 실제 생성 타입으로 타입 검사한다 — Song Myung 을 displayKo 로 쓰는 레시피.
// (959725a 의 preload: false 는 런타임 검사는 통과하고 tsc 에서만 TS2353 으로 빌드를 막았다. 아직 그 서체를 쓰는 레시피가 없어 빌드가 못 봤다.)
test('the generated fonts.ts type-checks against next/font types with Song Myung as displayKo; a preload key on it fails with TS2353 (negative control)', async () => {
  const ts = (await import('typescript')).default
  const r = structuredClone(good)
  r.fonts.displayKo = { family: 'Song Myung', item: 'font-song-myung' }
  r.alternates = { fonts: { display: { family: 'Tektur', item: 'font-tektur' }, displayKo: { family: 'Do Hyeon', item: 'font-do-hyeon' } }, note: 'x' }
  const mod = fontsModule([r])
  assert.match(mod, /= Song_Myung\(\{ ?weight: \["400"\], ?variable: "--font-song-myung-wf", ?display: "swap" ?\}\)/)
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [] }
  const check = (code) => {
    const name = join(root, '.tmp', 'fonts-probe.ts').split('\\').join('/') // 가상 파일 — 쓰지 않는다. 저장소 안 경로라 node_modules/next 를 찾는다
    const host = ts.createCompilerHost(options)
    const get = host.getSourceFile.bind(host), exists = host.fileExists.bind(host)
    host.getSourceFile = (f, v) => (f === name ? ts.createSourceFile(f, code, v) : get(f, v))
    host.fileExists = (f) => f === name || exists(f)
    return ts.getPreEmitDiagnostics(ts.createProgram([name], options, host)).map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
  }
  assert.deepEqual(check(mod), [])
  const bad = check(mod.replace(/(= Song_Myung\(\{)/, '$1 preload: false,'))
  assert.ok(bad.some((m) => m.startsWith('TS2353') && m.includes("'preload'")), bad.join('\n'))
})

// Task 10c fix 1(리뷰 M4): B안 축과 칸 속성은 한 곳에서 — scenes.tsx 가 다는 속성과 altCss 가 고르는 속성이 같다.
test('ALT_AXES and the alt attributes come from one source: gallery.tsx exports them, scenes.tsx reads ALT_AXES and sets every attribute altCss selects', async () => {
  const { ALT_ATTR, altAxesModule } = await import('./gen-recipes-gallery.mjs')
  const { ALT_AXES } = await import('./recipe.mjs')
  assert.match(altAxesModule(), new RegExp(`^export const ALT_AXES = ${JSON.stringify(ALT_AXES).replace(/[[\]]/g, '\\$&')} as const$`, 'm'))
  assert.ok(ALT_AXES.includes('fonts'))
  for (const k of Object.keys(ALT_ATTR)) assert.ok(ALT_AXES.includes(k), k)
  const scenes = readFileSync(join(root, 'app', 'qa', 'recipes', 'scenes.tsx'), 'utf8')
  assert.match(scenes, /^import \{ ALT_AXES \} from "@\/\.tmp\/recipes\/gallery"$/m)
  assert.match(scenes, /const all = ALT_AXES\.filter\(/)
  assert.doesNotMatch(scenes, /\["colorLogic", "motion"/, '축 목록을 손으로 적지 않는다')
  // 모든 축의 B 를 가진 머리로 altCss 를 만들고, 그 CSS 가 고르는 속성마다 장면이 같은 이름을 단다.
  const r = structuredClone(good)
  const field = { 'field-1': 'oklch(0.9 0.07 230)', 'field-1-foreground': 'oklch(0.2 0.02 230)' }
  r.alternates = { colorLogic: 'K6', color: { light: field, dark: field }, motion: 'M2', fonts: { display: { family: 'Tektur', item: 'font-tektur' } }, note: 'x' }
  const css = altCss(r)
  for (const attr of Object.values(ALT_ATTR)) {
    assert.ok(css.includes(`[${attr}]`), `altCss 가 ${attr} 를 고른다`)
    assert.ok(scenes.includes(`${attr}={`), `scenes.tsx 가 ${attr} 를 단다`)
  }
  // 축과 속성의 짝: 서체·모션은 그 축을 고를 때, 색은 colorLogic 을 고를 때(const color = picks.includes("colorLogic")).
  assert.match(scenes, /data-alt-fonts=\{picks\.includes\("fonts"\) \? "" : undefined\}/)
  assert.match(scenes, /data-alt-motion=\{picks\.includes\("motion"\) \? "" : undefined\}/)
  assert.match(scenes, /const color = picks\.includes\("colorLogic"\)[\s\S]*data-alt-color=\{color \? "" : undefined\}/)
})

// Task 9 fix 1(리뷰 M4): alt 모양은 키 목록(ALT_FIELDS) 하나에서 값과 타입을 만든다 — 키가 빠진 객체는 tsc 가 막는다(satisfies).
test('RecipeAlt: type and value come from one key list; a dropped key fails type-checking (satisfies), all-null rows keep the wide type', async () => {
  const { ALT_FIELDS, RECIPE_ALT_TYPE, altOf, altLiteral } = await import('./gen-recipes-gallery.mjs')
  const { loadBoardHeads } = await import('../board/recipe-board/jobs.mjs')
  const withB = loadBoardHeads().find((h) => h.alternates)
  const noB = { ...withB, alternates: undefined }
  assert.deepEqual(Object.keys(altOf(withB)), ALT_FIELDS.map(([k]) => k))
  for (const [k] of ALT_FIELDS) assert.ok(RECIPE_ALT_TYPE.includes(` ${k}: `), k)
  assert.equal(altOf(noB), null)
  const ts = (await import('typescript')).default
  const options = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'], types: [], skipLibCheck: true }
  const check = (code) => {
    const name = 'probe.ts'
    const host = ts.createCompilerHost(options)
    const get = host.getSourceFile.bind(host)
    host.getSourceFile = (f, v) => (f === name ? ts.createSourceFile(f, code, v) : get(f, v))
    return ts.getPreEmitDiagnostics(ts.createProgram([name], options, host)).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
  }
  // 양성: 키가 다 있으면 통과하고, 모두 null 인 행만 있어도 r.alt?.faces 가 never 가 아니다.
  const ok = [RECIPE_ALT_TYPE,
    `const rows = [{ alt: ${altLiteral(withB)} }, { alt: ${altLiteral(noB)} }]`,
    `const only = [{ alt: ${altLiteral(noB)} }]`,
    'const f: string[] | undefined = rows[0].alt?.faces',
    'const g: string[] | undefined = only[0].alt?.faces',
    'export { f, g }'].join('\n')
  assert.deepEqual(check(ok), [])
  // 음성 대조: 키 하나(faces)를 뺀 객체는 satisfies 에서 막힌다 — 옛 `as RecipeAlt` 만으로는 통과했다.
  const dropped = JSON.stringify((({ faces, ...rest }) => rest)(altOf(withB)))
  assert.ok(check(`${RECIPE_ALT_TYPE}\nconst a = (${dropped} satisfies RecipeAlt | null) as RecipeAlt | null\nexport { a }`).length > 0)
  assert.deepEqual(check(`${RECIPE_ALT_TYPE}\nconst a = ${dropped} as RecipeAlt | null\nexport { a }`), [], '대조: as 만으로는 빠진 키를 못 잡는다')
})

// ── Task 10d: 히어로 카탈로그 → 컴포넌트 · scene=hero 경로 ─────────────────
test('every HEROES catalog id has a component file; heroesModule wires each one and stops on a missing file', async () => {
  const { heroesModule, HEROES_DIR } = await import('./gen-recipes-gallery.mjs')
  const { HERO_IDS } = await import('./recipe.mjs')
  for (const id of HERO_IDS) {
    const f = join(HEROES_DIR, `${id}.tsx`)
    assert.ok(existsSync(f), `app/qa/recipes/heroes/${id}.tsx`)
    const src = readFileSync(f, 'utf8')
    assert.match(src, /^export default function /m, id)
    // P3-2 Task 3: 틀은 히어로 블록(레시피 사본)을 그리고, 블록 뿌리의 data-hero 가 카탈로그 id 와 같다.
    assert.match(src, new RegExp(`^import \\{ Hero\\w+ \\} from "@/\\.tmp/blocks/r\\d+-[a-z]+/hero/${id}"$`, 'm'), `${id}: 블록 사본을 부른다`)
    assert.ok(readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', `${id}.tsx`), 'utf8').includes(`data-hero="${id}"`), `${id}: data-hero 가 카탈로그 id 와 같다`)
  }
  const mod = heroesModule()
  for (const id of HERO_IDS) assert.ok(mod.includes(`from "@/app/qa/recipes/heroes/${id}"`) && mod.includes(`  ${JSON.stringify(id)}: `), id)
  assert.throws(() => heroesModule([...HERO_IDS, 'no-such-hero']), /no-such-hero\.tsx/)
  // CSS 는 구성마다 [data-hero] 아래에 가둔다.
  const css = readFileSync(join(HEROES_DIR, 'heroes.css'), 'utf8')
  for (const sel of css.match(/^[^@/\s}][^{]*\{/gm)) assert.ok(sel.split(',').every((s) => /\[data-hero/.test(s) || /^\s*(from|to|\d+%|from, to)/.test(s)), sel)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
})

test('scene=hero resolves: the catalog lists it, scenes.tsx renders r.hero (A) or r.alt.hero when the hero axis is picked, the page drops the QA chrome', async () => {
  const { SCENE_IDS, ALT_AXES } = await import('./recipe.mjs')
  const { ALT_FIELDS, altOf } = await import('./gen-recipes-gallery.mjs')
  assert.ok(SCENE_IDS.includes('hero') && ALT_AXES.includes('hero'))
  assert.ok(ALT_FIELDS.some(([k]) => k === 'hero'))
  const scenes = readFileSync(join(root, 'app', 'qa', 'recipes', 'scenes.tsx'), 'utf8')
  assert.match(scenes, /^import \{ heroes \} from "@\/\.tmp\/recipes\/heroes"$/m)
  assert.match(scenes, /const id = picks\.includes\("hero"\) \? r\.alt\?\.hero : r\.hero/)
  assert.match(scenes, /^  hero: HeroScene,$/m)
  const page = readFileSync(join(root, 'app', 'qa', 'recipes', 'page.tsx'), 'utf8')
  // 히어로는 늘 틀 없이, 다른 장면은 &frame=1(보드 v2 — Task 10f)일 때 틀 없이.
  assert.match(page, /const bare = !!q\.scene && \(q\.scene === "hero" \|\| q\.frame\) && shown\.length === 1/)
  assert.match(page, /frame: p\.get\("frame"\) === "1"/)
  // 원천 머리 r1: A hero 와 B hero 가 gallery 행에 실린다(parseAlt 가 B 전체로 hero 를 고른다).
  const r = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r1-measure', 'DESIGN.md'), 'utf8'))
  assert.equal(altOf(r).hero, r.alternates.hero)
  assert.notEqual(r.hero, r.alternates.hero)
})

// ── Task 10d fix: 히어로 CSS·구성 위생(리뷰 b1 M3·M4·M7·M10·M1, b2 M4·M5·M7) ─────────────────
// 중괄호를 맞춰 `@media (prefers-reduced-motion: no-preference) { … }` 블록을 뺀 나머지 CSS.
const withoutBlocks = (css, head) => {
  let out = '', i = 0
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, i)) {
    out += css.slice(i, at)
    let depth = 0, j = css.indexOf('{', at)
    for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break }
    i = j + 1
  }
  return out + css.slice(i)
}

test('hero CSS hygiene: no keyframes, colour tokens only, view-transition timing in the block (no root rule), typed steps tied to --chars, hover moves only when motion is allowed, loops pause offscreen', async () => {
  // P3-2 Task 3: 히어로 본체의 CSS 는 블록 훅(styles/base.css 의 blocks:hero 절)이고, heroes.css 에는 틀 머리 규칙만 남는다 — 둘 다 본다.
  const { HEROES_DIR } = await import('./gen-recipes-gallery.mjs')
  const { HERO_IDS } = await import('./recipe.mjs')
  const css = readFileSync(join(HEROES_DIR, 'heroes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const base = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  const hooks = base.slice(base.indexOf('/* blocks:hero */'), base.indexOf('/* /blocks:hero */')).replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(hooks.length > 1000, 'blocks:hero 절')
  const blockSrc = (id) => readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', `${id}.tsx`), 'utf8')
  // 키프레임 없음: 등장·맥박·커서·씨앗 바꾸기는 모두 GSAP 장면(유한 반복)이나 속성 바꾸기가 맡는다.
  assert.doesNotMatch(css + hooks, /@keyframes/)
  // 색은 토큰만: white·black·rgb()·rgba() 없음(white-space 같은 속성 이름은 괜찮다). 틀·블록 원천도 같다.
  const RAW = /(?<!\w)(white|black)(?![\w-])|rgba?\(/
  assert.doesNotMatch(css, RAW)
  assert.doesNotMatch(hooks, RAW)
  for (const id of HERO_IDS) {
    assert.doesNotMatch(readFileSync(join(HEROES_DIR, `${id}.tsx`), 'utf8'), RAW, id)
    assert.doesNotMatch(blockSrc(id), RAW, `blocks/hero/${id}`)
  }
  // view-transition: 전역 CSS 규칙 없이 블록이 이름 붙은 그룹 하나의 길이만 바꾼다 — root 전환 규칙은 페이지 전체에 걸린다.
  assert.doesNotMatch(css + hooks, /::view-transition/)
  const bnw = blockSrc('baseline-news-app-window')
  assert.match(bnw, /pseudoElement === `::view-transition-group\(\$\{VT\}\)`/)
  assert.match(bnw, /const VT = "hero-vt-title"/)
  // 타자: 칸 폭은 --chars(늘 최종 폭 — 줄 배치가 바뀌지 않는다), 타자는 같은 글자 수의 steps() 로 칸을 연다(width 애니메이션 대신 clip-path).
  assert.match(hooks, /\[&_\.ct-typed\]:\[width:calc\(var\(--chars,\d+\)_\*_1ch\)\]/)
  const typed = blockSrc('crop-marks-typed-title')
  assert.match(typed, /\["--chars" as string\]: typedText\.length/)
  assert.match(typed, /steps\(\$\{typedText\.length\}\)/)
  // hover·focus·active 로 움직이는 규칙(transform)은 동작이 허용될 때만: heroes.css 는 no-preference 블록 안, 훅은 motion-safe: 변형.
  const rest = withoutBlocks(css, '@media (prefers-reduced-motion: no-preference)')
  const moving = [...rest.matchAll(/([^{}]*:(?:hover|focus-visible|active)[^{}]*)\{([^}]*)\}/g)].filter((m) => /(^|;)\s*transform\s*:/.test(m[2])).map((m) => m[1].trim())
  assert.deepEqual(moving, [])
  const hookMoving = hooks.split(/\s+/).filter((t) => /(hover|focus-visible|active)/.test(t) && /(transform:|translate|scale-|rotate-)/.test(t) && !t.startsWith('motion-safe:'))
  assert.deepEqual(hookMoving, [])
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-hero\] \*, \[data-hero\] \*::before, \[data-hero\] \*::after \{ animation: none !important; transition: none !important; \}\s*\}/)
  // 무한 반복 없음(M2~M3 유휴 반복은 모션 키트 s.loop 가 화면 밖·숨은 탭에서 멈춘다). 공용 뿌리 훅이 [data-paused] 를 멈추고 동작 줄이기에서 전환·애니메이션을 끈다.
  assert.doesNotMatch(css + hooks, /\binfinite\b/)
  const rootHook = hooks.match(/\.cn-block-hero-root \{\s*@apply ([^;]*);/)?.[1] ?? ''
  assert.match(rootHook, /\[&_\[data-paused\]\]:\[animation-play-state:paused\]!/)
  assert.match(rootHook, /motion-reduce:\[&_\*\]:\[animation:none\]! motion-reduce:\[&_\*\]:\[transition:none\]!/)
})

test('one source for faces and one h1 in hero mode: FACE_CLASS lives only in heroes/parts.tsx; scenes/specimen import it; bare hero pages drop the QA h1', () => {
  const dir = join(root, 'app', 'qa', 'recipes')
  const files = ['scenes.tsx', 'specimen.tsx', 'page.tsx', join('heroes', 'parts.tsx')]
  const defs = files.filter((f) => /const FACE_CLASS\b/.test(readFileSync(join(dir, f), 'utf8')))
  assert.deepEqual(defs, [join('heroes', 'parts.tsx')])
  assert.match(readFileSync(join(dir, 'scenes.tsx'), 'utf8'), /^import \{ Face as FaceBase \} from "\.\/heroes\/parts"$/m)
  assert.match(readFileSync(join(dir, 'specimen.tsx'), 'utf8'), /^import \{ FACE_CLASS \} from "\.\/heroes\/parts"$/m)
  const page = readFileSync(join(dir, 'page.tsx'), 'utf8')
  assert.match(page, /\{!bare && \(\s*<header[^>]*>\s*<h1 /)
})
