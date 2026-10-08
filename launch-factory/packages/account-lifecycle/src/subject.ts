// 보존 거래기록의 가명 참조(subject_ref, 대장 D21).
// 탈퇴한 소비자가 열람·분쟁 때문에 연락하면 그 이메일로 기록을 찾아야 한다(전자상거래법 시행령 제6조 — 보존 기록의 열람).
// 그래서 이메일을 버리지 않고 「키 있는 해시」로만 남긴다: HMAC-SHA256(SUBJECT_REF_KEY, 정규화한 이메일).
// - 키가 없으면 해시를 거꾸로 맞춰 볼 수 없다(흔한 이메일 목록을 대입해도 키 없이는 같은 값이 안 나온다).
// - 키는 BETTER_AUTH_SECRET 과 따로 둔다: 인증 비밀을 바꿔도 옛 기록을 찾을 수 있어야 한다. 키를 바꾸면 옛 기록은 옛 키로만 찾는다.
import { createHmac } from "node:crypto"

export const SUBJECT_REF_VERSION = "h1"
export const SUBJECT_KEY_MIN_LENGTH = 32

/** 이메일 정규화: 앞뒤 공백 제거·NFC·소문자. 로컬 부분 대소문자를 구분하는 메일 서버는 드물고, 찾는 쪽이 대소문자를 틀려도 찾아야 한다 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFC").toLowerCase()
}

export function assertSubjectKey(key: string | undefined): asserts key is string {
  if (!key || key.length < SUBJECT_KEY_MIN_LENGTH) throw new Error(`SUBJECT_REF_KEY must be at least ${SUBJECT_KEY_MIN_LENGTH} characters`)
}

/** "h1:" + HMAC-SHA256 hex. 판 접두어는 알고리즘·정규화를 바꿀 때 옛 값과 섞이지 않게 한다 */
export function subjectRef(key: string, email: string): string {
  assertSubjectKey(key)
  return `${SUBJECT_REF_VERSION}:${createHmac("sha256", key).update(`email:${normalizeEmail(email)}`).digest("hex")}`
}
