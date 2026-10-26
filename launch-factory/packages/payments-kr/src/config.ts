// 환경 → 게이트웨이. 어느 구현을 쓸지는 이 파일 한 곳이 정한다.
//   LF_MODE=mock → 키가 있어도 mock 게이트웨이(미리보기가 실결제로 새지 않는다).
//   LF_MODE=live → PortOne 값 넷이 다 있어야 켠다. 하나라도 없으면 던지지 않고 「상점만 꺼진다」(문의 창구와 같은 규칙) — 사이트는 켜진다.
// 오류·사유에는 이름만 싣고 값은 싣지 않는다.
import { PortOneClient } from "@portone/server-sdk"
import { PaymentsConfigError, type PaymentGateway } from "./gateway.ts"
import { mockGateway, type MockGateway } from "./mock.ts"
import { portoneGateway, type PortOneClientLike } from "./portone.ts"

/** live 에서 요구하는 환경 변수 이름. 앞 둘은 브라우저에도 노출되는 값이다 */
export const PORTONE_ENV = ["NEXT_PUBLIC_PORTONE_STORE_ID", "NEXT_PUBLIC_PORTONE_CHANNEL_KEY", "PORTONE_API_SECRET", "PORTONE_WEBHOOK_SECRET"] as const

export type PaymentsEnv = Record<string, string | undefined>

export type PaymentsConfig =
  | { enabled: true; mode: "mock"; gateway: MockGateway }
  | { enabled: true; mode: "live"; gateway: PaymentGateway; webhookSecret: string }
  | { enabled: false; mode: "live"; reason: string; missing: string[] }

export interface ResolveOptions {
  /** API Secret → PortOne 서버 클라이언트(시험에서 가짜로 바꾼다). 기본은 SDK 의 PortOneClient */
  createClient?: (apiSecret: string) => PortOneClientLike
}

const clean = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : v.trim())

export function resolvePayments(env: PaymentsEnv, options: ResolveOptions = {}): PaymentsConfig {
  const mode = env.LF_MODE
  if (mode !== "mock" && mode !== "live") throw new PaymentsConfigError("LF_MODE 는 mock 또는 live 여야 해요 — 조용히 mock 으로 켜지 않아요")
  if (mode === "mock") return { enabled: true, mode: "mock", gateway: mockGateway() }

  const missing = PORTONE_ENV.filter((name) => clean(env[name]) === undefined)
  if (missing.length > 0) {
    return { enabled: false, mode: "live", missing: [...missing], reason: `상점을 끕니다 — PortOne 설정이 빠졌어요: ${missing.join(", ")} (commerce disabled: missing ${missing.join(", ")})` }
  }
  const [storeId, channelKey, apiSecret, webhookSecret] = PORTONE_ENV.map((name) => clean(env[name]) as string) as [string, string, string, string]
  const createClient = options.createClient ?? ((secret: string) => PortOneClient({ secret }))
  return { enabled: true, mode: "live", gateway: portoneGateway({ client: createClient(apiSecret), storeId, channelKey }), webhookSecret }
}
