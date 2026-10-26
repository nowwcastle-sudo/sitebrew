import * as React from "react"

import type { Product } from "@/components/content/schemas/commerce"
import { cn } from "@/lib/utils"

import { formatPrice, type MoneyFormat } from "../_shared/price-tag"

// 상품 가격(P3-2 공유 조각 block-shared-product-price): 할인율 · 판매가 · 정가(취소선, 읽기 도구에는 「정가」 붙임) · 단위 가격.
// 금액은 모두 data-numeric. 문구 틀은 copy 로 받는다(할인 「{p}%」, 정가 이름, 단위 가격 「{per}당 {price}」).
// vatNote(선택, 대장 A120): 「부가세 포함」 같은 총액 문구 — 카드마다 가격 바로 아래 한 줄(원화 가격은 총액·VAT 문구와 같은 묶음에 둔다, 전자상거래법 제21조의2①1)
export type ProductPriceLabels = { discount: string; listPrice: string; unitPrice: string; vatNote?: string }

// money(선택): 콘텐츠 통화 — 주면 금액(최소 단위 정수)을 그 통화·로캘로 그린다(detail). 안 주면 원화 글자 그대로(commerce 는 원화 전용 — 통화 칸이 없다).
export function ProductPrice({ product, labels, money, className }: { product: Pick<Product, "price" | "listPrice" | "unitPrice">; labels: ProductPriceLabels; money?: MoneyFormat; className?: string }) {
  const show = (n: number) => (money ? formatPrice(n, money.currency, { minor: true, locale: money.locale }) : formatPrice(n))
  const off = product.listPrice && product.listPrice > product.price ? Math.round((1 - product.price / product.listPrice) * 100) : 0
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        {off > 0 ? (
          <span data-numeric className="text-[1.125rem] leading-[1.3] font-medium">
            {labels.discount.replace("{p}", String(off))}
          </span>
        ) : null}
        <span data-numeric className="text-[1.125rem] leading-[1.3] font-medium">
          {show(product.price)}
        </span>
        {off > 0 && product.listPrice ? (
          <s className="text-base text-muted-foreground">
            <span className="sr-only">{labels.listPrice} </span>
            <span data-numeric>{show(product.listPrice)}</span>
          </s>
        ) : null}
      </span>
      {labels.vatNote ? <span className="text-base text-muted-foreground">{labels.vatNote}</span> : null}
      {product.unitPrice ? (
        <span data-numeric className="text-base text-muted-foreground">
          {labels.unitPrice.replace("{per}", product.unitPrice.per).replace("{price}", show(product.unitPrice.amount))}
        </span>
      ) : null}
    </span>
  )
}
