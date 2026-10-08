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
      {c.note ? <p className="cn-block-mtab-note">{c.note}</p> : null}
      <ul className="cn-block-mtab-list">
        {c.items.map((it, i) => (
          <li key={i} data-sold-out={it.soldOut ? "" : undefined} className="cn-block-mtab-item">
            <div className="cn-block-mtab-text">
              <span className="cn-block-mtab-name">
                {it.name}
                {it.soldOut ? <span className="cn-block-mtab-sold">{copy.soldOutLabel}</span> : null}
              </span>
              {it.description ? <span className="cn-block-mtab-desc">{it.description}</span> : null}
            </div>
            <MenuPrice item={it} className="cn-block-mtab-price" />
          </li>
        ))}
      </ul>
    </>
  )
  return (
    <section ref={ref} id={id} data-block="menu-price-category-tabs" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-mtab">
        {categories.length === 1 ? (
          list(categories[0])
        ) : (
          <Tabs defaultValue="0">
            <div className="cn-block-mtab-scroll">
              <TabsList variant="line" aria-label={copy.tabsLabel}>
                {categories.map((c, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {c.name}
                    <span data-numeric className="cn-block-mtab-count">
                      {c.items.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {categories.map((c, i) => (
              <TabsContent key={i} value={String(i)} className="cn-block-mtab-panel">
                {list(c)}
              </TabsContent>
            ))}
          </Tabs>
        )}
        {copy.footnote ? <p className="cn-block-menu-footnote">{copy.footnote}</p> : null}
        {copy.origin ? <p className="cn-block-mtab-origin">{copy.origin}</p> : null}
      </div>
    </section>
  )
}
