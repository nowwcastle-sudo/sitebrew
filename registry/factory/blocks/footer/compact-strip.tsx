import * as React from "react"

import type { Business, Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"

import { BusinessInline, type BusinessLabels } from "../_shared/business-info"

// 푸터 — 작은 사이트의 한 줄 띠: 워드마크 · 링크 몇 개 · 저작권이 한 줄, 그 아래 사업자 정보가 「이름 값」 흐름 한 문단(법정 표시 항목 전부 +
// 정책 링크). 375 에서는 첫 줄이 줄 바꿈하며 쌓인다. 등장 모션 없음.
export type FooterCompactStripCopy = {
  brand: string
  navLabel: string
  links: Cta[]
  business: Business
  businessLabels: BusinessLabels
  copyright: string
}
export type FooterCompactStripProps = BlockBase<FooterCompactStripCopy>

export function FooterCompactStrip({ copy, id = "site-footer", className }: FooterCompactStripProps) {
  return (
    <footer id={id} data-block="footer-compact-strip" className={cn("cn-block-footer", className)}>
      <div className="cn-block-footer-strip">
        <div className="cn-block-footer-strip-row">
          <p className="cn-block-footer-strip-brand font-heading">{copy.brand}</p>
          {copy.links.length ? (
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
          <p className="cn-block-footer-strip-copyright">{copy.copyright}</p>
        </div>
        <BusinessInline business={copy.business} labels={copy.businessLabels} />
      </div>
    </footer>
  )
}
