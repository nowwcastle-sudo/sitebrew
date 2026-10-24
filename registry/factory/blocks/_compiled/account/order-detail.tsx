"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { CommercePort, Order } from "@/registry/factory/contract/commerce"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { CartMiniLines, CartTotalsList, type CartTotalsCopy } from "../_shared/cart-kit"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { ListEmpty } from "../_shared/list-status"
import { OrderStatusBadge, OrderStatusNote, isCancelable, isPaidStatus, totalsOf, type OrderStatusCopy, type OrderStatusNotes } from "../_shared/order-kit"
import { FormAlert, FormField, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 주문 상세 — 주문 하나: 주문번호·상태 배지·상태 한 줄(날짜 포함)·송장번호(있을 때) → 상품 줄·합계(총액 먼저·VAT) → 받는 분·주소 → 주문 취소.
// 취소는 승인 행동(cancel-order)이다: [주문 취소하기]를 누르면 확인 칸이 열리고(취소 사유는 선택, 결제 완료 주문이면 환불 안내), [돌아가기][취소 확정] 두 선택지가 대등하다.
// [취소 확정]만 cancelOrder({ orderId, reason?, confirmed: true }) 를 부르고 data-requires-human + 눈에 보이는 안내 글(copy.humanHint)을 가진다. 성공하면 돌려준 주문으로 화면을 바꾸고 상태 줄로 초점을 옮긴다.
// 취소할 수 있는 상태: 결제 전(주문 닫기)·결제 완료·상품 준비 중(환불). 배송 중 이후는 취소 단추 대신 안내 글만 있다(서버도 not_cancelable 로 거절한다).
// 포트: order(읽기 4상태 — 없는 주문(not_found)은 빈 상태) · cancelOrder. 계측(선택): form_error. 화면 글은 모두 copy 다.
export type AccountOrderDetailCopy = {
  title: string
  /** 사람 승인 안내 글(R18) — [취소 확정] 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  lead?: string
  /** 「주문번호」 이름표 */
  orderLabel: string
  status: OrderStatusCopy
  /** 상태별 한 줄 안내({date} = 상태에 맞는 날짜) */
  notes: OrderStatusNotes
  /** 송장번호: href 가 있으면 {number} 자리에 번호를 넣은 배송 조회 링크 */
  tracking: { label: string; link?: { label: string; href: string } }
  items: { title: string; listLabel: string; quantity: string }
  totals: CartTotalsCopy
  shipping: { title: string; recipient: string; phone: string; address: string; note: string }
  cancel: {
    title: string
    /** 열기 단추 글 */
    open: string
    /** 확인 칸 질문: 결제 전 주문 / 결제 완료 주문(환불) */
    questionUnpaid: string
    questionPaid: string
    reasonLabel: string
    reasonMarker?: string
    reasonHint?: string
    back: string
    confirm: string
    pending: string
    errorTitle: string
    /** 취소할 수 없는 상태(배송 중·완료)의 안내 */
    unavailable: string
  }
  notices: SubmitNotices
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountOrderDetailProps = BlockBase<AccountOrderDetailCopy> & {
  /** 볼 주문의 번호(주소의 /orders/[id] 에서 온다) */
  orderId: string
  order: CommercePort["order"]
  cancelOrder: CommercePort["cancelOrder"]
  track?: AnalyticsPort["track"]
  initial?: { order?: Order }
}

export function AccountOrderDetail({ copy, locale, timeZone, orderId, order, cancelOrder, track, initial, id = "order-detail", className }: AccountOrderDetailProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  // 읽기 메서드는 주문 번호가 같은 동안 그대로여야 한다(바뀌면 usePortRead 가 다시 읽는다)
  const readOrder = React.useCallback(() => order({ orderId }), [order, orderId])
  const read = usePortRead(readOrder, initial?.order)
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "order-detail", fields: e.fields, kind: e.kind }) })
  const [confirming, setConfirming] = React.useState(false)
  const statusRef = React.useRef<HTMLDivElement>(null)
  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  // 없는 주문(남의 주문 번호 포함)은 오류가 아니라 빈 상태다 — 다시 불러와도 같다
  const missing = err?.code === "not_found"
  const data = read.state.status === "ready" ? read.state.data : null

  const cancel = async () => {
    if (!data) return
    const reason = (form.read().reason ?? "").trim()
    // confirmed: [취소 확정] 이 확인 단계다 — 눌렀다는 선언을 싣는다(P3-7 AXC, R20)
    const r = await form.run(() => cancelOrder({ orderId: data.id, ...(reason ? { reason } : {}), confirmed: true }))
    if (!r) return
    read.set(r)
    setConfirming(false)
    // 바뀐 상태를 읽도록 상태 줄로 초점을 옮긴다(눌렀던 단추는 사라졌다)
    requestAnimationFrame(() => statusRef.current?.focus())
  }

  return (
    <section ref={ref} id={id} data-block="account-order-detail" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex max-w-3xl flex-col gap-8">
        {loading ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {err && !missing ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {missing ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {data ? (
          <>
            <div ref={statusRef} tabIndex={-1} role="status" data-part="status" className="flex flex-col items-start gap-3 outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
              <p className="flex flex-wrap items-baseline gap-2 text-[1.125rem] leading-[1.4]">
                <span className="text-base">{copy.orderLabel}</span> <span data-numeric data-order-id={data.id}>{data.id}</span>
              </p>
              <OrderStatusBadge status={data.status} labels={copy.status} />
              <OrderStatusNote order={data} notes={copy.notes} locale={locale} timeZone={timeZone} />
              {data.trackingNumber ? (
                <p data-tracking={data.trackingNumber} className="flex flex-wrap items-baseline gap-x-2 text-base leading-[1.6]">
                  <span>{copy.tracking.label}</span> <span data-numeric>{data.trackingNumber}</span>
                  {copy.tracking.link ? (
                    <>
                      {" "}
                      <a href={fillText(copy.tracking.link.href, { number: encodeURIComponent(data.trackingNumber) })} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                        {copy.tracking.link.label}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div data-part="items" className="flex flex-col gap-4">
              <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.items.title}</h3>
              <CartMiniLines lines={data.lines} label={copy.items.listLabel} quantity={copy.items.quantity} locale={locale} />
              <CartTotalsList totals={totalsOf(data)} copy={copy.totals} locale={locale} />
            </div>
            <div data-part="shipping" className="flex flex-col gap-4">
              <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.shipping.title}</h3>
              <dl className="grid gap-3 text-base leading-[1.6] sm:grid-cols-[8rem_minmax(0,1fr)]">
                <div>
                  <dt>{copy.shipping.recipient}</dt>
                  <dd>{data.address.recipient}</dd>
                </div>
                <div>
                  <dt>{copy.shipping.phone}</dt>
                  <dd data-numeric>{data.address.phone}</dd>
                </div>
                <div>
                  <dt>{copy.shipping.address}</dt>
                  <dd>
                    <span data-numeric>{data.address.postcode}</span> {data.address.address1}
                    {data.address.address2 ? ` ${data.address.address2}` : ""}
                  </dd>
                </div>
                {data.address.note ? (
                  <div>
                    <dt>{copy.shipping.note}</dt>
                    <dd>{data.address.note}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {isCancelable(data.status) ? (
              <div data-part="cancel" className="flex flex-col gap-4">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.cancel.title}</h3>
                {confirming ? (
                  <>
                    <FormAlert form={form} fieldTitle={copy.cancel.errorTitle} serverTitle={copy.cancel.errorTitle} />
                    <p id={`${id}-question`} className="text-[1.125rem] leading-[1.4]">
                      {isPaidStatus(data.status) ? copy.cancel.questionPaid : copy.cancel.questionUnpaid}
                    </p>
                    <form method="post" id={form.formId} noValidate onSubmit={(e) => e.preventDefault()} className="flex max-w-md flex-col gap-3">
                      <FormField form={form} name="reason" label={copy.cancel.reasonLabel} marker={copy.cancel.reasonMarker} autoComplete="off" hint={copy.cancel.reasonHint} />
                    </form>
                    <ApprovalHint id={`${id}-cancel-hint`}>{copy.humanHint}</ApprovalHint>
                    <ChoiceRow label={copy.cancel.title}>
                      <ChoiceButton choice="decline" type="button" disabled={form.pending} focusableWhenDisabled onClick={() => setConfirming(false)}>
                        {copy.cancel.back}
                      </ChoiceButton>
                      <ChoiceButton choice="primary" type="button" disabled={form.pending} focusableWhenDisabled onClick={cancel} {...humanApprovalProps("cancel-order", `${id}-cancel-hint`)}>
                        {form.pending ? copy.cancel.pending : copy.cancel.confirm}
                      </ChoiceButton>
                    </ChoiceRow>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="lg" data-order-cancel-open="" onClick={() => setConfirming(true)}>
                    {copy.cancel.open}
                  </Button>
                )}
              </div>
            ) : data.status === "shipped" || data.status === "delivered" ? (
              <p data-part="cancel-unavailable" className="text-base leading-[1.6]">
                {copy.cancel.unavailable}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
