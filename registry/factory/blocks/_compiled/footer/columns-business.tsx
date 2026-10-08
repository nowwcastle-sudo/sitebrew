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
    <footer id={id} data-block="footer-columns-business" className={cn("border-t bg-background text-foreground", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:gap-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="flex flex-col gap-3 md:col-span-4">
            <p className="text-[1.563rem] leading-[1.2] font-heading">{copy.brand}</p>
            {copy.tagline ? <p className="max-w-[40ch] text-base leading-[1.7]">{copy.tagline}</p> : null}
          </div>
          <nav aria-label={copy.navLabel} className="grid grid-cols-2 gap-x-6 gap-y-8 md:col-span-8 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
            {copy.columns.map((col, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-2">
                <h2 id={`${id}-col-${i + 1}`} className="text-base leading-[1.5] font-heading">
                  {col.title}
                </h2>
                <ul aria-labelledby={`${id}-col-${i + 1}`} className="flex flex-col">
                  {col.links.map((l, j) => (
                    <li key={j}>
                      <a href={l.href} className="inline-flex min-h-11 min-w-11 items-center text-base leading-[1.4] underline-offset-4 hover:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-6 border-t pt-8">
          <BusinessRows business={copy.business} labels={copy.businessLabels} />
          <p className="text-sm leading-[1.6]">{copy.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
