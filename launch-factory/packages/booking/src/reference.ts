// 예약 접수 번호. 서비스가 만든다(DB 는 unique 만 지킨다). "B-" + 헷갈리는 글자(I·L·O·U)를 뺀 Crockford base32 8자.
// 조회·취소에서 사람이 손으로 옮겨 적으므로 입력은 느슨하게 받는다(소문자·공백·O→0·I/L→1).
import { randomInt } from "node:crypto"

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const REFERENCE_PATTERN = /^B-[0-9A-HJKMNP-TV-Z]{8}$/

export function newReference(): string {
  return `B-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`
}

/** 사람이 적은 접수 번호를 저장 모양으로. 모양이 아니면 null (DB 를 부르기 전에 걸러낸다) */
export function normalizeReference(input: unknown): string | null {
  if (typeof input !== "string") return null
  const compact = input.toUpperCase().replace(/[\s_]/g, "").replace(/^B-?/, "")
  const body = compact.replace(/-/g, "").replace(/[IL]/g, "1").replace(/O/g, "0")
  const ref = `B-${body}`
  return REFERENCE_PATTERN.test(ref) ? ref : null
}
