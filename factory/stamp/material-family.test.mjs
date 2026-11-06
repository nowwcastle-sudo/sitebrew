// v0.2.6 T21 — 「다른 세계」: 재료 계열 분류표 · 시각 거리 · 색 전략 · 후보 머리 4칸 · b 팔레트 브랜드 색조 · 보라 확장.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { materialFamily, colorStrategy, FAMILIES } from './material-family.mjs'
import { visualDistance, checkWorldSpread, SPACE_RULE, thesisOf, familyClash, DISTANCE_FIELDS } from './visual-distance.mjs'
import { pickDirections } from './directions.mjs'
import { goldenSet } from './golden.mjs'
import { pickPalettes, listPresets, loadPalettePool } from '../scripts/style-presets.mjs'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { hexToOklch, hueDist } from '../scripts/lib/palette-lib.mjs'
import { isAiTellViolet, violetRoleOf } from '../scripts/lib/palette-rules.mjs'
import { brandPrimaryOf } from './brand.mjs'

const archs = await loadArchetypes()
const head = (axes = {}, extra = {}) => ({ id: 'h', axes: { radius: 'R1', button: 'B1', input: 'I1', surface: 'C1', table: 'T2', header: 'H1', shadow: 'S1', ...axes }, motion: 'M1', colorLogic: 'K1', defaultTheme: 'light', ...extra })

test('계열 분류표: P1 4.6절 — 앞에서부터 첫 일치(glass → collage → print → paper → kinetic → editorial → terminal → plain)', () => {
  assert.equal(materialFamily(head({ surface: 'C5' })), 'glass')
  assert.equal(materialFamily(head({ texture: 'X7' })), 'glass')
  assert.equal(materialFamily(head({ texture: 'X8' })), 'glass')
  assert.equal(materialFamily(head({ texture: 'X3' })), 'collage')
  assert.equal(materialFamily(head({ surface: 'C8' })), 'collage')
  assert.equal(materialFamily(head({ texture: 'X2' })), 'print')
  assert.equal(materialFamily(head({ surface: 'C6' })), 'print')
  for (const x of ['X1', 'X4', 'X5', 'X6']) assert.equal(materialFamily(head({ texture: x })), 'paper', x)
  assert.equal(materialFamily(head({ shadow: 'S3' })), 'paper')
  assert.equal(materialFamily(head({ display: 'D3' })), 'kinetic')
  assert.equal(materialFamily(head({}, { motion: 'M3' })), 'kinetic')
  assert.equal(materialFamily(head({ header: 'H5' })), 'editorial')
  assert.equal(materialFamily(head({ display: 'D2' })), 'editorial')
  assert.equal(materialFamily(head({ radius: 'R0', table: 'T4' }, { defaultTheme: 'dark' })), 'terminal')
  assert.equal(materialFamily(head({ radius: 'R0', table: 'T1' }, { defaultTheme: 'dark' })), 'terminal')
  assert.equal(materialFamily(head({ radius: 'R0', table: 'T4' }, { defaultTheme: 'light' })), 'plain', '밝은 화면은 터미널이 아니다')
  assert.equal(materialFamily(head()), 'plain')
  // 우선순위: glass 가 collage·paper·kinetic 보다 먼저, paper 가 kinetic 보다 먼저
  assert.equal(materialFamily(head({ surface: 'C5', texture: 'X3', display: 'D3' })), 'glass')
  assert.equal(materialFamily(head({ texture: 'X1', display: 'D3' })), 'paper')
  assert.equal(materialFamily(head({ display: 'D3', header: 'H5' })), 'kinetic')
  assert.deepEqual([...FAMILIES].sort(), ['collage', 'editorial', 'glass', 'kinetic', 'paper', 'plain', 'print', 'terminal'])
})

test('색 전략: K1·K3·K5·K9 Restrained · K4·K6·K7 Committed · K2·K8 Full', () => {
  const s = (k) => colorStrategy({ colorLogic: k })
  for (const k of ['K1', 'K3', 'K5', 'K9']) assert.equal(s(k), 'Restrained', k)
  for (const k of ['K4', 'K6', 'K7']) assert.equal(s(k), 'Committed', k)
  for (const k of ['K2', 'K8']) assert.equal(s(k), 'Full', k)
})

