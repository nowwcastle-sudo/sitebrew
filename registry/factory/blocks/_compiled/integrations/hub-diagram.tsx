"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Avatar, AvatarFallback } from "@/registry/factory/ui/avatar"

import { BlockHeading } from "../_shared/block-heading"
import { IntegrationMark, type IntegrationItem } from "../_shared/integration-mark"

// 연동 — 가운데 제품 + 둘레 연동(허브). 왼쪽(좁으면 위) 정사각 그림: 가운데 제품 표지에서 둘레의 연동 표지로 선(SVG)을 긋는다(svg-draw — 동작
// 줄이기·M0 에서는 다 그어진 선 그대로). 그림은 장식이라 읽기 도구에서 숨기고(aria-hidden), 같은 내용을 오른쪽(좁으면 아래) 목록이 글자로 보인다.
// 둘레 표지는 최대 12개(넘으면 목록에만).
export type IntegrationsHubDiagramCopy = {
  title: string
  lead?: string
  // 가운데 표지에 쓰는 제품 이름(짧게).
  product: string
  items: IntegrationItem[]
  kindLabels: Record<IntegrationItem["kind"], string>
  apiNote?: string
}
export type IntegrationsHubDiagramProps = BlockBase<IntegrationsHubDiagramCopy>

const MAX_NODES = 12
const R = 40 // 둘레 반지름(그림 폭의 %)

export function IntegrationsHubDiagram({ copy, id = "integrations", className }: IntegrationsHubDiagramProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
    svgDraw(s, s.q("[data-hub-line]"), { at: 0.1 })
  })
  const nodes = copy.items.slice(0, MAX_NODES).map((it, i, all) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / all.length
    return { it, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) }
  })
  return (
    <section ref={ref} id={id} data-block="integrations-hub-diagram" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
        <div data-enter aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[32rem]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" focusable="false">
            {nodes.map((n, i) => (
              <line key={i} data-hub-line x1={50} y1={50} x2={n.x} y2={n.y} pathLength={1} className="fill-none stroke-border [stroke-width:0.5]" />
            ))}
          </svg>
          <Avatar className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 md:size-28">
            <AvatarFallback className="bg-primary text-[1.25rem] text-primary-foreground font-heading">{copy.product}</AvatarFallback>
          </Avatar>
          <ul className="absolute inset-0">
            {nodes.map((n, i) => (
              <li key={i} style={{ insetInlineStart: `${n.x}%`, insetBlockStart: `${n.y}%` }} className="absolute flex -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2">
                <IntegrationMark item={n.it} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {copy.items.map((it, i) => (
              <li key={i} data-enter className="flex min-w-0 items-center gap-3">
                <IntegrationMark item={it} />
                <a href={it.url} className="inline-flex min-h-11 min-w-0 flex-1 items-center text-base leading-[1.4] font-medium underline-offset-4 outline-hidden hover:underline focus-visible:ring-3 focus-visible:ring-ring">
                  {it.name}
                </a>
                <span className="shrink-0 text-base text-muted-foreground">{copy.kindLabels[it.kind]}</span>
              </li>
            ))}
          </ul>
          {copy.apiNote ? (
            <p data-enter className="max-w-3xl text-base leading-[1.7]">
              {copy.apiNote}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
