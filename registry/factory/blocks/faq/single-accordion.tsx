"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta, Faq } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/registry/factory/ui/accordion"

import { BlockHeading } from "../_shared/block-heading"

// FAQ — 한 열 아코디언. 가운데 좁은 열에 질문 줄만 쌓고 누르면 답이 열린다(여러 개를 함께 열 수 있다).
// 닫힌 답도 DOM 에 남긴다(hiddenUntilFound — 브라우저 찾기·검색 색인이 답 글자를 찾으면 그 칸이 열린다).
// 아래 선택 줄 more: 「여기 없는 질문은 …」 + 연락 링크 하나.
export type FaqSingleAccordionCopy = {
  title: string
  lead?: string
  items: Faq[]
  more?: { text: string; cta: Cta }
}
export type FaqSingleAccordionProps = BlockBase<FaqSingleAccordionCopy> & {
  // 처음부터 열어 둘 질문 번호(0부터). 기본은 모두 닫힘.
  defaultOpen?: number[]
}

export function FaqSingleAccordion({ copy, id = "faq", className, defaultOpen = [] }: FaqSingleAccordionProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  return (
    <section ref={ref} id={id} data-block="faq-single-accordion" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-faq-narrow", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-faq-accordion">
        <Accordion multiple hiddenUntilFound defaultValue={defaultOpen.map(String)}>
          {copy.items.map((it, i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="cn-block-faq-accordion-trigger">{it.q}</AccordionTrigger>
              <AccordionContent>
                <p className="cn-block-faq-answer">{it.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      {copy.more ? (
        <p data-enter className="cn-block-faq-more">
          <span>{copy.more.text}</span>
          <a href={copy.more.cta.href} className="cn-block-faq-more-link">
            {copy.more.cta.label}
          </a>
        </p>
      ) : null}
    </section>
  )
}
