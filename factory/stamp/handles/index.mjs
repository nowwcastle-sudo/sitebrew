// 읽기 하나로 레시피 머리 옮기기(설계 5.10) — 읽기의 축을 handles.yaml 이 가리키는 블록(blocks.mjs 등록부)에 맡긴다.
//   stepHead(head, reading, ctx) → { head, from, to, palette?, keep? } | { ask }
//   색을 바꾼 블록은 쓴 팔레트(palette — 값으로 정한 색은 null)를, 팔레트를 고른 블록은 뒤 읽기가 지킬 조건(keep)을 함께 싣는다. 읽기 여럿을 잇는 쪽이 ctx.palette·ctx.keep 으로 이어 준다.
//   ctx = { lex, archetype, palette, site, keep? }. 새 머리는 호환표(원형 기준)와 레시피 린트를 모두 통과한 것만 낸다 — 통과한 후보가 없으면 grammar.noSafeChange.
//   세기 0 은 머리를 그대로 돌려준다(같은 객체).
import { loadHandles } from '../handles.mjs'
import { BLOCKS } from './blocks.mjs'
import { TEXT } from './common.mjs'

export { BLOCKS }

const loaded = new WeakMap()
/** 사전 하나당 한 번만 읽는다 — 손잡이를 읽는 모든 모듈이 이 한 곳을 쓴다. */
export function handlesOf(lex) {
  if (!loaded.has(lex)) loaded.set(lex, loadHandles(lex))
  return loaded.get(lex)
}

export function stepHead(head, reading, ctx) {
  const handles = handlesOf(ctx.lex)
  const handle = handles.axes[reading.axis]
  if (!handle) throw new Error(`손잡이가 없는 축이다: ${reading.axis}`)
  if (reading.strength === 0) return { head, from: TEXT.current, to: TEXT.keep }
  return BLOCKS[handle.kind].step(head, reading, handle, { ...ctx, handles })
}
