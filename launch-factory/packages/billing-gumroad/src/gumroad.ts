// Gumroad API v2 에서 우리가 쓰는 부분(읽기 둘). 공식 SDK 가 없어 전역 fetch 로 부른다.
// 출처(2026-09-30, https://gumroad.com/api — 라이브 번들 Api-DyZWPF2i.js 와 원천 antiwork/gumroad@74d7314 이 같다):
// - 기본 주소 https://api.gumroad.com/v2, 액세스 토큰(설정 → 고급 → 앱 → 「Generate access token」). 문서 cURL 예시는 access_token 매개변수,
//   일부 엔드포인트 설명은 「Authenticate with a Bearer token」. 토큰이 URL·로그에 남지 않게 Authorization: Bearer 머리를 쓴다(실측은 대장 D161).
// - GET /sales/:id → { success, sale }, GET /subscribers/:id → { success, subscribers }(단일 객체인데 키가 복수형이다). 둘 다 view_sales 범위.
// - 오류: { success: false, message }, 404 = 없음, 500·502·503·504 = Gumroad 쪽 오류.
// 쓰기(해지·일시정지·요금제 변경·결제수단 변경) 엔드포인트는 문서에 없다 — 그래서 어댑터가 provider_unsupported 로 끝낸다.

export const GUMROAD_API = "https://api.gumroad.com/v2"

/** GET /subscribers/:id 의 구독 객체(문서 SUBSCRIBER_FIELDS 중 우리가 읽는 칸) */
export interface GumroadSubscriber {
  id: string
  product_id: string
  user_email?: string | null
  purchase_ids?: string[]
  created_at: string
  user_requested_cancellation_at?: string | null
  recurrence?: string | null
  cancelled_at?: string | null
  ended_at?: string | null
  failed_at?: string | null
  free_trial_ends_at?: string | null
  status: string
}

/** GET /sales/:id 의 판매 객체(문서 SALE_FIELDS 중 우리가 읽는 칸) */
export interface GumroadSale {
  id: string
  email?: string | null
  created_at: string
  product_id: string
  price?: number
  currency?: string
  tax_cents?: number
  tax_included_in_price?: boolean
  subscription_id?: string | null
  refunded?: boolean
}

export interface GumroadClient {
  getSale(id: string): Promise<GumroadSale>
  getSubscriber(id: string): Promise<GumroadSubscriber>
}

export class GumroadApiError extends Error {
  readonly status: number
  readonly code: "not_found" | "unauthorized" | "gumroad_error"
  readonly retryable: boolean
  constructor(status: number, message: string) {
    super(message)
    this.name = "GumroadApiError"
    this.status = status
    this.code = status === 404 ? "not_found" : status === 401 ? "unauthorized" : "gumroad_error"
    // 문서의 서버 오류(500·502·503·504)와 네트워크 오류(status 0)는 다시 해 볼 수 있다
    this.retryable = status === 0 || status >= 500
  }
}

/** 액세스 토큰 값은 오류·로그에 싣지 않는다 */
export function createGumroadClient(options: { accessToken: string; fetch?: typeof fetch }): GumroadClient {
  if (!options.accessToken) throw new Error("GUMROAD_ACCESS_TOKEN is missing (owner action: Gumroad OAuth app access token — register D161)")
  const doFetch = options.fetch ?? ((input: string | URL | Request, init?: RequestInit) => fetch(input, init))
  async function get<T>(path: string, key: string): Promise<T> {
    let res: Response
    try {
      res = await doFetch(`${GUMROAD_API}${path}`, { headers: { authorization: `Bearer ${options.accessToken}`, accept: "application/json" } })
    } catch (e) {
      throw new GumroadApiError(0, `network: ${e instanceof Error ? e.name : "error"}`)
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !body || body.success !== true) {
      const message = body && typeof body.message === "string" ? body.message : `HTTP ${res.status}`
      throw new GumroadApiError(res.ok ? 502 : res.status, message)
    }
    const value = body[key]
    if (!value || typeof value !== "object") throw new GumroadApiError(502, `response has no ${key}`)
    return value as T
  }
  return {
    getSale: (id) => get<GumroadSale>(`/sales/${encodeURIComponent(id)}`, "sale"),
    getSubscriber: (id) => get<GumroadSubscriber>(`/subscribers/${encodeURIComponent(id)}`, "subscribers"),
  }
}
