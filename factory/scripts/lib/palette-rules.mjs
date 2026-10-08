// 팔레트 조합 규칙(DESIGN §5-A)의 기계 판정 — build-palettes.mjs(references/palettes/palettes.json 의 bans)와
// recipe.mjs(lintRecipeReport)가 같은 문턱을 쓴다.
// Tailwind 대조표 tailwind-v3-colors.json 출처: https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/public/colors.js
// (이름 244개, hex 243개 — neutral-50 = zinc-50 = #FAFAFA 라 hex 키에서 하나로 합쳐진다. 이 저장소의 사본은 선택 자료 폴더의 factory/palettes/tailwind-v3-colors.json 과 같다.)
import { readFileSync } from 'node:fs'
import { hexToOklch, clusters, ACCENT_C } from './palette-lib.mjs'

// pal-04: 채도 0.05 이상인 색이 Tailwind v3 기본 hex 와 OKLab 거리 0.005 미만이면 복사한 기본값(2026-09-27 컨트롤러 보정 — 0.02 는 회색·옅은 틴트까지 걸었다).
export const TAILWIND_MAX_DIST = 0.005
export const TAILWIND_MIN_C = 0.05
// pal-03: 바탕이 따뜻한 색상 60~95° 에서 C > 0.012 면 크림·베이지(DESIGN §5-A — 명도 조건 없음). lint 는 라이트 background 에만 건다.
// 데이터(palettes.json)는 어두운 갈색 바탕을 크림으로 잡지 않도록 바탕 L ≥ DATA_LIGHT_BG_L 일 때만 건다(README).
export const CREAM = { hueFrom: 60, hueTo: 95, maxC: 0.012 }
export const DATA_LIGHT_BG_L = 0.6
// 역할 배정 채도 상한(리뷰 I3): 바탕 후보 C ≤ 0.04, 테두리·muted C ≤ 0.06 — 원색 바탕·원색 테두리를 레퍼런스로 내지 않는다.
export const BG_MAX_C = 0.04
export const SURFACE_MAX_C = 0.06
// pal-02: C ≥ 0.05 인 색을 45° 안끼리 한 묶음으로 셀 때 3묶음 이상이면 강조 과다.
export const MAX_HUE_GROUPS = 2

const TW = JSON.parse(readFileSync(new URL('./tailwind-v3-colors.json', import.meta.url), 'utf8'))
export const labOf = ([L, C, H]) => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]
// 흑백은 「Tailwind 모양」이 아니므로 뺀다(compare-sns-dataset.md 와 같은 기준).
const TAILWIND = Object.entries(TW.colors)
  .filter(([hex]) => hex !== '#000000' && hex !== '#FFFFFF')
  .map(([hex, name]) => ({ hex, name, lab: labOf(hexToOklch(hex.slice(1))) }))

export function parseOklch(value) {
  const m = String(value).match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  return m ? [Number(m[1]) / (m[2] ? 100 : 1), Number(m[3]), Number(m[4])] : null
}

// 가장 가까운 Tailwind 기본값({ hex, name, dist }) — 채도가 문턱 아래거나 거리가 문턱 이상이면 null.
export function tailwindCopy(lch) {
  if (!lch || lch[1] < TAILWIND_MIN_C) return null
  const p = labOf(lch)
  let best = null
  for (const t of TAILWIND) {
    const d = Math.hypot(p[0] - t.lab[0], p[1] - t.lab[1], p[2] - t.lab[2])
    if (!best || d < best.dist) best = { hex: t.hex, name: t.name, dist: d }
  }
  return best && best.dist < TAILWIND_MAX_DIST ? best : null
}

export const isCreamBackground = ([, C, H]) => C > CREAM.maxC && H >= CREAM.hueFrom && H <= CREAM.hueTo

export const hueGroups = (lchs) => clusters(lchs.filter((c) => c[1] >= ACCENT_C).map((c) => c[2])).length

// AI 티 보라(DESIGN §13, 컨트롤러 판정 2026-09-29 — Task 15m 재료 등록분): 주색이 색상각 265~300 이고 C > 0.15 이면
// 금지 `ai-tell-violet` 로 decor-only. 채도가 낮은 보라·바탕·면으로 쓰는 보라는 대상이 아니다. 레퍼런스 데이터에만 걸고 lint 에는 없다.
export const AI_TELL_VIOLET = { hueFrom: 265, hueTo: 300, minC: 0.15 }
export const isAiTellViolet = ([, C, H]) => C > AI_TELL_VIOLET.minC && H >= AI_TELL_VIOLET.hueFrom && H <= AI_TELL_VIOLET.hueTo

