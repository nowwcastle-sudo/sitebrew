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
    <section id={id} data-block="final-cta-quiet-link-row" aria-labelledby={`${id}-title`} className={cn("cn-block-cta-quiet", className)}>
      <div className="cn-block-cta-quiet-row">
        <h2 id={`${id}-title`} className="cn-block-cta-quiet-title font-heading">
          {copy.title}
        </h2>
        <ul aria-label={copy.linksLabel} className="cn-block-cta-quiet-links">
          {copy.links.map((l, i) => (
            <li key={i}>
              <a href={l.href} className="cn-block-cta-quiet-link">
                {l.label}
                <span aria-hidden="true" className="cn-block-cta-quiet-arrow">
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
