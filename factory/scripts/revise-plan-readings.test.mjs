// planReadings — 확정된 읽기 또는 후보 둘에서 「지금 + 다른 안 2개」(설계 5.10)를 만든다. 재료는 라이브러리 레시피 머리와 그 레시피의 팔레트다(사이트 빌드 없음).
//   r5-celadon: 글자 크기 D1 · 여백 normal(기본) · 색 가짓수 K6 — 읽기 하나로 안 a 가 되고, 세기를 하나 올린 안 b 도 나오는 머리.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { loadHandles } from '../stamp/handles.mjs'
import { stepHead } from '../stamp/handles/index.mjs'
import { isSafe } from '../stamp/handles/common.mjs'
import { recipeColors } from '../stamp/site-files.mjs'
import { AXIS_ORDER, axisValue } from './axes.mjs'
import { planReadings } from '../stamp/plan-readings.mjs'
import { derivePalette, loadLibrary, loadPalettePool, recipeToMaterials } from './style-presets.mjs'
import { hexToOklch } from './lib/palette-lib.mjs'
import { parseOklch } from './lib/palette-rules.mjs'

const lex = loadLexicon()
const handles = loadHandles(lex)
const T = grammar.text
const LIB = loadLibrary()

const headOf = (id, patch = {}) => ({ ...structuredClone(LIB.find((r) => r.id === id)), ...patch })
async function ctxOf(head) {
  return { lex, archetype: head.archetypes[0], palette: (await recipeToMaterials(head)).palette, site: {} }
}
const read = (axis, o = {}) => ({ axis, scope: 'site', strength: 1, ...o })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** 머리에서 달라진 레시피 칸 이름들(axes.<축>은 풀어서). */
function diffFields(a, b) {
  const out = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'axes') for (const x of new Set([...Object.keys(a.axes), ...Object.keys(b.axes)])) { if (a.axes[x] !== b.axes[x]) out.push(`axes.${x}`) }
    else if (!same(a[k], b[k])) out.push(k)
  }
  return out
}

test('planReadings [spacing airy 1] (머리 normal): 안 a 는 airy, 안 b 는 없다(세기 2 도 같은 끝) — 이유 grammar.onlyOne', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const readings = [read('spacing', { direction: 'airy' })]
  const r = planReadings(head, { readings }, ctx)
  assert.equal(r.variants.length, 1)
  const [a] = r.variants
  assert.equal(a.id, 'a')
  assert.equal(a.head.spacing, 'airy')
  assert.deepEqual(diffFields(head, a.head), ['spacing'])
  assert.deepEqual(a.readings, readings)
  assert.deepEqual(a.changes, [{ axis: 'spacing', from: '지금', to: '한 칸 더 시원하게' }])
  assert.equal(r.why, T.plan.onlyOne)
  assert.ok(isSafe(a.head, ctx))
  assert.equal(a.say, fill(T.plan.sayReading, { label: '여백', end: '시원하게', amount: '조금' }))
})

test('planReadings [type-scale larger 1] (D1): 안 a D2, 안 b D3 — b 는 세기를 하나 올린 같은 읽기', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const r = planReadings(head, { readings: [read('type-scale', { direction: 'larger' })] }, ctx)
  assert.deepEqual(r.variants.map((v) => v.id), ['a', 'b'])
  assert.deepEqual(r.variants.map((v) => v.head.axes.display), ['D2', 'D3'])
  assert.equal(r.why, undefined)
  assert.deepEqual(r.variants.map((v) => v.readings[0].strength), [1, 2])
  assert.deepEqual(r.variants.map((v) => v.changes[0].to), ['한 칸 더 크게', '두 칸 더 크게'])
  assert.deepEqual(r.variants.map((v) => v.say), ['조금', '많이'].map((amount) => fill(T.plan.sayReading, { label: '글자 크기', end: '크게', amount })), '안 b 는 더 센 말로 알린다')
  assert.deepEqual(r.variants[0].readings[0], read('type-scale', { direction: 'larger' }), '입력 읽기는 바뀌지 않는다')
})

test('planReadings: 끝에 닿은 읽기 — 안 a 가 없으면 되묻고, 세기가 이미 가장 크거나 b 가 a 와 같으면 안 b 만 없다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const top = headOf('r5-celadon', { axes: { ...head.axes, display: 'D3' } })
  assert.deepEqual(planReadings(top, { readings: [read('type-scale', { direction: 'larger' })] }, ctx), { ask: T.step.atEnd })
  const mid = headOf('r5-celadon', { axes: { ...head.axes, display: 'D2' } })
  const one = planReadings(mid, { readings: [read('type-scale', { direction: 'larger' })] }, ctx)
  assert.deepEqual(one.variants.map((v) => v.head.axes.display), ['D3'], 'D2 에서는 세기 2 도 D3 — a 와 같은 안은 내지 않는다')
  assert.equal(one.why, T.plan.onlyOne)
  const max = planReadings(head, { readings: [read('type-scale', { direction: 'larger', strength: 2 })] }, ctx)
  assert.deepEqual(max.variants.map((v) => v.head.axes.display), ['D3'], '세기가 이미 최대라 올릴 수 없다')
  assert.equal(max.why, T.plan.onlyOne)
})

