"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/factory/ui/tabs"

import { BlockHeading } from "../_shared/block-heading"
import { IntegrationMark, type IntegrationItem } from "../_shared/integration-mark"

// 연동 — 분류 탭 + 목록. 위 탭(회계·메신저·결제 …)으로 분류를 고르고, 아래에 그 분류의 연동을 한 줄씩(표지·이름·한 줄 설명·방식 배지·안내 링크).
// 탭 줄은 좁은 화면에서 그 줄 안에서만 가로로 밀린다. 분류가 하나면 탭 없이 목록만 그린다.
export type IntegrationsCategoryTabsCopy = {
  title: string
  lead?: string
  // 탭 목록의 이름(aria-label).
  tabsLabel: string
  categories: { name: string; items: IntegrationItem[] }[]
  kindLabels: Record<IntegrationItem["kind"], string>
  // 줄 끝 링크 문구(예: 「연결 방법」) — 링크 이름은 「<제품> 연결 방법」으로 읽힌다.
  linkLabel: string
}
export type IntegrationsCategoryTabsProps = BlockBase<IntegrationsCategoryTabsCopy>

export function IntegrationsCategoryTabs({ copy, id = "integrations", className }: IntegrationsCategoryTabsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const list = (items: IntegrationItem[]) => (
    <ul className="cn-block-integration-rows">
      {items.map((it, i) => (
        <li key={i} className="cn-block-integration-row">
          <IntegrationMark item={it} />
          <div className="cn-block-integration-row-text">
            <span className="cn-block-integration-row-name">{it.name}</span>
            {it.note ? <span className="cn-block-integration-row-note">{it.note}</span> : null}
          </div>
          <div className="cn-block-integration-row-meta">
            <Badge variant="outline">{copy.kindLabels[it.kind]}</Badge>
            <a href={it.url} className="cn-block-integration-row-link">
              <span className="sr-only">{it.name} </span>
              {copy.linkLabel}
              <ArrowRight aria-hidden="true" className="cn-block-integration-row-arrow" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
  const single = copy.categories.length === 1
  return (
    <section ref={ref} id={id} data-block="integrations-category-tabs" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-integration-tabs">
        {single ? (
          list(copy.categories[0].items)
        ) : (
          <Tabs defaultValue="0">
            <div className="cn-block-integration-tablist-scroll">
              <TabsList variant="line" aria-label={copy.tabsLabel}>
                {copy.categories.map((c, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {c.name}
                    <span data-numeric className="cn-block-integration-tab-count">
                      {c.items.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {copy.categories.map((c, i) => (
              <TabsContent key={i} value={String(i)} className="cn-block-integration-panel">
                {list(c.items)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </section>
  )
}
