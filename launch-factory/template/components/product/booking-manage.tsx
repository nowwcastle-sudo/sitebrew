"use client"

import * as React from "react"

import { FormAlert, FormField, SubmitButton, usePortForm } from "@/components/blocks/_shared/port-form"
import type { ActionResult } from "@/components/contract/block-contract"
import { Button } from "@/components/ui/button"
import { submitNotices } from "@/content/copy.en"
import { bookingManageCopy as copy } from "@/content/copy.ux.en"
import { formatKrw, formatWhen } from "@/lib/booking-client"

// 예약 조회·취소(/book/manage) — 로그인 없이 예약 번호 + 연락처로 쓴다. 세 장면: 찾기 폼 → 찾은 예약(+취소 확인 단계) → 취소 결과.
//   · 번호와 연락처 중 어느 쪽이 틀렸는지 알리지 않는다: 틀린 조합은 모두 not_found 이고 화면 글도 서버 글이 아니라 같은 고정 문구다.
//   · 취소는 두 번 누른다 — 「Cancel this booking」은 확인 단계를 펴고, 확인 단계의 「Yes, cancel this booking」이 실제로 부른다. 확인 단계가 열리면 포커스가 제목으로 간다.
//   · 취소 마감이 지났으면(cancel_closed, 또는 canCancel false) 취소 단추 대신 이유와 문의 링크를 보인다.
export interface ManagedBooking {
  id: string
  serviceName: string
  startsAt: string
  partySize: number
  status: string
  canCancel: boolean
  cancelBy: string
  /** 예약금이 있는 예약(서버가 센 값 그대로 — 금액·기한·환불 규정) */
  deposit?: { status: string; amount: number; payBy?: string; refundedAmount?: number; fullRefundBy: string; laterRefundPercent: number }
}
type Pair = { reference: string; contact: string }
type Cancelled = { id: string; status: string; message: string }

export function BookingManage({
  lookup,
  cancel,
  timeZone,
  contactHref,
}: {
  lookup: (input: Pair) => Promise<ActionResult<ManagedBooking>>
  cancel: (input: Pair) => Promise<ActionResult<Cancelled>>
  timeZone: string
  /** 문의 쪽 주소 — 문의 쪽이 없는 제품은 undefined(링크를 그리지 않는다) */
  contactHref?: string
}) {
  const [found, setFound] = React.useState<{ booking: ManagedBooking; pair: Pair } | null>(null)
  const [cancelled, setCancelled] = React.useState<Cancelled | null>(null)
  const find = usePortForm({
    id: "manage",
    notices: submitNotices,
    validators: {
      reference: (v) => (v ? null : copy.errors.referenceRequired),
      contact: (v) => (v ? null : copy.errors.contactRequired),
    },
  })

  const onFind = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = find.validate(["reference", "contact"])
    if (!v) return
    const pair = { reference: v.reference ?? "", contact: v.contact ?? "" }
    const r = await find.run(async () => genericNotFound(await lookup(pair)))
    if (r) setFound({ booking: r, pair })
  }

  if (cancelled) return <CancelResult result={cancelled} onAgain={() => { setCancelled(null); setFound(null) }} />
  if (found) return <FoundBooking found={found} cancel={cancel} timeZone={timeZone} contactHref={contactHref} onCancelled={setCancelled} onAgain={() => setFound(null)} />
  return (
    <form id={find.formId} noValidate aria-labelledby="manage-title" aria-busy={find.pending || undefined} onSubmit={onFind} className="flex flex-col gap-5">
      <FormAlert form={find} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
      <FormField form={find} name="reference" label={copy.reference.label} marker={copy.reference.marker} hint={copy.reference.hint} autoComplete="off" maxLength={64} />
      <FormField form={find} name="contact" label={copy.contact.label} marker={copy.contact.marker} autoComplete="email" maxLength={254} />
      <SubmitButton form={find} label={copy.find} pendingLabel={copy.finding} />
    </form>
  )
}

/** not_found 는 어떤 틀린 조합이든 같은 글이다(서버 글을 그대로 쓰지 않는다) */
function genericNotFound<T>(r: ActionResult<T>): ActionResult<T> {
  return !r.ok && r.code === "not_found" ? { ...r, formError: copy.notFound, fieldErrors: undefined } : r
}

