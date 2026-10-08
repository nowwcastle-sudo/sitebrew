import * as React from "react"

import type { Business, Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"

import { BusinessRows, type BusinessLabels } from "../_shared/business-info"

// 푸터 — 위: 워드마크·한 줄 소개 + 링크 열 3~4개(열 제목 h2). 아래: 선 하나 뒤 한국 사업자 정보(법정 표시 항목 전부)와 정책 링크, 저작권 줄.
// 375 에서는 링크 열이 두 칸으로 접히고 사업자 정보는 한 항목씩 줄 바꿈한다. 등장 모션 없음(문서 끝 정보 칸).
export type FooterColumnsBusinessCopy = {
  brand: string
  tagline?: string
  // 링크 열 묶음의 이름(aria-label).
  navLabel: string
  columns: { title: string; links: Cta[] }[]
  business: Business
  businessLabels: BusinessLabels
  copyright: string
}
export type FooterColumnsBusinessProps = BlockBase<FooterColumnsBusinessCopy>

export function FooterColumnsBusiness({ copy, id = "site-footer", className }: FooterColumnsBusinessProps) {
  return (
    <footer id={id} data-block="footer-columns-business" className={cn("cn-block-footer", className)}>
      <div className="cn-block-footer-inner">
        <div className="cn-block-footer-cols-top">
          <div className="cn-block-footer-intro">
            <p className="cn-block-footer-brand font-heading">{copy.brand}</p>
            {copy.tagline ? <p className="cn-block-footer-tagline">{copy.tagline}</p> : null}
          </div>
          <nav aria-label={copy.navLabel} className="cn-block-footer-cols">
            {copy.columns.map((col, i) => (
              <div key={i} className="cn-block-footer-col">
                <h2 id={`${id}-col-${i + 1}`} className="cn-block-footer-col-title font-heading">
                  {col.title}
                </h2>
                <ul aria-labelledby={`${id}-col-${i + 1}`} className="cn-block-footer-col-list">
                  {col.links.map((l, j) => (
                    <li key={j}>
                      <a href={l.href} className="cn-block-footer-link">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="cn-block-footer-legal">
          <BusinessRows business={copy.business} labels={copy.businessLabels} />
          <p className="cn-block-footer-copyright">{copy.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
