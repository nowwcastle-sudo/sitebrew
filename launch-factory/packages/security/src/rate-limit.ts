// 요청 제한(v0 Task 15). 저장은 DB(`rate_limits`, @launch-factory/db hitRateLimit) — 서버리스 인스턴스끼리 같은 수를 본다.
//
// 표가 둘이다(대장 D44 판정):
//   - Better Auth `rate_limit`: 인증 경로(`auth.handler` 안 — 가입·로그인·재설정). Better Auth 1.7.6 제한은 라우터 onRequest 안에서만 걸리고
//     키가 `IP|인증 경로`라서(`dist/api/rate-limiter/index.mjs` resolveRateLimitConfig) `customRules` 로도 서버 액션(문의·결제 시작)은 덮지 못한다.
//   - 우리 `rate_limits`: 그 밖의 모든 경로. 키 = 경로 + IP + 사용자(로그인했으면) — 같은 IP 뒤의 다른 사용자는 한도를 나누지 않는다.
// 인증 세 경로의 기본값은 Better Auth 기본 규칙과 같은 값이다(로그인·가입 10초 3번, 재설정 60초 3번). 인증 경로는 Better Auth 가 세고,
// 이 값은 auth.handler 를 거치지 않는 인증 입구가 생길 때 같은 규칙으로 쓰려고 둔다.
//
// IP 는 Better Auth 와 같은 함수(@better-auth/core getIP)로 얻는다 — 두 표가 같은 사람을 같은 IP 로 본다. 어느 머리를 믿을지는
// `ipAddressFromEnv(process.env)` 한 곳에서 정하고(대장 D205) 제한기와 Better Auth(`createAuth({ ipAddress })`)에 같은 값을 준다.
// 기본은 어떤 머리도 믿지 않는다(속일 수 있는 머리로 한도를 피하지 못하게). IP 를 못 찾으면 경로별 공용 통 하나로 떨어지고(`ip:unknown`) onNoIp 로 알린다.
import { findInvalidTrustedProxies, getIP } from "@better-auth/core/utils/ip"

export interface RateRule {
  max: number
  windowSec: number
}

/** 기본 규칙. 경로 이름은 제한 키에 그대로 들어간다 */
export const RATE_LIMIT_DEFAULTS = {
  signUp: { max: 3, windowSec: 10 },
  signIn: { max: 3, windowSec: 10 },
  passwordReset: { max: 3, windowSec: 60 },
  inquiry: { max: 5, windowSec: 600 },
  checkoutStart: { max: 10, windowSec: 60 },
} as const satisfies Record<string, RateRule>
export type DefaultRoute = keyof typeof RATE_LIMIT_DEFAULTS

/** 한 번 세고 창의 수·시작 시각을 돌려주는 저장소. DB 는 `(k, w, n) => hitRateLimit(db, k, w, n)` */
export interface RateLimitStore {
  hit(key: string, windowMs: number, now: Date): Promise<{ count: number; windowStartedAt: Date }>
}

/** Better Auth `advanced.ipAddress` 와 같은 모양 — 같은 값을 두 곳에 준다 */
export interface IpAddressOptions {
  ipAddressHeaders?: string[]
  trustedProxies?: string[]
  ipv6Subnet?: 128 | 64 | 48 | 32
}

/**
 * 어느 머리의 IP 를 믿을지를 환경에서 정한다. 앞단이 덮어쓰는 머리만 믿어야 한다 — 그렇지 않은 머리는 요청자가 마음대로 써서 한도를 피한다.
 * 순서(앞선 것이 이긴다):
 *   1. LF_TRUSTED_PROXY_CIDRS  프록시 주소 목록(쉼표). 체인을 오른쪽부터 믿는 프록시를 건너뛰어 첫 미신뢰 주소를 쓴다. 머리는 LF_CLIENT_IP_HEADER(기본 x-forwarded-for)
 *   2. LF_CLIENT_IP_HEADER     앞단이 덮어쓰는 머리 하나(예: Cloudflare 앞이면 cf-connecting-ip)
 *   3. LF_TRUSTED_PROXY        `vercel` 또는 `none`. 명시한 값이 자동 감지를 이긴다
 *   4. VERCEL=1 (Vercel 이 넣는 시스템 변수)  → vercel
 *   5. 그 밖: none(믿는 머리 없음)
 * vercel = `x-vercel-forwarded-for` 다음 `x-forwarded-for`. Vercel 문서: x-forwarded-for 는 Vercel 이 덮어쓰고 외부 IP 를 전달하지 않는다(위조 방지),
 * x-vercel-forwarded-for 는 같은 값이며 앞단에 프록시를 두어 x-forwarded-for 가 덮여도 남는다. 잘못된 값은 던진다.
 */
