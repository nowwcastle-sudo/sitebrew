// 팔레트형 손잡이 — 색 밝기·진하기·온도를 팔레트 풀(use "recipe")에서 다른 팔레트를 골라 바꾼다. 배선은 handles.yaml 의 palette 칸.
//   온도·진하기: 방향의 mood 꼬리표와 겹치는 팔레트. 밝기: roles.background 의 oklch L 이 지금보다 큰(밝게)·작은(어둡게) 팔레트.
//   순서: 지금 팔레트와 hue_family 가 같은 것 먼저(둘 다 있을 때만) → rank_score 높은 순. 세기 2 는 기준에서 가장 먼 것부터.
//   읽기 여럿을 잇는 쪽(plan-readings)을 위해: ctx.palette = 지금까지 고른 팔레트(없으면 후보의 팔레트), ctx.origin = 읽기를 재는 기준 팔레트(없으면 ctx.palette), ctx.keep = 새 팔레트가 지켜야 할 조건들(앞서 고른 읽기·상한).
//   결과에는 쓴 팔레트(palette)와 뒤 읽기가 지킬 조건(keep)을 싣는다.
import { loadPalettePool } from '../../scripts/style-presets.mjs'
import { hexToOklch } from '../../scripts/lib/palette-lib.mjs'
import { parseOklch } from '../../scripts/lib/palette-rules.mjs'
import { fill } from '../../vocab/fill.mjs'
import { TEXT, ask, endLabelOf, firstSafe, lazyMap, repaint, signOf } from './common.mjs'

/** 밝기를 재는 방법 — handles.yaml palette.lightness.by 가 고른다. of = 팔레트의 값, now = 지금의 값(지금 팔레트가 있으면 그 값 — 같은 잣대로 견준다 — 없으면 머리 색의 기본 테마 배경). */
const MEASURES = {
  'background-l': { of: (p) => hexToOklch(p.roles.background.slice(1))[0], now: (head, palette) => (palette ? hexToOklch(palette.roles.background.slice(1))[0] : parseOklch(head.color[head.defaultTheme === 'dark' ? 'dark' : 'light'].background)[0]) },
}
let POOL
const pool = (use) => (POOL ??= loadPalettePool()).filter((p) => p.use === use)
const familiesOf = (p) => (p.hue_family ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean)

/** 처음 팔레트 — 읽기 여럿 중에도 이 팔레트에서 바꿔 나간다(앞 읽기가 고른 팔레트는 뒤 읽기의 후보로 남는다). */
const startOf = (ctx) => ctx.origin ?? ctx.palette

/** 앞서 정해진 조건(ctx.keep)을 모두 지키는 팔레트인가. */
const kept = (ctx) => (p) => (ctx.keep ?? []).every((k) => k(p))

/** 후보 팔레트를 차례로 새 머리로 만들어 안전한 첫째를 낸다(없으면 null). 낸 것 = { head, palette }. */
function pick(head, palettes, ctx, opts) {
  return firstSafe(lazyMap(palettes.filter(kept(ctx)), (palette) => ({ head: repaint(head, palette, opts), palette })), ctx)
}

/** 보라·남색 계열을 피한다 — hue_family 를 아는 팔레트 중 그 계열이 아닌 것, 지금과 다른 것 중 rank_score 1위부터. 낸 것 = { head, palette, keep } | null. */
export function avoiding(head, families, ctx) {
  const outside = outsideOf(families)
  const list = pool(ctx.handles.palette.pool).filter((p) => outside(p) && p.id !== startOf(ctx)?.id).sort((a, b) => b.rank_score - a.rank_score)
  const out = pick(head, list, ctx)
  return out && { ...out, keep: outside }
}
const outsideOf = (families) => (p) => Boolean(p.hue_family) && !familiesOf(p).some((f) => families.includes(f))

