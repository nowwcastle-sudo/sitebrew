// 읽기 → 2안(설계 5.10) — 사이트 전체·요소 범위의 읽기를 레시피 머리에 적용해 「지금 + 다른 안 2개」 중 다른 안(a·b)을 만든다.
//   planReadings(head, input, ctx) → { variants: Variant[], why? } | { ask }
//   input = { readings } 확정 | { options: [{ readings }, { readings }] } 후보 둘. 한 축에 서로 다른 값(빨강·파랑)을 말한 확정 읽기는 두 값이 각각 안 a·b 다.
//   byOption: true 는 안마다 자기 해석(후보 둘·값을 나눈 읽기)이라는 표시다. ctx.lang(ko|en)은 되묻는 글의 언어다.
//   안이 하나뿐이면 variants 에 그 하나만 담고, 안 b 가 없는 이유를 why(되묻는 글 한 줄)에 싣는다 — 소비하는 쪽은 variants 가 하나일 때 why 를 보여 줘야 한다.
//   안 a 를 못 만들면 되묻는다. 후보 둘에서 한쪽만 되면 되는 쪽이 안 a(id 'a')가 되고 why 는 안 된 쪽의 되물음이다.
//   input = { copyFrom: 시안 id | 'previous' } 는 읽기 없이 그 시안(또는 방금 고치기 전 모양) 머리의 다른 값을 지금 머리로 옮기는 안 a 하나다(안 b 없음). 따라 할 머리는 ctx.copySources[copyFrom] 이다.
//   ctx = { lex, archetype, palette, site, copySources? }. 머리를 옮기는 일은 stepHead(손잡이 블록)에 맡기고, 여기서는 읽기 묶음을 순서대로 잇고 상한·충돌을 거른다.
//   읽기를 잇는 법: 색을 바꾼 읽기가 쓴 팔레트는 다음 읽기의 ctx.palette 가 되고, 팔레트를 고른 읽기와 상한은 뒤 읽기의 ctx.keep(지킬 조건)이 된다 — 그래서 앞 읽기의 색 효과가 뒤 읽기에 지워지지 않는다.
import { isDeepStrictEqual } from 'node:util'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { extraSectionWordsOf, pageWordsOf, sectionWordsOf } from '../vocab/lexicon.mjs'
import { AXIS_ORDER, axisValue } from '../scripts/axes.mjs'
import { handlesOf, stepHead } from './handles/index.mjs'
import { currentOf, isSafe, signOf } from './handles/common.mjs'
import { notPast, notPastHead, wanted } from './handles/palette.mjs'

const T = grammar.text
const MAX = grammar.limits.strengthMax

/** 읽기에 붙은 사용자 말 — direction 읽기는 endLabels, value 읽기는 valueLabels. */
function labelOf(reading, lex) {
  const def = lex.axes[reading.axis]
  return reading.direction === undefined ? def.valueLabels[reading.value] ?? reading.value : def.endLabels[def.ends.indexOf(reading.direction)] // 직접 말한 값(색 코드·서체 이름)은 사전 표기가 없어 값 그대로
}

/** 서로 반대로 읽히는 두 읽기를 되묻는 글(요청 언어 lang: ko|en). */
export const clashAsk = (a, b, lex, lang = 'ko') => ({ ask: fill(T.clash[lang], { a: labelOf(a, lex), b: labelOf(b, lex) }) })

/** 같은 축에서 방향(값)이 다른 두 읽기를 찾아 되묻는 글을 낸다. 상한과 세기 0 읽기는 밀지 않으므로 충돌이 아니다. */
function clashIn(readings, lex, lang) {
  const pushing = readings.filter((r) => !r.cap && r.strength > 0)
  for (let i = 0; i < pushing.length; i++) {
    for (let j = i + 1; j < pushing.length; j++) {
      const [a, b] = [pushing[i], pushing[j]]
      if (a.axis === b.axis && (a.direction ?? a.value) !== (b.direction ?? b.value)) return clashAsk(a, b, lex, lang)
    }
  }
  return null
}

