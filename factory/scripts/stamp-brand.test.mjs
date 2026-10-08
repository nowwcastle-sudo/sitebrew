// ③ 브랜드 입력 → 레시피 머리(P3-3 Task 4). 계획 Step 1 테스트 + 본문 7:1·링 3:1 두 테마, 보라 예외 기록, 로고, 서체 기록.
// 계획과 다른 점(코드가 정본): contrast.mjs 는 CLI 라 불러오면 실행·종료한다 → 같은 계산 lib/contrast-lib.mjs ratio 를 contrastRatio 로 쓴다.
// presets.json 은 { presets: [...] } 다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { brandToRecipeHead } from '../stamp/brand.mjs'
import { ratio as contrastRatio } from './lib/contrast-lib.mjs'
import { lintRecipe, isKorean } from './recipe.mjs'
import { hexToOklch, hueDist } from './lib/palette-lib.mjs'
import { parseOklch } from './lib/palette-rules.mjs'

const presets = JSON.parse(await readFile('references/styles/presets.json', 'utf8')).presets
const preset = presets[0]
const both = ['light', 'dark']
const floors = (r) => {
  for (const t of both) {
    const c = r.head.color[t]
    assert.ok(contrastRatio(c.foreground, c.background) >= 7, `${t} body`)
    assert.ok(contrastRatio(c['muted-foreground'], c.background) >= 7, `${t} muted body`)
    assert.ok(contrastRatio(c.ring, c.background) >= 3, `${t} focus ring`)
    assert.ok(contrastRatio(c['primary-foreground'], c.primary) >= 4.5, `${t} button text`)
  }
}

test('yellow brand primary is moved to accent, body contrast >= 7 both themes', () => {
  const r = brandToRecipeHead({ colors: ['#FFD400', '#1A1A1A'] }, preset)
  assert.equal(r.blocked, undefined)
  assert.ok(r.adjustments.some((a) => a.role === 'primary'))
  for (const t of ['light', 'dark']) assert.ok(contrastRatio(r.head.color[t].foreground, r.head.color[t].background) >= 7, t)
  assert.deepEqual(lintRecipe(r.head), [])
  floors(r)
  // 노랑은 라이트에서 강조색(accent)으로 살아 있고 색조가 그대로다. 다크에서는 주색 자리를 지킨다(대비가 되므로).
  const yellow = hexToOklch('FFD400')
  const moved = r.adjustments.find((a) => a.role === 'accent' && a.theme === 'light')
  assert.ok(moved, JSON.stringify(r.adjustments))
  assert.ok(hueDist(parseOklch(r.head.color.light.accent)[2], yellow[2]) <= 2)
  assert.ok(hueDist(parseOklch(r.head.color.dark.primary)[2], yellow[2]) <= 2)
})

test('only lightness changes: hue within 2 degrees of the brand color', () => {
  const r = brandToRecipeHead({ colors: ['#6FA8FF'] }, preset)
  for (const a of r.adjustments) assert.ok(Math.abs(a.hueDelta ?? 0) <= 2, JSON.stringify(a))
  assert.equal(r.blocked, undefined)
  assert.ok(r.adjustments.some((a) => a.role === 'primary' && a.theme === 'light'), '라이트 바탕에서 4.5:1 로 명도를 내린 기록')
  const blue = hexToOklch('6FA8FF')
  for (const t of both) assert.ok(hueDist(parseOklch(r.head.color[t].primary)[2], blue[2]) <= 2, t)
  floors(r)
  assert.deepEqual(lintRecipe(r.head), [])
})

test('unlicensed font is substituted with same-category free font and recorded', () => {
  const r = brandToRecipeHead({ colors: ['#0B5FFF'], fonts: ['Proxima Nova'] }, preset)
  assert.equal(r.fontSubstitutions[0].asked, 'Proxima Nova')
  assert.notEqual(r.fontSubstitutions[0].used, 'Proxima Nova')
  assert.equal(r.head.fonts.display.family, r.fontSubstitutions[0].used)
  assert.match(r.fontSubstitutions[0].reason, /라이선스|licen/i)
})

