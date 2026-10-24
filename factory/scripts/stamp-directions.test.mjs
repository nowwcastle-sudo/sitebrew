// 01-direction 방향 3안 고르기(P3-3 Task 3) — 녹화 데이터 대신 저장소의 실제 프리셋·팔레트·레시피(P3-2 Task 16a 산출물)를 쓴다.
// 원형 객체는 Task 1 archetypes.mjs loadArchetypes() 로 읽는다(C16). 라이브러리 머리는 style-presets loadLibrary().
// 브랜드 테스트는 brand.mjs(Task 4)가 생기기 전까지 FAIL 이 정상이다(건너뛰지 않는다 — 계획 Task 3 Step 3·4).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickDirections, axisDistance, DirectionsShortError, diversityOrder, paletteKey, mulberry32 } from '../stamp/directions.mjs'
import { loadLibrary } from './style-presets.mjs'
import { loadArchetypes } from './archetypes.mjs'

const archetypes = await loadArchetypes()
const loadArchetype = (id) => archetypes[id]
const arch = loadArchetype('saas')
const brief = { topic: '미수금 독촉 자동화(예시)', archetype: 'saas', locale: 'en', facts: { name: 'Example Co' }, seed: 7 }
const library = loadLibrary()
const headOf = (c) => (typeof c.recipe === 'string' ? library.find((r) => r.id === c.recipe) : c.recipe)
const base = await pickDirections({ brief, archetype: arch, seed: 7 })

test('slots are safe=library, new=generated, bold=generated with highest novelty', () => {
  const { candidates } = base
  assert.deepEqual(candidates.map((c) => [c.id, c.slot, c.source]), [['a', 'safe', 'library'], ['b', 'new', 'generated'], ['c', 'bold', 'generated']])
  assert.ok(candidates[2].novelty >= candidates[1].novelty)
  assert.ok(library.find((r) => r.id === candidates[0].recipe).archetypes.includes('saas'))
  for (const c of candidates) assert.ok(c.why && c.fonts?.display && c.fonts?.body, c.id)
})

test('every pair differs in >= 2 axes, generated also >= 2 from every library recipe', () => {
  const heads = base.candidates.map(headOf)
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(axisDistance(heads[i], heads[j]) >= 2, `${i}~${j}`)
  for (const h of heads.slice(1)) for (const r of library) assert.ok(axisDistance(h, r) >= 2, `${h.id} ~ ${r.id}`)
})

test('bold is the highest novelty among all passing generated candidates', async () => {
  const noFilter = await pickDirections({ brief, archetype: arch, seed: 7, _paletteDiversity: false })
  assert.equal(noFilter.candidates[2].novelty, base.candidates[2].novelty)
})

test('same seed -> same candidates (golden set determinism); different seed may change only the seeded choices', async () => {
  const a = await pickDirections({ brief, archetype: arch, seed: 7 })
  assert.deepEqual(a.candidates, base.candidates)
  assert.deepEqual(a.rejected, base.rejected)
  const r1 = mulberry32(7), r2 = mulberry32(7)
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()])
})

test('brand input puts the brand candidate in the bold slot (FAILS until P3-3 Task 4 adds factory/stamp/brand.mjs)', async () => {
  const { candidates } = await pickDirections({ brief: { ...brief, brand: { colors: ['#0B5FFF', '#FFFFFF'] } }, archetype: arch, seed: 7 })
  assert.equal(candidates[2].source, 'brand')
})