test('planReadings [spacing airy 1, palette-count fewer 1, color-temperature warm 0 cap]: a = 여백 + 색 가짓수 한 등급 아래 + 색 온도 그대로, b 없음(여백이 끝)', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const readings = [
    read('spacing', { direction: 'airy' }),
    read('palette-count', { direction: 'fewer' }),
    read('color-temperature', { direction: 'warm', strength: 0, cap: true }),
  ]
  const r = planReadings(head, { readings }, ctx)
  assert.equal(r.variants.length, 1)
  const [a] = r.variants
  assert.equal(a.head.spacing, 'airy')
  const logic = stepHead(head, readings[1], ctx).head.colorLogic
  assert.equal(a.head.colorLogic, logic)
  assert.notEqual(logic, head.colorLogic)
  // 색 온도는 그대로 — 색은 후보의 팔레트를 새 색 논리로 다시 펼친 것 그대로다(다른 팔레트로 옮겨 가지 않았다)
  const start = derivePalette({ ...ctx.palette, theme: undefined }, { colorLogic: logic, axes: head.axes })
  assert.deepEqual(a.head.color, { light: start.light, dark: start.dark }, '팔레트가 같다')
  assert.deepEqual(a.changes.map((c) => [c.axis, c.to]), [['spacing', '한 칸 더 시원하게'], ['palette-count', '한 칸 더 적게'], ['color-temperature', '그대로']])
  assert.equal(r.why, T.plan.onlyOne)
  assert.ok(isSafe(a.head, ctx))
})

test('planReadings options: 사전 looks-ai-made 의 원인 둘 — 안 a 는 글꼴 칸만, 안 b 는 색 칸만 바뀐다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const options = lex.entries.find((e) => e.id === 'looks-ai-made').causes.slice(0, 2).map((c) => ({ readings: c.reading.map((r) => ({ ...r, scope: 'site' })) }))
  assert.equal(options.length, 2)
  const r = planReadings(head, { options }, ctx)
  assert.deepEqual(r.variants.map((v) => v.id), ['a', 'b'])
  assert.equal(r.why, undefined)
  const [a, b] = r.variants
  assert.deepEqual(a.readings, options[0].readings)
  assert.deepEqual(b.readings, options[1].readings)
  const own = (k) => !['id', 'name', 'alternates'].includes(k) // 이름표(id·name)와 옛 색 기준 B안은 따라 바뀐다
  assert.deepEqual(diffFields(head, a.head).filter(own), ['fonts'], '안 a 는 글꼴만')
  assert.deepEqual(diffFields(head, b.head).filter(own), ['color'], '안 b 는 색 칸만')
  assert.ok(isSafe(a.head, ctx) && isSafe(b.head, ctx))
})

test('planReadings options: 한쪽만 되면 되는 쪽이 안 a — 선택지 a 가 안 되면 b 가 안 a 가 되고 이유는 a 의 되물음, b 가 안 되면 안 a 만 · 둘 다 안 되면 a 의 되물음', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const top = headOf('r5-celadon', { axes: { ...head.axes, display: 'D3' } })
  const stuck = { readings: [read('type-scale', { direction: 'larger' })] }
  const fine = { readings: [read('spacing', { direction: 'airy' })] }
  const first = planReadings(top, { options: [stuck, fine] }, ctx)
  assert.deepEqual(first.variants.map((v) => v.id), ['a'])
  assert.deepEqual(first.variants[0].readings, fine.readings, '되는 선택지가 안 a 다')
  assert.equal(first.variants[0].head.spacing, 'airy')
  assert.equal(first.why, T.step.atEnd)
  const second = planReadings(top, { options: [fine, stuck] }, ctx)
  assert.deepEqual(second.variants.map((v) => v.id), ['a'])
  assert.equal(second.variants[0].head.spacing, 'airy')
  assert.equal(second.why, T.step.atEnd)
  assert.deepEqual(planReadings(top, { options: [stuck, stuck] }, ctx), { ask: T.step.atEnd })
  const bright = read('color-lightness', { direction: 'bright' })
  const clashing = { readings: [bright, read('color-lightness', { direction: 'dark' })] }
  const viaClash = planReadings(top, { options: [clashing, fine] }, ctx)
  assert.deepEqual(viaClash.variants.map((v) => v.readings), [fine.readings], '선택지 안의 충돌도 같은 길이다')
  assert.equal(viaClash.why, fill(T.clash.ko, { a: '밝게', b: '어둡게' }))
})

/** 후보 팔레트 풀 · 머리 색이 어느 풀 팔레트에서 왔는지(색 논리·축 그대로 펼쳐 같은 것). */
const POOL = loadPalettePool().filter((p) => p.use === 'recipe')
const paletteOf = (head) => POOL.find((p) => same(derivePalette({ ...p, theme: undefined }, { colorLogic: head.colorLogic, axes: head.axes }).light, head.color.light))
const bgL = (p) => hexToOklch(p.roles.background.slice(1))[0]
const hits = (p, tags) => p.mood.filter((m) => tags.includes(m)).length
const HEADS = ['r5-celadon', 'r1-measure', 'r10-console', 'r6-civic', 'r3-woodblock', 'r9-clay']