/** 범위 이름의 사용자 말 — 구획·쪽은 사전 이름표의 첫 한글 낱말(히어로), 요소이거나 이름표가 없으면 이름 그대로. */
function scopeName(kind, key, lex) {
  const korean = (words = []) => words.find((w) => /[가-힣]/.test(w))
  if (kind === 'section') return korean([...sectionWordsOf(lex), ...extraSectionWordsOf(lex)].find((e) => e.kind.test(key))?.words) ?? key
  if (kind === 'page') return korean(pageWordsOf(lex)[key])?.replace(/ 쪽$/, '') ?? key // 글 틀이 「쪽에만」을 붙이므로 이름의 끝 「쪽」은 뺀다
  return key
}

const entryOf = (lex, id) => lex.entries.find((e) => e.id === id)
/**
 * 읽기들이 알리는 한 문장 — 상한은 상한 글. 그 밖에는 읽기를 낸 항목의 say(그 항목이 같은 축을 같은 세기로 읽을 때만 — 사전 글은 사전의 세기를 말한다),
 * 없으면 sayReading 틀(세기 말 포함)·값 읽기는 sayValue 틀. 범위가 있으면 앞 글을 붙이고, 같은 글은 한 번만 쓴다. 세기 0 의 밀지 않는 읽기는 말하지 않는다.
 */
export function sayOf(readings, lex) {
  const says = readings.filter((r) => r.cap || r.strength > 0).map((r) => {
    const [kind, key] = r.scope.split(':')
    const prefix = key === undefined ? '' : fill(T.scope[kind].ko, { key: scopeName(kind, key, lex) })
    const label = lex.axes[r.axis].label
    if (r.cap) return prefix + fill(T.say.cap.ko, { label: labelOf(r, lex) })
    const entry = entryOf(lex, r.source)
    if (entry?.say && entry.reading?.some((x) => x.axis === r.axis && (r.direction === undefined || (x.strength ?? 1) === r.strength))) return prefix + entry.say.ko
    if (r.direction === undefined) return prefix + fill(T.plan.sayValue, { label, end: labelOf(r, lex) })
    return prefix + fill(T.plan.sayReading, { label, end: labelOf(r, lex), amount: T.plan.amounts[r.strength - 1] })
  })
  return [...new Set(says)].join(' ')
}

/** 그 축의 값 자리(순서형은 줄 안의 자리, 등급형은 등급). 팔레트·값 손잡이는 자리가 없다(null). */
function positionOf(handle, head) {
  if (handle.kind === 'order') return handle.order.indexOf(currentOf(head, handle))
  if (handle.kind === 'rank') return handle.rank[currentOf(head, handle)]
  return null
}

/** 같은 방향으로 미는 읽기의 세기 합 — 상한이 허락하는 만큼. */
const pushOf = (readings, cap) => readings.filter((r) => !r.cap && r.axis === cap.axis && r.direction === cap.direction).reduce((sum, r) => sum + r.strength, 0)

/**
 * 읽기들을 순서대로 머리에 잇는다. 하나라도 되묻으면 그 되물음.
 * 색을 바꾼 읽기의 팔레트는 뒤 읽기로 넘긴다. 팔레트 후보는 처음부터 모든 팔레트 읽기의 방향과 상한을 함께 지켜야 하고(wanted·notPast),
 * 뒤 읽기는 앞 읽기가 간 만큼은 그대로 가 있어야 한다(keep) — 그래서 뒤 읽기가 앞 읽기를 되돌리지 않고, 만족하는 팔레트가 없으면 되묻는다.
 * 값으로 정한 색(팔레트 null)은 팔레트 상한 중 밝기만 그려진 배경으로 지키고(keepHead), 온도·진하기 상한이나 다른 색 읽기와는 함께 적용할 수 없어 되묻는다 — 한쪽 색이 다른 쪽에 지워지므로.
 */
