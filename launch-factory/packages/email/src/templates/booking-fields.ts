// 예약 메일 셋(확인·취소·대표 알림)이 함께 검사하는 칸. 템플릿이 아니라 검사 도우미다.
import { isValidDate } from "../format.ts"

const REFERENCE = /^[A-Z]-[0-9A-Z]{6,16}$/

/** 예약 번호·서비스 이름 같이 세 예약 메일이 함께 검사하는 칸 */
export function checkBookingFields(input: { reference: unknown; serviceName: unknown; startsAt: unknown }, problems: string[]): void {
  if (typeof input.reference !== "string" || !REFERENCE.test(input.reference)) problems.push("reference must be a server-made reference like B-7K3M9P2A")
  if (typeof input.serviceName !== "string" || input.serviceName.trim() === "") problems.push("serviceName is required")
  if (!isValidDate(input.startsAt)) problems.push("startsAt must be an ISO date")
}
