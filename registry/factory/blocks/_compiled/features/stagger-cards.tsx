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
    <section ref={ref} id={id} data-block="features-stagger-cards" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] sc-title font-heading">
          <SplitSource label={copy.title}>{copy.title}</SplitSource>
        </h2>
        {copy.lead ? <p className="text-base leading-[1.7]">{copy.lead}</p> : null}
      </div>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6" data-count={copy.steps.length}>
        {copy.steps.map((st, i) => (
          <li key={i} data-enter aria-labelledby={sid(i)} className="relative flex flex-col gap-3 overflow-clip rounded-lg border bg-card p-6 pt-7 text-card-foreground transition-transform duration-(--duration-hover) ease-(--ease-standard) hover:-translate-y-1 motion-reduce:transition-none">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-primary sc-bar" />
            <span data-numeric aria-hidden="true" className="text-[2.441rem] leading-none text-foreground font-heading">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 id={sid(i)} className="text-xl leading-[1.3] font-heading">
              {st.title}
            </h3>
            <p className="leading-[1.7]">{st.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
