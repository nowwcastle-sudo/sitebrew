// 등급형 손잡이 — 사전 axes.<축>.rank(값 → 등급)에서 지금 값의 등급을 세기만큼 옮긴다(ends[1] 쪽이 높은 등급, 끝을 넘으면 끝).
//   목표 등급에 값이 여럿이면 호환 복구로 바뀐 축 수가 적은 값, 같으면 rank 표의 앞 값. recolor 손잡이(색 가짓수)는 새 색 논리로 색을 다시 짠다.
import { TEXT, ask, currentOf, endLabelOf, moveText, moveToValue, repaint, signOf } from './common.mjs'

/** @returns {{ head: object, from: string, to: string } | { ask: string }} */
export function step(head, reading, handle, ctx) {
  const def = ctx.lex.axes[reading.axis]
  const now = currentOf(head, handle)
  if (!(now in handle.rank)) throw new Error(`${reading.axis}: 지금 값 ${now} 이 등급표(${Object.keys(handle.rank).join('·')})에 없다`)
  const grades = [...new Set(Object.values(handle.rank))].sort((a, b) => a - b)
  const at = grades.indexOf(handle.rank[now])
  const to = Math.min(grades.length - 1, Math.max(0, at + signOf(reading, def) * reading.strength))
  if (to === at) return ask('atEnd')
  if (handle.recolor && !ctx.palette) return ask('noPalette')
  const values = Object.keys(handle.rank).filter((v) => handle.rank[v] === grades[to])
  const hit = moveToValue(head, handle, values, ctx, handle.recolor ? (h) => repaint(h, ctx.palette) : undefined)
  // 색을 다시 짠 손잡이는 쓴 팔레트(지금 팔레트)를 알린다 — 뒤 읽기가 같은 팔레트에서 이어 간다
  return hit ? { head: hit.head, ...(handle.recolor ? { palette: ctx.palette } : {}), from: TEXT.current, to: moveText(Math.abs(to - at), endLabelOf(reading, def)) } : ask('noSafeChange')
}
