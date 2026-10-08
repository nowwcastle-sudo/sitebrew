import * as React from "react"

import type { Business, Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"

import { BusinessPolicyLinks, BusinessTable, type BusinessLabels } from "../_shared/business-info"

// 푸터 — 사업자 정보를 법정 표 모양으로 크게(공공·상세 페이지). 제목 h2 → 두 칸 표(항목 이름 · 값, 줄마다 선) → 정책 링크 줄(개인정보 처리방침 굵게)
// → 사이트 링크 몇 개 · 워드마크 · 저작권 줄. 375 에서는 표의 항목 이름이 값 위로 올라간다. 등장 모션 없음.
export type FooterStackedLegalCopy = {
  title: string
  lead?: string
  business: Business
  businessLabels: BusinessLabels
  brand: string
  navLabel: string
  links?: Cta[]
  copyright: string
}
export type FooterStackedLegalProps = BlockBase<FooterStackedLegalCopy>

export function FooterStackedLegal({ copy, id = "site-footer", className }: FooterStackedLegalProps) {
  return (
    <footer id={id} data-block="footer-stacked-legal" aria-labelledby={`${id}-title`} className={cn("cn-block-footer", className)}>
      <div className="cn-block-footer-legal-inner">
        <div className="cn-block-footer-legal-head">
          <h2 id={`${id}-title`} className="cn-block-footer-legal-title font-heading">
            {copy.title}
          </h2>
          {copy.lead ? <p className="cn-block-footer-legal-lead">{copy.lead}</p> : null}
        </div>
        <BusinessTable business={copy.business} labels={copy.businessLabels} />
        <BusinessPolicyLinks business={copy.business} labels={copy.businessLabels} />
        <div className="cn-block-footer-legal-foot">
          <p className="cn-block-footer-strip-brand font-heading">{copy.brand}</p>
          {copy.links?.length ? (
            <nav aria-label={copy.navLabel}>
              <ul className="cn-block-footer-strip-links">
                {copy.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.href} className="cn-block-footer-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <p className="cn-block-footer-copyright">{copy.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
