"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Business } from "@/registry/factory/content/content-core"
import { CheckCircle, ExternalLink } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type BusinessLabels, businessRows } from "../_shared/business-info"

// 확인할 수 있는 사업자 띠(마케팅 규칙 L9·X2 — factory-rules.md §22-1·§22-7). 전자상거래법 제10조 사업자 정보(상호·대표자·사업자등록번호·통신판매업 신고번호·
// 주소·연락처)를 서버가 그린 글자로 한 띠에 두고, 누구나 대조할 수 있는 공정위 사업자정보 공개 페이지 링크를 곁에 단다(L9). 가짜 인증 씰 그림은 없다 —
// 「확인」은 그림이 아니라 공개 조회 링크다. 결제 버튼 곁·상세페이지 아래·푸터 위에 둔다(모바일은 줄을 바꿔 차례로 보인다).
export type TrustVerifiedBusinessStripCopy = {
  title: string
  verify: { text: string; label: string }
  labels: BusinessLabels
}
export type TrustVerifiedBusinessStripProps = BlockBase<TrustVerifiedBusinessStripCopy> & { business: Business }

export function TrustVerifiedBusinessStrip({ copy, business, id = "verified-business", className }: TrustVerifiedBusinessStripProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 8 })
  })
  const rows = businessRows(business, copy.labels)
  return (
    <section ref={ref} id={id} data-block="trust-verified-business-strip" aria-labelledby={`${id}-title`} className={cn("mx-auto w-full max-w-6xl px-4 py-8 md:px-8", className)}>
      <div data-enter className="flex flex-col gap-4 border-t-4 border-foreground pt-5">
        <div className="flex items-center gap-2">
          <CheckCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <h2 id={`${id}-title`} className="text-[1.25rem] leading-[1.35] font-heading-ko">
            {copy.title}
          </h2>
        </div>
        <dl data-business-facts="" className="grid grid-cols-1 gap-x-8 gap-y-2 text-base leading-[1.6] sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.key} data-fact={r.key} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <dt className="shrink-0 text-base">{r.term}</dt>
              <dd className="min-w-0 break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
        {business.ftcLookupUrl ? (
          <p data-ftc-lookup="" className="flex flex-col items-start gap-1 border-t pt-3 text-base leading-[1.6] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <span className="text-base">{copy.verify.text}</span>
            <a href={business.ftcLookupUrl} target="_blank" rel="noopener noreferrer" className="relative inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
              {copy.verify.label}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
