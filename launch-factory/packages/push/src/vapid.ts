// VAPID 설정 검사 — 잘못된 키로 web-push 를 부르면 던지므로, 서비스를 만들 때 미리 값으로 걸러낸다.
export interface VapidConfig {
  /** `mailto:` 주소 또는 https 주소 */
  subject: string
  /** 비압축 P-256 공개키(65바이트)의 base64url */
  publicKey: string
  /** P-256 개인키(32바이트)의 base64url — 어떤 문구·기록에도 싣지 않는다 */
  privateKey: string
}

/**
 * 가짜 모드가 브라우저에 알려 주는 공개키. 실제 P-256 점이라 `pushManager.subscribe` 가 받아들인다(개인키는 만들고 버렸다 — 이 키로는 아무것도 보낼 수 없다).
 * 가짜 모드에서 만든 구독은 진짜 모드에서 쓸 수 없다(키가 다르다).
 */
export const MOCK_VAPID_PUBLIC_KEY = "BOPzJlxvcilhqV6v79_wGUEZ4zgvD6CL3kfQXj4-9rlEgOTPm6Jz7vb3CiSTOke0JbeteuqG9oHz3oyLAq-_8Ck"

const decodedLength = (v: unknown): number => (typeof v === "string" && /^[A-Za-z0-9_-]+$/.test(v) ? Buffer.from(v, "base64url").length : -1)

/** 쓸 수 있는 설정이면 true. 값(키)은 돌려주지도 적지도 않는다 */
export function isValidVapid(v: unknown): v is VapidConfig {
  if (!v || typeof v !== "object") return false
  const { subject, publicKey, privateKey } = v as Partial<Record<keyof VapidConfig, unknown>>
  const subjectOk = typeof subject === "string" && (/^mailto:[^\s@]+@[^\s@]+$/.test(subject) || /^https:\/\/[^\s/]+/.test(subject))
  return subjectOk && decodedLength(publicKey) === 65 && decodedLength(privateKey) === 32
}
