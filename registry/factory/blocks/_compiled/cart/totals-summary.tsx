"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cart, CommercePort } from "@/registry/factory/contract/commerce"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"
import { CartMiniLines, CartTotalsList, type CartEmptyCopy, type CartTotalsCopy } from "../_shared/cart-kit"
import { ListEmpty } from "../_shared/list-status"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 장바구니 — 합계 요약(읽기 전용: 담은 상품을 한 줄씩 + 합계 목록). 결제 쪽(checkout) 위나 옆에서 「무엇을 얼마에 사는지」를 한 번 더 보이는 칸이다.
// 합계는 총액 먼저(data-total)·VAT 표기·배송비가 한 구획에 있고, 고치는 길은 [장바구니 고치기] 링크다(여기서 수량을 바꾸지 않는다 — 바꾸는 쪽은 cart/lines-table·lines-cards).
// 포트: cart(읽기 4상태)만 — 쓰기 포트가 없다. 승인 행동 없음.
export type CartTotalsSummaryCopy = {
  title: string
  lead?: string
  /** 상품 줄 목록의 접근 이름 */
  listLabel: string
  /** 줄 하나의 수량 글({quantity} = 수량) */
  quantity: string
  totals: CartTotalsCopy
  /** 선택: 장바구니로 돌아가 고치는 링크 */
  edit?: { label: string; href: string }
  empty: CartEmptyCopy
  loading: string
  error: string
  retry: string
}
export type CartTotalsSummaryProps = BlockBase<CartTotalsSummaryCopy> & {
  cart: CommercePort["cart"]
  initial?: { cart?: Cart }
}

export function CartTotalsSummary({ copy, locale, cart, initial, id = "cart-summary", className }: CartTotalsSummaryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(cart, initial?.cart)
  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  const data = read.state.status === "ready" ? read.state.data : null

  return (
    <section ref={ref} id={id} data-block="cart-totals-summary" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex flex-col gap-6 max-w-xl">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {data && data.lines.length === 0 ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {data && data.lines.length > 0 ? (
          <>
            <CartMiniLines lines={data.lines} label={copy.listLabel} quantity={copy.quantity} locale={locale} />
            <CartTotalsList totals={data} copy={copy.totals} locale={locale} />
            {copy.edit ? (
              <a href={copy.edit.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                {copy.edit.label}
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
