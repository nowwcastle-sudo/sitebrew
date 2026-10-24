"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { Cart, CartLine, CartTotals, CommercePort, Order, PaymentSession } from "@/components/contract/commerce"
import type { AnalyticsPort } from "@/components/contract/ports"
import { AlertTriangle, CheckCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"

import { MoneyText, fill, fillText, formatMoney, vatLabel } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { CartMiniLines, CartTotalsList, type CartEmptyCopy, type CartTotalsCopy } from "../_shared/cart-kit"
import { payAndConfirm, phoneDigitsOk, type PayResult } from "../_shared/checkout-flow"
import { ListEmpty } from "../_shared/list-status"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

export type { PayResult } from "../_shared/checkout-flow"

// 장바구니 — 배송지 + 결제(주문하기). 왼쪽(좁으면 위)에 받는 분 · 연락처 · 주소 칸, 오른쪽(아래)에 주문 요약(상품 줄 · 합계 먼저 · VAT)과 [○○원 결제하기].
// 한 바퀴: ① [결제하기] = placeOrder({ address, confirmed: true }) — 승인 행동(place-order)이라 버튼 곁에 안내 글과 data-requires-human 이 있다. 에이전트가 부르면 승인 대기 알림으로 멈춘다.
//   ② 주문이 만들어지면 onPay(payment) — 결제창은 조립하는 쪽(launch-factory 의 PortOne 어댑터 등)이 연다. 블록은 공급자를 모른다. 돌려준 { ok, paymentId, code? } 가 전부다.
//   ③ ok 면 confirmPayment({ orderId, paymentId }) 로 확정 → 완료 칸(주문 번호 · 결제 금액 · 주문 내역 링크). 사용자가 결제창을 닫았거나 실패하면 같은 주문으로 [다시 결제하기](주문을 또 만들지 않는다).
//   ④ 결제는 끝났는데 확정을 못 받으면 [결제 확인 다시 하기] — 확정만 다시 한다(결제창을 다시 열지 않아 이중 결제가 없다).
// 포트: cart(읽기 4상태) · placeOrder · confirmPayment. 계측(선택): begin_checkout(주문이 만들어졌을 때) · purchase(확정됐을 때) · form_error. 멱등 키는 조립하는 쪽이 폼을 열 때 숨은 입력으로 더한다(블록은 만들지 않는다).
export type CartCheckoutFormCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  shippingTitle: string
  fields: Record<"recipient" | "phone" | "postcode" | "address1" | "address2" | "note", { label: string; placeholder?: string }>
  marker: { required: string; optional: string }
  errors: { recipient: string; phone: string; phoneFormat: string; postcode: string; address1: string }
  summaryTitle: string
  /** 줄 하나의 수량 글({quantity} = 수량) */
  quantity: string
  listLabel: string
  totals: CartTotalsCopy
  /** 결제 단추 글 — {amount} 는 합계(예: 「45,500원 결제하기」) */
  submit: string
  pending: string
  /** 선택: 단추 아래 안내(결제창이 열린다는 말 등) */
  payNote?: string
  pay: {
    /** 결제창이 열려 있는 동안 */
    waiting: string
    canceledTitle: string
    canceled: string
    failedTitle: string
    failed: string
    retry: string
    confirmTitle: string
    confirmFailed: string
    confirmRetry: string
  }
  /** 완료 칸: body 의 {orderId} 는 주문 번호. link.href 의 {id} 는 주문 id */
  done: { title: string; body: string; orderLabel: string; totalLabel: string; link: { label: string; href: string }; continue?: { label: string; href: string } }
  empty: CartEmptyCopy
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
}
export type CartCheckoutFormProps = BlockBase<CartCheckoutFormCopy> & {
  cart: CommercePort["cart"]
  placeOrder: CommercePort["placeOrder"]
  confirmPayment: CommercePort["confirmPayment"]
  /** 결제창을 연다 — 조립하는 쪽이 공급자 SDK 로 구현한다. 사용자가 창을 닫으면 { ok: false, code: "canceled" } 같은 값으로 끝낸다(던지지 않는다) */
  onPay: (session: PaymentSession) => Promise<PayResult>
  /** 선택: 결제가 확정됐을 때(주문 완료 쪽으로 보내는 등). 안 주면 이 블록의 완료 칸을 보인다 */
  onComplete?: (order: Order) => void
  track?: AnalyticsPort["track"]
  initial?: { cart?: Cart }
}

type Placed = { order: Order; payment: PaymentSession }
type Stage =
  | { step: "form" }
  /** 결제창이 열려 있다 */
  | { step: "paying"; placed: Placed }
  | { step: "pay-failed"; placed: Placed; canceled: boolean }
  | { step: "confirm-failed"; placed: Placed; paymentId: string }
  | { step: "done"; order: Order }

