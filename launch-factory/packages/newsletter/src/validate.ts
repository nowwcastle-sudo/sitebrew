// 구독 신청 입력 검사(순수 — DB·메일 없음). 동의는 기본 false 이고 명시적으로 체크한 것만 동의다(정보통신망법 제50조제1항 — 광고성 정보는 수신자의 명시적 사전 동의).
// 이메일은 앞뒤 공백을 떼고 소문자로 맞춘다(표의 unique 가 대소문자 때문에 뚫리지 않게). +태그는 건드리지 않는다.
import { t, type Locale } from "@launch-factory/i18n"

export const LIMITS = { email: 254, source: 40 } as const
/** 동의 문구의 판. 화면의 동의 문구를 고치면 올린다 — 동의한 시각과 함께 구독자 행에 남는다 */
export const NEWSLETTER_CONSENT_VERSION = "2026-10-22"
export const DEFAULT_SOURCE = "web"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCE = /^[a-z0-9][a-z0-9-]{0,39}$/
const CONSENT_YES = new Set(["yes", "on", "true"])

/** 형식이 맞는 이메일이면 소문자·공백 정리한 값, 아니면 null */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  return email.length <= LIMITS.email && EMAIL.test(email) ? email : null
}

export type SubscribeInput = FormData | Record<string, unknown>

/** FormData·객체에서 문자열 칸만 읽는다(자기 속성만 — 프로토타입 칸은 무시) */
export function readFields(input: SubscribeInput): Map<string, string> {
  const out = new Map<string, string>()
  const entries = input instanceof FormData ? [...input.entries()] : Object.entries(input ?? {})
  for (const [k, v] of entries) if (typeof v === "string") out.set(k, v.trim())
  return out
}

export type ParsedSubscribe = { ok: true; email: string; source: string } | { ok: false; fieldErrors: Record<string, string[]> }

export function parseSubscribe(f: Map<string, string>, locale: Locale): ParsedSubscribe {
  const errors: Record<string, string[]> = {}
  const raw = f.get("email") ?? ""
  const email = normalizeEmail(raw)
  if (!raw) errors.email = [t(locale, "newsletter.required")]
  else if (raw.length > LIMITS.email) errors.email = [t(locale, "newsletter.tooLong", { max: LIMITS.email })]
  else if (!email) errors.email = [t(locale, "newsletter.emailInvalid")]
  if (!CONSENT_YES.has((f.get("consent") ?? "").toLowerCase())) errors.consent = [t(locale, "newsletter.consentRequired")]
  if (Object.keys(errors).length || !email) return { ok: false, fieldErrors: errors }
  const source = f.get("source") ?? ""
  return { ok: true, email, source: SOURCE.test(source) ? source : DEFAULT_SOURCE }
}