// ── 색 논리 다양성(DESIGN §5-B, div-01~05) ─────────────────────────────────
// recipe.mjs(lintRecipeReport — K6·K7·K8·다크 기본)와 recipes-diversity.mjs(골격 분포)가 같은 문턱을 쓴다.
// 거의 흰 바탕: 라이트 바탕 L ≥ 0.96 · C < 0.015(§5-B 원문 그대로).
export const NEAR_WHITE = { minL: 0.96, maxC: 0.015 }
export const isNearWhite = ([L, C]) => L >= NEAR_WHITE.minL && C < NEAR_WHITE.maxC
// 레시피의 「얼굴」 색 — 강조 묶음을 셀 때 보는 키(상태색·차트·사이드바는 의미·데이터 색이라 뺀다). K6~K8 의 면·칸 키는 따로 더한다.
export const BRAND_KEYS = ['primary', 'primary-foreground', 'secondary', 'accent', 'accent-foreground', 'ring']
// 골격의 「강조 한 점」은 칠하는 면 키로만 센다(Task 6b 리뷰 I3): ring·*-foreground 는 면적이 거의 없어 한 색을 바꿔도 화면은 그대로다.
export const PAINT_KEYS = ['primary', 'secondary', 'accent']
export const PAINT_MIN_C = 0.08
// K6 색 면: 밝은 면과 중간·짙은 면의 L·C 대역, 한 페이지 면 색 2개까지.
export const FIELD_BANDS = { light: { L: [0.82, 0.95], C: [0.06, 0.14] }, deep: { L: [0.25, 0.6], C: [0.08, 0.18] } }
export const FIELD_MAX = 2
// K6 밝은 면의 크림 경계: §13·계획 Global Constraints 「oklch(0.9x 0.0x 60~90)」 — 따뜻한 색상 밝은 면은 대역 전체(L ≥ 0.82)에서 C 0.1 이상이어야
// 크림·모래·탠을 확실히 벗어난다(Task 6b 리뷰: L 0.82~0.9 구간의 oklch(0.86 0.065 78) 모래색이 새던 틈을 닫음).
export const FIELD_CREAM = { minL: 0.82, maxC: 0.1, hueFrom: CREAM.hueFrom, hueTo: CREAM.hueTo }
// 면·칸 위 글자: 4.5:1 바닥(위반), 7:1 목표(경고) — §5-B 「면 위 글자 7:1(최소 4.5:1)」.
export const TEXT_MIN = 4.5
export const TEXT_TARGET = 7
// K7 듀오톤: C ≥ 0.1 인 두 색상각 묶음, 90° 이상.
export const DUO = { minC: 0.1, minGap: 90 }
// K8 색 블록: 칸 3~4개, 색상각 묶음 3~4, 가장 채도 높은 칸은 하나(다음 칸보다 C 0.02 이상 높다). 무지개 순서는 4칸일 때만 원형으로 판정한다
// (원 위 세 점은 어느 순서든 한 방향이라 3칸 판정은 뜻이 없다 — 보드에서 사람이 본다).
export const BLOCKS = { min: 3, max: 4, groups: [3, 4], peakGap: 0.02 }
// 다크 기본(div-05): 다크 바탕 L 0.12~0.22 · C 0.01~0.04. 「거의 검정 + 형광 초록·주홍 한 점」(§13): 다크 얼굴색이 한 묶음뿐이고
// 그 색이 형광(C ≥ 0.2 · L ≥ 0.65, 초록 110~165° 또는 주홍 20~55°)이면 위반.
export const DARK_DEFAULT_BG = { L: [0.12, 0.22], C: [0.01, 0.04] }
export const NEON = { minC: 0.2, minL: 0.65, hues: [[110, 165], [20, 55]] }
export const isNeon = ([L, C, H]) => C >= NEON.minC && L >= NEON.minL && NEON.hues.some(([a, b]) => H >= a && H <= b)
export const inBand = ([L, C], band) => L >= band.L[0] && L <= band.L[1] && C >= band.C[0] && C <= band.C[1]
// C ≥ minC 인 색의 색상각 묶음(45° 단일 연결, §5-A) — 묶음마다 원 둘레 평균 색상각.
export const hueGroupsAt = (lchs, minC) => clusters(lchs.filter((c) => c[1] >= minC).map((c) => c[2]))
