"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { IsoDate } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { fillText, formatFrom } from "../_shared/billing-format"
import { type NoticeCopy, type NoticeData, NoticeTable } from "../_shared/notice-kit"

// 상품정보제공고시 표(대장 A62, 전자상거래법 제13조 제2항·공정위 고시 — factory-rules.md §21-6 MUST). 고시 품목의 항목을 실제 <table> 한 장으로 그린다:
// caption(고시 품목) · 항목 열 th scope="row" · 값 열. 이미지가 아니라 서버가 그린 글자다(X2). 값이 없는 항목은 「확인 필요」, 제공할 수 없는 항목은 사유(고시 Ⅱ.3).
// 항목 이름·값은 콘텐츠(notice.rows)가 준다 — 블록은 항목 이름을 모른다. 표 아래 「기준일」(있을 때).
export type ProductInfoNoticeTableCopy = {
  title: string
  lead?: string
  notice: NoticeCopy
  // 「{date} 기준」 — asOf 가 있을 때
  asOf?: string
}
export type ProductInfoNoticeTableProps = BlockBase<ProductInfoNoticeTableCopy> & { notice: NoticeData; asOf?: IsoDate }

export function ProductInfoNoticeTable({ copy, locale, timeZone, notice, asOf, id = "product-info", className }: ProductInfoNoticeTableProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  return (
    <section ref={ref} id={id} data-block="product-info-notice-table" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-16 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
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
      <div data-enter className="overflow-x-auto rounded-md border">
        <NoticeTable notice={notice} copy={copy.notice} id={id} />
      </div>
      {asOf && copy.asOf ? (
        <p data-enter className="-mt-6 text-base leading-[1.5] md:-mt-8">
          <time data-numeric dateTime={asOf}>
            {fillText(copy.asOf, { date: formatFrom(asOf, locale, timeZone) })}
          </time>
        </p>
      ) : null}
    </section>
  )
}
