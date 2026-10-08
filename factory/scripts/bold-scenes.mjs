// 대담안 장면 수(factory v1 Task 5.4 · 합의안 C1). 원형마다 대담안으로 고를 수 있는 블록이 BOLD_MIN 개 이상 있어야 01 방향의 ③ 칸(c)이 대담안을 낸다.
// 원형 목록은 박아 두지 않는다 — 블록 메타 archetypes 에 적힌 원형에서 센다(새 원형은 블록이 적는 순간 세어진다).
import { loadBlocks, blockName } from './blocks.mjs'

export const BOLD_SCENE_KINDS = ['hero', 'final-cta', 'announcement', 'onboarding', 'social-proof']
export const BOLD_MIN = 3
// public·dashboard 는 모션 대신 배치·서체로만 대담하다(bold-safety 의 BOLD_LAYOUT_ARCHETYPES 와 같은 뜻) — motion 대담 블록은 세지 않는다.
const LAYOUT_ONLY = new Set(['public', 'dashboard'])

/** 블록 메타 목록 [{ name, kind, archetypes, boldness?, boldMode?, motion }] → { [원형]: 블록 이름[] } */
export function boldScenes(blocks) {
  const out = {}
  for (const b of blocks) {
    if (b.boldness !== 'bold' || !BOLD_SCENE_KINDS.includes(b.kind)) continue
    for (const a of b.archetypes ?? []) {
      if (LAYOUT_ONLY.has(a) && b.boldMode !== 'layout') continue
      ;(out[a] ??= []).push(b.name)
    }
  }
  return out
}

/** 저장소의 유효한 블록 메타를 boldScenes 입력 모양으로. */
export function loadBoldIndex(root) {
  return loadBlocks(root).filter((b) => b.meta.success).map((b) => ({ name: blockName(b.kind, b.variant), kind: b.kind, ...b.meta.data }))
}
