"use client"

import * as React from "react"

import type { Cart, CartLine, CartTotals, CommercePort } from "@/components/contract/commerce"
import type { AnalyticsPort, Money } from "@/components/contract/ports"
import { Minus, Plus, Trash } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { MoneyText, fillText, vatLabel } from "../_shared/billing-format"
import { isComposingEnter } from "../_shared/ime-guard"
import { FieldMessage, fieldAria, usePortForm, type PortForm } from "../_shared/port-form"
import { ProductThumb } from "../_shared/product-thumb"
import type { SubmitNotices } from "../_shared/submit-guard"
import { usePortRead } from "../_shared/port-read"

// 장바구니 조각(공유 조각 block-shared-cart-kit — cart 블록 넷이 같이 쓴다). 한 곳에 둔 것:
//   · 문구 틀(copy 하위 모양) — 금액은 늘 총액 먼저, VAT 포함/별도 문구는 copy 가 준다(전자상거래법 §21-2①1 · 마케팅 규칙 L1).
//   · useCartLines — 담은 줄을 읽고(usePortRead) 수량을 바꾸는(setCartLine) 훅. 수량 0 은 줄을 뺀다. 재고 부족(out_of_stock)의 fieldErrors[상품 id] 는
//     수량 칸 id(`${form.id}-${상품 id}`)에 닿아 그 줄 아래에 그려진다(usePortForm 규칙). 올릴 때만 add_to_cart 를 센다(내릴 때는 세지 않는다).
//   · QuantityStepper — [−][수량][+] (칸은 글자를 마치고 떠날 때·Enter 에 보낸다, 단추는 바로 보낸다).
//   · CartTotalsList — 합계 먼저(data-total · data-price=billed), 그 아래 상품 금액·배송비. 합계는 서버가 센 값 그대로다(클라이언트는 더하지 않는다).
// 가격의 정본은 서버 상품표라 이 조각은 금액을 계산하지 않는다 — 줄 합계(단가 × 수량)만 보여 주기 위해 곱하고, 청구액(합계)은 포트가 준 값을 쓴다.

/** 수량 칸이 받는 최대 수량(서버 mockCommerce 의 한도와 같다 — 서버가 다시 거절한다) */
export const MAX_QUANTITY = 99

export type CartMoneyCopy = { vatIncluded: string; vatExcluded: string }
export type CartLineCopy = {
  product: string
  unitPrice: string
  quantity: string
  lineTotal: string
  /** 줄 빼기 단추의 보이는 글 */
  remove: string
  /** 줄 빼기 단추의 접근 이름({name} = 상품 이름) */
  removeOf: string
  /** [−] 단추 접근 이름({name}) */
  decrease: string
  /** [+] 단추 접근 이름({name}) */
  increase: string
  /** 수량 칸 접근 이름({name}) */
  quantityOf: string
}
export type CartTotalsCopy = CartMoneyCopy & {
  total: string
  subtotal: string
  shipping: string
  /** 배송비가 0원일 때 금액 대신 보이는 글 */
  shippingFree: string
  /** 선택: 합계 아래 한 줄(예: 5만 원 이상이면 배송비가 없어요) */
  note?: string
}
export type CartEmptyCopy = { title: string; body: string; label: string; href: string }

/** 줄 합계(단가 × 수량) — 보여 주기용. 청구액은 포트의 합계다 */
export const lineTotal = (line: Pick<CartLine, "unitPrice" | "quantity">): Money => ({ ...line.unitPrice, amount: line.unitPrice.amount * line.quantity })

/** 담은 줄 읽기 + 수량 바꾸기. initial 을 주면 처음부터 ready(서버가 미리 읽은 값) */
export function useCartLines({ id, cart, setCartLine, initial, notices, track, formName }: { id: string; cart: CommercePort["cart"]; setCartLine: CommercePort["setCartLine"]; initial?: Cart; notices: SubmitNotices; track?: AnalyticsPort["track"]; formName: string }) {
  const read = usePortRead(cart, initial)
  const form = usePortForm({ id, notices, onError: (e) => track?.("form_error", { form: formName, fields: e.fields, kind: e.kind }) })
  /** 수량을 정한다(0 이면 줄을 뺀다). 같은 수량이면 아무것도 보내지 않는다. 성공하면 포트가 돌려준 장바구니로 바꾼다 */
  const setQuantity = async (line: CartLine, quantity: number) => {
    const next = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)))
    if (next === line.quantity) return
    const r = await form.run(() => setCartLine({ productId: line.productId, quantity: next }))
    if (!r) return
    if (next > line.quantity) track?.("add_to_cart", { productId: line.productId, quantity: next - line.quantity })
    read.set(r)
  }
  return { read, form, setQuantity }
}

/** 줄의 작은 사진(사진이 없으면 「실제 사진 필요」 자리) */
export function CartLineThumb({ line, locale, className }: { line: CartLine; locale?: "ko" | "en"; className?: string }) {
  return <ProductThumb thumb={{ id: line.productId, aspect: "1:1", source: "real-required", alt: "", src: line.imageUrl }} locale={locale} className={cn("w-16 shrink-0 md:w-20", className)} />
}