const FIELDS = ["recipient", "phone", "postcode", "address1"] as const

export function CartCheckoutForm({ copy, locale, cart, placeOrder, confirmPayment, onPay, onComplete, track, initial, id = "checkout", className }: CartCheckoutFormProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(cart, initial?.cart)
  const [stage, setStage] = React.useState<Stage>({ step: "form" })
  const form = usePortForm({
    id,
    notices: copy.notices,
    onError: (e) => track?.("form_error", { form: "checkout-form", fields: e.fields, kind: e.kind }),
    validators: {
      recipient: (v) => (v ? null : copy.errors.recipient),
      phone: (v) => (!v ? copy.errors.phone : phoneDigitsOk(v) ? null : copy.errors.phoneFormat),
      postcode: (v) => (v ? null : copy.errors.postcode),
      address1: (v) => (v ? null : copy.errors.address1),
    },
  })
  const noticeRef = React.useRef<HTMLDivElement>(null)
  const doneRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (stage.step === "pay-failed" || stage.step === "confirm-failed") noticeRef.current?.focus()
    if (stage.step === "done") doneRef.current?.focus()
  }, [stage.step])

  /** 결제창 → 확정 한 바퀴. 결과로 stage 를 정한다 */
  const settle = async (placed: Placed) => {
    setStage({ step: "paying", placed })
    const out = await payAndConfirm({
      session: placed.payment,
      pay: onPay,
      confirm: (paymentId) => form.run(() => confirmPayment({ orderId: placed.order.id, paymentId })),
    })
    if (out.status === "paid") {
      track?.("purchase", { orderId: out.order.id, amount: out.order.total.amount, currency: out.order.total.currency })
      setStage({ step: "done", order: out.order })
      onComplete?.(out.order)
    } else if (out.status === "pay-failed") setStage({ step: "pay-failed", placed, canceled: out.canceled })
    else setStage({ step: "confirm-failed", placed, paymentId: out.paymentId })
  }
  /** 결제는 끝났는데 확정을 못 받았을 때: 확정만 다시(결제창을 다시 열지 않는다) */
  const confirmAgain = async (placed: Placed, paymentId: string) => {
    const order = await form.run(() => confirmPayment({ orderId: placed.order.id, paymentId }))
    if (!order) return
    track?.("purchase", { orderId: order.id, amount: order.total.amount, currency: order.total.currency })
    setStage({ step: "done", order })
    onComplete?.(order)
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const values = form.validate([...FIELDS])
    if (!values) return
    const address = { recipient: values.recipient, phone: values.phone, postcode: values.postcode, address1: values.address1, ...(values.address2 ? { address2: values.address2 } : {}), ...(values.note ? { note: values.note } : {}) }
    // confirmed: [결제하기] 를 사람이 눌렀다는 선언이다(승인 행동 place-order, P3-7 AXC) — 에이전트가 이 단추 없이 부르면 포트가 승인 대기로 멈춘다
    const placed = await form.run(() => placeOrder({ address, confirmed: true }))
    if (!placed) return
    track?.("begin_checkout", { amount: placed.order.total.amount, currency: placed.order.total.currency })
    await settle(placed)
  }

  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  const data = read.state.status === "ready" ? read.state.data : null
  const placed = stage.step === "paying" || stage.step === "pay-failed" || stage.step === "confirm-failed" ? stage.placed : null
  // 주문이 만들어진 뒤에는 서버 장바구니가 비므로 요약은 주문의 줄·합계를 쓴다
  const summary: { lines: CartLine[]; totals: CartTotals } | null = placed ? { lines: placed.order.lines, totals: placed.order } : data && data.lines.length > 0 ? { lines: data.lines, totals: data } : null
  const done = stage.step === "done" ? stage.order : null

  return (
    <section ref={ref} id={id} data-block="cart-checkout-form" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || stage.step === "paying" || undefined} className="flex flex-col gap-6">
        {loading ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {!done && data && data.lines.length === 0 && !placed ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
        {done ? (
          <div ref={doneRef} tabIndex={-1} role="status" data-checkout="done" className="flex max-w-2xl items-start gap-4 border px-6 py-6 outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
            <CheckCircle aria-hidden="true" className="mt-1 size-6 shrink-0" />
            <div className="flex min-w-0 flex-col gap-3 text-base leading-[1.6]">
              <p className="text-[1.563rem] leading-[1.25] font-heading">{copy.done.title}</p>
              <p>{fill(copy.done.body, { orderId: <span data-numeric>{done.id}</span> })}</p>
              <p className="flex flex-wrap items-baseline gap-x-2 text-[1.125rem] leading-[1.4]">
                <span>{copy.done.totalLabel}</span> <MoneyText money={done.total} price="billed" className="font-heading" locale={locale} /> <span data-vat="">{vatLabel(done.total, copy.totals)}</span>
              </p>
              <div className="flex flex-col gap-3 md:items-end">
                <Button size="lg" nativeButton={false} render={<a href={fillText(copy.done.link.href, { id: encodeURIComponent(done.id) })} />}>
                  {copy.done.link.label}
                </Button>
                {copy.done.continue ? (
                  <a href={copy.done.continue.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                    {copy.done.continue.label}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {!done && summary ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {stage.step === "form" ? (
              <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={submit} className="flex min-w-0 flex-col gap-6">
                <fieldset className="flex min-w-0 flex-col gap-5">
                  <legend className="mb-1 text-[1.25rem] leading-[1.35] font-heading">{copy.shippingTitle}</legend>
                  <FormField form={form} name="recipient" label={copy.fields.recipient.label} marker={copy.marker.required} autoComplete="name" placeholder={copy.fields.recipient.placeholder} />
                  <FormField form={form} name="phone" label={copy.fields.phone.label} marker={copy.marker.required} type="tel" autoComplete="tel" inputMode="tel" format="phone" placeholder={copy.fields.phone.placeholder} />
                  <FormField form={form} name="postcode" label={copy.fields.postcode.label} marker={copy.marker.required} autoComplete="postal-code" inputMode="numeric" maxLength={6} placeholder={copy.fields.postcode.placeholder} />
                  <FormField form={form} name="address1" label={copy.fields.address1.label} marker={copy.marker.required} autoComplete="address-line1" placeholder={copy.fields.address1.placeholder} />
                  <FormField form={form} name="address2" label={copy.fields.address2.label} marker={copy.marker.optional} autoComplete="address-line2" placeholder={copy.fields.address2.placeholder} />
                  <FormField form={form} name="note" label={copy.fields.note.label} marker={copy.marker.optional} autoComplete="off" placeholder={copy.fields.note.placeholder} />
                </fieldset>
                <div className="flex flex-col items-start gap-3">
                  <SubmitButton form={form} label={fillText(copy.submit, { amount: formatMoney(summary.totals.total, locale) })} pendingLabel={copy.pending} approval={{ action: "place-order", hint: copy.humanHint }} />
                  {copy.payNote ? <p className="text-base leading-[1.6]">{copy.payNote}</p> : null}
                </div>
              </form>
            ) : (
              <div data-checkout={stage.step} className="flex min-w-0 flex-col gap-6">
                {stage.step === "paying" ? (
                  <p role="status" className="border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6]">
                    {copy.pay.waiting}
                  </p>
                ) : null}
                {stage.step === "pay-failed" ? (
                  <div ref={noticeRef} tabIndex={-1} role="alert" data-state={stage.canceled ? "canceled" : "failed"} className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-4 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[state=failed]:border-destructive data-[state=confirm-failed]:border-destructive">
                    <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                    <div className="flex min-w-0 flex-col items-start gap-3">
                      <p className="text-[1.125rem] leading-[1.4] font-heading">{stage.canceled ? copy.pay.canceledTitle : copy.pay.failedTitle}</p>
                      <p>{stage.canceled ? copy.pay.canceled : copy.pay.failed}</p>
                      <Button type="button" size="lg" onClick={() => settle(stage.placed)} data-checkout-retry="pay">
                        {copy.pay.retry}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {stage.step === "confirm-failed" ? (
                  <div ref={noticeRef} tabIndex={-1} role="alert" data-state="confirm-failed" className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-4 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[state=failed]:border-destructive data-[state=confirm-failed]:border-destructive">
                    <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                    <div className="flex min-w-0 flex-col items-start gap-3">
                      <p className="text-[1.125rem] leading-[1.4] font-heading">{copy.pay.confirmTitle}</p>
                      <p>{copy.pay.confirmFailed}</p>
                      <Button type="button" size="lg" disabled={form.pending} focusableWhenDisabled onClick={() => confirmAgain(stage.placed, stage.paymentId)} data-checkout-retry="confirm">
                        {copy.pay.confirmRetry}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <aside aria-labelledby={`${id}-summary`} className="flex flex-col gap-4 border px-5 py-5 lg:sticky lg:top-6">
              <h3 id={`${id}-summary`} className="text-[1.25rem] leading-[1.35] font-heading">
                {copy.summaryTitle}
              </h3>
              <CartMiniLines lines={summary.lines} label={copy.listLabel} quantity={copy.quantity} locale={locale} />
              <CartTotalsList totals={summary.totals} copy={copy.totals} locale={locale} />
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  )
}
