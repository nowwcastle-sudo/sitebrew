"use client"

import * as React from "react"

import { confirmBookingDeposit, payBookingWithMock } from "@/app/actions/booking-deposit"
import type { PayResult } from "@/components/blocks/_shared/checkout-flow"
import type { PaymentSession } from "@/components/contract/commerce"
import { MockPayPanel, type MockPayRequest } from "@/components/product/mock-pay-panel"
import { BOOKING_RETURN_PATH, openPortOne } from "@/components/product/portone-pay"
import { Button } from "@/components/ui/button"
import { bookCopy } from "@/content/copy.ux.en"
import { formatKrw, formatWhen } from "@/lib/booking-client"

// 예약금 결제 단계(접수 영수증 안). 금액·기한·결제 세션은 모두 서버가 정한 값이다 — 브라우저는 그대로 보여 주고 결제창만 연다.
//   결제창(PortOne) 또는 모의 결제 화면(키 없는 미리보기) → 서버 액션 confirmBookingDeposit({ paymentId }) 가 공급자에 다시 물어 확정한다(웹훅과 같은 함수).
//   확정이 아직이면(payment_pending) 다시 확인만 한다 — 다시 결제하라고 하지 않는다. 결제창을 닫거나 실패하면 같은 예약으로 다시 결제한다(대기 시간 안).
//   모바일 결제창은 리디렉션으로 나갔다 /book/return 으로 돌아와 같은 확정을 부른다.
export interface BookingDeposit {
  amount: number
  currency: "KRW"
  /** 결제 기한(ISO) */
  payBy: string
  session: PaymentSession
}

export type DepositConfirmed = { status: "requested" | "confirmed"; message: string }
type Phase = "idle" | "opening" | "mock" | "confirming" | "pending" | "closed"

const copy = bookCopy.deposit

export function BookingDepositPay({ deposit, timeZone, onConfirmed }: { deposit: BookingDeposit; timeZone: string; onConfirmed: (result: DepositConfirmed) => void }) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [note, setNote] = React.useState<string | null>(null)
  const payBy = formatWhen(deposit.payBy, timeZone)

  const confirm = React.useCallback(async () => {
    setPhase("confirming")
    setNote(null)
    const r = await confirmBookingDeposit({ paymentId: deposit.session.paymentId }).catch(() => null)
    if (r?.ok) return onConfirmed({ status: r.data.status === "confirmed" ? "confirmed" : "requested", message: r.data.message })
    const code = r && "code" in r ? r.code : undefined
    const retryable = r && "retryable" in r ? r.retryable : undefined
    if (code === "payment_pending") return setPhase("pending")
    if (code === "deposit_failed" && retryable !== false) {
      setNote(copy.failed.replace("{when}", payBy))
      return setPhase("idle")
    }
    // 예약이 이미 닫혔거나(대기 시간 지남·취소) 더 시도해도 소용없다 — 닫힘 안내. 그 밖의 막힘(요청 제한·네트워크)은 다시 확인한다
    setPhase(r && retryable === false ? "closed" : "pending")
  }, [deposit.session.paymentId, onConfirmed, payBy])

  const failedNote = () => setNote(copy.failed.replace("{when}", payBy))

  const pay = async () => {
    setNote(null)
    if (deposit.session.provider === "mock") return setPhase("mock")
    setPhase("opening")
    const result = await openPortOne(deposit.session, BOOKING_RETURN_PATH)
    if (result.ok) return confirm()
    failedNote()
    setPhase("idle")
  }

  const mock: MockPayRequest = {
    session: deposit.session,
    settle: (result: PayResult) => {
      if (result.ok) void confirm()
      else {
        failedNote()
        setPhase("idle")
      }
    },
  }

  return (
    <section data-testid="book-deposit" data-phase={phase} aria-labelledby="book-deposit-title" aria-busy={phase === "confirming" || phase === "opening" || undefined} className="flex flex-col gap-3">
      <h3 id="book-deposit-title" className="font-heading text-[1.125rem] leading-[1.35]">
        {copy.title}
      </h3>
      <p className="text-base leading-[1.6]">
        {copy.amount}:{" "}
        <strong data-testid="book-deposit-amount" data-numeric className="font-heading">
          {formatKrw(deposit.amount)}
        </strong>
      </p>
      <p className="text-base leading-[1.6]">{copy.payBy.replace("{when}", payBy)}</p>
      {note ? (
        <p role="alert" data-testid="book-deposit-note" className="text-base leading-[1.7]">
          {note}
        </p>
      ) : null}
      {phase === "confirming" ? (
        <p role="status" className="text-base leading-[1.6]">
          {copy.confirming}
        </p>
      ) : null}
      {phase === "pending" ? (
        <>
          <p role="status" data-testid="book-deposit-pending" className="text-base leading-[1.7]">
            {copy.pendingBody}
          </p>
          <Button type="button" variant="outline" size="lg" data-testid="book-deposit-check" onClick={() => void confirm()} className="self-start">
            {copy.checkAgain}
          </Button>
        </>
      ) : null}
      {phase === "closed" ? (
        <p role="status" data-testid="book-deposit-closed" className="text-base leading-[1.7]">
          {copy.closed}
        </p>
      ) : null}
      {phase === "mock" ? <MockPayPanel request={mock} pay={payBookingWithMock} /> : null}
      {phase === "idle" || phase === "opening" ? (
        <Button type="button" size="lg" data-testid="book-deposit-pay" disabled={phase === "opening"} aria-busy={phase === "opening" || undefined} onClick={() => void pay()} className="self-start">
          {phase === "opening" ? copy.opening : copy.pay.replace("{amount}", formatKrw(deposit.amount))}
        </Button>
      ) : null}
    </section>
  )
}
