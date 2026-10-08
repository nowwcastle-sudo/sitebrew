"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kineticType, playOnView, staggerIn } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { SplitSource } from "@/registry/factory/motion/split-source"

// 기능 — 차례로 내려앉는 카드(P3-5 MOTKIT). 큰 번호·막대·단계 이름 h3·한두 문장 카드 3~6장이 격자(넓은 화면 3열·좁은 화면 1열)로 놓인다(saas workflowSteps 칸).
// 모션(MOTKIT — 동작 줄이기·M0 정지): 구획이 화면에 들어올 때(한 번) 제목이 낱말마다 올라오고 → 카드가 왼쪽 위에서부터 2차원 물결로 떠오르며(스태거 —
// 형제 60ms, 전체 1.2s 이내, 8장 넘으면 묶음) → 카드 위 막대가 왼쪽에서 펼쳐진다. 마우스를 올리면 카드가 살짝 뜬다(CSS — 확대는 하지 않는다).
export type FeaturesStaggerCardsCopy = {
  title: string
  lead?: string
  steps: { title: string; body: string }[]
}
export type FeaturesStaggerCardsProps = BlockBase<FeaturesStaggerCardsCopy>

export function FeaturesStaggerCards({ copy, id = "features", className }: FeaturesStaggerCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    playOnView(s)
    kineticType(s, s.root.querySelector(".sc-title"), { mode: "rise", by: "words", at: 0 })
    staggerIn(s, s.q("[data-enter]"), { at: 0.2, y: 36, grid: "auto", from: "start" })
    s.tl.from(s.q(".sc-bar"), { scaleX: 0, transformOrigin: "0% 50%", duration: s.t.enter * 1.4, stagger: 0.06 * s.scale.stagger, clearProps: "transform" }, 0.45)
  })
  const sid = (i: number) => `${id}-card-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="features-stagger-cards" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div className="cn-block-heading">
        <h2 id={`${id}-title`} className="cn-block-title sc-title font-heading">
          <SplitSource label={copy.title}>{copy.title}</SplitSource>
        </h2>
        {copy.lead ? <p className="cn-block-lead">{copy.lead}</p> : null}
      </div>
      <ol className="cn-block-stagger-cards" data-count={copy.steps.length}>
        {copy.steps.map((st, i) => (
          <li key={i} data-enter aria-labelledby={sid(i)} className="cn-block-stagger-card">
            <span aria-hidden="true" className="cn-block-stagger-card-bar sc-bar" />
            <span data-numeric aria-hidden="true" className="cn-block-stagger-card-number font-heading">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 id={sid(i)} className="cn-block-stagger-card-title font-heading">
              {st.title}
            </h3>
            <p className="cn-block-stagger-card-body">{st.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
