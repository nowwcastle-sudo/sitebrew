// 레시피 보드가 다루는 목록 — shots.mjs(스크린샷)·gates.mjs(장면 관문)·build.mjs(보드 HTML)가 같이 쓴다.
// 레시피마다 선택지 A(현재 머리)와 B(머리 alternates 전체 — 있을 때만), 선택지마다 대표 장면(signature).
// 장면 주소: /qa/recipes?r=<id>&scene=<장면>[&alt=B][&theme=light|dark] (app/qa/recipes/page.tsx · scenes.tsx).
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recipeIds, parseRecipe, RECIPES_DIR, ALT_AXES, applyAlternate, BOLD_LOGICS } from '../../scripts/recipe.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const OUT = join(ROOT, '.tmp', 'board')
export const WIDTHS = [1440, 375]
// 관문 Chrome(Task 10f 리뷰 M2 — gates.mjs·hero-contrast.mjs): 스크롤바를 숨겨 1440 뷰포트를 1440 폭 그대로 배치·촬영하고(보이던 15px 무채 띠가
// 유채 픽셀 비율을 약 1%p 낮췄다), 색 프로필을 sRGB 로 고정해 촬영(video.mjs·shots.mjs)과 같은 화면을 잰다.
export const GATE_CHROME_FLAGS = ['--hide-scrollbars', '--force-color-profile=srgb']
// 다크 기본 레시피는 다크를 먼저(리뷰 M3).
export const themesFor = (head) => (head.defaultTheme === 'dark' ? ['dark', 'light'] : ['light', 'dark'])

export function loadHeads() {
  return recipeIds().map((id) => {
    const { body, ...head } = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    return { ...head, body }
  })
}

// 게시한 보드가 쓴 레시피 10벌의 고정본(8541c6f, 결정 반영 전 — alternates·body 포함). 운영자 결정(Task 9)이 원천 머리에
// B를 옮기고 alternates 를 지운 뒤에도 보드·B안 검사는 이 고정본으로 돈다. 다시 만들지 않는다(보드는 반영 전 상태를 보여 준다).
export const BOARD_HEADS = join(dirname(fileURLToPath(import.meta.url)), 'heads-at-board.json')
export const loadBoardHeads = (file = BOARD_HEADS) => JSON.parse(readFileSync(file, 'utf8')).heads

// 선택지: key 'A' | 'B', picks(B가 바꾸는 축), head(그 선택지를 적용한 머리), query(주소 조각).
export function optionsOf(head) {
  const opts = [{ key: 'A', picks: [], head, query: '' }]
  if (head.alternates) opts.push({ key: 'B', picks: ALT_AXES.filter((k) => head.alternates[k] !== undefined), head: applyAlternate(head), query: '&alt=B' })
  return opts
}

// 면 관문 종류(Task 8 Step 1b, Task 7 fix 1 리뷰 I4-c): K6~K8 비대시보드 → 첫 화면 면적 25% · K6~K8 × dashboard → 첫 화면 상단 바 면 · 나머지 → 없음.
// dashboard 원형이 있는 레시피는 dashboard 규칙을 받는다(compat 주의가 대시보드의 면을 한두 곳으로 제한한다 — K7 × dashboard 도 같게 본다).
// 히어로 장면(Task 10f §2b — 컨트롤러 판정): 히어로는 랜딩 첫 화면이라 상단 바 규칙을 받지 않고, 클래스 면적 대신 그려진 화면의
// 유채 픽셀 비율(OKLCH C ≥ 0.06, 1440 첫 화면)로 잰다 → 'pixel'. SVG·작은 칸으로 칠한 면도 센다. 다른 장면은 그대로다.
export function faceGateKind(optHead, scene) {
  if (!BOLD_LOGICS.includes(optHead.colorLogic)) return null
  if (scene === 'hero') return 'pixel'
  return optHead.archetypes.includes('dashboard') ? 'top-bar' : 'area'
}

export const sceneUrl = (origin, id, scene, opt, theme) => `${origin}/qa/recipes?r=${id}&scene=${scene}${opt.query}${theme ? `&theme=${theme}` : ''}`
export const specimenUrl = (origin, id) => `${origin}/qa/recipes?r=${id}`
export const shotName = ({ recipe, option, scene, width, theme }) => `${recipe}-${scene ? `${option}-${scene}` : 'specimen'}-${width}-${theme}.webp`

// 찍을 목록: 레시피 → 선택지 → 장면 → 폭 → 테마(다크 기본은 다크 먼저), 그다음 공통 견본(A만).
export function shotJobs(heads = loadHeads()) {
  const jobs = []
  for (const h of heads) {
    for (const opt of optionsOf(h)) for (const scene of h.signature ?? []) for (const width of WIDTHS) for (const theme of themesFor(h))
      jobs.push({ recipe: h.id, option: opt.key, scene, width, theme, kind: 'scene', query: opt.query })
    for (const width of WIDTHS) for (const theme of themesFor(h)) jobs.push({ recipe: h.id, option: 'A', scene: null, width, theme, kind: 'specimen', query: '' })
  }
  return jobs.map((j) => ({ ...j, file: shotName(j) }))
}