test('planReadings 색 읽기 둘: 한 읽기의 색 효과가 다른 읽기에 지워지지 않는다 — 온도·밝기·진하기·색 가짓수·보라 피하기가 최종 머리에 모두 보인다', async () => {
  const warm = handles.palette.temperature.warm
  const vivid = handles.palette.saturation.vivid
  let checked = 0
  for (const id of HEADS) {
    const head = headOf(id)
    const ctx = await ctxOf(head)
    const start = ctx.palette
    const pair = (x, y) => planReadings(head, { readings: [x, y] }, ctx)
    const bright = read('color-lightness', { direction: 'bright' })
    const warmR = read('color-temperature', { direction: 'warm' })
    const vividR = read('color-saturation', { direction: 'vivid' })
    const fewer = read('palette-count', { direction: 'fewer' })
    const avoid = read('color-hue', { value: 'away-from-indigo-violet' })
    for (const [x, y] of [[warmR, bright], [bright, warmR], [avoid, warmR], [warmR, avoid], [vividR, bright], [bright, vividR]]) {
      const r = pair(x, y)
      if (r.ask) continue // 조건을 모두 지키는 팔레트가 없으면 되묻는다(틀린 안을 내지 않는다)
      checked++
      const a = r.variants[0]
      const p = paletteOf(a.head)
      assert.ok(p, `${id}: 최종 색이 풀 팔레트에서 왔다`)
      assert.deepEqual(a.changes.map((c) => c.axis), [x.axis, y.axis], `${id}: changes 에 둘 다`)
      for (const rd of [x, y]) {
        if (rd.axis === 'color-temperature') assert.ok(hits(p, warm) > 0, `${id}: 따뜻한 팔레트`)
        if (rd.axis === 'color-saturation') assert.ok(hits(p, vivid) > 0, `${id}: 쨍한 팔레트`)
        if (rd.axis === 'color-lightness') assert.ok(bgL(p) > bgL(start), `${id}: 처음보다 밝은 배경`)
        if (rd.axis === 'color-hue') assert.ok(p.hue_family && !/indigo|violet|purple/i.test(p.hue_family), `${id}: 보라·남색 계열이 아니다`)
      }
    }
    const fe = pair(warmR, fewer)
    if (!fe.ask) {
      checked++
      const a = fe.variants[0]
      assert.notEqual(a.head.colorLogic, head.colorLogic, `${id}: 색 가짓수가 한 등급 아래`)
      const p = paletteOf(a.head)
      assert.ok(p && hits(p, warm) > 0, `${id}: 따뜻한 팔레트가 새 색 논리로 펼쳐졌다`)
      assert.deepEqual(a.changes.map((c) => c.axis), ['color-temperature', 'palette-count'])
    }
  }
  assert.ok(checked >= HEADS.length * 3, `읽기 둘이 실제로 적용된 경우가 충분하다(${checked})`)
})

test('planReadings 같은 축에 값 둘(빨강·파랑): 값마다 한 안 — 안 a 는 첫 값, 안 b 는 둘째 값 · 값이 셋이거나 갈린 축이 둘이면 되묻는다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const red = read('color-hue', { value: 'red' })
  const blue = read('color-hue', { value: 'blue' })
  const r = planReadings(head, { readings: [red, blue, read('spacing', { direction: 'airy' })] }, ctx)
  assert.deepEqual(r.variants.map((v) => v.id), ['a', 'b'])
  assert.deepEqual(r.variants.map((v) => v.readings.map((x) => x.value ?? x.direction)), [['red', 'airy'], ['blue', 'airy']])
  assert.ok(r.variants.every((v) => v.head.spacing === 'airy'), '나머지 읽기는 두 안 모두에 든다')
  assert.notDeepEqual(r.variants[0].head.color, r.variants[1].head.color)
  assert.equal(r.why, undefined)
  const clash = (x, y) => ({ ask: fill(T.clash.ko, { a: x, b: y }) })
  assert.deepEqual(planReadings(head, { readings: [red, blue, read('color-hue', { value: 'green' })] }, ctx), clash('빨강', '파랑'))
  assert.deepEqual(planReadings(head, { readings: [red, blue, read('type-family', { value: 'serif' }), read('type-family', { value: 'sans' })] }, ctx), clash('빨강', '파랑'), '값이 갈린 축이 둘')
})

test('planReadings 색 읽기: 값으로 정한 색(빨강·파랑 등)은 다른 색 읽기와 함께 적용할 수 없어 되묻는다 · 글꼴 값은 색과 함께 된다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const blue = read('color-hue', { value: 'blue' })
  const warm = read('color-temperature', { direction: 'warm' })
  const ask = { ask: T.plan.colorTwo }
  assert.deepEqual(planReadings(head, { readings: [blue, warm] }, ctx), ask)
  assert.deepEqual(planReadings(head, { readings: [warm, blue] }, ctx), ask)
  assert.deepEqual(planReadings(head, { readings: [blue, read('palette-count', { direction: 'fewer' })] }, ctx), ask)
  assert.ok(planReadings(head, { readings: [blue] }, ctx).variants, '값 하나는 된다')
  const mixed = planReadings(head, { readings: [read('type-family', { value: 'distinctive' }), warm] }, ctx)
  assert.deepEqual(mixed.variants[0].changes.map((c) => c.axis), ['type-family', 'color-temperature'])
  assert.ok(mixed.variants[0].head.fonts && paletteOf(mixed.variants[0].head), '글꼴과 색이 함께 바뀐다')
})

