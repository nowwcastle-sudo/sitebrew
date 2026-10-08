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
    <footer id={id} data-block="footer-stacked-legal" aria-labelledby={`${id}-title`} className={cn("border-t bg-background text-foreground", className)}>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-14 md:px-8 md:py-20">
        <div className="flex flex-col gap-3">
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
            {copy.title}
          </h2>
          {copy.lead ? <p className="max-w-[60ch] text-base leading-[1.7]">{copy.lead}</p> : null}
        </div>
        <BusinessTable business={copy.business} labels={copy.businessLabels} />
        <BusinessPolicyLinks business={copy.business} labels={copy.businessLabels} />
        <div className="flex flex-col gap-3 border-t pt-6 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8">
          <p className="text-[1.25rem] leading-[1.3] font-heading">{copy.brand}</p>
          {copy.links?.length ? (
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
      </div>
    </footer>
  )
}
