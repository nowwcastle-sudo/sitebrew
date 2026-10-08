"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Card } from "@/registry/factory/ui/card"

import { BlockHeading } from "../_shared/block-heading"
import { gridCols } from "../_shared/grid-cols"
import { IntegrationMark, type IntegrationItem } from "../_shared/integration-mark"

// 연동 — 아이콘 격자. 연동 제품마다 한 칸(표지 + 이름 + 연동 방식 배지), 칸 전체가 그 제품의 연동 안내 링크다.
// 실제로 연동하는 제품만 싣는다(saas integrations — 연동하지 않는 로고는 쓰지 않는다). 아래 선택 줄 apiNote: API·웹훅 제공과 가져오기 경로.
export type IntegrationsIconGridCopy = {
  title: string
  lead?: string
  items: IntegrationItem[]
  kindLabels: Record<IntegrationItem["kind"], string>
  apiNote?: string
}
export type IntegrationsIconGridProps = BlockBase<IntegrationsIconGridCopy>

export function IntegrationsIconGrid({ copy, id = "integrations", className }: IntegrationsIconGridProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  return (
    <section ref={ref} id={id} data-block="integrations-icon-grid" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul data-cols={gridCols(copy.items.length, { prefer: [4, 3, 2] })} className="cn-block-integration-grid">
        {copy.items.map((it, i) => (
          <li key={i} data-enter className="cn-block-integration-grid-item">
            <Card size="sm" className="cn-block-integration-tile">
              <IntegrationMark item={it} size="lg" />
              <a href={it.url} className="cn-block-integration-tile-link">
                {it.name}
              </a>
              <Badge variant="outline">{copy.kindLabels[it.kind]}</Badge>
            </Card>
          </li>
        ))}
      </ul>
      {copy.apiNote ? (
        <p data-enter className="cn-block-integration-note">
          {copy.apiNote}
        </p>
      ) : null}
    </section>
  )
}