/** [−][수량][+]. 수량 칸은 글자를 마치고 떠날 때·Enter 에 보낸다. 재고 부족 같은 줄 오류는 칸 아래에 그려진다 */
export function QuantityStepper({ form, line, copy, onChange }: { form: PortForm; line: CartLine; copy: CartLineCopy; onChange: (line: CartLine, quantity: number) => void }) {
  const inputId = `${form.id}-${line.productId}`
  const busy = form.pending || !!form.holdLabel
  const commit = (raw: string) => {
    const n = Number(raw.trim())
    if (raw.trim() && Number.isFinite(n)) onChange(line, n)
  }
  return (
    <div data-cart-qty="" className="flex flex-col gap-1">
      <div className="inline-flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label={fillText(copy.decrease, { name: line.name })} disabled={busy || line.quantity <= 1} focusableWhenDisabled onClick={() => onChange(line, line.quantity - 1)}>
          <Minus aria-hidden="true" />
        </Button>
        {/* key: 서버가 정한 수량이 바뀌면 칸도 그 값으로 다시 시작한다(적다 만 글이 남지 않게) */}
        <Input
          key={line.quantity}
          id={inputId}
          name={line.productId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={String(line.quantity)}
          aria-label={fillText(copy.quantityOf, { name: line.name })}
          data-numeric
          className="w-16 text-center tabular-nums"
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isComposingEnter(e)) {
              e.preventDefault()
              commit(e.currentTarget.value)
            }
          }}
          {...fieldAria(form, line.productId)}
        />
        <Button type="button" variant="outline" size="icon" aria-label={fillText(copy.increase, { name: line.name })} disabled={busy || line.quantity >= MAX_QUANTITY} focusableWhenDisabled onClick={() => onChange(line, line.quantity + 1)}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <FieldMessage form={form} name={line.productId} />
    </div>
  )
}

/** 줄 빼기 단추(수량 0) */
export function RemoveLineButton({ form, line, copy, onChange }: { form: PortForm; line: CartLine; copy: CartLineCopy; onChange: (line: CartLine, quantity: number) => void }) {
  return (
    <Button type="button" variant="ghost" disabled={form.pending || !!form.holdLabel} focusableWhenDisabled aria-label={fillText(copy.removeOf, { name: line.name })} onClick={() => onChange(line, 0)} className="gap-2">
      <Trash aria-hidden="true" />
      {copy.remove}
    </Button>
  )
}

/** 합계 먼저(data-total) — 그 아래 상품 금액·배송비. 배송비 0 은 금액 대신 「무료」 글 */
export function CartTotalsList({ totals, copy, className, locale }: { totals: CartTotals; copy: CartTotalsCopy; className?: string; locale?: string }) {
  return (
    <div aria-live="polite" className={cn("flex w-full min-w-0 flex-col gap-3 md:max-w-md", className)}>
      <dl data-cart-totals="" className="flex flex-col border">
        <div data-total="" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4">
          <dt className="text-[1.125rem] leading-[1.4]">{copy.total}</dt>
          <dd className="flex flex-wrap items-baseline justify-end gap-x-3">
            <MoneyText money={totals.total} price="billed" className="text-[1.953rem] leading-none tabular-nums font-heading" locale={locale} />
            <span data-vat="" className="text-base leading-[1.5]">
              {vatLabel(totals.total, copy)}
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b px-5 py-3 text-base leading-[1.5] last:border-b-0">
          <dt>{copy.subtotal}</dt>
          <dd>
            <MoneyText money={totals.subtotal} price="plain" locale={locale} />
          </dd>
        </div>
        <div data-cart-shipping="" className="flex items-baseline justify-between gap-4 border-b px-5 py-3 text-base leading-[1.5] last:border-b-0">
          <dt>{copy.shipping}</dt>
          <dd>{totals.shipping.amount === 0 ? copy.shippingFree : <MoneyText money={totals.shipping} price="plain" locale={locale} />}</dd>
        </div>
      </dl>
      {copy.note ? <p className="text-base leading-[1.6]">{copy.note}</p> : null}
    </div>
  )
}

/** 줄 요약 목록(읽기 전용): 작은 사진 · 이름 · 수량 · 줄 금액. 주문 요약(totals-summary)과 결제 쪽 요약(checkout-form)이 같이 쓴다. quantity 는 「{quantity}개」 틀 */
export function CartMiniLines({ lines, label, quantity, locale }: { lines: readonly CartLine[]; label: string; quantity: string; locale?: "ko" | "en" }) {
  return (
    <ul aria-label={label} className="flex flex-col border-y">
      {lines.map((line) => (
        <li key={line.productId} data-cart-line={line.productId} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b py-3 last:border-b-0">
          <CartLineThumb line={line} locale={locale} />
          <span className="flex min-w-0 flex-col gap-0.5 text-base leading-[1.5]">
            <span className="min-w-0 break-words">{line.name}</span>
            <span data-numeric className="text-base leading-[1.5]">
              {fillText(quantity, { quantity: line.quantity })}
            </span>
          </span>
          <MoneyText money={lineTotal(line)} price="plain" className="text-base tabular-nums" locale={locale} />
        </li>
      ))}
    </ul>
  )
}
