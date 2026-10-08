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
    <section ref={ref} id={id} data-block="menu-price-board-columns" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="cn-block-board">
        <div className="cn-block-board-columns">
          {categories.map((c, ci) => (
            <div key={ci} data-enter className="cn-block-board-group">
              <h3 className="cn-block-board-category font-heading">{c.name}</h3>
              {c.note ? <p className="cn-block-board-note">{c.note}</p> : null}
              <ul className="cn-block-board-list">
                {c.items.map((it, i) => (
                  <li key={i} data-sold-out={it.soldOut ? "" : undefined} className="cn-block-board-item">
                    <div className="cn-block-board-line">
                      <span className="cn-block-board-name">{it.name}</span>
                      <span aria-hidden="true" className="cn-block-board-leader" />
                      <MenuPrice item={it} className="cn-block-board-price" />
                    </div>
                    {it.description || it.soldOut || it.tags?.length ? (
                      <p className="cn-block-board-desc">
                        {it.soldOut ? <span className="cn-block-board-sold">{copy.soldOutLabel}</span> : null}
                        {it.tags?.map((t) => (
                          <span key={t} className="cn-block-board-tag">
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
        {copy.origin ? <p className="cn-block-board-origin">{copy.origin}</p> : null}
      </div>
    </section>
  )
}
