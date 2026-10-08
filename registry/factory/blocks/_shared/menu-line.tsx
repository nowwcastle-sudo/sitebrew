import * as React from "react"

import type { ImageSlot } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"

import { formatPrice } from "../_shared/price-tag"

// 메뉴 한 줄의 모양과 가격 칸(P3-2 공유 조각 block-shared-menu-line — menu-price 세 변형이 같이 쓴다).
// 가격은 HTML 글자(원, data-numeric). 크기·양 선택(options)이 있으면 선택마다 「R 4,500원」처럼 나란히 적는다.
export type MenuItem = {
  name: string
  price: number
  description?: string
  tags?: string[]
  // 메뉴 사진(콘텐츠 ImageSlot — 실사 필수, local menu-photo 칸). 비우면 비율을 지킨 빈 자리
  photo?: ImageSlot
  soldOut?: boolean
  options?: { label: string; price: number }[]
}
export type MenuCategory = { name: string; note?: string; items: MenuItem[] }

export function MenuPrice({ item, className, amountClassName }: { item: MenuItem; className?: string; amountClassName?: string }) {
  if (!item.options?.length)
    return (
      <span data-numeric className={cn("cn-block-menu-amount", amountClassName, className)}>
        {formatPrice(item.price)}
      </span>
    )
  return (
    <span className={cn("cn-block-menu-options", className)}>
      {item.options.map((o) => (
        <span key={o.label} className="cn-block-menu-option">
          {o.label} <span data-numeric>{formatPrice(o.price)}</span>
        </span>
      ))}
    </span>
  )
}