test('rejected generated candidates are replaced; if pool is exhausted it throws with rule ids', async () => {
  await assert.rejects(() => pickDirections({ brief, archetype: arch, seed: 7, _presetFilter: () => false }), (e) => e instanceof DirectionsShortError && e.rejected.length > 0 && e.rejected.some((r) => r.id.startsWith('slot:')))
  // 라이브러리 레시피에서 나온 프리셋만 남기면 모두 라이브러리와 축 차이 < 2 로 떨어진다 — 떨어진 후보마다 규칙 id.
  await assert.rejects(() => pickDirections({ brief, archetype: arch, seed: 7, _presetFilter: (p) => p.source.startsWith('recipe:') }), (e) => {
    assert.ok(e instanceof DirectionsShortError)
    const cands = e.rejected.filter((r) => !r.id.startsWith('slot:'))
    assert.ok(cands.length > 0)
    for (const r of cands) assert.ok(r.reasons.length && r.reasons.every((x) => /^axis-distance:(safe|library:[\w-]+)$/.test(x)), JSON.stringify(r))
    return true
  })
})

test('a generated candidate that fails lint is replaced by the next in the same slot, with the lint rule id recorded (Review Focus 2)', async () => {
  const top = base.candidates[1].recipe.id
  const r = await pickDirections({ brief, archetype: arch, seed: 7, _lint: (h) => (h.id === top ? ['texture-contrast: 시험용 실패'] : []) })
  assert.equal(r.candidates.length, 3)
  assert.notEqual(r.candidates[1].recipe.id, top)
  assert.equal(r.candidates[1].source, 'generated')
  assert.ok(r.rejected.some((x) => x.id.includes(base.candidates[1].palette) && x.reasons.includes('lint:texture-contrast')))
  // 모두 lint 에 걸리면 2안만 내지 않고 던진다.
  await assert.rejects(() => pickDirections({ brief, archetype: arch, seed: 7, _lint: () => ['schema: 시험용'] }), (e) => e instanceof DirectionsShortError && e.rejected.some((x) => x.reasons.includes('lint:schema')))
})

test('a candidate dropped by a later gate (exclude, e.g. ai-tell in Task 11) is refilled from the same slot and recorded', async () => {
  const bold = base.candidates[2]
  const r = await pickDirections({ brief, archetype: arch, seed: 7, exclude: [{ id: bold.recipe.id, reasons: ['ai-tell:G-over-threshold'] }] })
  assert.equal(r.candidates[2].source, 'generated')
  assert.notEqual(r.candidates[2].recipe.id, bold.recipe.id)
  assert.ok(r.rejected.some((x) => x.id.includes(bold.palette) && x.reasons.includes('ai-tell:G-over-threshold')))
})

test('library recipes with an archetypeConditions note for this archetype are used only when no unconditional recipe fits', async () => {
  const local = loadArchetype('local')
  for (const seed of [1, 2, 3, 4]) {
    const { candidates } = await pickDirections({ brief: { ...brief, archetype: 'local', seed }, archetype: local, seed })
    const r = library.find((x) => x.id === candidates[0].recipe)
    assert.ok(r.archetypes.includes('local') && !r.archetypeConditions?.local, `${seed}: ${r.id}`)
  }
})

test('weights reorder only among passing candidates', async () => {
  const w = await pickDirections({ brief, archetype: arch, seed: 7, weights: [{ scope: 'recipe', key: base.candidates[0].recipe, archetype: 'saas', lift: 0.01, conversions: 5, samples: 10 }] })
  assert.deepEqual(w.candidates, base.candidates) // 전환 5건 < 30 → 무시
  // 양성 대조: 30건 이상이면 ① 칸 안 순서가 바뀐다.
  const other = library.find((r) => r.archetypes.includes('saas') && r.id !== base.candidates[0].recipe).id
  const w2 = await pickDirections({ brief, archetype: arch, seed: 7, weights: [{ scope: 'recipe', key: other, archetype: 'saas', lift: 0.5, conversions: 40, samples: 400 }] })
  assert.equal(w2.candidates[0].recipe, other)
  // 가중치가 원형에 맞지 않는 레시피를 새로 들이지는 못한다.
  const alien = library.find((r) => !r.archetypes.includes('saas')).id
  const w3 = await pickDirections({ brief, archetype: arch, seed: 7, weights: [{ scope: 'recipe', key: alien, archetype: 'saas', lift: 9, conversions: 999, samples: 9999 }] })
  assert.deepEqual(w3.candidates, base.candidates)
})