test('planReadings 상한(색 축): 다른 색 읽기가 상한 축의 팔레트를 처음보다 그 방향으로 넘기지 않는다 — 모든 라이브러리 머리', async () => {
  const warm = read('color-temperature', { direction: 'warm' })
  const cap = (direction) => read('color-lightness', { direction, strength: 0, cap: true })
  let yielded = 0
  for (const head of LIB.map((r) => structuredClone(r))) {
    const ctx = await ctxOf(head)
    for (const direction of ['bright', 'dark']) {
      const r = planReadings(head, { readings: [warm, cap(direction)] }, ctx)
      if (r.ask) continue // 조건을 지키는 팔레트가 없으면 되묻는다
      for (const v of r.variants) {
        const p = paletteOf(v.head)
        assert.ok(p, `${head.id}`)
        const sign = direction === 'bright' ? 1 : -1
        assert.ok(sign * (bgL(p) - bgL(ctx.palette)) <= 0, `${head.id} ${direction}: 상한을 넘은 밝기`)
        assert.ok(hits(p, handles.palette.temperature.warm) > 0, `${head.id}: 따뜻하게는 지킨다`)
      }
      yielded++
    }
  }
  assert.ok(yielded >= 15, `상한 아래에서 안이 나온 경우가 충분하다(${yielded})`)
})

test('planReadings 상한(온도): 따뜻함 상한은 다른 읽기가 처음보다 더 따뜻한 팔레트로 가지 못하게 한다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const r = planReadings(head, { readings: [read('color-lightness', { direction: 'bright' }), read('color-temperature', { direction: 'warm', strength: 0, cap: true })] }, ctx)
  assert.ok(r.variants, '되는 팔레트가 있다')
  const warm = handles.palette.temperature.warm
  for (const v of r.variants) assert.ok(hits(paletteOf(v.head), warm) <= hits(ctx.palette, warm), '처음보다 더 따뜻해지지 않는다')
})

test('planReadings [color-lightness bright 1, color-lightness bright 0 cap]: a 는 한 칸, 같은 축 상한이 있어 b 는 없다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const readings = [read('color-lightness', { direction: 'bright' }), read('color-lightness', { direction: 'bright', strength: 0, cap: true })]
  const r = planReadings(head, { readings }, ctx)
  assert.equal(r.variants.length, 1)
  const solo = stepHead(head, readings[0], ctx)
  assert.deepEqual(r.variants[0].head, solo.head)
  assert.equal(r.variants[0].changes[0].to, solo.to)
  assert.equal(r.why, T.plan.onlyOne)
  // 상한이 반대쪽에 있어도 같은 축이면 b 는 없다
  const other = planReadings(head, { readings: [readings[0], read('color-lightness', { direction: 'dark', strength: 0, cap: true })] }, ctx)
  assert.equal(other.variants.length, 1)
})

test('planReadings: 같은 축 반대 방향 두 개는 되묻는다(상한은 반대가 아니다)', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const bright = read('color-lightness', { direction: 'bright' })
  const dark = read('color-lightness', { direction: 'dark' })
  const clash = { ask: fill(T.clash.ko, { a: '밝게', b: '어둡게' }) }
  assert.deepEqual(planReadings(head, { readings: [bright, dark] }, ctx), clash)
  const viaOptions = planReadings(head, { options: [{ readings: [bright, dark] }, { readings: [bright] }] }, ctx)
  assert.deepEqual([viaOptions.variants.map((v) => v.id), viaOptions.why], [['a'], clash.ask], '선택지 안의 충돌은 그 선택지를 빼고 이유로 알린다')
  assert.deepEqual(planReadings(head, { options: [{ readings: [bright, dark] }, { readings: [bright, dark] }] }, ctx), clash)
  assert.ok(planReadings(head, { readings: [bright, read('color-lightness', { direction: 'dark', strength: 0, cap: true })] }, ctx).variants, '밝게 + 어둡게는 말고 는 충돌이 아니다')
})

