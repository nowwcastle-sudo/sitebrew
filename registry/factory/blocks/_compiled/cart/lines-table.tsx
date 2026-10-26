"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cart, CommercePort } from "@/registry/factory/contract/commerce"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { MoneyText } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { CartLineThumb, CartTotalsList, QuantityStepper, RemoveLineButton, lineTotal, useCartLines, type CartEmptyCopy, type CartLineCopy, type CartTotalsCopy } from "../_shared/cart-kit"
import { ListEmpty } from "../_shared/list-status"
import { FormAlert } from "../_shared/port-form"
import { ReadError, ReadLoading } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 장바구니 — 줄 표(담은 상품을 표로: 상품 | 단가 | 수량 | 줄 합계 | 빼기). 합계(총액 먼저·VAT 표기·배송비)와 주문으로 가는 링크가 표 아래에 있다.
// 수량은 [−][칸][+]로 바꾸고(0 으로 내리지 않고 [빼기]), 재고가 모자라면 그 줄 아래에 서버 문구가 그려진다. 좁은 화면(sm 미만)에서는 줄 단위로 쌓는다.
// 포트: cart(읽기 4상태) · setCartLine. 계측(선택): add_to_cart(수량을 올릴 때만) · cta_click(주문하기). 승인 행동은 없다 — 결제는 cart/checkout-form 이 맡는다.
export type CartLinesTableCopy = {
  title: string
  lead?: string
  caption: string
  line: CartLineCopy
  totals: CartTotalsCopy
  checkout: { label: string; href: string }
  /** 선택: 쇼핑 계속하기 링크 */
  continue?: { label: string; href: string }
  empty: CartEmptyCopy
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
}
export type CartLinesTableProps = BlockBase<CartLinesTableCopy> & {
  cart: CommercePort["cart"]
  setCartLine: CommercePort["setCartLine"]
  track?: AnalyticsPort["track"]
  initial?: { cart?: Cart }
}

export function CartLinesTable({ copy, locale, cart, setCartLine, track, initial, id = "cart", className }: CartLinesTableProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const { read, form, setQuantity } = useCartLines({ id, cart, setCartLine, initial: initial?.cart, notices: copy.notices, track, formName: "cart-lines-table" })
  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  const data = read.state.status === "ready" ? read.state.data : null

  return (
    <section ref={ref} id={id} data-block="cart-lines-table" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex flex-col gap-6">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {data && data.lines.length === 0 ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {data && data.lines.length > 0 ? (
          <>
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <div id={form.formId} className="w-full min-w-0">
              <Table role="table" className="text-base max-sm:block max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-[repeat(var(--stack-cols,2),minmax(0,1fr))] max-sm:[&_tr]:gap-x-4 max-sm:[&_tr]:gap-y-1 max-sm:[&_tr]:py-3 max-sm:[&_caption]:block max-sm:[&_th]:block max-sm:[&_th]:h-auto max-sm:[&_th]:w-auto max-sm:[&_th]:border-0 max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:min-w-0 max-sm:[&_td]:border-0 max-sm:[&_td]:py-0 max-sm:[&_[data-stack=skip]]:hidden max-sm:[&_th[scope=row]]:col-span-full max-sm:[&_td[colspan]]:col-span-full max-sm:[&_td[data-label]]:before:block max-sm:[&_td[data-label]]:before:text-sm max-sm:[&_td[data-label]]:before:font-normal max-sm:[&_td[data-label]]:before:text-muted-foreground max-sm:[&_td[data-label]]:before:content-[attr(data-label)]">
                <caption className="sr-only">{copy.caption}</caption>
                <TableHeader role="rowgroup">
                  <TableRow role="row">
                    <TableHead scope="col" role="columnheader">{copy.line.product}</TableHead>
                    <TableHead scope="col" role="columnheader">{copy.line.unitPrice}</TableHead>
                    <TableHead scope="col" role="columnheader">{copy.line.quantity}</TableHead>
                    <TableHead scope="col" role="columnheader">{copy.line.lineTotal}</TableHead>
                    <TableHead scope="col" role="columnheader">
                      <span className="sr-only">{copy.line.remove}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody role="rowgroup">
                  {data.lines.map((line) => (
                    <TableRow key={line.productId} role="row" data-cart-line={line.productId}>
                      <TableHead scope="row" role="rowheader" className="flex min-w-0 items-center gap-4 text-base font-medium">
                        <CartLineThumb line={line} locale={locale} />
                        <span className="min-w-0 break-words">{line.name}</span>
                      </TableHead>
                      <TableCell role="cell" data-label={copy.line.unitPrice} data-numeric>
                        <MoneyText money={line.unitPrice} price="plain" locale={locale} />
                      </TableCell>
                      <TableCell role="cell" data-label={copy.line.quantity}>
                        <QuantityStepper form={form} line={line} copy={copy.line} onChange={setQuantity} />
                      </TableCell>
                      <TableCell role="cell" data-label={copy.line.lineTotal} data-numeric>
                        <MoneyText money={lineTotal(line)} price="plain" locale={locale} />
                      </TableCell>
                      <TableCell role="cell" className="text-end max-sm:col-span-full max-sm:pt-1 max-sm:text-start">
                        <RemoveLineButton form={form} line={line} copy={copy.line} onChange={setQuantity} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
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
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