test('C10: new and bold never share a palette with each other or with safe while an alternative passes; off-switch shows the clash it prevents', async () => {
  let clashesOff = 0
  for (const id of ['detail', 'commerce', 'saas']) for (const seed of [1, 2, 3]) {
    const b = { ...brief, archetype: id, seed }
    const on = await pickDirections({ brief: b, archetype: loadArchetype(id), seed })
    assert.equal(new Set(on.candidates.map((c) => paletteKey(c.palette))).size, 3, `${id}/${seed}`)
    const off = await pickDirections({ brief: b, archetype: loadArchetype(id), seed, _paletteDiversity: false })
    if (new Set(off.candidates.map((c) => paletteKey(c.palette))).size < 3) clashesOff++
  }
  assert.ok(clashesOff > 0, '벌점 없이도 겹침이 없다 — 양성 대조가 사라졌다(프리셋 팔레트 분포가 바뀌었는지 확인 — 씨앗이 팔레트를 뽑게 된 뒤(P4GD)로는 detail·commerce 씨앗 3 에서 겹친다)')
})

test('diversityOrder puts shared palettes last and falls back to them only when nothing else is left', () => {
  const list = [{ palette: 'p1' }, { palette: 'pal-recipe-r1-measure-b' }, { palette: 'p2' }]
  assert.deepEqual(diversityOrder(list, ['p1', 'pal-recipe-r1-measure']).map((c) => c.palette), ['p2', 'p1', 'pal-recipe-r1-measure-b'])
  assert.deepEqual(diversityOrder([{ palette: 'p1' }], ['p1']).map((c) => c.palette), ['p1'])
})

test('axisDistance counts 9 axes + motion + color logic + colour', () => {
  const r = library[0]
  assert.equal(axisDistance(r, r), 0)
  assert.equal(axisDistance(r, { ...r, motion: r.motion === 'M0' ? 'M1' : 'M0' }), 1)
  assert.equal(axisDistance(r, { ...r, axes: { ...r.axes, display: 'D2' }, colorLogic: r.colorLogic === 'K1' ? 'K3' : 'K1' }), 2)
  const other = library.find((x) => x.id !== r.id && axisDistance(r, x) > 0)
  assert.equal(axisDistance(r, other), axisDistance(other, r))
})

test('minAxes: 올리면 모든 쌍과 생성 안~라이브러리 거리가 그 값 이상이다(기본 고름에는 더 가까운 쌍이 있다) · 안 주면 예전 그대로 · 채울 수 없으면 던진다', async () => {
  const dash = loadArchetype('dashboard')
  const b = { topic: '운영 현황판(예시)', archetype: 'dashboard', locale: 'en', facts: { name: 'Example Co' }, seed: 1 }
  const closest = ({ candidates }) => {
    const heads = candidates.map(headOf)
    const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => axisDistance(heads[i], heads[j]))
    const libs = heads.slice(1).flatMap((h) => library.filter((r) => r.id !== heads[0].id).map((r) => axisDistance(h, r)))
    return Math.min(...pairs, ...libs)
  }
  const normal = await pickDirections({ brief: b, archetype: dash, seed: 1 })
  const minAxes = closest(normal) + 1
  const wide = await pickDirections({ brief: b, archetype: dash, seed: 1, minAxes })
  assert.ok(closest(wide) >= minAxes, `넓힌 뒤 가장 가까운 거리 ${closest(wide)} < ${minAxes}`)
  assert.deepEqual((await pickDirections({ brief: b, archetype: dash, seed: 1, minAxes: undefined })).candidates, normal.candidates)
  await assert.rejects(() => pickDirections({ brief: b, archetype: dash, seed: 1, minAxes: 99 }), DirectionsShortError)
})
