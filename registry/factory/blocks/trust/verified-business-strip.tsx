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
    <section ref={ref} id={id} data-block="trust-verified-business-strip" aria-labelledby={`${id}-title`} className={cn("cn-block-tvb-section", className)}>
      <div data-enter className="cn-block-tvb-strip">
        <div className="cn-block-tvb-head">
          <CheckCircle aria-hidden="true" className="cn-block-tvb-icon" />
          <h2 id={`${id}-title`} className="cn-block-tvb-title font-heading-ko">
            {copy.title}
          </h2>
        </div>
        <dl data-business-facts="" className="cn-block-tvb-list">
          {rows.map((r) => (
            <div key={r.key} data-fact={r.key} className="cn-block-tvb-item">
              <dt className="cn-block-tvb-term">{r.term}</dt>
              <dd className="cn-block-tvb-value">{r.value}</dd>
            </div>
          ))}
        </dl>
        {business.ftcLookupUrl ? (
          <p data-ftc-lookup="" className="cn-block-tvb-verify">
            <span className="cn-block-tvb-verify-text">{copy.verify.text}</span>
            <a href={business.ftcLookupUrl} target="_blank" rel="noopener noreferrer" className="cn-block-tvb-link">
              {copy.verify.label}
              <ExternalLink aria-hidden="true" className="cn-block-tvb-link-icon" />
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