function FoundBooking({
  found,
  cancel,
  timeZone,
  contactHref,
  onCancelled,
  onAgain,
}: {
  found: { booking: ManagedBooking; pair: Pair }
  cancel: (input: Pair) => Promise<ActionResult<Cancelled>>
  timeZone: string
  contactHref?: string
  onCancelled: (r: Cancelled) => void
  onAgain: () => void
}) {
  const { booking, pair } = found
  const [confirming, setConfirming] = React.useState(false)
  const [closed, setClosed] = React.useState(false)
  const confirmRef = React.useRef<HTMLHeadingElement>(null)
  const form = usePortForm({ id: "manage-cancel", notices: submitNotices })
  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const onConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const r = await form.run(async () => {
      const res = genericNotFound(await cancel(pair))
      if (!res.ok && res.code === "cancel_closed") {
        setClosed(true)
        setConfirming(false)
      }
      return res
    })
    if (r) onCancelled(r)
  }

  const canCancel = booking.canCancel && !closed
  const dep = booking.deposit
  const rows: Array<[string, string, string]> = [
    ["reference", copy.found.reference, booking.id],
    ["service", copy.found.service, booking.serviceName],
    ["when", copy.found.when, formatWhen(booking.startsAt, timeZone)],
    ["people", copy.found.people, String(booking.partySize)],
    ["status", copy.found.status, copy.statuses[booking.status] ?? booking.status],
    ...(dep ? ([["deposit", copy.found.deposit, (copy.deposit.status[dep.status] ?? "{amount}").replace("{amount}", formatKrw(dep.status === "refunded" && dep.refundedAmount != null ? dep.refundedAmount : dep.amount))]] as Array<[string, string, string]>) : []),
  ]
  return (
    <div data-testid="manage-found" data-status={booking.status} data-can-cancel={canCancel} className="flex flex-col gap-5">
      <section aria-labelledby="manage-found-title" className="flex flex-col gap-3 border px-4 py-5 md:px-6">
        <h2 id="manage-found-title" className="font-heading text-[1.25rem] leading-[1.35]">
          {copy.found.title}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base leading-[1.6]">
          {rows.map(([key, label, value]) => (
            <React.Fragment key={key}>
              <dt>{label}</dt>
              <dd data-testid={`manage-${key}`} data-numeric={key === "reference" || key === "when" || key === "people" ? "" : undefined} className="font-heading">
                {value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
        {dep ? <DepositRules deposit={dep} timeZone={timeZone} /> : null}
        {canCancel ? (
          <p className="text-base leading-[1.6]">{copy.found.cancelBy.replace("{when}", formatWhen(booking.cancelBy, timeZone))}</p>
        ) : (
          <p data-testid="manage-cancel-closed" className="text-base leading-[1.7]">
            {closed ? copy.found.cancelClosed : copy.found.cannotCancel}{" "}
            {contactHref ? (
              <a href={contactHref} className="underline underline-offset-4">
                {copy.found.contactUs}
              </a>
            ) : null}
          </p>
        )}
      </section>
      {canCancel && !confirming ? (
        <Button type="button" variant="outline" size="lg" data-testid="manage-cancel" onClick={() => setConfirming(true)} className="self-start">
          {copy.cancel.start}
        </Button>
      ) : null}
      {canCancel && confirming ? (
        <form id={form.formId} onSubmit={onConfirm} aria-labelledby="manage-confirm-title" aria-busy={form.pending || undefined} data-testid="manage-confirm" className="flex flex-col gap-4 border border-destructive px-4 py-5 md:px-6">
          <h2 id="manage-confirm-title" ref={confirmRef} tabIndex={-1} className="font-heading text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
            {copy.cancel.confirmTitle}
          </h2>
          <p className="text-base leading-[1.7]">{copy.cancel.confirmBody}</p>
          {dep && (dep.status === "paid" || dep.status === "pending") ? <p data-testid="manage-refund-note" className="text-base leading-[1.7]">{refundNow(dep)}</p> : null}
          <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.cancel.error} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton form={form} label={copy.cancel.confirm} pendingLabel={copy.cancel.pending} />
            <Button type="button" variant="outline" size="lg" data-testid="manage-keep" onClick={() => setConfirming(false)} className="w-full sm:w-auto">
              {copy.cancel.keep}
            </Button>
          </div>
        </form>
      ) : null}
      {/* 취소 확인 단계가 닫혀 있을 때의 서버 오류(마감 지남 등)는 단계가 사라져도 보이게 따로 둔다 */}
      {!confirming ? <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.cancel.error} /> : null}
      <button type="button" onClick={onAgain} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
        {copy.found.another}
      </button>
    </div>
  )
}

/** 예약금 규정: 결제 기한(대기 중) · 전액 환불 기한 · 그 뒤 비율. 글은 서버가 센 값만 채운다 */
function DepositRules({ deposit, timeZone }: { deposit: NonNullable<ManagedBooking["deposit"]>; timeZone: string }) {
  if (deposit.status !== "pending" && deposit.status !== "paid") return null
  return (
    <div data-testid="manage-deposit-rules" className="flex flex-col gap-1 text-base leading-[1.6]">
      {deposit.status === "pending" && deposit.payBy ? <p>{copy.deposit.payBy.replace("{when}", formatWhen(deposit.payBy, timeZone))}</p> : null}
      <p>
        {copy.deposit.refundFull.replace("{when}", formatWhen(deposit.fullRefundBy, timeZone))}{" "}
        {deposit.laterRefundPercent > 0 ? copy.deposit.refundLater.replace("{percent}", String(deposit.laterRefundPercent)) : copy.deposit.refundNone}
      </p>
    </div>
  )
}

/** 지금 취소하면 돌려받는 몫(취소 확인 단계). 결제 전이면 낸 돈이 없다 */
function refundNow(deposit: NonNullable<ManagedBooking["deposit"]>): string {
  if (deposit.status === "pending") return copy.deposit.willVoid
  if (Date.now() <= new Date(deposit.fullRefundBy).getTime()) return copy.deposit.willRefundFull
  return deposit.laterRefundPercent > 0 ? copy.deposit.willRefundLater.replace("{percent}", String(deposit.laterRefundPercent)) : copy.deposit.willRefundNone
}

function CancelResult({ result, onAgain }: { result: Cancelled; onAgain: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div ref={ref} tabIndex={-1} role="status" data-testid="manage-result" data-status={result.status} className="flex flex-col gap-3 border px-4 py-5 outline-hidden focus-visible:ring-3 focus-visible:ring-ring md:px-6">
      <h2 className="font-heading text-[1.25rem] leading-[1.35]">{copy.cancel.doneTitle}</h2>
      <p className="text-base leading-[1.6]">
        {copy.found.reference}:{" "}
        <strong data-numeric className="font-heading">
          {result.id}
        </strong>
      </p>
      <p className="text-base leading-[1.7]">{result.message}</p>
      <button type="button" onClick={onAgain} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
        {copy.found.another}
      </button>
    </div>
  )
}
