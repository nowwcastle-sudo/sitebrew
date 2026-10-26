"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Faq } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"

// FAQ — 주제 머리글별 묶음. 주제 하나가 한 칸(머리글 h3 + 질문 수 + 질문·답 목록)이고, 넓은 화면에서는 칸이 두·세 열로 나란히 선다.
// 답은 접지 않고 모두 보인다(주제로 먼저 고르고 바로 읽는 모양 — 공공·상세 원형처럼 질문이 많고 훑어 읽는 곳).
export type FaqGroupedByTopicCopy = {
  title: string
  lead?: string
  // 주제마다 붙는 질문 수 표기의 뒷말(예: 「개」 → 「3개」).
  countUnit: string
  topics: { name: string; items: Faq[] }[]
}
export type FaqGroupedByTopicProps = BlockBase<FaqGroupedByTopicCopy>

export function FaqGroupedByTopic({ copy, id = "faq", className }: FaqGroupedByTopicProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const tid = (i: number) => `${id}-topic-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="faq-grouped-by-topic" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3 md:data-[count=1]:grid-cols-1 lg:data-[count=1]:grid-cols-1 lg:data-[count=2]:grid-cols-2" data-count={copy.topics.length}>
        {copy.topics.map((t, i) => (
          <section key={i} data-enter aria-labelledby={tid(i)} className="flex min-w-0 flex-col gap-5 border-t border-foreground pt-5">
            <header className="flex items-baseline justify-between gap-4">
              <h3 id={tid(i)} className="text-[1.25rem] leading-[1.35] font-heading">
                {t.name}
              </h3>
              <span className="shrink-0 text-base text-muted-foreground">
                <span data-numeric>{t.items.length}</span>
                {copy.countUnit}
              </span>
            </header>
            <dl className="flex flex-col gap-5">
              {t.items.map((it, j) => (
                <div key={j} className="flex flex-col gap-1.5">
                  <dt className="text-base leading-[1.5] font-medium">{it.q}</dt>
                  <dd className="text-base leading-[1.7]">{it.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  )
}
