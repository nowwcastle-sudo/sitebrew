// 손잡이 블록 공용 도구 — 레시피 머리 칸 읽기·쓰기, 「안전한 머리」 판정, 호환 복구 탐색, 사용자 글.
//   블록(order·rank·palette·value)은 factory/stamp/handles.mjs 를 읽지 않는다 — 손잡이는 인자로 받는다(순환 import 없음).
import { AXIS_DEFAULTS } from '../../scripts/axes.mjs'
import { COMPAT, checkCompat } from '../../scripts/compat.mjs'
import { lintRecipeReport } from '../../scripts/recipe.mjs'
import { derivePalette } from '../../scripts/style-presets.mjs'
import { fill } from '../../vocab/fill.mjs'
import { grammar } from '../../vocab/grammar.mjs'

export const TEXT = grammar.text.step
/** 되묻기 결과 — 글은 grammar.yaml 의 text.step 에만 있다. */
export const ask = (key) => ({ ask: TEXT[key] })

const getField = (head, path) => path.split('.').reduce((o, k) => o?.[k], head)
/** 머리 사본에서 칸 하나만 바꾼다(`axes.display` 같은 점 경로). */
function setField(head, path, value) {
  const out = structuredClone(head)
  const keys = path.split('.')
  const last = keys.pop()
  const holder = keys.reduce((o, k) => (o[k] ??= {}), out)
  holder[last] = value
  return out
}
/** 지금 값 — 머리에 없으면 손잡이의 default, 그다음 레시피 축 기본값(AXIS_DEFAULTS). */
export const currentOf = (head, handle) => getField(head, handle.field) ?? handle.default ?? AXIS_DEFAULTS[handle.field.replace(/^axes\./, '')]

/** 읽기의 방향 부호: ends[1] 쪽이면 +1(뒤로·높은 등급), ends[0] 쪽이면 -1. value 읽기는 부호가 없다. */
export function signOf(reading, def) {
  const at = def.ends?.indexOf(reading.direction) ?? -1
  if (at < 0) throw new Error(`${reading.axis}: 방향 ${reading.direction} 은 이 축의 끝(${(def.ends ?? []).join('·')})이 아니다`)
  return at === 1 ? 1 : -1
}
export const endLabelOf = (reading, def) => def.endLabels[def.ends.indexOf(reading.direction)]

/** 호환표를 지키는가 — 레시피 린트와 같이 머리에 적힌 원형 모두에서(목록이 비면 ctx.archetype 하나). */
const compatClean = (axes, head, ctx) => (head.archetypes?.length ? head.archetypes : [ctx.archetype]).every((a) => checkCompat(axes, a).length === 0)
/** 린트에서 호환표 검사만 뺀다 — 호환 복구 축으로 풀 수 없는 위반이 있는지 보려고. */
const WITHOUT_COMPAT = { checkCompat: () => [], checkCompatWarnings: () => [] }

/** 새 머리가 안전한가 — 호환표(머리의 모든 원형 기준)와 레시피 린트(위반)를 모두 통과한다. */
export const isSafe = (head, ctx) => compatClean(head.axes, head, ctx) && lintRecipeReport(head).violations.length === 0
/** 후보 머리들 중 안전한 첫째(없으면 null). 후보는 { head, ... } 이고, 앞에 있을수록 먼저다. */
export function firstSafe(cands, ctx) {
  for (const c of cands) if (isSafe(c.head, ctx)) return c
  return null
}

/**
 * 새 팔레트로 색을 다시 짠 머리 — 팔레트가 가진 theme 는 쓰지 않고 역할색에서 색 논리대로 새로 펼친다. B안(alternates)은 옛 색 기준이라 뺀다.
 * 기본 테마(라이트·다크)는 그대로 둔다 — followTheme 이면 팔레트의 밝기를 따른다(밝기를 바꾸는 요청만).
 */
