"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentHead, type ContentValue, ContentValueText, enterOf, formatValue } from "../_shared/content-kit"

// 이름 → 값 목록(대장 C70 — 사례 메타·배송 안내·원산지·쪽 기준 시각). 실제 <dl>: 이름(dt)은 흐린 글자, 값(dd)은 본문 글자,
// 넓은 화면에서 두 칸·줄마다 위쪽 선. 값은 콘텐츠 $ref 이고 금액·일수·연도·날짜는 서식과 data-numeric 을 받는다. 빈 값의 줄은 그리지 않는다.
export type ContentFactRow = { label: string; value: ContentValue }
export type ContentFactsProps = BlockBase<ContentCopy> & { rows: ContentFactRow[]; first?: boolean }

export function ContentFacts({ copy, rows, first, locale, id = "facts", className }: ContentFactsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  const enter = enterOf(first)
  const shown = rows.filter((r) => formatValue(r.value, copy.units, locale) !== null)
  return (
    <section ref={ref} id={id} data-block="content-facts" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <dl className="cn-block-content-facts">
        {shown.map((r, i) => (
          <div key={i} data-enter={enter} className="cn-block-content-fact">
            <dt className="cn-block-content-fact-label">{r.label}</dt>
            <dd className="cn-block-content-fact-value">
              <ContentValueText v={r.value} units={copy.units} locale={locale} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
