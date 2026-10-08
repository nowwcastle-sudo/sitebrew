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
    <section ref={ref} id={id} data-block="product-info-spec-and-notice" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-pis-section", className)}>
      <div className="cn-block-pin-head">
        <h2 id={`${id}-title`} data-enter className="cn-block-title font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="cn-block-lead">
            {copy.lead}
          </p>
        ) : null}
      </div>
      <div className="cn-block-pis-grid">
        <div data-enter className="cn-block-pis-spec">
          <h3 className="cn-block-pis-sub font-heading-ko">{copy.specTitle}</h3>
          <dl data-spec-list="" className="cn-block-pis-list">
            {specs.map((s) => (
              <div key={s.id} data-spec={s.id} className="cn-block-pis-item">
                <dt className="cn-block-pis-term">{s.label}</dt>
                <dd className="cn-block-pis-value">
                  {s.value?.trim() ? (
                    s.value
                  ) : (
                    <span data-needs-check="" className="cn-block-notice-missing">
                      {NEEDS_CHECK}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div data-enter className="cn-block-pis-notice">
          <h3 className="cn-block-pis-sub font-heading-ko">{copy.noticeTitle}</h3>
          <NoticeTable notice={notice} copy={copy.notice} id={id} />
        </div>
      </div>
    </section>
  )
}
