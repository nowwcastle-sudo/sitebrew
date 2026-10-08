"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type NoticeCopy, type NoticeData, NoticeTable, NoticeValue } from "../_shared/notice-kit"

// 핵심 먼저 + 고시 전체(대장 A62, 원형 핵심 과업 — 제조국·A/S 연락처를 바로 찾는다). 위에 「먼저 확인할 것」 칸 3~4개(강조 행 id 로 고른 항목: 예 제조국·A/S 전화·품질보증기준)를
// 큰 글씨 dl 로, 아래에 같은 고시의 전체 표. 강조 행이 비어도 칸은 그리고 「확인 필요」를 보인다 — 핵심 사실이 비었다는 것이 눈에 띄어야 한다.
// 고시 전체 표는 그대로 있다(강조는 표를 대신하지 않는다 — 법이 정한 항목은 표에 모두).
export type ProductInfoKeyFactsFirstCopy = {
  title: string
  lead?: string
  factsTitle: string
  tableTitle: string
  notice: NoticeCopy
}
export type ProductInfoKeyFactsFirstProps = BlockBase<ProductInfoKeyFactsFirstCopy> & {
  notice: NoticeData
  // 먼저 보일 행 id(순서대로, 최대 4개 — 넘치면 앞 4개)
  highlight: string[]
}

export function ProductInfoKeyFactsFirst({ copy, notice, highlight, id = "product-info", className }: ProductInfoKeyFactsFirstProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const facts = highlight
    .slice(0, 4)
    .map((rid) => notice.rows.find((r) => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
  return (
    <section ref={ref} id={id} data-block="product-info-key-facts-first" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-16 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 id={`${id}-title`} data-enter className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="text-base leading-[1.7]">
            {copy.lead}
          </p>
        ) : null}
      </div>
      {facts.length ? (
        <div data-enter className="flex flex-col gap-4">
          <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.factsTitle}</h3>
          <dl data-key-facts="" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((r) => (
              <div key={r.id} data-fact={r.id} className="flex min-w-0 flex-col gap-2 rounded-md border bg-muted p-5">
                <dt className="text-base leading-[1.5] text-muted-foreground">{r.label}</dt>
                <dd className="text-[1.25rem] leading-[1.45] break-words">
                  <NoticeValue row={r} copy={copy.notice} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <div data-enter className="flex min-w-0 flex-col gap-4 overflow-x-auto">
        <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.tableTitle}</h3>
        <NoticeTable notice={notice} copy={copy.notice} id={id} />
      </div>
    </section>
  )
}