test('font in fonts.json without an installable kit item is replaced by the top same-category, same-script kit font', () => {
  // Anton(condensed · latin)은 라이선스는 통과지만 키트 항목이 없다 → 같은 범주·문자 중 rank_score 1등 키트 서체.
  const fonts = JSON.parse(readFileSync('references/fonts/fonts.json', 'utf8')).fonts
  const asked = fonts.find((f) => f.family === 'Anton')
  assert.ok(asked, 'fixture font present')
  const r = brandToRecipeHead({ colors: ['#0B5FFF'], fonts: ['Anton'] }, preset)
  const sub = r.fontSubstitutions[0]
  assert.equal(sub.asked, 'Anton')
  assert.match(sub.reason, /키트/)
  const used = fonts.find((f) => f.family === sub.used)
  assert.equal(used.category, asked.category)
  assert.equal(used.script, asked.script)
  assert.deepEqual(lintRecipe(r.head), [])
})

test('licensed kit font is used as-is, and a non-Korean body font keeps the Korean body (recorded)', () => {
  const r = brandToRecipeHead({ colors: ['#0B5FFF'], fonts: ['Boogaloo', 'Boogaloo'] }, preset)
  assert.equal(r.head.fonts.display.family, 'Boogaloo')
  assert.equal(r.head.fonts.display.item, 'font-boogaloo')
  assert.ok(isKorean(r.head.fonts.body.family))
  assert.deepEqual(r.fontSubstitutions.map((s) => [s.role, s.asked]), [['body', 'Boogaloo']])
  assert.deepEqual(lintRecipe(r.head), [])
})

test('unfixable brand (would need hue change) returns blocked with reason, no head', () => {
  const r = brandToRecipeHead({ colors: ['#FFFF00', '#FFFFE0'] }, preset)
  assert.match(r.blocked ?? '', /색조|hue/)
  assert.equal(r.head, undefined)
})

test('violet primary brand keeps brand colors (brand wins over ai-tell palette ban) but still passes contrast', () => {
  const r = brandToRecipeHead({ colors: ['#7C3AED'] }, preset)
  assert.equal(r.blocked, undefined)
  floors(r)
  const violet = hexToOklch('7C3AED')
  for (const t of both) assert.ok(hueDist(parseOklch(r.head.color[t].primary)[2], violet[2]) <= 2, t)
  assert.ok(r.adjustments.some((a) => /ai-tell-violet/.test(a.reason)), '보라 예외를 조정 기록에 남긴다')
  assert.deepEqual(lintRecipe(r.head), [])
})

test('logo is recorded as head.brand.logo only (favicon is Task 9)', () => {
  const r = brandToRecipeHead({ colors: ['#0B5FFF', '#FFFFFF'], logo: 'brand/logo.svg' }, preset)
  assert.deepEqual(r.head.brand, { logo: 'brand/logo.svg' })
  assert.equal(brandToRecipeHead({ colors: ['#0B5FFF'] }, preset).head.brand, undefined)
})

test('brand white background is kept as the light background', () => {
  const r = brandToRecipeHead({ colors: ['#0B5FFF', '#FFFFFF'] }, preset)
  assert.equal(r.blocked, undefined)
  assert.ok(parseOklch(r.head.color.light.background)[0] > 0.99)
  // 흰색의 색조(H 0)가 파생 중립·섞은 면을 붉게 끌지 않는다(다크 바탕·라이트 accent 는 주색 색조).
  const blueH = hexToOklch('0B5FFF')[2]
  assert.ok(hueDist(parseOklch(r.head.color.dark.background)[2], blueH) <= 2, r.head.color.dark.background)
  assert.ok(hueDist(parseOklch(r.head.color.light.accent)[2], blueH) <= 2, r.head.color.light.accent)
  floors(r)
  assert.deepEqual(lintRecipe(r.head), [])
})

test('bad colour input is blocked with a reason, not thrown', () => {
  const r = brandToRecipeHead({ colors: ['not-a-colour'] }, preset)
  assert.match(r.blocked ?? '', /색 형식/)
})
