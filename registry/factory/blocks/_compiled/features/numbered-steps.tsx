"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"

// 기능 — 번호 단계 3~5개. 넓은 화면에서는 단계가 가로로 나란히 서고 위 선이 한 줄로 이어진다(흐름). 좁은 화면에서는 세로로 쌓이고
// 왼쪽 선이 번호를 잇는다. 번호는 큰 숫자(data-numeric), 단계 이름 h3, 그 단계에서 얻는 것 한두 문장(saas workflowSteps 칸).
export type FeaturesNumberedStepsCopy = {
  title: string
  lead?: string
  steps: { title: string; body: string }[]
}
export type FeaturesNumberedStepsProps = BlockBase<FeaturesNumberedStepsCopy>

export function FeaturesNumberedSteps({ copy, id = "features", className }: FeaturesNumberedStepsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.1 })
  })
  const sid = (i: number) => `${id}-step-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="features-numbered-steps" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ol className="grid gap-10 md:auto-cols-fr md:grid-flow-col md:gap-8" data-count={copy.steps.length}>
        {copy.steps.map((st, i) => (
          <li key={i} data-enter aria-labelledby={sid(i)} className="flex min-w-0 flex-col gap-3 border-s ps-6 md:border-s-0 md:border-t md:ps-0 md:pt-6">
            <span data-numeric aria-hidden="true" className="text-[2.441rem] leading-none md:text-[3.052rem] font-heading">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 id={sid(i)} className="text-[1.25rem] leading-[1.35] font-heading">
              {st.title}
            </h3>
            <p className="text-base leading-[1.7]">{st.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