export function ipAddressFromEnv(env: Record<string, string | undefined>): IpAddressOptions {
  const value = (k: string) => env[k]?.trim() || undefined
  const header = value("LF_CLIENT_IP_HEADER")?.toLowerCase()
  if (header !== undefined && !/^[a-z0-9-]+$/.test(header)) throw new Error("LF_CLIENT_IP_HEADER must be an HTTP header name")
  const cidrs = value("LF_TRUSTED_PROXY_CIDRS")
    ?.split(",")
    .map((c) => c.trim())
    .filter(Boolean)
  if (cidrs?.length) {
    const bad = findInvalidTrustedProxies(cidrs)
    if (bad.length) throw new Error(`LF_TRUSTED_PROXY_CIDRS has invalid entries: ${bad.join(", ")}`)
    return { ipAddressHeaders: [header ?? "x-forwarded-for"], trustedProxies: cidrs }
  }
  if (header) return { ipAddressHeaders: [header] }
  const platform = value("LF_TRUSTED_PROXY") ?? (env.VERCEL === "1" ? "vercel" : "none")
  if (platform === "vercel") return { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"] }
  if (platform === "none") return { ipAddressHeaders: [] }
  throw new Error("LF_TRUSTED_PROXY must be 'vercel' or 'none'")
}

/** onNoIp 기본 알림: 경로마다 한 번만 남긴다(요청마다 남기면 로그가 묻힌다). 배포 환경이 믿을 머리를 정하지 않았다는 뜻이다(LF_TRUSTED_PROXY 등) */
export function warnNoIpOnce(log: (message: string) => void = console.warn): (route: string) => void {
  const seen = new Set<string>()
  return (route) => {
    if (seen.has(route)) return
    seen.add(route)
    log(`[rate-limit] no trusted client IP for route "${route}" — requests share one bucket. Set LF_TRUSTED_PROXY / LF_CLIENT_IP_HEADER / LF_TRUSTED_PROXY_CIDRS for this host.`)
  }
}

export interface Requester {
  /** 요청 머리(IP 를 읽는다). ip 를 직접 주면 쓰지 않는다 */
  headers?: Headers
  ip?: string | null
  userId?: string | null
}

export type RateDecision = { ok: true; remaining: number } | { ok: false; retryAfter: number }

export interface RateLimiterOptions {
  store: RateLimitStore
  rules?: Partial<Record<string, RateRule>>
  ipAddress?: IpAddressOptions
  now?: () => Date
  /** IP 를 못 찾아 공용 통으로 떨어질 때(운영 설정 문제) */
  onNoIp?: (route: string) => void
}

export interface RateLimiter {
  check(route: string, who: Requester): Promise<RateDecision>
  key(route: string, who: Requester): string
  /** 이 제한기가 보는 IP(ipAddress 설정을 따른다). 못 찾으면 null */
  ip(who: Requester): string | null
}

/** 요청 머리에서 클라이언트 IP. Better Auth 와 같은 규칙(개발·시험 환경에서 머리가 없으면 127.0.0.1) */
export function clientIp(headers: Headers, ipAddress: IpAddressOptions = {}): string | null {
  return getIP(headers, { advanced: { ipAddress } } as Parameters<typeof getIP>[1])
}

export function createRateLimiter({ store, rules = {}, ipAddress, now = () => new Date(), onNoIp }: RateLimiterOptions): RateLimiter {
  const ruleOf = (route: string): RateRule => {
    const r = rules[route] ?? (RATE_LIMIT_DEFAULTS as Record<string, RateRule>)[route]
    if (!r) throw new Error(`no rate limit rule for route "${route}" — pass rules: { "${route}": { max, windowSec } }`)
    if (!(r.max >= 1 && r.windowSec >= 1)) throw new Error(`rate limit rule for "${route}" needs max >= 1 and windowSec >= 1`)
    return r
  }
  const ipOf = (who: Requester): string | null => (who.ip !== undefined ? who.ip : who.headers ? clientIp(who.headers, ipAddress) : null)
  const key = (route: string, who: Requester): string => {
    const ip = ipOf(who)
    if (!ip) onNoIp?.(route)
    return `${route}|ip:${ip ?? "unknown"}|user:${who.userId ?? "-"}`
  }
  return {
    key,
    ip: ipOf,
    async check(route, who) {
      const rule = ruleOf(route)
      const at = now()
      const windowMs = rule.windowSec * 1000
      const { count, windowStartedAt } = await store.hit(key(route, who), windowMs, at)
      if (count <= rule.max) return { ok: true, remaining: rule.max - count }
      const retryAfter = Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - at.getTime()) / 1000))
      return { ok: false, retryAfter }
    },
  }
}
