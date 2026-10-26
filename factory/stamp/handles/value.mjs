// 값형 손잡이 — 사용자가 값을 말한 축(색 이름·글꼴)을 handles.yaml values 표로 revise-values.mjs 의 요청으로 바꿔 머리를 만든다.
//   색: 이름 → 대표 색(hex 가 없으면 COLOR_NAMES). 글꼴: 범주 → 그 범주의 키트 글꼴. avoidHueFamilies 는 palette 블록이, notCurrent 는 여기서 지금 범주를 뺀다.
//   직접 말한 값(색 코드 #rrggbb · 서체 이름)은 표 없이 그 값 그대로 요청한다.
//   세기 1 = 안전한 첫 후보, 세기 2 = 둘째 후보(없으면 첫 후보) — 그래서 「2안」의 안 b 가 planAxisValue 의 둘째 안이다.
import { COLOR_NAMES, TYPE_CATEGORIES, isLiteralValue, koreanKitFonts, planAxisValue } from '../revise-values.mjs'
import { TEXT, ask, isSafe } from './common.mjs'
import { avoiding } from './palette.mjs'

/** 지금 제목 글꼴의 범주(키트 글꼴 표에 없으면 null). */
const categoryOf = (head) => {
  const items = [head.fonts?.display?.item, head.fonts?.displayKo?.item]
  return koreanKitFonts().find((f) => items.includes(f.item))?.category ?? null
}

/** 영어 요청이면 요청 글(text)을 영어 이름으로 — planAxisValue 는 text 에 한글이 있는지로 되묻는 말과 안내의 언어를 정한다. 색은 표의 영어 이름, 범주는 범주 표의 영어 이름, 서체는 그 이름. */
function englishName(request) {
  const { target, value } = request
  if (target === 'color') return COLOR_NAMES.find((c) => c.key === value.name)?.en ?? 'color'
  if (value.category) return TYPE_CATEGORIES.find((c) => c.key === value.category).en
  return /[가-힣]/.test(value.family) ? 'font' : value.family
}

/** 값 하나를 planAxisValue 요청으로 바꾼다. 글은 사전 이름(valueLabels, 직접 말한 값은 축 이름)으로 — 언어를 한국어로 읽게 한다(영어 요청은 step 이 englishName 으로 바꾼다). */
function requestOf(head, spec, axis, value, label) {
  if (!spec) return axis === 'color-hue' ? { target: 'color', text: label, value: { hex: value.toUpperCase(), from: 'hex' } } : { target: 'type', text: label, value: { family: value } }
  if (spec.category || spec.notCurrent) {
    const category = spec.category ?? spec.notCurrent.find((c) => c !== categoryOf(head))
    return category && { target: 'type', text: label, value: { category } }
  }
  // 이름으로 읽은 색은 안내(「초록 → #2E7D32 로 읽었어요」)와 질문에 이름이 남는다 — 표 14색은 COLOR_NAMES 의 대표 색, 그 밖(금색·하늘색 …)은 handles.yaml 의 hex 와 name
  const known = COLOR_NAMES.find((c) => c.key === value)
  return { target: 'color', text: label, value: { hex: spec.hex ?? known.hex, from: 'name', name: value, label: spec.name } }
}

/** @returns {{ head: object, from: string, to: string, detail: string, notes?: string[], reason?: string } | { ask: string }} detail = 이 안이 고른 모양(주색·서체) — 안 a·b 가 무엇이 다른지 */
export function step(head, reading, handle, ctx) {
  const spec = ctx.handles.values[reading.axis]?.[reading.value]
  if (!spec && !isLiteralValue(reading.axis, reading.value)) throw new Error(`${reading.axis}: 값 ${reading.value} 의 배선이 handles.yaml values 에 없다`)
  const def = ctx.lex.axes[reading.axis]
  const label = def.valueLabels[reading.value] ?? reading.value
  if (spec?.avoidHueFamilies) {
    const out = avoiding(head, spec.avoidHueFamilies, ctx)
    return out ? { ...out, from: TEXT.current, to: label } : ask('noSafeChange')
  }
  const request = requestOf(head, spec, reading.axis, reading.value, spec ? label : def.label)
  if (!request) return ask('noSafeChange') // 지금 범주가 아닌 범주가 목록에 없다
  if (ctx.lang === 'en') request.text = englishName(request)
  const planned = planAxisValue(head, request)
  if (planned.ask) return { ask: planned.ask }
  const safe = planned.heads.filter((c) => (ctx.keepHead ?? []).every((k) => k(c.head))).filter((c) => isSafe(c.head, ctx)) // keepHead = 색 값이 지킬 상한(처음 머리보다 그 방향으로 더 가지 않기)
  if (!safe.length) return ask('noSafeChange')
  const hit = safe[Math.min(reading.strength, safe.length) - 1]
  // 색 값은 palette: null — 색을 바꿨지만 풀 팔레트가 아니라 뒤 읽기가 이어받을 팔레트가 없다(글꼴 값은 색을 건드리지 않으므로 palette 칸이 없다)
  return { head: hit.head, ...(request.target === 'color' ? { palette: null } : {}), from: TEXT.current, to: label, detail: hit.label, notes: planned.notes, ...(planned.reason ? { reason: planned.reason } : {}) }
}
