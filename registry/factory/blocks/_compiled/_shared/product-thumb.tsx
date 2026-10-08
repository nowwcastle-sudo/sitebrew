import * as React from "react"

import type { Product } from "@/registry/factory/content/schemas/commerce"
import { Image as ImageIcon } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { blockLabels } from "../_shared/block-labels"

// 상품 사진 칸(P3-2 공유 조각 block-shared-product-thumb). 콘텐츠 ImageSlot 의 비율(aspect)로 자리를 먼저 잡는다(레이아웃 이동 0).
// src 가 없으면 비율을 지킨 빈 자리(콘텐츠 규칙: 비우면 빈 슬롯으로 납품)에 「실제 사진 필요」 글을 보인다(content/cards 와 같은 표지, FINAL-WF3 — 글 없는 회색 판은 자리인지 오류인지 모른다). 깨진 그림을 내지 않는다.
type Thumb = Product["thumbs"][number]

const ratio = (aspect: string) => {
  const m = aspect.match(/^(\d+)[:x](\d+)/)
  return m ? `${m[1]} / ${m[2]}` : "1 / 1"
}

export function ProductThumb({ thumb, className, eager = false, locale }: { thumb: Thumb; className?: string; eager?: boolean; locale?: "ko" | "en" }) {
  const label = blockLabels(locale).photoNeeded
  return (
    <span data-slot="product-thumb" style={{ aspectRatio: ratio(thumb.aspect) }} className={cn("relative flex w-full items-center justify-center overflow-hidden bg-muted", className)}>
      {thumb.src ? (
        <img src={thumb.src} alt={thumb.alt} loading={eager ? "eager" : "lazy"} decoding="async" className="size-full object-cover" />
      ) : (
        <span role="img" aria-label={thumb.alt ? `${thumb.alt} — ${label}` : label} data-photo-needed="" className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-base leading-[1.3] text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-8 shrink-0" />
          <span aria-hidden="true">{label}</span>
        </span>
      )}
    </span>
  )
}
