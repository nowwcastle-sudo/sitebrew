"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { Cart, CommercePort } from "@/components/contract/commerce"
import type { AnalyticsPort } from "@/components/contract/ports"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"

import { MoneyText } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { CartLineThumb, CartTotalsList, QuantityStepper, RemoveLineButton, lineTotal, useCartLines, type CartEmptyCopy, type CartLineCopy, type CartTotalsCopy } from "../_shared/cart-kit"
import { ListEmpty } from "../_shared/list-status"
import { FormAlert } from "../_shared/port-form"
import { ReadError, ReadLoading } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 장바구니 — 줄 카드(담은 상품을 카드 목록으로, 오른쪽(좁으면 아래)에 합계 칸). 모바일 장바구니에 맞다: 줄마다 사진 · 이름 · 단가 · 수량 · 줄 금액 · [빼기]가 한 카드에 있다.
// 표(cart/lines-table)와 같은 포트·같은 동작이고 모양만 다르다 — 수량은 [−][칸][+], 재고가 모자라면 그 카드 아래에 서버 문구, 합계는 총액 먼저(VAT 표기).
// 포트: cart(읽기 4상태) · setCartLine. 계측(선택): add_to_cart(수량을 올릴 때만) · cta_click(주문하기). 승인 행동은 없다 — 결제는 cart/checkout-form 이 맡는다.
export type CartLinesCardsCopy = {
  title: string
  lead?: string
  /** 줄 목록의 접근 이름 */
  listLabel: string
  line: CartLineCopy
  totals: CartTotalsCopy
  /** 합계 칸의 제목 */
  summaryTitle: string
  checkout: { label: string; href: string }
  continue?: { label: string; href: string }
  empty: CartEmptyCopy
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
}
export type CartLinesCardsProps = BlockBase<CartLinesCardsCopy> & {
  cart: CommercePort["cart"]
  setCartLine: CommercePort["setCartLine"]
  track?: AnalyticsPort["track"]
  initial?: { cart?: Cart }
}

export function CartLinesCards({ copy, locale, cart, setCartLine, track, initial, id = "cart", className }: CartLinesCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const { read, form, setQuantity } = useCartLines({ id, cart, setCartLine, initial: initial?.cart, notices: copy.notices, track, formName: "cart-lines-cards" })
  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  const data = read.state.status === "ready" ? read.state.data : null

  return (
    <section ref={ref} id={id} data-block="cart-lines-cards" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex flex-col gap-6">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {data && data.lines.length === 0 ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {data && data.lines.length > 0 ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              <ul id={form.formId} aria-label={copy.listLabel} className="flex flex-col border-y">
                {data.lines.map((line) => (
                  <li key={line.productId} data-cart-line={line.productId} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b py-5 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
                    <CartLineThumb line={line} locale={locale} />
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="min-w-0 break-words font-heading">{line.name}</p>
                      <p className="flex flex-wrap items-baseline gap-x-2 text-base leading-[1.5]">
                        <span className="text-base leading-[1.5]">{copy.line.unitPrice}</span> <MoneyText money={line.unitPrice} price="plain" locale={locale} />
                      </p>
                      <QuantityStepper form={form} line={line} copy={copy.line} onChange={setQuantity} />
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between">
                      <p className="flex items-baseline gap-2 text-[1.125rem] leading-[1.4] tabular-nums">
                        <span className="text-base leading-[1.5]">{copy.line.lineTotal}</span>
                        <MoneyText money={lineTotal(line)} price="plain" className="font-heading" locale={locale} />
                      </p>
                      <RemoveLineButton form={form} line={line} copy={copy.line} onChange={setQuantity} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <aside aria-labelledby={`${id}-summary`} className="flex flex-col gap-4 border px-5 py-5 lg:sticky lg:top-6">
              <h3 id={`${id}-summary`} className="text-[1.25rem] leading-[1.35] font-heading">
                {copy.summaryTitle}
              </h3>
              <CartTotalsList totals={data} copy={copy.totals} locale={locale} />
              <div className="flex flex-col gap-3 md:items-end">
                <Button size="lg" nativeButton={false} render={<a href={copy.checkout.href} />} onClick={() => track?.("cta_click", { id: "cart-checkout", label: copy.checkout.label, section: id })}>
                  {copy.checkout.label}
                </Button>
                {copy.continue ? (
                  <a href={copy.continue.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                    {copy.continue.label}
                  </a>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  )
}
