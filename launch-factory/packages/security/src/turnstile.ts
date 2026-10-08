// 봇 방어: Cloudflare Turnstile 서버 검증(v0 Task 15). 가입·문의 폼에 쓴다.
// 1차 출처(2026-09-30 확인):
//   - 서버 검증 https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//     POST https://challenges.cloudflare.com/turnstile/v0/siteverify — secret·response(필수), remoteip·idempotency_key(UUID, 선택).
//     토큰은 최대 2048자, 만든 뒤 300초만 유효하고 한 번만 검증된다(두 번째는 timeout-or-duplicate). 응답을 끝없이 기다리지 말 것, hostname·action 확인 권고.
//   - 시험 키 https://developers.cloudflare.com/turnstile/troubleshooting/testing/ — 비밀 1x…AA 늘 통과, 2x…AA 늘 실패, 3x…AA 이미 쓴 토큰. 시험 토큰 XXXX.DUMMY.TOKEN.XXXX
//   - 요금 https://developers.cloudflare.com/turnstile/plans/ — Free: 위젯 20개, 검증 요청 무제한
// 운영자 할 일 O7(Turnstile 키). 키가 없으면 mock 모드에서는 통과하고, live 모드에서는 만들 때 설정 오류다(환경 검증은 @launch-factory/env).
// 토큰 칸은 블록이 아니라 조립 쪽이 숨은 입력(`cf-turnstile-response` — 위젯이 폼 안에 자동으로 만드는 이름)으로 더한다.

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
/**
 * 위젯이 쓰는 CSP 출처 — `securityHeaders(nonce, { extend: TURNSTILE_CSP })`(POSTHOG_CSP 와 합쳐서).
 * https://developers.cloudflare.com/turnstile/reference/content-security-policy/ — script-src·frame-src 에 challenges.cloudflare.com,
 * nonce 를 api.js 태그에 주면 Turnstile 이 퍼뜨리고 strict-dynamic 과 함께 쓸 수 있다(2026-09-30 확인)
 */
export const TURNSTILE_CSP = { scriptSrc: ["https://challenges.cloudflare.com"], frameSrc: ["https://challenges.cloudflare.com"] } as const
/** 위젯이 폼에 넣는 숨은 입력 이름 */
export const TURNSTILE_FIELD = "cf-turnstile-response"
const MAX_TOKEN_LENGTH = 2048
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TurnstileMode = "mock" | "live"

/** invalid: 토큰이 없거나 틀림·만료·재사용(→ 400). unavailable: Cloudflare 에 닿지 못함·설정 오류(→ 다시 시도) */
export type TurnstileResult =
  | { ok: true; mode: TurnstileMode; hostname?: string; action?: string }
  | { ok: false; reason: "invalid"; errorCodes: string[] }
  | { ok: false; reason: "unavailable"; errorCodes: string[] }

export interface VerifyInput {
  token: string | null | undefined
  remoteIp?: string | null
  /** 같은 제출을 다시 검증할 때(UUID 여야 보낸다) */
  idempotencyKey?: string
}

export interface TurnstileOptions {
  mode: TurnstileMode
  /** live 필수(TURNSTILE_SECRET_KEY). 값은 로그·오류에 싣지 않는다 */
  secretKey?: string
  /** 주면 응답 hostname 이 이 안에 있어야 통과(공식 권고) */
  expectedHostnames?: string[]
  /** 주면 응답 action 이 같아야 통과 */
  expectedAction?: string
  timeoutMs?: number
  fetch?: typeof fetch
}

export interface Turnstile {
  readonly mode: TurnstileMode
  verify(input: VerifyInput): Promise<TurnstileResult>
}

export class TurnstileConfigError extends Error {
  constructor() {
    super("live Turnstile needs TURNSTILE_SECRET_KEY — set it in the environment (owner action O7)")
    this.name = "TurnstileConfigError"
  }
}

// 설정 오류 코드는 방문자 탓이 아니다 → invalid(400)가 아니라 unavailable 로 알린다
const CONFIG_CODES = new Set(["missing-input-secret", "invalid-input-secret", "internal-error", "bad-request"])

export function createTurnstile(options: TurnstileOptions): Turnstile {
  const { mode } = options
  if (mode !== "mock" && mode !== "live") throw new Error(`turnstile mode must be mock or live, got ${String(mode)}`)
  if (mode === "mock") return { mode, verify: async () => ({ ok: true, mode }) }
  if (!options.secretKey) throw new TurnstileConfigError()
  const secret = options.secretKey
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 8000

  return {
    mode,
    async verify({ token, remoteIp, idempotencyKey }) {
      if (typeof token !== "string" || token.trim() === "") return { ok: false, reason: "invalid", errorCodes: ["missing-input-response"] }
      if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "invalid", errorCodes: ["invalid-input-response"] }
      const body = new URLSearchParams({ secret, response: token })
      if (remoteIp) body.set("remoteip", remoteIp)
      if (idempotencyKey && UUID.test(idempotencyKey)) body.set("idempotency_key", idempotencyKey)
      let data: { success?: unknown; "error-codes"?: unknown; hostname?: unknown; action?: unknown }
      try {
        const res = await doFetch(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(timeoutMs) })
        if (!res.ok) return { ok: false, reason: "unavailable", errorCodes: [`http-${res.status}`] }
        data = (await res.json()) as typeof data
      } catch {
        return { ok: false, reason: "unavailable", errorCodes: ["network-error"] }
      }
      const errorCodes = Array.isArray(data["error-codes"]) ? data["error-codes"].map(String) : []
      if (data.success !== true) {
        return errorCodes.some((c) => CONFIG_CODES.has(c))
          ? { ok: false, reason: "unavailable", errorCodes }
          : { ok: false, reason: "invalid", errorCodes: errorCodes.length ? errorCodes : ["invalid-input-response"] }
      }
      const hostname = typeof data.hostname === "string" ? data.hostname : undefined
      const action = typeof data.action === "string" ? data.action : undefined
      if (options.expectedHostnames && !(hostname && options.expectedHostnames.includes(hostname))) return { ok: false, reason: "invalid", errorCodes: ["hostname-mismatch"] }
      if (options.expectedAction !== undefined && action !== options.expectedAction) return { ok: false, reason: "invalid", errorCodes: ["action-mismatch"] }
      return { ok: true, mode, ...(hostname ? { hostname } : {}), ...(action ? { action } : {}) }
    },
  }
}
