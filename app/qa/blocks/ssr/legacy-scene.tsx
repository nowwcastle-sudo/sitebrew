"use client"

// /qa/blocks/ssr &control=legacy 의 양성 대조(P3-2 Task 1c — 리뷰 I-7): Task 1 방식 그대로 단계를 useSyncExternalStore 로 읽어 level 로 넘기는 장면.
// 서버 스냅숏은 2 이고 하이드레이션 뒤 레시피 값(r1 → 1, r5 → 3)으로 바뀌면 level 이 바뀌어 장면을 되돌리고 다시 세운다 — 등장이 두 번 시작한다.
// 검사 도구가 이 대조에서 두 번을 잡아야 블록(level 없음)의 「한 번」이 눈먼 결과가 아니다.
import * as React from "react"

import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { motionLevel, useRecipeMotion } from "@/registry/factory/motion/use-recipe-motion"

export function LegacyScene() {
  const ref = React.useRef<HTMLElement>(null)
  const level = useRecipeMotion(ref)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  }, { level: motionLevel(level) })
  return (
    <section ref={ref} data-block="qa-legacy-scene" aria-labelledby="legacy-title" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16">
      <h2 id="legacy-title" data-enter className="font-heading">
        옛 방식 대조 장면(예시)
      </h2>
      <p data-enter>레시피 단계를 useRecipeMotion 으로 읽어 level 로 넘깁니다(예시).</p>
      <p data-enter>하이드레이션 뒤 값이 바뀌면 등장을 다시 세웁니다(예시).</p>
    </section>
  )
}
