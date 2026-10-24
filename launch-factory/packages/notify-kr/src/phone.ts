// 한국 휴대전화 번호 정규화. 문자·알림톡은 휴대전화로만 보낸다(지역번호·대표번호·수신거부 번호는 받는 번호가 아니다).

/** 01[016789] + 7~8자리. 010 은 11자리(010-XXXX-XXXX)만, 011·016~019 는 10~11자리 */
const MOBILE = /^01(?:0\d{8}|[16789]\d{7,8})$/

/**
 * 한국 휴대전화 번호를 숫자만(`01012345678`)으로 바꾼다.
 * `010-1234-5678` · `010 1234 5678` · `+82 10-1234-5678` · `0082 10 …` · `+82 010-…` 를 받고, 휴대전화가 아니면 null.
 */
export function normalizeKrMobile(input: unknown): string | null {
  if (typeof input !== "string") return null
  const compact = input.trim().replace(/[\s\-.()]/g, "")
  if (!/^\+?\d+$/.test(compact)) return null // 숫자·+ 밖의 글자가 있으면 거절
  let digits: string
  if (compact.startsWith("+")) {
    if (!compact.startsWith("+82")) return null
    digits = compact.slice(3)
  } else if (compact.startsWith("0082")) {
    digits = compact.slice(4)
  } else {
    digits = compact
    return MOBILE.test(digits) ? digits : null
  }
  if (digits.startsWith("0")) digits = digits.slice(1) // +82 010-… 처럼 0 을 또 쓴 입력
  digits = `0${digits}`
  return MOBILE.test(digits) ? digits : null
}

/** 정규화된 번호의 끝 4자리(기록·문의 대응용 — 전체 번호는 어디에도 남기지 않는다) */
export function last4(normalized: string): string {
  return normalized.slice(-4)
}
