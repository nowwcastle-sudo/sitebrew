"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/factory/ui/tabs"

import { BlockHeading } from "../_shared/block-heading"
import { MenuPrice, type MenuCategory } from "../_shared/menu-line"

// 메뉴·가격표 — 분류 탭. 위 밑줄 탭(커피·차·디저트 …, 개수 표시)으로 분류를 고르고, 아래 그 분류의 메뉴가 넓으면 두 열 목록.
// 줄마다 이름 · 설명 · 가격(크기 선택이 있으면 선택마다). 탭 줄은 좁은 화면에서 그 줄 안에서만 가로로 밀린다. 분류가 하나면 탭 없이 목록만.
export type MenuPriceCategoryTabsCopy = {
  title: string
  lead?: string
  tabsLabel: string
  soldOutLabel: string
  // 가격표 바로 아래 각주(대장 A120) — 「가격은 모두 부가세 포함이에요」. 분류 탭과 상관없이 목록 아래에 늘 보인다
  footnote?: string
  origin?: string
}
export type MenuPriceCategoryTabsProps = BlockBase<MenuPriceCategoryTabsCopy> & { categories: MenuCategory[] }

export function MenuPriceCategoryTabs({ copy, categories, id = "menu", className }: MenuPriceCategoryTabsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const list = (c: MenuCategory) => (
    <>
      {c.note ? <p className="text-base leading-[1.6]">{c.note}</p> : null}
      <ul className="grid gap-x-12 md:grid-cols-2">
        {c.items.map((it, i) => (
          <li key={i} data-sold-out={it.soldOut ? "" : undefined} className="flex items-start justify-between gap-4 border-b py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-baseline gap-2 text-[1.125rem] leading-[1.45] font-medium break-keep [overflow-wrap:break-word] in-data-[sold-out]:line-through">
                {it.name}
                {it.soldOut ? <span className="border px-1.5 text-base leading-[1.5] font-normal no-underline">{copy.soldOutLabel}</span> : null}
              </span>
              {it.description ? <span className="text-base leading-[1.6] break-keep [overflow-wrap:break-word]">{it.description}</span> : null}
            </div>
            <MenuPrice item={it} className="max-w-[50%] text-end" />
          </li>
        ))}
      </ul>
    </>
  )
  return (
    <section ref={ref} id={id} data-block="menu-price-category-tabs" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="flex flex-col gap-6">
        {categories.length === 1 ? (
          list(categories[0])
        ) : (
          <Tabs defaultValue="0">
            <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              <TabsList variant="line" aria-label={copy.tabsLabel}>
                {categories.map((c, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {c.name}
                    <span data-numeric className="ms-1.5 text-base">
                      {c.items.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {categories.map((c, i) => (
              <TabsContent key={i} value={String(i)} className="flex flex-col gap-4 pt-6">
                {list(c)}
              </TabsContent>
            ))}
          </Tabs>
        )}
        {copy.footnote ? <p className="text-base leading-[1.6] text-muted-foreground">{copy.footnote}</p> : null}
        {copy.origin ? <p className="border-t pt-6 text-base leading-[1.6]">{copy.origin}</p> : null}
      </div>
    </section>
  )
}
