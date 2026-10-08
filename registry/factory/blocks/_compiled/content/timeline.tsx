"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentHead, type ContentValue, ContentValueText, enterOf } from "../_shared/content-kit"

// 연혁(대장 C70 — factory-rules.md §21-2: 연도별 <ol>, JS 없이 전부 보임, 가로 스크롤·과한 연출 없음). 줄마다 왼쪽에 연도(제목 서체, 큰 숫자),
// 오른쪽에 사건 글. 연도 칸 오른쪽의 세로 선 하나가 줄들을 잇는다. 연도·사건은 콘텐츠 $ref.
export type ContentTimelineEntry = { when: ContentValue; text: string }
export type ContentTimelineProps = BlockBase<ContentCopy> & { entries: ContentTimelineEntry[]; first?: boolean }

export function ContentTimeline({ copy, entries, first, locale, id = "timeline", className }: ContentTimelineProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const enter = enterOf(first)
  return (
    <section ref={ref} id={id} data-block="content-timeline" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ol className="flex max-w-4xl flex-col">
        {entries.map((e, i) => (
          <li key={i} data-enter={enter} className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-5 border-t py-5 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-10">
            <ContentValueText v={e.when} units={copy.units} locale={locale} className="border-e pe-5 text-[1.563rem] leading-[1.2] tabular-nums md:text-[1.953rem] font-heading" />
            <p className="text-[1.0625rem] leading-[1.7] break-keep md:pt-1.5">{e.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
