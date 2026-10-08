// 히어로 구성(Task 10d)이 받는 것 — 장면(app/qa/recipes/scenes.tsx HeroScene)이 넘긴다.
// o.faces: 이 선택지(A 또는 B)에서 칠할 면(K6·K7 field-*, K8 block-*; 없으면 골격), o.dyn: 이 선택지의 역동 기법(recipe.mjs DYNAMICS id).
import type * as React from "react"

import type { Recipe } from "../specimen"

// motion: 이 선택지의 모션 강도(M0~M3) — 안무(registry/factory/motion use-gsap-scene)가 받는다.
export type HeroOption = { faces: string[]; dyn: Set<string>; motion: string }
// zone: 칸(article)의 레시피 속성(data-recipe·data-alt-*) 사본 — DarkZone 이 안쪽 요소에 달아 그 레시피(B면 B)의 다크 값을 한 구역에만 얹는다.
export type HeroZone = Record<string, string | undefined>
export type HeroProps = { r: Recipe; o: HeroOption; zone: HeroZone }
export type HeroComponent = (p: HeroProps) => React.ReactElement
