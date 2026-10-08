// launch-factory: 보안 보호 조립 — 요청 제한(DB 저장소) · 봇 방어(Cloudflare Turnstile) · 폼 멱등 키(DB). 제품의 경로·서버 액션이 부르는 도우미다.
// 순서는 한도 → 봇이다(Cloudflare 호출도 세기 위해서). 막히면 경로는 429(Retry-After)·400·503 응답을, 서버 액션은 code·retryAfter 가 든 실패를 받는다.
import { hitRateLimit, withIdempotency, type IdempotentOutcome } from "@launch-factory/db"
import { blockedResponse, blockedResult, protect, type Blocked, type LaunchFailure } from "@launch-factory/security/protect"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce, type RateLimiter, type RateRule, type Requester } from "@launch-factory/security/rate-limit"
import { createTurnstile, type Turnstile } from "@launch-factory/security/turnstile"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { env, required } from "@/lib/launch/env"

/**
 * 제품이 더하는 경로별 한도. 기본 경로(signUp·signIn·passwordReset·inquiry·checkoutStart)는 패키지 값을 쓴다.
 * 이름이 없는 경로를 부르면 던진다(조용히 한도 없이 통과하지 않는다). 예: { "invite": { max: 5, windowSec: 60 } }
 */
export const RATE_RULES: Record<string, RateRule> = {}

let limiterCache: Promise<RateLimiter> | undefined
let turnstileCache: Turnstile | undefined

export function limiter(): Promise<RateLimiter> {
  // 믿을 IP 머리는 환경이 정한다(대장 D205): 기본은 어떤 머리도 믿지 않고, Vercel 은 자동, 그 밖은 LF_TRUSTED_PROXY·LF_CLIENT_IP_HEADER·LF_TRUSTED_PROXY_CIDRS. 인증 항목과 같은 함수다
  return (limiterCache ??= database().then((db) =>
    createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, rules: RATE_RULES, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
  ))
}

/** mock 은 통과한다. live 는 TURNSTILE_SECRET_KEY 가 필수다(없으면 던진다) */
export function turnstile(): Turnstile {
  return (turnstileCache ??= createTurnstile(env().LF_MODE === "live" ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }))
}

export interface GuardOptions {
  /** 로그인한 사용자 id(있으면 제한 키에 들어간다) */
  userId?: string | null
  /** 봇 확인을 할 때만(가입·문의처럼 공개 폼). token 은 폼의 cf-turnstile-response */
  bot?: { token: string | null | undefined; idempotencyKey?: string }
}

async function blockedBy(route: string, who: Requester, bot: GuardOptions["bot"]): Promise<Blocked | null> {
  return protect(await limiter(), { route, who, ...(bot ? { bot: { turnstile: turnstile(), ...bot } } : {}) })
}

/** 경로 처리기 앞에서 부른다. 막히면 돌려줄 응답(429 + Retry-After · 400 · 503), 통과면 null */
export async function guardRequest(request: Request, route: string, options: GuardOptions = {}): Promise<Response | null> {
  const blocked = await blockedBy(route, { headers: request.headers, userId: options.userId ?? null }, options.bot)
  return blocked ? blockedResponse(blocked, DEFAULT_LOCALE) : null
}

/** 서버 액션 앞에서 부른다. 막히면 계약 모양의 실패(code·retryAfter 포함), 통과면 null. 요청 머리는 next/headers 의 headers() 로 넘긴다 */
export async function guardAction(route: string, who: Requester, bot?: GuardOptions["bot"]): Promise<LaunchFailure | null> {
  const blocked = await blockedBy(route, who, bot)
  return blocked ? blockedResult(blocked, DEFAULT_LOCALE) : null
}

/** 같은 (scope, key) 는 24시간 동안 한 번만 성공한다. 키 모양 검사는 부르는 쪽이 한다. 성공 결과만 저장하고, 같은 키로 다시 오면 그 결과를 돌려준다 */
export async function once<R>(scope: string, key: string, run: () => Promise<R>): Promise<IdempotentOutcome<R>> {
  return withIdempotency(await database(), { scope, key, now: new Date() }, run)
}
