// 순서형 손잡이 — 사전 axes.<축>.order(값 순서표)에서 지금 값의 자리를 세기만큼 옮긴다(ends[1] 쪽이면 뒤로, 끝을 넘으면 끝).
//   이미 끝이면 되묻는다. 옮긴 값이 호환표를 깨면 handle.repair 축을 함께 옮긴다(common.mjs compatible).
import { TEXT, ask, currentOf, endLabelOf, moveText, moveToValue, signOf } from './common.mjs'

/** @returns {{ head: object, from: string, to: string } | { ask: string }} */
export function step(head, reading, handle, ctx) {
  const def = ctx.lex.axes[reading.axis]
  const at = handle.order.indexOf(currentOf(head, handle))
  if (at < 0) throw new Error(`${reading.axis}: 지금 값 ${currentOf(head, handle)} 이 순서표(${handle.order.join('·')})에 없다`)
  const to = Math.min(handle.order.length - 1, Math.max(0, at + signOf(reading, def) * reading.strength))
  if (to === at) return ask('atEnd')
  const hit = moveToValue(head, handle, [handle.order[to]], ctx)
  return hit ? { head: hit.head, from: TEXT.current, to: moveText(Math.abs(to - at), endLabelOf(reading, def)) } : ask('noSafeChange')
}