export function repaint(head, palette, { followTheme = false } = {}) {
  const d = derivePalette({ ...palette, theme: undefined }, { colorLogic: head.colorLogic, axes: head.axes })
  const out = { ...structuredClone(head), color: { light: d.light, dark: d.dark }, ...(followTheme ? { defaultTheme: d.defaultTheme } : {}) }
  delete out.alternates
  return out
}

/** 후보를 만들 때까지 계산을 미루는 map(앞 후보가 통과하면 뒤 후보는 만들지 않는다). */
export function* lazyMap(iter, fn) { for (const x of iter) yield fn(x) }

/**
 * 호환 복구 후보 — 머리가 호환표를 지키면 그 머리 하나, 깨면 `repair` 축 값을 바꾼 조합 중 위반 0 인 것을 좋은 순서로 낸다.
 * 순서: 바뀐 축 수가 적은 것 → repair 목록 앞 축을 덜 바꾼 것 → compat.json 축 값 순서 앞. 조합은 repair 축 값의 곱을 전수한다.
 * @returns {Generator<{ head: object, changed: number }>}
 */
export function* compatible(head, repair, ctx) {
  if (compatClean(head.axes, head, ctx)) { yield { head, changed: 0 }; return }
  const n = repair.length
  // 바뀌는 축의 부분집합: 개수 오름차순, 같으면 앞 축을 덜 바꾼 것(비트열 사전순 — 앞 축이 높은 자리)
  const bit = (mask, i) => (mask >> (n - 1 - i)) & 1
  const masks = [...Array(1 << n).keys()].filter((m) => m > 0)
  const size = (m) => repair.reduce((s, _, i) => s + bit(m, i), 0)
  masks.sort((a, b) => size(a) - size(b) || a - b)
  for (const mask of masks) {
    const picked = repair.filter((_, i) => bit(mask, i))
    const options = picked.map((axis) => COMPAT.axes[axis].filter((v) => v !== head.axes[axis]))
    const pick = (k, chosen) => k === picked.length ? [chosen] : options[k].flatMap((v) => pick(k + 1, [...chosen, v]))
    for (const values of pick(0, [])) {
      const axes = { ...head.axes, ...Object.fromEntries(picked.map((a, k) => [a, values[k]])) }
      if (compatClean(axes, head, ctx)) yield { head: { ...structuredClone(head), axes }, changed: picked.length }
    }
  }
}

/**
 * 값 후보(목표 등급에 든 값들, 앞이 먼저)를 하나씩 `field` 에 넣어 보고 안전한 머리를 고른다 — 호환 복구로 바뀐 축 수가 가장 적은 값, 같으면 앞 값.
 * @param {(h: object) => object} finish 호환 복구 뒤 마무리(색 다시 짜기 등)
 * @returns {{ head: object, value: string } | null}
 */
export function moveToValue(head, handle, values, ctx, finish = (h) => h) {
  let best = null
  for (const value of values) {
    const moved = setField(head, handle.field, value)
    // 호환을 깬 머리는 repair 축으로 푼다. 그런데 호환 말고도 린트 위반이 있으면 repair 조합을 모두 린트해도 소용없다 — 이 값은 버린다.
    if (!compatClean(moved.axes, moved, ctx) && lintRecipeReport(finish(moved), { compat: WITHOUT_COMPAT }).violations.length > 0) continue
    const cands = lazyMap(compatible(moved, handle.repair ?? [], ctx), (c) => ({ ...c, head: finish(c.head) }))
    const hit = firstSafe(cands, ctx)
    if (hit && (!best || hit.changed < best.changed)) best = { ...hit, value }
  }
  return best && { head: best.head, value: best.value }
}

/** 「한 칸 더 크게」 — 옮긴 칸 수와 끝 이름으로 grammar 의 틀을 채운다. */
export const moveText = (moved, end) => fill(TEXT.move, { count: TEXT.counts[moved - 1], end })