function walk(head, readings, ctx) {
  const handles = handlesOf(ctx.lex)
  const caps = readings.filter((c) => c.cap && handles.axes[c.axis].kind === 'palette' && pushOf(readings, c) === 0)
  const wants = readings.filter((r) => !r.cap && r.strength > 0).map((r) => wanted(head, r, { ...ctx, handles })).filter(Boolean)
  let keep = [...caps.map((c) => notPast(head, c, { ...ctx, handles })), ...wants] // 처음부터 모든 팔레트 읽기를 함께 만족하는 팔레트만 후보다
  const headCheck = caps.map((c) => notPastHead(head, c, { ...ctx, handles })) // 값으로 정한 색에 거는 상한 — 밝기만 잰다(null = 잴 수 없음)
  const keepHead = headCheck.filter(Boolean)
  let palette = ctx.palette
  const painted = []
  const changes = []
  const notes = []
  const reasons = []
  const details = [] // 값 읽기가 안마다 달리 고른 것(주색·서체) — 안 a·b 가 무엇이 다른지 말하는 글
  let cur = head
  for (const r of readings) {
    const step = stepHead(cur, r, { ...ctx, palette, origin: ctx.palette, keep, keepHead })
    if (step.ask) return step
    if (step.palette === null && headCheck.includes(null)) return { ask: T.plan.colorTwo } // 값으로 정한 색의 온도·진하기는 상한과 견줄 수 없다
    cur = step.head
    changes.push({ axis: r.axis, from: step.from, to: step.detail ? `${step.to} (${step.detail})` : step.to })
    if (step.detail) details.push(step.detail)
    notes.push(...(step.notes ?? []))
    if (step.reason) reasons.push(step.reason)
    if ('palette' in step) painted.push(step.palette)
    if (step.palette) palette = step.palette
    if (step.keep) keep = [...keep, step.keep]
  }
  if (painted.length > 1 && painted.includes(null)) return { ask: T.plan.colorTwo }
  return { head: cur, changes, notes: [...new Set(notes)], reasons, details }
}

/**
 * 상한(cap) 읽기가 막는 안인가 — 읽기들로 허락한 만큼(같은 방향 읽기의 세기 합)보다 그 축이 상한 방향으로 더 움직였다.
 * 다른 읽기의 호환 복구가 이 축을 함께 옮긴 경우가 이것이다. 자리를 잴 수 없는 축은 막지 않는다 — 색 축의 상한은 walk 가 팔레트를 고를 때 이미 지킨다.
 */
function breaksCap(base, made, readings, ctx) {
  const handles = handlesOf(ctx.lex)
  return readings.filter((c) => c.cap).some((c) => {
    const handle = handles.axes[c.axis]
    const [from, to] = [positionOf(handle, base), positionOf(handle, made)]
    if (from === null) return false
    return signOf(c, ctx.lex.axes[c.axis]) * (to - from) > pushOf(readings, c)
  })
}

/** 말한 값이 「더 가지 말라」고 한 값(값 축의 상한)과 같은가 — 그 값으로 가는 안은 만들지 않는다. */
const cappedValue = (readings) => readings.some((c) => c.cap && c.value !== undefined && readings.some((r) => !r.cap && r.strength > 0 && r.axis === c.axis && r.value === c.value))

/** 읽기 묶음 하나를 안 하나로 — { variant } | { ask }. */
function variantOf(id, base, readings, ctx) {
  const lang = ctx.lang ?? 'ko'
  const clash = clashIn(readings, ctx.lex, lang)
  if (clash) return clash
  if (cappedValue(readings)) return { ask: T.ask.valueCapped[lang] }
  const made = walk(base, readings, ctx)
  if (made.ask) return made
  if (breaksCap(base, made.head, readings, ctx)) return { ask: T.step.noSafeChange }
  const say = [sayOf(readings, ctx.lex), ...made.details].join(' ')
  return { variant: { id, head: made.head, readings, say, changes: made.changes, ...(made.notes.length ? { notes: made.notes } : {}), ...(made.reasons.length ? { reason: made.reasons[0] } : {}) } }
}

