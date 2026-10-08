// 요청 제한·봇 방어 결과를 두 모양으로 바꾼다(v0 Task 15, 대장 D104).
//   - HTTP(라우트 처리기): 한도 초과 429 + Retry-After(초, RFC 9110 §10.2.3) · 봇 확인 실패 400 · 확인 불가 503.
//   - 서버 액션(블록): ActionResult 실패 + `code`·`retryAfter`. 계약 `ActionResult` 에는 아직 이 두 칸이 없다 —
//     web-factory A52 묶음(A101 짝)이 선택 칸으로 더한다. 그 전까지는 계약 모양의 상위 집합이라 블록은 formError 만 읽고, 칸이 생기면 그대로 읽는다.
// 문구는 메시지 목록 `protect` 에서만 읽는다.
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import type { RateDecision, RateLimiter, Requester } from "./rate-limit.ts"
import type { Turnstile, TurnstileResult } from "./turnstile.ts"

export type FailureCode = "rate_limited" | "bot_check_failed" | "bot_check_unavailable" | "in_progress" | "provider_unavailable"

/** 계약 ActionResult 실패 + A52 선택 칸(code·retryAfter) */
export interface LaunchFailure {
  ok: false
  formError?: string
  fieldErrors?: Partial<Record<string, string[]>>
  retryable?: boolean
  code?: FailureCode
  /** 다시 보낼 수 있을 때까지 남은 초(code: rate_limited) */
  retryAfter?: number
}
export type LaunchActionResult<T> = { ok: true; data: T; message?: string } | LaunchFailure

export type Blocked =
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "bot"; result: Extract<TurnstileResult, { ok: false }> }

export const blockedByRate = (d: RateDecision): Blocked | null => (d.ok ? null : { kind: "rate_limited", retryAfter: d.retryAfter })
export const blockedByBot = (r: TurnstileResult): Blocked | null => (r.ok ? null : { kind: "bot", result: r })

const loc = (locale: unknown): Locale => (isLocale(locale) ? locale : "en")

/** 서버 액션용 실패 결과 */
export function blockedResult(b: Blocked, locale?: Locale): LaunchFailure {
  const l = loc(locale)
  if (b.kind === "rate_limited") {
    return { ok: false, code: "rate_limited", retryAfter: b.retryAfter, retryable: true, formError: t(l, "protect.rateLimited", { seconds: b.retryAfter }) }
  }
  if (b.result.reason === "unavailable") return { ok: false, code: "bot_check_unavailable", retryable: true, formError: t(l, "protect.botCheckUnavailable") }
  return { ok: false, code: "bot_check_failed", retryable: true, formError: t(l, "protect.botCheckFailed") }
}

/** 라우트 처리기용 응답. 본문은 blockedResult 와 같은 JSON */
export function blockedResponse(b: Blocked, locale?: Locale): Response {
  const body = JSON.stringify(blockedResult(b, locale))
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  if (b.kind === "rate_limited") return new Response(body, { status: 429, headers: { ...headers, "retry-after": String(b.retryAfter) } })
  return new Response(body, { status: b.result.reason === "unavailable" ? 503 : 400, headers })
}

export interface ProtectInput {
  route: string
  who: Requester
  /** 봇 확인을 할 때만(가입·문의). 주면 토큰을 검증한다 */
  bot?: { turnstile: Turnstile; token: string | null | undefined; idempotencyKey?: string }
}

/** 한도 → 봇 순으로 본다. 통과면 null. 한도를 먼저 보는 것은 Cloudflare 호출도 세기 위해서다 */
export async function protect(limiter: RateLimiter, input: ProtectInput): Promise<Blocked | null> {
  const rate = blockedByRate(await limiter.check(input.route, input.who))
  if (rate || !input.bot) return rate
  const ip = limiter.ip(input.who)
  return blockedByBot(await input.bot.turnstile.verify({ token: input.bot.token, remoteIp: ip, idempotencyKey: input.bot.idempotencyKey }))
}
