"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"
import { MenuPrice, type MenuCategory } from "../_shared/menu-line"

// 메뉴·가격표 — 칠판식 두 열. 뒤집힌 면(글자색 바탕) 한 장 위에 분류별 묶음이 두 열로 흐르고, 줄마다 이름 …… 가격(점선 이음).
// 가격은 HTML 글자(data-numeric, 원). 품절은 줄을 긋고 「품절」 글자. 아래 원산지 표시(음식점 원산지 표시 의무 — 문구는 copy).
export type MenuPriceBoardColumnsCopy = {
  title: string
  lead?: string
  soldOutLabel: string
  origin?: string
}
export type MenuPriceBoardColumnsProps = BlockBase<MenuPriceBoardColumnsCopy> & { categories: MenuCategory[] }

export function MenuPriceBoardColumns({ copy, categories, id = "menu", className }: MenuPriceBoardColumnsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  return (
    <section ref={ref} id={id} data-block="menu-price-board-columns" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="flex flex-col gap-8 bg-foreground px-6 py-10 text-background md:px-12 md:py-14">
        <div className="gap-12 md:columns-2">
          {categories.map((c, ci) => (
            <div key={ci} data-enter className="mb-10 flex break-inside-avoid flex-col gap-3 last:mb-0">
              <h3 className="border-b border-background pb-2 text-[1.563rem] leading-[1.25] font-heading">{c.name}</h3>
              {c.note ? <p className="text-base leading-[1.6] break-keep [overflow-wrap:break-word]">{c.note}</p> : null}
              <ul className="flex flex-col gap-4">
                {c.items.map((it, i) => (
                  <li key={i} data-sold-out={it.soldOut ? "" : undefined} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="min-w-0 text-[1.125rem] leading-[1.45] break-keep [overflow-wrap:break-word] in-data-[sold-out]:line-through">{it.name}</span>
                      <span aria-hidden="true" className="min-w-6 flex-1 translate-y-[-0.3em] border-b border-dotted border-background" />
                      <MenuPrice item={it} className="ms-auto max-w-[60%]" />
                    </div>
                    {it.description || it.soldOut || it.tags?.length ? (
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base leading-[1.6] break-keep [overflow-wrap:break-word]">
                        {it.soldOut ? <span className="border border-background px-1.5 leading-[1.5]">{copy.soldOutLabel}</span> : null}
                        {it.tags?.map((t) => (
                          <span key={t} className="border border-background px-1.5 leading-[1.5]">
                            {t}
                          </span>
                        ))}
                        {it.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {copy.origin ? <p className="border-t border-background pt-6 text-base leading-[1.6]">{copy.origin}</p> : null}
      </div>
    </section>
  )
}