/** 읽기 하나가 팔레트를 재는 도구 — 재는 법(measure)·기준(now)·그 방향 mood 꼬리표 수(hits)와, 그 방향으로 간 팔레트인지(reached). */
function gauge(head, reading, ctx) {
  const wiring = ctx.handles.palette[reading.axis.replace(/^color-/, '')]
  const measure = MEASURES[ctx.handles.palette.lightness.by]
  const sign = signOf(reading, ctx.lex.axes[reading.axis])
  const from = startOf(ctx) // 「밝게」는 읽기 여럿 중에도 처음 팔레트보다 밝게다
  const now = measure.now(head, from)
  const hits = (p) => p.mood.filter((m) => wiring[reading.direction].includes(m)).length
  const reached = wiring.by ? (p) => sign * (measure.of(p) - now) > 0 : (p) => hits(p) > 0
  const atLeast = (q) => (wiring.by ? (p) => sign * (measure.of(p) - measure.of(q)) >= 0 : (p) => hits(p) >= hits(q)) // q 만큼은 그 방향으로 간 팔레트인가
  return { wiring, measure, sign, now, hits, reached, atLeast, from }
}

/**
 * 읽기가 팔레트에 바라는 조건(팔레트로 이루는 읽기가 아니면 null). 읽기 여럿을 잇는 쪽이 앞 읽기의 팔레트도 뒤 읽기를 만족하게 미리 건다 —
 * 그래야 「밝고 쨍하게」에서 앞 읽기가 뒤 읽기와 맞지 않는 팔레트를 골라 되묻는 일이 없다. 방향은 처음 팔레트에서 잰다.
 */
export function wanted(head, reading, ctx) {
  if (ctx.handles.axes[reading.axis].kind === 'palette') return gauge(head, reading, ctx).reached
  const avoid = ctx.handles.values[reading.axis]?.[reading.value]?.avoidHueFamilies
  return avoid ? outsideOf(avoid) : null
}

/**
 * 상한(cap) 읽기를 색 값(머리 하나)에 거는 조건 — 처음 머리보다 그 방향으로 더 가지 않은 머리인가. 밝기만 잰다(그려진 기본 테마 배경의 L).
 * 온도·진하기는 값으로 정한 색의 mood 를 알 수 없어 null — 부르는 쪽이 되묻는다.
 */
export function notPastHead(head, reading, ctx) {
  const { wiring, measure, sign } = gauge(head, reading, { ...ctx, palette: null, origin: null })
  if (!wiring.by) return null
  const now = measure.now(head, null)
  return (h) => sign * (measure.now(h, null) - now) <= 0
}

/** 상한(cap) 읽기가 지키라는 조건 — 지금 팔레트보다 그 방향으로 더 가지 않은 팔레트인가(밝기는 같은 잣대의 값, 온도·진하기는 그 방향 mood 꼬리표 수). */
export function notPast(head, reading, ctx) {
  const { wiring, measure, sign, now, hits, from } = gauge(head, reading, ctx)
  // 잴 수 없는 배경(L 이 NaN)은 지켰다고 볼 수 없어 뺀다 — 그래서 「넘지 않았다」를 <= 로 쓴다(! reached 가 아니다)
  if (wiring.by) return (p) => sign * (measure.of(p) - now) <= 0
  const start = from ? hits(from) : 0
  return (p) => hits(p) <= start
}

/** @returns {{ head: object, from: string, to: string, palette: object, keep: (p: object) => boolean } | { ask: string }} 쓴 팔레트(palette)와 뒤 읽기가 지킬 조건(keep — 이 팔레트만큼은 그 방향으로 간 팔레트) */
export function step(head, reading, handle, ctx) {
  const def = ctx.lex.axes[reading.axis]
  const { wiring, measure, now, hits, reached, atLeast } = gauge(head, reading, ctx)
  const away = (p) => Math.abs(measure.of(p) - now) // 지금 밝기에서 얼마나 먼가
  const hue = ctx.palette?.hue_family
  const byRank = (a, b) => Number(Boolean(hue) && b.hue_family === hue) - Number(Boolean(hue) && a.hue_family === hue) || b.rank_score - a.rank_score
  const far = reading.strength === 2
  const base = pool(ctx.handles.palette.pool).filter((p) => p.id !== startOf(ctx)?.id)
  let list
  if (wiring.by) list = base.filter(reached).sort(far ? (a, b) => away(b) - away(a) || byRank(a, b) : byRank)
  else list = base.filter(reached).sort(far ? (a, b) => hits(b) - hits(a) || away(b) - away(a) || byRank(a, b) : byRank)
  const out = pick(head, list, ctx, { followTheme: Boolean(wiring.by) })
  return out ? { head: out.head, palette: out.palette, keep: atLeast(out.palette), from: TEXT.current, to: fill(TEXT.palette, { end: endLabelOf(reading, def) }) } : ask('noSafeChange')
}
