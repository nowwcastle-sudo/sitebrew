// 개인정보·토큰 모양 가림. Sentry beforeSend 와 접속기록 검사가 함께 쓴다.
//   오탐(날짜·버전·주문번호·UUID·추적 id 를 가림)보다 누락이 더 나쁘지만, 추적 id 까지 가리면 Sentry 가 쓸모없어진다.
//   그래서 토큰은 「긴 16진수」 같은 넓은 모양이 아니라 알려진 모양(Bearer·JWT·공급자 키 접두사·비밀 쿼리)만 잡는다.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// 한국 휴대·지역번호: 010-1234-5678 · 01012345678 · 02-123-4567 · 031.123.4567 · 070 1234 5678
const PHONE_KR = /(?<![\w.+-])0(?:1[016789]|2|[3-6][1-5]|70)[-.\s]?\d{3,4}[-.\s]?\d{4}(?![\w])/g
// 국제 표기: +82 10 1234 5678 · +1-415-555-0100 (숫자 8~15개일 때만)
const PHONE_INTL = /(?<![\w.])\+\d{1,3}(?:[-.\s]?\(?\d{1,4}\)?){2,5}(?![\w])/g

const TOKEN_RULES: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]"],
  // 공급자 키 접두사: Paddle(pdl_live_·pdl_sdbx_·pdl_ntfset_), Resend(re_ + 숫자 포함), PostHog(phc_·phx_), Stripe 모양(sk_·rk_), 웹훅(whsec_)
  [/\b(?:pdl_(?:live|sdbx|ntfset)_\w+|re_(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{6,}|ph[cx]_[A-Za-z0-9]+|[sr]k_(?:live|test)_\w+|whsec_\w+)/g, "[token]"],
  [/([?&](?:token|access_token|refresh_token|id_token|code|key|api_key|apikey|secret|password|sig|signature|OC)=)[^&#\s"']*/gi, "$1[token]"],
]

/** 문자열 하나에서 토큰·이메일·전화 모양을 가린다. */
export function maskPii(text: string): string {
  let out = text
  for (const [re, to] of TOKEN_RULES) out = out.replace(re, to)
  out = out.replace(EMAIL, "[email]")
  out = out.replace(PHONE_INTL, (m) => {
    const digits = m.replace(/\D/g, "").length
    return digits >= 8 && digits <= 15 ? "[phone]" : m
  })
  out = out.replace(PHONE_KR, "[phone]")
  return out
}

/** 값 안의 모든 문자열을 가린 **복사본**을 만든다. 순환 참조는 같은 복사본으로 잇는다. */
export function maskDeep<T>(value: T, seen: Map<object, unknown> = new Map()): T {
  if (typeof value === "string") return maskPii(value) as T
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return seen.get(value) as T
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const v of value) copy.push(maskDeep(v, seen))
    return copy as T
  }
  const copy: Record<string, unknown> = {}
  seen.set(value, copy)
  for (const [k, v] of Object.entries(value)) copy[k] = maskDeep(v, seen)
  return copy as T
}

/** 문자열에 이메일·전화·토큰 모양이 들어 있으면 true. */
export function containsPii(text: string): boolean {
  return maskPii(text) !== text
}
