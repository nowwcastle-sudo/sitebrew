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
    <section ref={ref} id={id} data-block="faq-grouped-by-topic" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="cn-block-faq-topics" data-count={copy.topics.length}>
        {copy.topics.map((t, i) => (
          <section key={i} data-enter aria-labelledby={tid(i)} className="cn-block-faq-topic">
            <header className="cn-block-faq-topic-head">
              <h3 id={tid(i)} className="cn-block-faq-topic-name font-heading">
                {t.name}
              </h3>
              <span className="cn-block-faq-topic-count">
                <span data-numeric>{t.items.length}</span>
                {copy.countUnit}
              </span>
            </header>
            <dl className="cn-block-faq-topic-list">
              {t.items.map((it, j) => (
                <div key={j} className="cn-block-faq-topic-item">
                  <dt className="cn-block-faq-topic-q">{it.q}</dt>
                  <dd className="cn-block-faq-topic-a">{it.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  )
}