test('시각 거리: 7칸(surface·header·shadow·display·texture·defaultTheme·hero), 값이 없으면 기본값으로 채워 비교', () => {
  assert.deepEqual(DISTANCE_FIELDS, ['surface', 'header', 'shadow', 'display', 'texture', 'defaultTheme', 'hero'])
  const a = head({}, { hero: 'h1' })
  assert.equal(visualDistance(a, a), 0)
  assert.equal(visualDistance(a, head({}, { hero: 'h1' })), 0)
  assert.equal(visualDistance(a, head({ display: 'D1', texture: 'X0' }, { hero: 'h1' })), 0, '기본값 D1·X0 은 없는 것과 같다')
  assert.equal(visualDistance(a, head({ surface: 'C2' }, { hero: 'h1' })), 1)
  assert.equal(visualDistance(a, head({ header: 'H2', shadow: 'S2' }, { hero: 'h1' })), 2)
  assert.equal(visualDistance(a, head({}, { hero: 'h2', defaultTheme: 'dark' })), 2)
  assert.equal(visualDistance(head({ surface: 'C2', header: 'H2', shadow: 'S2', display: 'D3', texture: 'X3' }, { hero: 'x', defaultTheme: 'dark' }), a), 7)
  assert.equal(visualDistance(head({ radius: 'R0', button: 'B2' }, { hero: 'h1' }), a), 0, '반경·버튼은 거리에 세지 않는다')
})

test('세계 간격 규칙: 모든 쌍이 거리 2 이상이어야 하고, 어기면 규칙 id visual-distance 로 위반을 돌려준다(계열은 규칙이 아니다)', () => {
  assert.deepEqual(SPACE_RULE, { minDistance: 2, distinctFamily: false })
  const a = { ...head({ surface: 'C1' }), id: 'a' }, b = { ...head({ surface: 'C2', header: 'H2' }), id: 'b' }, c = { ...head({ surface: 'C2', header: 'H3' }), id: 'c' }
  const r = checkWorldSpread([a, b, c])
  assert.equal(r.ok, false)
  assert.deepEqual(r.violations.map((v) => [v.pair.join(''), v.rule]), [['bc', 'visual-distance']])
  assert.equal(checkWorldSpread([a, b]).ok, true)
  assert.ok(familyClash(head({ texture: 'X1' }), head({ shadow: 'S3' })), '같은 종이 계열은 경고 문구만 낸다')
  assert.equal(familyClash(head({ texture: 'X1' }), head({ texture: 'X2' })), '')
})

test('thesis: 「{계열} 세계에서 {색 전략} 색으로 {목표}를 보여 줘요.」 — 받침에 맞춰 을/를', () => {
  assert.equal(thesisOf({ family: 'paper', strategy: 'Restrained', goal: '회사가 하는 일' }), '종이 세계에서 절제한 색으로 회사가 하는 일을 보여 줘요.')
  assert.equal(thesisOf({ family: 'glass', strategy: 'Full', goal: '실제 작업' }), '유리 세계에서 다채로운 색으로 실제 작업을 보여 줘요.')
  assert.equal(thesisOf({ family: 'plain', strategy: 'Committed', goal: '제안과 신청' }).endsWith('제안과 신청을 보여 줘요.'), true)
  assert.match(thesisOf({ family: 'plain', strategy: 'Committed', goal: '최전선 기술' }), /최전선 기술을 보여/)
  assert.match(thesisOf({ family: 'plain', strategy: 'Committed', goal: '가장 쉬운 선택' }), /가장 쉬운 선택을 보여/)
  assert.match(thesisOf({ family: 'plain', strategy: 'Committed', goal: '동네 전문가' }), /동네 전문가를 보여/)
})

