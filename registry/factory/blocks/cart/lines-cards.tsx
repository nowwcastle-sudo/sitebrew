"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cart, CommercePort } from "@/registry/factory/contract/commerce"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

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
    <section ref={ref} id={id} data-block="cart-lines-cards" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="cn-block-cart">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {data && data.lines.length === 0 ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {data && data.lines.length > 0 ? (
          <div className="cn-block-cart-split">
            <div className="cn-block-cart-main">
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              <ul id={form.formId} aria-label={copy.listLabel} className="cn-block-cart-cards">
                {data.lines.map((line) => (
                  <li key={line.productId} data-cart-line={line.productId} className="cn-block-cart-card">
                    <CartLineThumb line={line} locale={locale} />
                    <div className="cn-block-cart-card-body">
                      <p className="cn-block-cart-name font-heading">{line.name}</p>
                      <p className="cn-block-cart-card-unit">
                        <span className="cn-block-cart-card-key">{copy.line.unitPrice}</span> <MoneyText money={line.unitPrice} price="plain" locale={locale} />
                      </p>
                      <QuantityStepper form={form} line={line} copy={copy.line} onChange={setQuantity} />
                    </div>
                    <div className="cn-block-cart-card-side">
                      <p className="cn-block-cart-card-total">
                        <span className="cn-block-cart-card-key">{copy.line.lineTotal}</span>
                        <MoneyText money={lineTotal(line)} price="plain" className="font-heading" locale={locale} />
                      </p>
                      <RemoveLineButton form={form} line={line} copy={copy.line} onChange={setQuantity} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <aside aria-labelledby={`${id}-summary`} className="cn-block-cart-aside">
              <h3 id={`${id}-summary`} className="cn-block-cart-aside-title font-heading">
                {copy.summaryTitle}
              </h3>
              <CartTotalsList totals={data} copy={copy.totals} locale={locale} />
              <div className="cn-block-cart-actions">
                <Button size="lg" nativeButton={false} render={<a href={copy.checkout.href} />} onClick={() => track?.("cta_click", { id: "cart-checkout", label: copy.checkout.label, section: id })}>
                  {copy.checkout.label}
                </Button>
                {copy.continue ? (
                  <a href={copy.continue.href} className="cn-block-cart-link">
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