test('planReadings 상한: 다른 읽기의 호환 복구가 상한 방향으로 그 축을 넘기면 그 안을 버리고, a 가 버려지면 noSafeChange', async () => {
  const head = headOf('r3-woodblock')
  const ctx = await ctxOf(head)
  const depth = read('depth', { direction: 'lifted' })
  const plain = stepHead(head, depth, ctx)
  assert.ok(plain.head, '깊이만 올리면 된다')
  const radiusAt = (h) => lex.axes.shape.order.indexOf(h.axes.radius)
  const delta = radiusAt(plain.head) - radiusAt(head)
  assert.notEqual(delta, 0, '이 머리는 입체감을 올리면 모서리 반경이 함께 옮겨진다(호환 복구)')
  const dir = delta > 0 ? 'round' : 'sharp'
  const opposite = dir === 'round' ? 'sharp' : 'round'
  assert.deepEqual(planReadings(head, { readings: [depth, read('shape', { direction: dir, strength: 0, cap: true })] }, ctx), { ask: T.step.noSafeChange })
  const ok = planReadings(head, { readings: [depth, read('shape', { direction: opposite, strength: 0, cap: true })] }, ctx)
  assert.deepEqual(ok.variants[0].head, plain.head, '반대쪽 상한은 막지 않는다')
})

test('planReadings element: 제목 → type-scale 은 실행(사이트 읽기와 같은 결과), 표에 없는 요소·축은 grammar.siteWide', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const site = planReadings(head, { readings: [read('type-scale', { direction: 'larger' })] }, ctx)
  const title = planReadings(head, { readings: [read('type-scale', { direction: 'larger', scope: 'element:제목' })] }, ctx)
  assert.deepEqual(title.variants.map((v) => v.head), site.variants.map((v) => v.head))
  assert.deepEqual(planReadings(head, { readings: [read('shape', { direction: 'round', scope: 'element:버튼' })] }, ctx), { ask: T.ask.siteWide.ko })
  assert.deepEqual(planReadings(head, { readings: [read('spacing', { direction: 'airy', scope: 'element:제목' })] }, ctx), { ask: T.ask.siteWide.ko }, '제목 칸에 없는 축')
  assert.deepEqual(planReadings(head, { readings: [read('type-scale', { direction: 'larger' }), read('shape', { direction: 'round', scope: 'element:버튼' })] }, ctx), { ask: T.ask.siteWide.ko }, '하나라도 못 하면 모두 묻는다')
})

test('handles.yaml elements 의 칸은 그 축 손잡이의 칸과 같다 — 같아야 stepHead 가 요소 읽기를 그 칸으로 옮긴다', () => {
  for (const [name, row] of Object.entries(handles.elements)) {
    for (const [axis, field] of Object.entries(row)) assert.equal(field, handles.axes[axis].field, `${name}.${axis}`)
  }
})

test('planReadings: 구획·쪽 범위 읽기와 모양이 틀린 입력은 던진다(sectionPlan 이 맡는다)', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  assert.throws(() => planReadings(head, { readings: [read('type-scale', { direction: 'larger', scope: 'section:hero' })] }, ctx), /sectionPlan/)
  assert.throws(() => planReadings(head, { readings: [read('type-scale', { direction: 'larger', scope: 'page:home' })] }, ctx), /sectionPlan/)
  assert.throws(() => planReadings(head, { options: [{ readings: [] }] }, ctx), /둘/)
  assert.throws(() => planReadings(head, {}, ctx), /ReadingsInput/)
})

test('planReadings say: 읽기의 source 항목에 사전 say 가 있으면 그것을, 없으면 sayReading 틀을 쓴다 · 상한은 상한 글 · 요소 범위는 앞 글을 붙인다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const entry = lex.entries.find((e) => e.id === 'airy')
  const cited = planReadings(head, { readings: [read('spacing', { direction: 'airy', source: entry.id })] }, ctx)
  assert.equal(cited.variants[0].say, entry.say.ko)
  const plain = planReadings(head, { readings: [read('type-scale', { direction: 'larger' }), read('color-temperature', { direction: 'warm', strength: 0, cap: true })] }, ctx)
  assert.equal(plain.variants[0].say, fill(T.plan.sayReading, { label: '글자 크기', end: '크게', amount: '조금' }) + ' ' + fill(T.say.cap.ko, { label: '따뜻하게' }))
  const scoped = planReadings(head, { readings: [read('type-scale', { direction: 'larger', scope: 'element:제목' })] }, ctx)
  assert.equal(scoped.variants[0].say, fill(T.scope.element.ko, { key: '제목' }) + fill(T.plan.sayReading, { label: '글자 크기', end: '크게', amount: '조금' }))
  const twice = planReadings(head, { readings: [read('spacing', { direction: 'airy', source: 'airy' }), read('type-scale', { direction: 'larger', source: 'airy' })] }, ctx)
  assert.equal(twice.variants[0].say, entry.say.ko + ' ' + fill(T.plan.sayReading, { label: '글자 크기', end: '크게', amount: '조금' }), '사전 글은 그 항목이 읽는 축에만 쓴다')
  const same2 = planReadings(head, { readings: [read('type-scale', { direction: 'larger', source: 'larger' }), read('type-scale', { direction: 'larger', source: 'larger' })] }, ctx)
  assert.equal(same2.variants[0].say, lex.entries.find((e) => e.id === 'larger').say.ko, '같은 글은 한 번만')
  const stronger = planReadings(head, { readings: [read('spacing', { direction: 'airy', source: 'airy', strength: 2 })] }, ctx)
  assert.equal(stronger.variants[0].say, fill(T.plan.sayReading, { label: '여백', end: '시원하게', amount: '많이' }), '사전 글은 사전의 세기를 말하므로 더 센 읽기는 틀로 말한다')
  const valued = planReadings(head, { readings: [read('type-family', { value: 'distinctive' })] }, ctx)
  const sayValue = fill(T.plan.sayValue, { label: '글꼴', end: '흔하지 않은 글꼴' })
  assert.ok(valued.variants[0].say.startsWith(`${sayValue} `) && valued.variants[0].say.length > sayValue.length + 1, '값 읽기는 읽은 말 뒤에 고른 모양(서체 이름)을 붙인다 — 안 a·b 가 무엇이 다른지')
})