/** 요소 범위 읽기는 handles.yaml elements 표에 그 요소·축이 있어야 실행한다 — 칸은 그 축 손잡이의 칸과 같다(시험이 지킨다). 구획·쪽 범위는 sectionPlan 몫이다. */
function checkScopes(readings, ctx) {
  const handles = handlesOf(ctx.lex)
  for (const r of readings) {
    if (r.scope === 'site') continue
    const [kind, name] = r.scope.split(':')
    if (kind !== 'element') throw new Error(`범위 ${r.scope} 읽기는 sectionPlan 이 맡는다`)
    if (!handles.elements[name]?.[r.axis]) return { ask: T.ask.siteWide[ctx.lang ?? 'ko'] }
  }
  return null
}

/**
 * 확정 읽기: a = 읽기 전부, b = 상한이 아닌 첫 읽기의 세기를 하나 올린 같은 묶음.
 * 올리는 읽기의 축에 상한이 있으면 안 b 는 없다. 값 축(색 이름 …)의 상한은 안이 그 값에 닿는지 잴 수 없어, 그런 상한이 하나라도 있으면 더 가는 안 b 를 만들지 않는다.
 */
function fromReadings(head, readings, ctx) {
  const a = variantOf('a', head, readings, ctx)
  if (a.ask) return a
  const raise = readings.find((r) => !r.cap && r.strength > 0)
  const unmeasured = readings.some((r) => r.cap && handlesOf(ctx.lex).axes[r.axis].kind === 'value')
  if (!raise || raise.strength >= MAX || unmeasured || readings.some((r) => r.cap && r.axis === raise.axis)) return { variants: [a.variant], why: T.plan.onlyOne }
  const b = variantOf('b', head, readings.map((r) => (r === raise ? { ...r, strength: r.strength + 1 } : r)), ctx)
  if (b.ask || isDeepStrictEqual(b.variant.head, a.variant.head)) return { variants: [a.variant], why: T.plan.onlyOne }
  return { variants: [a.variant, b.variant] }
}

/** 후보 둘: 안 a·b = 각 선택지. 한쪽만 되면 되는 쪽이 안 a 다. byOption = 안마다 자기 해석이라 판의 해석 문장이 두 안을 모두 말해야 한다. */
function fromOptions(head, options, ctx) {
  if (options.length !== 2) throw new Error(`options 는 선택지 둘이어야 한다(지금 ${options.length}개)`)
  const [a, b] = options.map((o, i) => variantOf('ab'[i], head, o.readings, ctx))
  if (a.ask && b.ask) return a
  if (a.ask) return { variants: [{ ...b.variant, id: 'a' }], why: a.ask, byOption: true }
  return b.ask ? { variants: [a.variant], why: b.ask, byOption: true } : { variants: [a.variant, b.variant], byOption: true }
}

/**
 * 한 축에 서로 다른 값을 말한 확정 읽기는 값마다 한 안이다(5.10 — 후보 둘이면 두 안이 각 해석). 값이 둘인 축이 하나면 선택지 둘, 그보다 많으면 되묻는다.
 * @returns {null | { options: object[] } | { ask: string }} 나눌 것이 없으면 null
 */
function splitValues(readings, lex, lang) {
  const valued = readings.filter((r) => !r.cap && r.strength > 0 && r.value !== undefined)
  const splits = [...new Set(valued.map((r) => r.axis))].map((axis) => valued.filter((r) => r.axis === axis)).filter((rs) => new Set(rs.map((r) => r.value)).size > 1)
  if (!splits.length) return null
  const values = [...new Set(splits[0].map((r) => r.value))]
  if (splits.length > 1 || values.length > 2) return clashAsk(splits[0].find((r) => r.value === values[0]), splits[0].find((r) => r.value === values[1]), lex, lang)
  const without = (value) => ({ readings: readings.filter((r) => !(valued.includes(r) && r.axis === splits[0][0].axis && r.value !== value)) })
  return { options: values.map(without) }
}

