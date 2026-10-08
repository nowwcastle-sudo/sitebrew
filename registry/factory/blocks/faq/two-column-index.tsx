"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Separator } from "@/registry/factory/ui/separator"

import { BlockHeading } from "../_shared/block-heading"

// FAQ — 왼쪽 질문 목록(색인)·오른쪽 답. 넓은 화면에서 색인은 붙어 따라오고(질문이 많으면 목록만 스크롤된다), 좁은 화면에서는 색인을 접고
// 질문·답을 차례로 보인다(색인 링크는 같은 문서 안 앵커라 읽기 도구의 제목 탐색과 겹치지 않게 넓은 화면에서만 둔다).
export type FaqTwoColumnIndexCopy = {
  title: string
  lead?: string
  // 색인 내비의 이름(aria-label) — 화면에는 보이지 않지만 읽기 도구가 읽는 문구라 copy 로 받는다.
  indexLabel: string
  items: { q: string; a: string }[]
}
export type FaqTwoColumnIndexProps = BlockBase<FaqTwoColumnIndexCopy>

export function FaqTwoColumnIndex({ copy, id = "faq", className }: FaqTwoColumnIndexProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const qid = (i: number) => `${id}-q-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="faq-two-column-index" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="cn-block-faq-index">
        <nav aria-label={copy.indexLabel} className="cn-block-faq-index-nav">
          {/* 질문 목차는 순서가 없는 목록이다 — 번호(01·02…)를 달면 단계처럼 읽힌다(FINAL-WF3). 단계 목록(이용 방법)만 번호를 둔다 */}
          <ul className="cn-block-faq-index-list">
            {copy.items.map((it, i) => (
              <li key={i}>
                <a href={`#${qid(i)}`} className="cn-block-faq-index-link">
                  <span>{it.q}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="cn-block-faq-answers">
          {copy.items.map((it, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Separator />}
              <article id={qid(i)} aria-labelledby={`${qid(i)}-h`} className="cn-block-faq-item" data-enter>
                <h3 id={`${qid(i)}-h`} className="cn-block-faq-question font-heading">
                  {it.q}
                </h3>
                <p className="cn-block-faq-answer">{it.a}</p>
              </article>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
