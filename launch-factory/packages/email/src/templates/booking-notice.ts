// 새 예약 알림 메일(운영자께). 방문자가 쓴 이름·연락처·메모를 그대로 싣는다(React 가 HTML 을 이스케이프한다).
// 지울 날(deleteOn)을 함께 적는다 — 보유 기간이 지나면 저장소에서 지워지므로 필요한 기록은 그 전에 옮겨 둔다.
import type { IsoDate, Money } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, formatMoney, isValidDate } from "../format.ts"
import { checkBookingFields } from "./booking-fields.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface BookingNoticeInput extends BaseInput<EmailMessages["email"]["bookingNotice"]> {
  reference: string
  serviceName: string
  startsAt: IsoDate
  partySize: number
  /** requested: 확인하고 확정해야 한다 · confirmed: 바로 확정됐다 */
  status: "requested" | "confirmed"
  name?: string
  contact: string
  note?: string
  deleteOn: IsoDate
  /** 관리 화면 주소(선택) */
  adminUrl?: string
  /** 낸 예약금(선택 — 결제가 끝난 예약일 때만 준다) */
  depositPaid?: Money
}

export function bookingNotice(input: BookingNoticeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  checkBookingFields(input, problems)
  if (input.status !== "requested" && input.status !== "confirmed") problems.push("status must be requested or confirmed")
  if (!Number.isInteger(input.partySize) || input.partySize < 1) problems.push("partySize must be a positive integer")
  if (typeof input.contact !== "string" || input.contact.trim() === "") problems.push("contact is required")
  if (!isValidDate(input.deleteOn)) problems.push("deleteOn must be an ISO date")
  if (input.adminUrl !== undefined) requireLink(input.adminUrl, "adminUrl", problems)
  if (input.depositPaid !== undefined && (!Number.isInteger(input.depositPaid.amount) || input.depositPaid.amount < 1 || typeof input.depositPaid.currency !== "string")) problems.push("depositPaid must be a positive minor-unit Money")
  throwIfProblems("bookingNotice", problems)

  const t = copyOf(input, "bookingNotice")
  const tz = timeZoneOf(input)
  const requested = input.status === "requested"
  const v = { productName: input.productName, reference: input.reference, deleteOn: formatDate(input.deleteOn, input.locale, tz) }
  const children = [
    p(requested ? t.requestedBody : t.body),
    row(t.referenceLabel, input.reference),
    row(t.serviceLabel, input.serviceName),
    row(t.startsAtLabel, formatDate(input.startsAt, input.locale, tz, true)),
    row(t.partySizeLabel, String(input.partySize)),
    ...(input.depositPaid ? [row(t.depositLabel, formatMoney(input.depositPaid, input.locale)), p(t.depositPaidNote)] : []),
    ...(input.name ? [row(t.nameLabel, input.name)] : []),
    row(t.contactLabel, input.contact),
    ...(input.note ? [p(`${t.noteLabel}:`, true), ...input.note.split(/\r?\n/).map((line) => p(line))] : []),
    p(fill(t.retentionNote, v, "bookingNotice.retentionNote")),
  ]
  if (input.adminUrl) children.push(actions(input.locale, [{ href: input.adminUrl, label: t.cta }]))
  return {
    subject: fill(requested ? t.requestedSubject : t.subject, v, "bookingNotice.subject"),
    element: layout(input, { preview: t.preview, heading: requested ? t.requestedHeading : t.heading, children, footer: fill(t.why, v, "bookingNotice.why") }),
  }
}