test('골든 20개: 세 후보의 모든 쌍이 거리 2 이상이고 후보마다 머리 4칸(thesis·sig·world·risk)이 있다', { timeout: 300_000 }, async () => {
  const fieldsOf = (c) => ['thesis', 'sig', 'world', 'risk'].every((k) => typeof c[k] === 'string')
  for (const e of goldenSet()) {
    const r = await pickDirections({ brief: e.brief, archetype: archs[e.archetype], seed: e.seed })
    const heads = r.candidates.map((c) => ({ id: c.id, ...(typeof c.recipe === 'string' ? library(c.recipe) : c.recipe) }))
    const spread = checkWorldSpread(heads)
    assert.ok(spread.ok, `${e.id}: ${JSON.stringify(spread.violations)}`)
    assert.ok(r.candidates.every(fieldsOf), `${e.id}: 머리 4칸`)
    assert.ok(r.candidates.every((c) => c.thesis.endsWith('보여 줘요.') && c.world.length > 0), e.id)
    // 소비자(대시보드·비교표·완성 리뷰·브랜드 노출 관문)가 읽는 이름도 후보에 있다
    assert.ok(r.candidates.every((c) => FAMILIES.includes(c.materialFamily) && c.ownWorld === c.world && ['Restrained', 'Committed', 'Full'].includes(c.colorStrategy)), `${e.id}: 소비자 칸`)
  }
})
import { loadLibrary } from '../scripts/style-presets.mjs'
const LIB = loadLibrary()
function library(id) { return LIB.find((r) => r.id === id) }

test('b 팔레트: 브랜드 주색이 있으면 팔레트 주색 색조가 유사색(±30°)·보색에 가까운 쪽이 앞선다', () => {
  const green = hexToOklch('0F7B5F')
  const preset = listPresets({ archetype: 'saas' })[0]
  const pool = loadPalettePool()
  const near = (p) => { const H = hexToOklch(p.roles.primary.slice(1)); return H[1] >= 0.05 && (hueDist(H[2], green[2]) <= 30 || hueDist(H[2], (green[2] + 180) % 360) <= 30) }
  const base = pickPalettes(preset, { n: 8, pool }), withBrand = pickPalettes(preset, { n: 8, pool, brand: green })
  assert.ok(withBrand.filter(near).length >= base.filter(near).length)
  assert.ok(withBrand.some(near), '브랜드 색조에 가까운 팔레트가 상위에 든다')
  assert.deepEqual(pickPalettes(preset, { n: 8, pool, brand: [0.6, 0.01, 40] }).map((p) => p.id), base.map((p) => p.id), '무채에 가까운 브랜드는 색조가 뜻이 없다')
})

test('보라 확장: 글자색·강조·링이 AI 티 보라(C 0.30 ·265~300°)면 레퍼런스 팔레트는 풀에서 빠지고, 레시피에서 온 팔레트는 그대로다', () => {
  const violetHex = '#5B21B6'
  assert.ok(isAiTellViolet(hexToOklch(violetHex.slice(1))), '전제: 이 색은 보라 금지 범위다')
  assert.equal(violetRoleOf({ foreground: hexToOklch(violetHex.slice(1)) }), 'foreground')
  assert.equal(violetRoleOf({ background: hexToOklch(violetHex.slice(1)) }), null, '바탕은 대상이 아니다')
  const preset = listPresets({ archetype: 'saas' })[0]
  const pool = loadPalettePool()
  const victim = pickPalettes(preset, { n: 1, pool })[0]
  const marked = { ...victim, id: 'pal-violet-fg', source: { platform: 'test' }, roles: { ...victim.roles, foreground: violetHex } }
  assert.ok(!pickPalettes(preset, { n: 400, pool: [marked, ...pool.filter((p) => p.id !== victim.id)] }).some((p) => p.id === 'pal-violet-fg'))
  const exempt = { ...marked, id: 'pal-violet-recipe', source: 'recipe:r1-measure' }
  assert.ok(pickPalettes(preset, { n: 400, pool: [exempt] }).some((p) => p.id === 'pal-violet-recipe'))
})

test('브랜드 주색: 입력 순서의 첫 유채색(무채만이면 null)', () => {
  assert.deepEqual(brandPrimaryOf({ colors: ['#FFFFFF', '#0F7B5F', '#FF6B35'] }).map((x) => Math.round(x * 100) / 100).slice(2), [Math.round(hexToOklch('0F7B5F')[2] * 100) / 100].map((x) => x))
  assert.equal(brandPrimaryOf({ colors: ['#FFFFFF', '#222222'] }), null)
  assert.equal(brandPrimaryOf({}), null)
})
