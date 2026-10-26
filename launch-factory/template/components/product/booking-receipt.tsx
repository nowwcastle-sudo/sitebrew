"use client"

import * as React from "react"

import { BookingDepositPay, type BookingDeposit, type DepositConfirmed } from "@/components/product/booking-deposit-pay"
import { bookCopy as copy } from "@/content/copy.ux.en"
import { formatWhen } from "@/lib/booking-client"

// 예약 접수 영수증(role=status). 예약 번호를 크게 보이고 화면에 남는 글로 둔다 — 마운트되면 포커스를 받아 낭독이 읽는다. 폼과 모르는 사이(props 만 받는다).
// 예약금이 있는 서비스는 deposit(서버가 정한 금액·기한·결제 세션)이 들어 있다: 결제 단계(BookingDepositPay)를 보이고, 결제가 확정되면 같은 영수증이 확정 상태로 바뀐다.
export type BookingReceiptData = { id: string; startsAt: string; status: "requested" | "confirmed"; message: string; deposit?: BookingDeposit }

export function BookingReceipt({ receipt, timeZone, onAgain }: { receipt: BookingReceiptData; timeZone: string; onAgain: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [paid, setPaid] = React.useState<DepositConfirmed | null>(null)
  React.useEffect(() => {
    ref.current?.focus()
  }, [])
  const waiting = Boolean(receipt.deposit) && !paid
  const status = paid?.status ?? receipt.status
  const message = paid?.message ?? receipt.message
  return (
    <div ref={ref} tabIndex={-1} role={receipt.deposit ? "group" : "status"} aria-label={receipt.deposit ? copy.deposit.title : undefined} data-testid="book-done" data-status={status} data-deposit={receipt.deposit ? (waiting ? "pending" : "paid") : undefined} className="flex flex-col gap-3 border px-4 py-5 outline-hidden focus-visible:ring-3 focus-visible:ring-ring md:px-6">
      <h2 className="font-heading text-[1.25rem] leading-[1.35]">{waiting ? copy.deposit.title : paid ? copy.deposit.confirmedTitle : copy.done.title}</h2>
      <p className="text-base leading-[1.6]">
        {copy.done.reference}:{" "}
        <strong data-testid="book-reference" data-numeric className="font-heading text-[1.25rem]">
          {receipt.id}
        </strong>
      </p>
      <p className="text-base leading-[1.6]">
        {copy.done.when}:{" "}
        <span data-testid="book-when" data-numeric>
          {formatWhen(receipt.startsAt, timeZone)}
        </span>
      </p>
      {/* 상태는 색이 아니라 글로 말한다 */}
      <p className="text-base leading-[1.6]">
        {copy.done.statusLabel}: <span data-testid="book-status">{waiting ? copy.deposit.statusPending : copy.done.status[status]}</span>
      </p>
      {/* 예약금이 있으면 영수증 상자는 단추를 품은 묶음이라 알림 영역이 아니다 — 바뀌는 글(상태 안내)만 알림으로 읽힌다 */}
      <p role={receipt.deposit ? "status" : undefined} className="text-base leading-[1.7]">
        {message}
      </p>
      {receipt.deposit && waiting ? <BookingDepositPay deposit={receipt.deposit} timeZone={timeZone} onConfirmed={setPaid} /> : null}
      <p className="text-base leading-[1.7]">{copy.done.keep}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <a href="/book/manage" data-testid="book-manage-link" className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
          {copy.done.manage}
        </a>
        <button type="button" onClick={onAgain} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
          {copy.done.again}
        </button>
      </div>
    </div>
  )
}
