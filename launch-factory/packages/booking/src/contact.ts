// 연락처 검사·정규화·비교. 조회·취소는 예약 번호 **와** 연락처가 맞아야 하므로 비교는 정규화한 값을 시간 일정하게 한다.
import { createHash, timingSafeEqual } from "node:crypto"

export const MAX_CONTACT_LENGTH = 254
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s\-().]+$/

/** 이메일이면 "email", 전화번호(숫자 8~15개)면 "phone", 아니면 null */
export function contactKindOf(raw: string): "email" | "phone" | null {
  if (EMAIL.test(raw)) return "email"
  if (PHONE.test(raw) && /^\d{8,15}$/.test(raw.replace(/\D/g, ""))) return "phone"
  return null
}

/**
 * 비교용 모양. 이메일은 소문자·앞뒤 공백 없이, 전화는 숫자만(+82 10… 와 010… 이 같다), 다른 국제 번호는 +숫자.
 * 저장된 값과 입력한 값에 같은 함수를 쓴다.
 */
export function normalizeContact(raw: string): string {
  const s = raw.trim()
  if (s.includes("@")) return s.toLowerCase()
  const digits = s.replace(/\D/g, "")
  if (s.startsWith("+82")) return `0${digits.slice(2).replace(/^0/, "")}`
  return s.startsWith("+") ? `+${digits}` : digits
}

const digest = (s: string) => createHash("sha256").update(s).digest()

/** 두 연락처가 같은가 — 정규화한 뒤 해시끼리 시간 일정하게 비교한다(길이가 달라도 같은 시간) */
export function sameContact(a: string, b: string): boolean {
  return timingSafeEqual(digest(normalizeContact(a)), digest(normalizeContact(b)))
}
