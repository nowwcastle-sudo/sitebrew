// Paddle Billing 연결과 우리가 쓰는 SDK 부분(@paddle/paddle-node-sdk 3.10.0, Apache-2.0 — 의존성으로만 쓴다).
// 기본은 샌드박스다. 실결제(production)는 LF_PADDLE_LIVE=1 일 때만 받는다 — 이 값은 대표만 넣는다(계획 Task 5, Global Constraints §9 Q14).
import { Environment, Paddle } from "@paddle/paddle-node-sdk"

export type PaddleEnv = "sandbox" | "production"

/** 어댑터·웹훅·예약 작업이 부르는 SDK 부분. 테스트는 진짜 SDK 에 녹화 응답 fetch 를 끼운다. */
export type PaddleClient = Pick<Paddle, "subscriptions" | "transactions" | "discounts" | "webhooks" | "customerPortalSessions" | "customers">

export class PaddleLiveModeError extends Error {
  constructor() {
    super("Paddle production mode needs LF_PADDLE_LIVE=1 (owner only). Use env: \"sandbox\" until the owner switches to live billing.")
    this.name = "PaddleLiveModeError"
  }
}

/** production 이면 LF_PADDLE_LIVE=1 을 요구한다. 모르는 값은 거절한다(오타로 실결제가 켜지지 않게). */
export function assertPaddleEnv(env: PaddleEnv, vars: Record<string, string | undefined> = process.env): PaddleEnv {
  if (env !== "sandbox" && env !== "production") throw new Error(`Paddle env must be "sandbox" or "production", got ${String(env)}`)
  if (env === "production" && vars.LF_PADDLE_LIVE !== "1") throw new PaddleLiveModeError()
  return env
}

/** SDK 클라이언트. 키 값은 로그·오류에 싣지 않는다. */
export function createPaddleClient(options: { apiKey: string; env?: PaddleEnv; vars?: Record<string, string | undefined> }): PaddleClient {
  const env = assertPaddleEnv(options.env ?? "sandbox", options.vars)
  if (!options.apiKey) throw new Error("PADDLE_API_KEY is missing (owner action O3: Paddle sandbox API key)")
  return new Paddle(options.apiKey, { environment: env === "production" ? Environment.production : Environment.sandbox })
}

/** SDK ApiError 에서 화면에 보여도 되는 것만(키·요청 본문 없음) */
export function paddleErrorOf(e: unknown): { code: string; detail: string; retryable: boolean } {
  const err = e as { code?: unknown; detail?: unknown; type?: unknown; message?: unknown }
  const code = typeof err?.code === "string" ? err.code : "paddle_error"
  const detail = typeof err?.detail === "string" ? err.detail : typeof err?.message === "string" ? err.message : String(e)
  // api_error(Paddle 쪽 5xx)·네트워크 오류는 다시 시도할 수 있다. request_error(4xx)는 요청을 고쳐야 한다.
  const retryable = err?.type === "api_error" || typeof err?.code !== "string"
  return { code, detail, retryable }
}