/** 머리에 그려진 기본 테마 배경의 L(값으로 정한 색은 풀 팔레트가 아니라 그려진 색으로 잰다). */
const renderedL = (h) => parseOklch(h.color[h.defaultTheme === 'dark' ? 'dark' : 'light'].background)[0]

test('planReadings 색 읽기 둘: 뒤 읽기가 앞 읽기를 되돌리지 않는다 — [bright 1, warm 1] 안 b(밝게 2)는 안 a 보다 어둡지 않고, [bright, bright] 은 첫 읽기만의 결과보다 어둡지 않다(모든 라이브러리 머리)', async () => {
  const bright = read('color-lightness', { direction: 'bright' })
  const warm = read('color-temperature', { direction: 'warm' })
  let compared = 0
  let repeated = 0
  const seen = new Set()
  for (const head of LIB.map((r) => structuredClone(r))) {
    const ctx = await ctxOf(head)
    seen.add(head.id)
    const r = planReadings(head, { readings: [bright, warm] }, ctx)
    if (r.variants?.length === 2) {
      compared++
      const [a, b] = r.variants.map((v) => bgL(paletteOf(v.head)))
      assert.ok(b >= a, `${head.id}: 안 b(밝게 2) ${b} 가 안 a ${a} 보다 어둡다`)
    }
    const twice = planReadings(head, { readings: [bright, bright] }, ctx)
    const first = stepHead(head, bright, ctx)
    if (twice.variants && first.head) {
      repeated++
      assert.ok(bgL(paletteOf(twice.variants[0].head)) >= bgL(first.palette), `${head.id}: 두 번째 밝게가 첫 번째 결과를 어둡게 되돌렸다`)
    }
  }
  assert.ok(seen.has('r10-console'))
  assert.ok(compared >= 5 && repeated >= 10, `비교한 경우가 충분하다(${compared}·${repeated})`)
  const consoleHead = headOf('r10-console')
  const both = planReadings(consoleHead, { readings: [bright, warm] }, await ctxOf(consoleHead))
  assert.ok(both.variants?.length >= 1, 'r10-console 에서도 안이 나온다')
})

test('planReadings 상한 × 값으로 정한 색: [파랑, 밝게 상한]은 그려진 배경이 처음보다 밝은 안을 내지 않고, 온도 상한은 견줄 수 없어 grammar.colorTwo', async () => {
  let yielded = 0
  for (const head of LIB.map((r) => structuredClone(r))) {
    const ctx = await ctxOf(head)
    const start = renderedL(head)
    for (const [direction, sign] of [['bright', 1], ['dark', -1]]) {
      const r = planReadings(head, { readings: [read('color-hue', { value: 'blue' }), read('color-lightness', { direction, strength: 0, cap: true })] }, ctx)
      for (const v of r.variants ?? []) {
        yielded++
        assert.ok(sign * (renderedL(v.head) - start) <= 0, `${head.id} ${direction}: 상한을 넘은 배경`)
      }
    }
    assert.deepEqual(planReadings(head, { readings: [read('color-hue', { value: 'red' }), read('color-temperature', { direction: 'warm', strength: 0, cap: true })] }, ctx), { ask: T.plan.colorTwo }, head.id)
  }
  assert.ok(yielded >= 15, `상한 아래에서 안이 나온 경우가 충분하다(${yielded})`)
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  assert.ok(planReadings(head, { readings: [read('color-hue', { value: 'red' })] }, ctx).variants, '상한이 없으면 값 색은 그대로 된다')
  assert.ok(planReadings(head, { readings: [read('color-hue', { value: 'red' }), read('color-temperature', { direction: 'warm' }), read('color-temperature', { direction: 'warm', strength: 0, cap: true })] }, ctx).ask, '값 색 + 다른 색 읽기는 여전히 되묻는다')
})

// ── { copyFrom }: 다른 시안(또는 아까 모양)의 값을 지금 머리로 옮긴다 ─────────────────────────────────────
const COPY_FIELDS = ['motion', 'colorLogic', 'spacing', 'fonts', 'color', 'defaultTheme']
const withSources = async (head, sources) => ({ ...(await ctxOf(head)), copySources: sources })