const COPY_FIELDS = ['motion', 'colorLogic', 'spacing', 'fonts', 'color', 'defaultTheme'] // 레시피 축(AXIS_ORDER)에 더해 시안 따라 하기가 옮기는 머리 칸 — 그 시안처럼 보이는 데 필요한 것(이름·분위기·원형은 지금 그대로)
const COLOR_FIELDS = ['color', 'defaultTheme'] // 색 한 벌: 기본 테마가 정하는 쪽의 색이 보이므로 함께 옮긴다

/**
 * 시안 따라 하기: 그 시안 머리의 레시피 축·모션·색 논리·여백·서체·색 한 벌(색 + 기본 테마) 중 지금과 다른 값을 지금 머리로 옮긴다(이름·분위기는 지금 그대로).
 * 머리에 안 적힌 칸은 손잡이의 기본값(여백 normal)으로 견준다. 색을 옮기면 B안(alternates)은 옛 색 기준이라 뺀다(repaint 와 같다).
 * 옮긴 머리가 호환표·린트를 못 지키면 적용하지 않고 되묻는다. 안의 changes 는 사전 축 중 옮긴 칸이 바뀐 축만 — 색은 비교 화면의 견본이 보여 준다.
 */
function fromCopy(head, id, ctx) {
  const source = ctx.copySources?.[id]
  const previous = id === grammar.match.candidate.previousId
  if (!source) return { ask: previous ? T.plan.noPrevious : T.plan.copyMissing }
  const handles = handlesOf(ctx.lex)
  const defaults = Object.fromEntries(Object.values(handles.axes).filter((h) => h.field && h.default !== undefined).map((h) => [h.field, h.default]))
  const made = structuredClone(head)
  made.axes = { ...head.axes, ...Object.fromEntries(AXIS_ORDER.filter((k) => axisValue(head.axes, k) !== axisValue(source.axes, k)).map((k) => [k, axisValue(source.axes, k)])) }
  for (const k of COPY_FIELDS) {
    if (isDeepStrictEqual(head[k] ?? defaults[k], source[k] ?? defaults[k])) continue
    if (source[k] === undefined) delete made[k]
    else made[k] = structuredClone(source[k])
  }
  if (COLOR_FIELDS.some((k) => !isDeepStrictEqual(head[k], made[k]))) delete made.alternates
  if (isDeepStrictEqual(made, head)) return { ask: T.plan.copyNothing }
  if (!isSafe(made, ctx)) return { ask: T.step.noSafeChange }
  const moved = Object.entries(handles.axes).filter(([, h]) => h.field && !isDeepStrictEqual(currentOf(head, h), currentOf(made, h)))
  return { variants: [{ id: 'a', head: made, readings: [], say: previous ? T.plan.sayPrevious : T.plan.sayCopy, changes: moved.map(([axis]) => ({ axis, from: T.step.current, to: T.plan.copyTo })) }], why: T.plan.onlyOne }
}

/**
 * @param {object} head 레시피 머리
 * @param {{ readings: object[] } | { options: { readings: object[] }[] } | { copyFrom: string }} input
 * @param {{ lex: object, archetype: string, palette: object|null, site: object, copySources?: Record<string, object|null> }} ctx
 * @returns {{ variants: object[], why?: string } | { ask: string }}
 */
export function planReadings(head, input, ctx) {
  if (input.copyFrom !== undefined) return fromCopy(head, input.copyFrom, ctx)
  const lists = input.readings ? [input.readings] : input.options?.map((o) => o.readings)
  if (!lists) throw new Error('ReadingsInput 이 아니다: readings 또는 options 가 있어야 한다')
  for (const list of lists) {
    const unsupported = checkScopes(list, ctx)
    if (unsupported) return unsupported
  }
  if (input.options) return fromOptions(head, input.options, ctx)
  const split = splitValues(input.readings, ctx.lex, ctx.lang ?? 'ko')
  if (!split) return fromReadings(head, input.readings, ctx)
  return split.ask ? split : fromOptions(head, split.options, ctx)
}
