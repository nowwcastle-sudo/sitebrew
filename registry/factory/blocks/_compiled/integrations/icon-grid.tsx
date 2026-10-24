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
    <section ref={ref} id={id} data-block="integrations-icon-grid" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul data-cols={gridCols(copy.items.length, { prefer: [4, 3, 2] })} className="flex flex-wrap justify-center gap-3 [--cols:2] data-[cols=1]:[--cols:1] max-sm:[&>li:last-child:nth-child(odd)]:basis-full sm:data-[cols=3]:[--cols:3] sm:data-[cols=4]:[--cols:4]">
        {copy.items.map((it, i) => (
          <li key={i} data-enter className="flex min-w-0 shrink-0 grow-0 basis-[calc((100%_-_(var(--cols)_-_1)_*_0.75rem)_/_var(--cols))]">
            <Card size="sm" className="relative w-full items-start gap-3 px-(--card-spacing) has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring">
              <IntegrationMark item={it} size="lg" />
              <a href={it.url} className="inline-flex min-h-11 items-center text-base leading-[1.4] font-medium break-keep underline-offset-4 outline-hidden after:absolute after:inset-0 hover:underline">
                {it.name}
              </a>
              <Badge variant="outline">{copy.kindLabels[it.kind]}</Badge>
            </Card>
          </li>
        ))}
      </ul>
      {copy.apiNote ? (
        <p data-enter className="max-w-3xl text-base leading-[1.7]">
          {copy.apiNote}
        </p>
      ) : null}
    </section>
  )
}
