"use client"

import * as React from "react"

// 레시피 모션 단계(M0~M3)를 소비자에서 읽는다. 레시피(registry:base)가 :root 에 --wf-motion: 0|1|2|3 을 싣는다(recipe.mjs recipeMarkers).
// 장면(useGsapScene)에는 쓰지 않는다 — 장면은 뿌리 요소의 --wf-motion 을 레이아웃 효과 안에서 직접 읽는다(하이드레이션 뒤 값이 바뀌어 등장을
// 다시 세우지 않게, P3-2 Task 1c). 이 훅은 장면 밖에서 단계를 알아야 할 때(조건부 렌더 등)에 쓴다.
// 서버 렌더에서는 2(M2 — 모르면 기본). 클라이언트에서는 넘긴 요소(ref)의 계산값을 읽는다 — 레시피가 html 이 아니라 [data-recipe] 구획에 있어도
// 그 안의 요소는 구획 값을 이어받는다. 요소를 주지 않았거나 아직 붙지 않았으면 :root 를 읽는다. html 의 속성(data-recipe·class·style)이
// 바뀌면 다시 읽는다(갤러리가 레시피를 바꿔 달 때).
export type RecipeMotion = 0 | 1 | 2 | 3
export type RecipeMotionLevel = "M0" | "M1" | "M2" | "M3"

export const RECIPE_MOTION_VAR = "--wf-motion"
const FALLBACK: RecipeMotion = 2

// CSS 변수 값 → 단계. 비었거나 0~3 정수가 아니면 2.
export function parseMotionLevel(value: string | null | undefined): RecipeMotion {
  const v = (value ?? "").trim()
  return v === "0" || v === "1" || v === "2" || v === "3" ? (Number(v) as RecipeMotion) : FALLBACK
}

// 단계 → 장면 훅(useGsapScene)의 level 값.
export const motionLevel = (n: RecipeMotion): RecipeMotionLevel => `M${n}` as RecipeMotionLevel

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-recipe", "class", "style"] })
  return () => mo.disconnect()
}

export function useRecipeMotion(el?: React.RefObject<Element | null>): RecipeMotion {
  // 값(0~3)을 돌려주므로 렌더마다 새 함수여도 스냅숏 비교가 흔들리지 않는다.
  const read = () => parseMotionLevel(getComputedStyle(el?.current ?? document.documentElement).getPropertyValue(RECIPE_MOTION_VAR))
  return React.useSyncExternalStore(subscribe, read, () => FALLBACK)
}
