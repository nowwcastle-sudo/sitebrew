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
    <footer id={id} data-block="footer-compact-strip" className={cn("border-t bg-background text-foreground", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8">
          <p className="text-[1.25rem] leading-[1.3] font-heading">{copy.brand}</p>
          {copy.links.length ? (
            <nav aria-label={copy.navLabel}>
              <ul className="flex flex-wrap gap-x-4">
                {copy.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.href} className="inline-flex min-h-11 min-w-11 items-center text-base leading-[1.4] underline-offset-4 hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <p className="text-sm leading-[1.6]">{copy.copyright}</p>
        </div>
        <BusinessInline business={copy.business} labels={copy.businessLabels} />
      </div>
    </footer>
  )
}
