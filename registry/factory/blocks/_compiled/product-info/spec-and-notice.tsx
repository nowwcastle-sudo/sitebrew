"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { NEEDS_CHECK } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type NoticeCopy, type NoticeData, NoticeTable } from "../_shared/notice-kit"

// 사양 + 고시(대장 A62 — 「HTML 표 + 사양 dl」). 왼쪽(넓으면 따라다니는 칸)에 사양 <dl>(크기·소재·구성처럼 사는 사람이 고르는 데 쓰는 값),
// 오른쪽에 고시 <table>. 사양은 구매 판단용, 고시는 법이 정한 항목이라 둘을 한 화면에서 나란히 두되 서로 섞지 않는다.
// 사양 값이 비면 「확인 필요」. 모두 글자(X2).
export type ProductInfoSpec = { id: string; label: string; value?: string }
export type ProductInfoSpecAndNoticeCopy = {
  title: string
  lead?: string
  specTitle: string
  noticeTitle: string
  notice: NoticeCopy
}
export type ProductInfoSpecAndNoticeProps = BlockBase<ProductInfoSpecAndNoticeCopy> & { notice: NoticeData; specs: ProductInfoSpec[] }

export function ProductInfoSpecAndNotice({ copy, notice, specs, id = "product-info", className }: ProductInfoSpecAndNoticeProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  return (
    <section ref={ref} id={id} data-block="product-info-spec-and-notice" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
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
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr] lg:gap-12">
        <div data-enter className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.specTitle}</h3>
          <dl data-spec-list="" className="flex flex-col">
            {specs.map((s) => (
              <div key={s.id} data-spec={s.id} className="flex flex-col gap-1 border-t py-3">
                <dt className="text-base leading-[1.5] text-muted-foreground">{s.label}</dt>
                <dd className="text-base leading-[1.6] break-words">
                  {s.value?.trim() ? (
                    s.value
                  ) : (
                    <span data-needs-check="" className="inline-flex items-center rounded-sm border border-dashed px-2 text-base leading-[1.6]">
                      {NEEDS_CHECK}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div data-enter className="flex min-w-0 flex-col gap-4 overflow-x-auto">
          <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.noticeTitle}</h3>
          <NoticeTable notice={notice} copy={copy.notice} id={id} />
        </div>
      </div>
    </section>
  )
}
