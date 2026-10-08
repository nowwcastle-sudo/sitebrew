import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

// 마지막 행동 유도 — 조용한 링크 한 줄(포트폴리오). 윗선 하나 아래 한 줄: 왼쪽에 작은 제목 h2(한 문장), 오른쪽에 밑줄 링크 몇 개(→).
// 색 면·버튼 없이 글자만 — 작업을 다 본 뒤 연락 길만 남긴다. 375 에서는 제목 아래로 링크가 줄 바꿈한다. 등장 모션 없음(조용한 끝).
export type FinalCtaQuietLinkRowCopy = {
  title: string
  linksLabel: string
  links: Cta[]
}
export type FinalCtaQuietLinkRowProps = BlockBase<FinalCtaQuietLinkRowCopy>

export function FinalCtaQuietLinkRow({ copy, id = "next-step", className }: FinalCtaQuietLinkRowProps) {
  return (
    <section id={id} data-block="final-cta-quiet-link-row" aria-labelledby={`${id}-title`} className={cn("mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-14", className)}>
      <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-baseline md:justify-between md:gap-10">
        <h2 id={`${id}-title`} className="text-[1.25rem] leading-[1.4] md:text-[1.563rem] font-heading">
          {copy.title}
        </h2>
        <ul aria-label={copy.linksLabel} className="flex flex-wrap gap-x-6">
          {copy.links.map((l, i) => (
            <li key={i}>
              <a href={l.href} className="inline-flex min-h-11 items-center gap-1.5 text-base underline underline-offset-4 hover:decoration-2">
                {l.label}
                <span aria-hidden="true" className="inline-flex [&_svg]:size-4">
                  <ArrowRight aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
