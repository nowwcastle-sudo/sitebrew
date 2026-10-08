// 문의 알림 메일(운영자께, v0 Task 15·대장 D97). 방문자가 쓴 이름·연락처·내용을 그대로 싣는다(React 가 HTML 을 이스케이프한다).
// 지울 날(deleteOn)을 함께 적는다 — 보유 기간이 지나면 저장소에서 지워지므로 답할 일은 그 전에 옮겨 둔다.
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface InquiryNoticeInput extends BaseInput<EmailMessages["email"]["inquiryNotice"]> {
  reference: string
  /** 어느 폼인지(블록 id 등) */
  form: string
  name?: string
  contact: string
  message: string
  receivedAt: IsoDate
  deleteOn: IsoDate
  /** 관리 화면 주소(선택) */
  adminUrl?: string
}

export function inquiryNotice(input: InquiryNoticeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  for (const k of ["reference", "form", "contact", "message"] as const) if (typeof input[k] !== "string" || input[k].trim() === "") problems.push(`${k} is required`)
  if (!isValidDate(input.receivedAt)) problems.push("receivedAt must be an ISO date")
  if (!isValidDate(input.deleteOn)) problems.push("deleteOn must be an ISO date")
  if (input.adminUrl !== undefined) requireLink(input.adminUrl, "adminUrl", problems)
  throwIfProblems("inquiryNotice", problems)

  const t = copyOf(input, "inquiryNotice")
  const tz = timeZoneOf(input)
  const v = { productName: input.productName, reference: input.reference, form: input.form, deleteOn: formatDate(input.deleteOn, input.locale, tz) }
  const children = [
    p(fill(t.body, v, "inquiryNotice.body")),
    row(t.referenceLabel, input.reference),
    row(t.receivedAtLabel, formatDate(input.receivedAt, input.locale, tz, true)),
    ...(input.name ? [row(t.nameLabel, input.name)] : []),
    row(t.contactLabel, input.contact),
    p(`${t.messageLabel}:`, true),
    ...input.message.split(/\r?\n/).map((line) => p(line)),
    p(fill(t.retentionNote, v, "inquiryNotice.retentionNote")),
  ]
  if (input.adminUrl) children.push(actions(input.locale, [{ href: input.adminUrl, label: t.cta }]))
  return {
    subject: fill(t.subject, v, "inquiryNotice.subject"),
    element: layout(input, { preview: fill(t.preview, v, "inquiryNotice.preview"), heading: fill(t.heading, v, "inquiryNotice.heading"), children, footer: fill(t.why, v, "inquiryNotice.why") }),
  }
}