test('planReadings {copyFrom} 안 a: 다른 축·모션·색 논리·여백·서체·색 한 벌이 시안 b 와 같고 나머지(이름·분위기·원형)는 지금 그대로 · 안 b 는 없다', async () => {
  const head = headOf('r5-celadon')
  const src = headOf('r1-measure')
  const ctx = await withSources(head, { b: src })
  const r = planReadings(head, { copyFrom: 'b' }, ctx)
  assert.equal(r.variants.length, 1)
  assert.equal(r.why, T.plan.onlyOne)
  const [a] = r.variants
  assert.equal(a.id, 'a')
  assert.deepEqual(a.readings, [])
  assert.equal(a.say, T.plan.sayCopy)
  for (const k of AXIS_ORDER) assert.equal(axisValue(a.head.axes, k), axisValue(src.axes, k), `축 ${k}`)
  for (const k of COPY_FIELDS) assert.deepEqual(a.head[k], src[k], k)
  for (const k of ['id', 'mood', 'archetypes']) assert.deepEqual(a.head[k], head[k], `${k} 은 지금 그대로`)
  assert.ok(isSafe(a.head, ctx))
  assert.notDeepEqual(a.head, head)
  assert.ok(a.changes.length > 0 && a.changes.every((c) => c.from === T.step.current && c.to === T.plan.copyTo && lex.axes[c.axis]), JSON.stringify(a.changes))
  assert.deepEqual(head, headOf('r5-celadon'), '지금 머리는 건드리지 않는다')
})

test('planReadings {copyFrom} 아까 모양(previous): 말은 아까 말, 시안이 없으면 되묻는다(없는 시안·아직 고친 적 없음)', async () => {
  const head = headOf('r5-celadon')
  const prev = grammar.match.candidate.previousId
  const ok = planReadings(head, { copyFrom: prev }, await withSources(head, { [prev]: headOf('r1-measure') }))
  assert.equal(ok.variants[0].say, T.plan.sayPrevious)
  assert.deepEqual(planReadings(head, { copyFrom: prev }, await withSources(head, {})), { ask: T.plan.noPrevious })
  assert.deepEqual(planReadings(head, { copyFrom: 'b' }, await withSources(head, { a: headOf('r1-measure') })), { ask: T.plan.copyMissing })
  assert.deepEqual(planReadings(head, { copyFrom: 'b' }, await ctxOf(head)), { ask: T.plan.copyMissing }, 'copySources 가 아예 없어도 같다')
})

test('planReadings {copyFrom}: 이미 같은 모양이면 되묻고, 옮기면 화면이 깨지는 시안(호환표·린트 위반)은 적용하지 않는다', async () => {
  const head = headOf('r5-celadon')
  assert.deepEqual(planReadings(head, { copyFrom: 'b' }, await withSources(head, { b: structuredClone(head) })), { ask: T.plan.copyNothing })
  // 사이드 레일(H4)은 dashboard 원형 전용 — r10-console 의 축을 옮기면 호환표 위반이다
  for (const id of ['r10-console', 'r4-evidence']) {
    const src = headOf(id)
    const ctx = await withSources(head, { b: src })
    assert.deepEqual(planReadings(head, { copyFrom: 'b' }, ctx), { ask: T.step.noSafeChange }, id)
  }
})

test('planReadings {copyFrom} 아까 모양: 여백만 바뀐 뒤에도 서체만 바뀐 뒤에도 그 값을 되살린다 — 「이미 같아요」로 막지 않는다 · 머리에 안 적힌 여백은 기본값으로 견준다', async () => {
  const prev = grammar.match.candidate.previousId
  const before = headOf('r5-celadon')
  const spaced = { ...structuredClone(before), spacing: 'airy' }
  const a = planReadings(spaced, { copyFrom: prev }, await withSources(spaced, { [prev]: before }))
  assert.equal(a.variants[0].head.spacing, before.spacing, '아까 머리에는 여백이 없었다')
  assert.deepEqual(a.variants[0].changes.map((c) => c.axis), ['spacing'])
  const explicit = { ...structuredClone(before), spacing: 'normal' }
  assert.deepEqual(planReadings(before, { copyFrom: 'b' }, await withSources(before, { b: explicit })), { ask: T.plan.copyNothing }, '여백 normal 을 적은 것과 안 적은 것은 같은 모양이다')
  const other = headOf('r1-measure')
  const refonted = { ...structuredClone(before), fonts: structuredClone(other.fonts) }
  const b = planReadings(refonted, { copyFrom: prev }, await withSources(refonted, { [prev]: before }))
  assert.deepEqual(b.variants[0].head.fonts, before.fonts)
  assert.ok(isSafe(b.variants[0].head, await ctxOf(before)))
})

test('planReadings {copyFrom}: 어두운 기본 테마 시안을 따라 하면 기본 테마와 색이 한 벌로 가서 견본도 어두운 쪽이다 · 밝은 시안을 따라 하면 어두운 기본 테마가 빠진다', async () => {
  const head = headOf('r5-celadon')
  const dark = { ...structuredClone(head), defaultTheme: 'dark' }
  const r = planReadings(head, { copyFrom: 'b' }, await withSources(head, { b: dark }))
  const made = r.variants[0].head
  assert.equal(made.defaultTheme, 'dark')
  assert.equal(recipeColors(made).theme, 'dark')
  assert.equal(recipeColors(made).og.background, head.color.dark.background)
  const back = planReadings(made, { copyFrom: 'b' }, await withSources(made, { b: head }))
  assert.equal('defaultTheme' in back.variants[0].head, false)
  assert.equal(recipeColors(back.variants[0].head).theme, 'light')
})

