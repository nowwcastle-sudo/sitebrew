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
    <section ref={ref} id={id} data-block="faq-two-column-index" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-16">
        <nav aria-label={copy.indexLabel} className="hidden md:sticky md:top-24 md:block md:max-h-[70vh] md:self-start md:overflow-y-auto md:border-e md:pe-6">
          {/* 질문 목차는 순서가 없는 목록이다 — 번호(01·02…)를 달면 단계처럼 읽힌다(FINAL-WF3). 단계 목록(이용 방법)만 번호를 둔다 */}
          <ul className="flex flex-col">
            {copy.items.map((it, i) => (
              <li key={i}>
                <a href={`#${qid(i)}`} className="flex min-h-[44px] items-center gap-3 py-2 text-base leading-[1.5] underline-offset-4 hover:underline">
                  <span>{it.q}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-8">
          {copy.items.map((it, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Separator />}
              <article id={qid(i)} aria-labelledby={`${qid(i)}-h`} className="flex scroll-mt-24 flex-col gap-3" data-enter>
                <h3 id={`${qid(i)}-h`} className="text-[1.25rem] leading-[1.4] font-heading">
                  {it.q}
                </h3>
                <p className="text-base leading-[1.7]">{it.a}</p>
              </article>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
