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
    <ul className="flex flex-col divide-y border-y">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <IntegrationMark item={it} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base leading-[1.4] font-medium">{it.name}</span>
            {it.note ? <span className="text-base leading-[1.6]">{it.note}</span> : null}
          </div>
          <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 md:col-start-auto md:justify-end">
            <Badge variant="outline">{copy.kindLabels[it.kind]}</Badge>
            <a href={it.url} className="inline-flex min-h-11 items-center gap-1 text-base font-medium underline underline-offset-4 outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
              <span className="sr-only">{it.name} </span>
              {copy.linkLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
  const single = copy.categories.length === 1
  return (
    <section ref={ref} id={id} data-block="integrations-category-tabs" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="min-w-0">
        {single ? (
          list(copy.categories[0].items)
        ) : (
          <Tabs defaultValue="0">
            <div className="overflow-x-auto pb-2">
              <TabsList variant="line" aria-label={copy.tabsLabel}>
                {copy.categories.map((c, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {c.name}
                    <span data-numeric className="ms-1.5 text-base text-muted-foreground">
                      {c.items.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {copy.categories.map((c, i) => (
              <TabsContent key={i} value={String(i)} className="pt-6">
                {list(c.items)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </section>
  )
}
