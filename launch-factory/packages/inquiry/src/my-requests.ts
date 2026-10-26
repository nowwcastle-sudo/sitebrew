// 내 신청 내역의 순수 부분(계획 3c Task 5) — 마스킹·쪽 보정·모양 바꾸기. DB·메일에 닿지 않는다.
// 목록은 연락처와 내용을 그대로 내려보내지 않는다: 연락처는 알아볼 수 있을 만큼만, 내용은 가린 앞 40자만.
import type { InquiryKind, InquiryStatus, MyInquiryRow } from "@launch-factory/db"

/** 미리보기 길이(글자 수, 이모지는 한 글자) */
export const PREVIEW_CHARS = 40
export const MY_REQUESTS_PAGE_SIZE = 20
export const MY_REQUESTS_MAX_PAGE_SIZE = 50

/** 목록 한 줄 — 화면이 받는 모양. 접수 번호·종류·상태·접수 시각(ISO)·가린 연락처·가린 미리보기 */
export interface MyRequest {
  reference: string
  kind: InquiryKind
  status: InquiryStatus
  receivedAt: string
  contact: string
  preview: string
}

export interface MyRequestsPage {
  items: MyRequest[]
  total: number
  page: number
  pageCount: number
}

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{6,}\d/g

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 0) return "***"
  const first = Array.from(email.slice(0, at))[0]
  return `${email.slice(0, at).length > 1 && first ? `${first}***` : "*"}${email.slice(at)}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 8 ? `***${digits.slice(-4)}` : "***"
}

/** 연락처를 가린다 — 이메일은 첫 글자 + 도메인, 전화는 끝 네 자리 */
export function maskContact(contact: string, kind: "email" | "phone"): string {
  return kind === "email" ? maskEmail(contact) : maskPhone(contact)
}

/** 내용 앞 40자. 그 안에 든 이메일·전화번호도 가린다(가린 뒤에 자른다) */
export function maskedPreview(message: string): string {
  const masked = message.replace(EMAIL_IN_TEXT, maskEmail).replace(PHONE_IN_TEXT, maskPhone).trim()
  const chars = Array.from(masked)
  return chars.length > PREVIEW_CHARS ? `${chars.slice(0, PREVIEW_CHARS).join("")}…` : masked
}

/** 쪽 번호·크기를 안전한 범위로 맞춘다(정수가 아니거나 1 미만이면 1쪽, 크기는 1~상한) */
export function normalizePaging(o: { page?: unknown; pageSize?: unknown } = {}): { page: number; pageSize: number } {
  const page = typeof o.page === "number" && Number.isInteger(o.page) && o.page >= 1 ? o.page : 1
  const size = typeof o.pageSize === "number" && Number.isInteger(o.pageSize) && o.pageSize >= 1 ? o.pageSize : MY_REQUESTS_PAGE_SIZE
  return { page, pageSize: Math.min(size, MY_REQUESTS_MAX_PAGE_SIZE) }
}

export function toMyRequest(row: MyInquiryRow): MyRequest {
  return { reference: row.reference, kind: row.kind, status: row.status, receivedAt: row.createdAt.toISOString(), contact: maskContact(row.contact, row.contactKind), preview: maskedPreview(row.preview) }
}

export function toMyRequestsPage(rows: MyInquiryRow[], total: number, paging: { page: number; pageSize: number }): MyRequestsPage {
  return { items: rows.map(toMyRequest), total, page: paging.page, pageCount: Math.ceil(total / paging.pageSize) }
}
