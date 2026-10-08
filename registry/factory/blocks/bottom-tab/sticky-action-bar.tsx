"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { useBottomBarSpace } from "../_shared/bottom-bar-space"
import { formatPrice, type MoneyFormat } from "../_shared/price-tag"

// 가격 + 구매 버튼 고정 줄(상세페이지·상품) — 왼쪽: 상품 이름(선택)·판매가(원화, data-numeric·tabular-nums)·정가 취소선(선택),
// 오른쪽: 보조 행동(선택, 외곽선 — 640 이상에서만. 375 는 가격 + 구매 버튼 한 줄) + 주 행동(구매). 화면 아래에 고정되고, 문서 --bottom-bar-height·scroll-padding-bottom + 문서 끝 여백
// (useBottomBarSpace pad — 푸터가 줄 뒤에 오므로 제자리 빈 칸이 아니라 끝 여백)으로 문서 끝 요소·포커스가 가리지 않는다. 안전 영역만큼 더 띄운다. 등장 모션 없음.
export type BottomTabStickyActionBarCopy = {
  // 고정 줄 구역 이름(aria-label).
  regionLabel: string
  name?: string
  priceLabel: string
  price: number
  originalPriceLabel?: string
  originalPrice?: number
  // 금액 단위(예: 원). money 를 주면 통화 기호가 금액에 붙으므로 쓰지 않는다.
  unit?: string
  // 콘텐츠 통화(선택, detail — price·originalPrice 는 최소 단위 정수). 없으면 원화(price + unit).
  money?: MoneyFormat
  primary: Cta
  secondary?: Cta
}
export type BottomTabStickyActionBarProps = BlockBase<BottomTabStickyActionBarCopy>

const won = (n: number) => n.toLocaleString("ko-KR")

export function BottomTabStickyActionBar({ copy, id = "buy-bar", className }: BottomTabStickyActionBarProps) {
  const bar = React.useRef<HTMLDivElement>(null)
  useBottomBarSpace(bar, { pad: true })
  const m = copy.money
  const show = (n: number) => (m ? formatPrice(n, m.currency, { minor: true, locale: m.locale }) : won(n))
  return (
    <div data-block="bottom-tab-sticky-action-bar" className={cn("cn-block-bottom-root", className)}>
      <div ref={bar} id={id} role="region" aria-label={copy.regionLabel} className="cn-block-bottom-bar">
        <div className="cn-block-bottom-action-row">
          <div className="cn-block-bottom-price-box">
            {copy.name ? <p className="cn-block-bottom-name">{copy.name}</p> : null}
            <p className="cn-block-bottom-price-line">
              <span className="sr-only">{copy.priceLabel} </span>
              <span data-numeric="" className="cn-block-bottom-price font-heading">
                {show(copy.price)}
              </span>
              {copy.unit ? <span className="cn-block-bottom-unit">{copy.unit}</span> : null}
              {copy.originalPrice ? (
                <s className="cn-block-bottom-original">
                  <span className="sr-only">{copy.originalPriceLabel} </span>
                  <span data-numeric="">{show(copy.originalPrice)}</span>
                  {copy.unit}
                </s>
              ) : null}
            </p>
          </div>
          <div className="cn-block-bottom-actions">
            {copy.secondary ? (
              <Button variant="outline" size="lg" nativeButton={false} render={<a href={copy.secondary.href} />} className="cn-block-bottom-secondary">
                {copy.secondary.label}
              </Button>
            ) : null}
            <Button size="lg" nativeButton={false} render={<a href={copy.primary.href} />} className="cn-block-bottom-primary">
              {copy.primary.label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
