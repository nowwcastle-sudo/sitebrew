"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"

import { BlockHeading } from "../_shared/block-heading"
import { MenuPrice, type MenuItem } from "../_shared/menu-line"
import { ProductThumb } from "../_shared/product-thumb"

// 메뉴·가격표 — 사진 + 이름 + 가격 행. 줄마다 1:1 사진(없으면 비율을 지킨 빈 자리) · 이름·표지(대표·신메뉴)·설명 · 오른쪽 가격.
// 넓으면 두 열로 흐르고, 좁으면 사진이 작아진 한 열. 품절은 「품절」 배지. 사진은 콘텐츠 ImageSlot(실사 필수, local menu-photo 칸).
export type MenuPricePhotoRowsCopy = {
  title: string
  lead?: string
  soldOutLabel: string
  // 가격표 바로 아래 각주(대장 A120) — 「가격은 모두 부가세 포함이에요」
  footnote?: string
  origin?: string
}
export type MenuPricePhotoRowsProps = BlockBase<MenuPricePhotoRowsCopy> & { items: MenuItem[] }

const EMPTY_PHOTO = { id: "menu-photo", aspect: "1:1", source: "real-required" as const, alt: "" }

export function MenuPricePhotoRows({ copy, items, id = "menu", className, locale }: MenuPricePhotoRowsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  return (
    <section ref={ref} id={id} data-block="menu-price-photo-rows" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="cn-block-mrow-list">
        {items.map((it, i) => (
          <li key={i} data-enter data-sold-out={it.soldOut ? "" : undefined} className="cn-block-mrow">
            <ProductThumb thumb={it.photo ?? EMPTY_PHOTO} className="cn-block-mrow-thumb" eager={i < 4} locale={locale} />
            <div className="cn-block-mrow-text">
              <div className="cn-block-mrow-head">
                <h3 className="cn-block-mrow-name font-heading">{it.name}</h3>
                {it.soldOut ? <Badge variant="outline">{copy.soldOutLabel}</Badge> : null}
                {it.tags?.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
              {it.description ? <p className="cn-block-mrow-desc">{it.description}</p> : null}
            </div>
            <MenuPrice item={it} className="cn-block-mrow-price" amountClassName="font-heading" />
          </li>
        ))}
      </ul>
      {copy.footnote ? <p className="cn-block-menu-footnote">{copy.footnote}</p> : null}
      {copy.origin ? <p className="cn-block-mrow-origin">{copy.origin}</p> : null}
    </section>
  )
}
