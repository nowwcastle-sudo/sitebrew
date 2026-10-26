// 예약 확인 메일(예약한 사람에게) — 접수(운영자 확인 전)·확정·알림 세 모양. 알림은 시작 전에 한 번 더 알리는 같은 내용이다.
// 받는 주소는 방문자가 적은 값이라 남의 주소일 수 있다. 그래서 방문자가 쓴 글(이름·메모)을 **싣지 않는다**(문의 접수 확인과 같은 규칙) —
// 싣는 것은 서버가 만든 예약 번호와 설정의 서비스 이름·일시·인원뿐이다. 인사도 이름 없는 인사만 쓴다.
import type { IsoDate, Money } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, formatMoney, isValidDate } from "../format.ts"
import { checkBookingFields } from "./booking-fields.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

/** 예약금 안내(선택 — 없으면 예약금 없는 예약의 메일 그대로). 금액·기한은 서버가 정한 값이다 */
export interface BookingDepositNote {
  /** pending: 결제 대기(결제 안내 모양) · paid: 결제 끝(보통 모양 + 예약금 줄) */
  state: "pending" | "paid"
  amount: Money
  /** pending 일 때 결제 기한 */
  payBy?: IsoDate
  /** 환불 규정: fullBefore 까지는 전액, 그 뒤에는 laterPercent(0~99)% */
  refund?: { fullBefore: IsoDate; laterPercent: number }
}

export interface BookingConfirmationInput extends Omit<BaseInput<EmailMessages["email"]["bookingConfirmation"]>, "recipientName"> {
  reference: string
  /** 설정의 서비스 이름(받는 사람 언어로) */
  serviceName: string
  startsAt: IsoDate
  partySize: number
  /** requested: 운영자가 확인하기 전(「접수」 문구) · confirmed: 확정 */
  status: "requested" | "confirmed"
  /** true 면 시작 전 알림 문구(확정된 예약만) */
  reminder?: boolean
  /** 직접 취소할 수 있는 마지막 때(예약 시작 − 취소 마감). 주면 한 줄로 알린다 */
  cancelBy?: IsoDate
  /** 예약 확인·취소 화면 주소(선택) */
  manageUrl?: string
  deposit?: BookingDepositNote
}

/** 예약금 안내를 검사한다(확인 메일) */
export function checkDeposit(d: BookingDepositNote | undefined, problems: string[]): void {
  if (d === undefined) return
  if (d.state !== "pending" && d.state !== "paid") problems.push("deposit.state must be pending or paid")
  if (!d.amount || !Number.isInteger(d.amount.amount) || d.amount.amount < 1 || typeof d.amount.currency !== "string") problems.push("deposit.amount must be a positive minor-unit Money")
  if (d.state === "pending" && !isValidDate(d.payBy)) problems.push("deposit.payBy must be an ISO date while pending")
  if (d.refund !== undefined) {
    if (!isValidDate(d.refund.fullBefore)) problems.push("deposit.refund.fullBefore must be an ISO date")
    if (!Number.isInteger(d.refund.laterPercent) || d.refund.laterPercent < 0 || d.refund.laterPercent > 99) problems.push("deposit.refund.laterPercent must be an integer from 0 to 99")
  }
}

export function bookingConfirmation(input: BookingConfirmationInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  checkBookingFields(input, problems)
  if (input.status !== "requested" && input.status !== "confirmed") problems.push("status must be requested or confirmed")
  if (!Number.isInteger(input.partySize) || input.partySize < 1) problems.push("partySize must be a positive integer")
  if (input.reminder && input.status !== "confirmed") problems.push("reminder is only for a confirmed booking")
  if (input.cancelBy !== undefined && !isValidDate(input.cancelBy)) problems.push("cancelBy must be an ISO date")
  if (input.manageUrl !== undefined) requireLink(input.manageUrl, "manageUrl", problems)
  checkDeposit(input.deposit, problems)
  if (input.deposit?.state === "pending" && (input.status !== "requested" || input.reminder)) problems.push("a pending deposit is only for a requested booking that is not a reminder")
  throwIfProblems("bookingConfirmation", problems)

  const t = copyOf(input, "bookingConfirmation")
  const tz = timeZoneOf(input)
  const v = { productName: input.productName }
  const dep = input.deposit
  const [subject, heading, body] = input.reminder
    ? [t.reminderSubject, t.reminderHeading, t.reminderBody]
    : dep?.state === "pending"
      ? [t.depositPendingSubject, t.depositPendingHeading, t.depositPendingBody]
      : input.status === "requested"
      ? [t.requestedSubject, t.requestedHeading, t.requestedBody]
      : [t.subject, t.heading, t.body]
  const children = [
    p(fill(body, v, "bookingConfirmation.body")),
    row(t.referenceLabel, input.reference),
    row(t.serviceLabel, input.serviceName),
    row(t.startsAtLabel, formatDate(input.startsAt, input.locale, tz, true)),
    row(t.partySizeLabel, String(input.partySize)),
  ]
  if (dep) {
    children.push(row(t.depositLabel, formatMoney(dep.amount, input.locale)))
    if (dep.state === "pending" && dep.payBy) children.push(p(fill(t.depositPendingNote, { payBy: formatDate(dep.payBy, input.locale, tz, true) }, "bookingConfirmation.depositPendingNote")))
    if (dep.state === "paid") children.push(p(t.depositPaidNote))
    if (dep.refund) {
      const when = { fullBefore: formatDate(dep.refund.fullBefore, input.locale, tz, true) }
      children.push(p(dep.refund.laterPercent === 0 ? fill(t.depositRefundAll, when, "bookingConfirmation.depositRefundAll") : fill(t.depositRefundPartial, { ...when, percent: String(dep.refund.laterPercent) }, "bookingConfirmation.depositRefundPartial")))
    }
  }
  if (input.cancelBy) children.push(p(fill(t.cancelNote, { cancelBy: formatDate(input.cancelBy, input.locale, tz, true) }, "bookingConfirmation.cancelNote")))
  if (input.manageUrl) children.push(actions(input.locale, [{ href: input.manageUrl, label: t.manageCta, secondary: true }]))
  return {
    subject: fill(subject, v, "bookingConfirmation.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      { preview: fill(t.preview, v, "bookingConfirmation.preview"), heading: fill(heading, v, "bookingConfirmation.heading"), children, footer: `${fill(t.why, v, "bookingConfirmation.why")} ${t.notYou}` },
    ),
  }
}