// ── 마지막 고침 라운드(최종 리뷰) ─────────────────────────────────────────────

const VALUE_CAP = (value) => read('color-hue', { value, strength: 0, cap: true })

test('값 축 상한(color-hue 흰색 상한): 더 가는 안 b 를 만들지 않고 까닭을 남긴다 — 값 축 상한은 안이 그 값에 닿는지 잴 수 없다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const r = planReadings(head, { readings: [read('color-lightness', { direction: 'bright' }), VALUE_CAP('white')] }, ctx)
  assert.equal(r.variants.length, 1)
  assert.equal(r.why, T.plan.onlyOne)
  const free = planReadings(head, { readings: [read('color-lightness', { direction: 'bright' })] }, ctx)
  assert.equal(free.variants.length, 2, '상한이 없으면 안 b 가 있다')
})

test('값 축 상한: 상한 값과 같은 값을 말한 안은 만들지 않는다 — 나눈 두 값 중 하나가 상한이면 다른 값 하나만 안 a', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const r = planReadings(head, { readings: [read('color-hue', { value: 'red' }), read('color-hue', { value: 'blue' }), VALUE_CAP('red')] }, ctx)
  assert.equal(r.variants.length, 1)
  assert.equal(r.variants[0].id, 'a')
  assert.deepEqual(r.variants[0].readings.filter((x) => !x.cap).map((x) => x.value), ['blue'])
  assert.equal(r.why, T.ask.valueCapped.ko)
  assert.equal(r.byOption, true)
  const only = planReadings(head, { readings: [read('color-hue', { value: 'red' }), VALUE_CAP('red')] }, ctx)
  assert.deepEqual(only, { ask: T.ask.valueCapped.ko }, '남는 안이 없으면 묻는다')
  assert.deepEqual(planReadings(head, { readings: [read('color-hue', { value: 'red' }), VALUE_CAP('red')] }, { ...ctx, lang: 'en' }), { ask: T.ask.valueCapped.en })
})

test('byOption: 후보 둘·값을 나눈 읽기만 안마다 자기 해석 — 확정 읽기 하나는 아니다 · 되묻는 글은 ctx.lang 을 따른다', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  assert.equal(planReadings(head, { readings: [read('spacing', { direction: 'airy' })] }, ctx).byOption, undefined)
  assert.equal(planReadings(head, { readings: [read('color-hue', { value: 'red' }), read('color-hue', { value: 'blue' })] }, ctx).byOption, true)
  assert.equal(planReadings(head, { options: [{ readings: [read('spacing', { direction: 'airy' })] }, { readings: [read('motion', { direction: 'dynamic' })] }] }, ctx).byOption, true)
  const clash = [read('spacing', { direction: 'airy' }), read('spacing', { direction: 'tight' })]
  assert.deepEqual(planReadings(head, { readings: clash }, ctx), { ask: fill(T.clash.ko, { a: '시원하게', b: '빽빽하게' }) })
  assert.deepEqual(planReadings(head, { readings: clash }, { ...ctx, lang: 'en' }), { ask: fill(T.clash.en, { a: '시원하게', b: '빽빽하게' }) })
  assert.deepEqual(planReadings(head, { readings: [read('shape', { direction: 'round', scope: 'element:버튼' })] }, { ...ctx, lang: 'en' }), { ask: T.ask.siteWide.en })
})

test('값 읽기의 안 b 는 안 a 와 다른 말을 한다 — 색: 같은 색조의 다른 명도 · 서체: 다른 서체 이름', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  for (const reading of [read('color-hue', { value: 'green' }), read('type-family', { value: 'serif' })]) {
    const { variants } = planReadings(head, { readings: [reading] }, ctx)
    assert.equal(variants.length, 2, reading.value)
    const [a, b] = variants
    assert.notEqual(a.say, b.say, `${reading.value}: 해석 문장`)
    assert.notDeepEqual(a.changes, b.changes, `${reading.value}: 바뀐 곳`)
  }
})

test('값 읽기의 안 설명은 요청 언어를 따른다 — 영어 요청은 영어 글(grammar text.value), 한국어는 한국어', async () => {
  const head = headOf('r5-celadon')
  const ctx = await ctxOf(head)
  const en = planReadings(head, { readings: [read('color-hue', { value: 'green' })] }, { ...ctx, lang: 'en' }).variants
  assert.match(en[0].say, /main color #/)
  assert.match(en[1].say, /same hue, (?:darker|lighter) — main color #/)
  const ko = planReadings(head, { readings: [read('color-hue', { value: 'green' })] }, ctx).variants
  assert.match(ko[0].say, /주색 #/)
  assert.match(ko[1].say, /같은 색조·더 (?:어두운|밝은) 명도 — 주색 #/)
  const font = planReadings(head, { readings: [read('type-family', { value: 'serif' })] }, { ...ctx, lang: 'en' }).variants
  assert.match(font[0].say, /for headings/)
})
