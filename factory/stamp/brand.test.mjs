// v0.2.6 T19 — 브랜드 색: 처음 적은 유채색이 주색, 기본 테마는 브랜드 색이 정하고, ③ 바탕 프리셋은 같은 테마에서 고른다.
// 부록 B 재현 색 [#0F7B5F(초록), #FF6B35(주황), #14213D(남색)]: 예전에는 채도가 높은 주황이 주색이 되고 어두운 프리셋 위에 얹혀 defaultTheme 이 dark 였다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/stamp/brand.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandThemeOf, brandToRecipeHead } from './brand.mjs'
import { pickDirections } from './directions.mjs'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { listPresets } from '../scripts/style-presets.mjs'
import { hexToOklch, hueDist } from '../scripts/lib/palette-lib.mjs'
import { parseOklch } from '../scripts/lib/palette-rules.mjs'

const COLORS = ['#0F7B5F', '#FF6B35', '#14213D']
const archetype = (await loadArchetypes()).saas
const brief = { topic: '청춘케어(예시)', archetype: 'saas', locale: 'ko', facts: { name: '청춘케어' }, seed: 7, brand: { colors: COLORS } }
const themeOfPreset = (p) => (p.recipeHints?.defaultTheme === 'dark' ? 'dark' : 'light')

test('T19 주색: 처음 적은 유채색이 주색이다 — 초록이 먼저면 주황이 아니라 초록(색조 160±15°)', async () => {
  const { candidates } = await pickDirections({ brief, archetype, seed: 7 })
  const c = candidates.find((x) => x.id === 'c')
  const primary = parseOklch(c.recipe.color.light.primary)
  const green = hexToOklch('0F7B5F')
  assert.ok(hueDist(primary[2], green[2]) <= 15, `c 주색 색조 ${primary[2]}° — 브랜드 초록 ${green[2]}°`)
  assert.ok(Math.abs(primary[2] - 160) <= 15 || hueDist(primary[2], 160) <= 15, `색조 ${primary[2]}`)
})

test('T19 순서가 바뀌면 주색도 바뀐다 — 주황을 먼저 적으면 주황이 주색(채도가 아니라 순서)', () => {
  const preset = listPresets({ archetype: 'saas' })[0]
  const a = brandToRecipeHead({ colors: ['#FF6B35', '#0F7B5F'] }, preset, { archetype: 'saas' })
  const b = brandToRecipeHead({ colors: ['#0F7B5F', '#FF6B35'] }, preset, { archetype: 'saas' })
  const hue = (r) => parseOklch(r.head.color.light.primary)[2]
  assert.ok(hueDist(hue(a), hexToOklch('FF6B35')[2]) <= 15 && hueDist(hue(b), hexToOklch('0F7B5F')[2]) <= 15, `${hue(a)}° / ${hue(b)}°`)
})

test('T19 테마: 브랜드 색이 밝은 바탕이면 c 의 defaultTheme 은 light 이고 바탕 프리셋도 light 다(프리셋 힌트가 덮지 않는다)', async () => {
  assert.equal(brandThemeOf({ colors: COLORS }), 'light')
  assert.equal(brandThemeOf({ colors: ['#FFFFFF', '#0F7B5F'] }), 'light')
  assert.equal(brandThemeOf({}), 'light')
  const { candidates } = await pickDirections({ brief, archetype, seed: 7 })
  const c = candidates.find((x) => x.id === 'c')
  assert.notEqual(c.recipe.defaultTheme, 'dark')
  const base = listPresets({ archetype: 'saas' }).find((p) => p.id === c.preset)
  assert.equal(themeOfPreset(base), 'light', `바탕 프리셋 ${c.preset}`)
})

test('T19 어두운 프리셋을 바탕으로 줘도 브랜드 테마가 이긴다(presetToRecipeHead opts.defaultTheme)', () => {
  const dark = listPresets({ archetype: 'saas' }).find((p) => themeOfPreset(p) === 'dark')
  assert.ok(dark, '시험 재료: 어두운 프리셋이 있다')
  const r = brandToRecipeHead({ colors: COLORS }, dark, { archetype: 'saas' })
  assert.notEqual(r.head.defaultTheme, 'dark')
})

test('T19 색이 없는 브랜드(서체·로고만)는 바탕 프리셋의 테마를 그대로 따른다', () => {
  const dark = listPresets({ archetype: 'saas' }).find((p) => themeOfPreset(p) === 'dark')
  const r = brandToRecipeHead({ logo: '/x/logo.svg' }, dark, { archetype: 'saas' })
  assert.equal(r.head.defaultTheme, 'dark')
})
