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
    <section ref={ref} id={id} data-block="content-timeline" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ol className="cn-block-content-timeline">
        {entries.map((e, i) => (
          <li key={i} data-enter={enter} className="cn-block-content-timeline-row">
            <ContentValueText v={e.when} units={copy.units} locale={locale} className="cn-block-content-timeline-when font-heading" />
            <p className="cn-block-content-timeline-text">{e.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
