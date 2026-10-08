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
    <section ref={ref} id={id} data-block="features-numbered-steps" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ol className="cn-block-steps" data-count={copy.steps.length}>
        {copy.steps.map((st, i) => (
          <li key={i} data-enter aria-labelledby={sid(i)} className="cn-block-step">
            <span data-numeric aria-hidden="true" className="cn-block-step-number font-heading">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 id={sid(i)} className="cn-block-step-title font-heading">
              {st.title}
            </h3>
            <p className="cn-block-step-body">{st.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
