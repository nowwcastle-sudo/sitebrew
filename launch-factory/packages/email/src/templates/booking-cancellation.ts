// 예약 취소 메일(예약한 사람에게). 누가 취소했는지(본인·대표·시스템)에 따라 한 줄만 다르다.
// 방문자가 쓴 글(이름·메모)은 싣지 않는다 — 예약 확인 메일과 같은 규칙(booking-confirmation.ts).
import type { IsoDate, Money } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, formatMoney } from "../format.ts"
import { checkBookingFields } from "./booking-fields.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface BookingCancellationInput extends Omit<BaseInput<EmailMessages["email"]["bookingCancellation"]>, "recipientName"> {
  reference: string
  serviceName: string
  startsAt: IsoDate
  /** 누가 취소했나 */
  cancelledBy: "booker" | "owner" | "system"
  /** 다시 예약하는 화면 주소(선택) */
  bookUrl?: string
  /**
   * 예약금이 있던 예약의 마무리(선택). expired = 결제 시간이 지나 닫힘(청구 없음) · refunded = 전액 환불 · partial = 일부 환불(refunded 금액) · forfeited = 환불 없음.
   * 금액은 서버가 정한 값이다.
   */
  deposit?: { outcome: "expired" | "refunded" | "partial" | "forfeited"; refunded?: Money }
}

export function bookingCancellation(input: BookingCancellationInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  checkBookingFields(input, problems)
  if (!["booker", "owner", "system"].includes(input.cancelledBy)) problems.push("cancelledBy must be booker, owner or system")
  if (input.bookUrl !== undefined) requireLink(input.bookUrl, "bookUrl", problems)
  if (input.deposit !== undefined) {
    if (!["expired", "refunded", "partial", "forfeited"].includes(input.deposit.outcome)) problems.push("deposit.outcome must be expired, refunded, partial or forfeited")
    const needsAmount = input.deposit.outcome === "refunded" || input.deposit.outcome === "partial"
    const m = input.deposit.refunded
    if (needsAmount && (!m || !Number.isInteger(m.amount) || m.amount < 1 || typeof m.currency !== "string")) problems.push("deposit.refunded must be a positive minor-unit Money for a refund")
  }
  throwIfProblems("bookingCancellation", problems)

  const t = copyOf(input, "bookingCancellation")
  const v = { productName: input.productName }
  const body = input.cancelledBy === "booker" ? t.bookerBody : input.cancelledBy === "owner" ? t.ownerBody : t.systemBody
  const children = [
    p(body),
    row(t.referenceLabel, input.reference),
    row(t.serviceLabel, input.serviceName),
    row(t.startsAtLabel, formatDate(input.startsAt, input.locale, timeZoneOf(input), true)),
  ]
  const dep = input.deposit
  if (dep) {
    if (dep.refunded && (dep.outcome === "refunded" || dep.outcome === "partial")) children.push(row(t.depositRefundedLabel, formatMoney(dep.refunded, input.locale)))
    children.push(p(dep.outcome === "expired" ? t.depositExpiredBody : dep.outcome === "refunded" ? t.depositRefundedBody : dep.outcome === "partial" ? t.depositPartialBody : t.depositForfeitedBody))
  }
  if (input.bookUrl) children.push(actions(input.locale, [{ href: input.bookUrl, label: t.rebookCta, secondary: true }]))
  return {
    subject: fill(t.subject, v, "bookingCancellation.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      { preview: t.preview, heading: t.heading, children, footer: `${fill(t.why, v, "bookingCancellation.why")} ${t.notYou}` },
    ),
  }
}
