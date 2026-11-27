// 토스 테스트 API 기초 계층. 발급·승인은 호출자가 영구 저장과 중복 방지를 먼저 보장해야 한다.
// 실키는 허용하지 않는다. 외부 네트워크를 시험에서 우연히 부르지 않도록 fetch를 반드시 주입한다.
const ROOT = "https://api.tosspayments.com"
const CUSTOMER = /^[A-Za-z0-9_=.@-]{22,50}$/
const ORDER = /^[A-Za-z0-9_=-]{6,64}$/
const testClients = new WeakMap<object, string>()
export function testMerchant(value: unknown): string | null { return typeof value === "object" && value !== null ? testClients.get(value) ?? null : null }
export function isTestTossClient(value: unknown): boolean { return testMerchant(value) !== null }

export class TossApiError extends Error {
  readonly status: number
  constructor(status: number) { super("Toss API request failed"); this.name = "TossApiError"; this.status = status }
}
export class TossResponseError extends Error {
  constructor() { super("Invalid Toss response"); this.name = "TossResponseError" }
}
// 토스 자동결제 승인 API가 명시한 카드 한도·잔액 거절만 확정한다.
export class TossCardDeclined extends Error {
  constructor() { super("Toss card declined"); this.name = "TossCardDeclined" }
}
export interface TossTestClientOptions {
  secretKey: string
  merchantId: string
  fetch: typeof fetch
}
export interface TossPayment {
  paymentKey: string
  orderId: string
  amount: number
}
type ObjectValue = Record<string, unknown>
function object(value: unknown): value is ObjectValue { return typeof value === "object" && value !== null && !Array.isArray(value) }
function key(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max && !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}
function pathKey(value: string): boolean { return key(value, 200) && value !== "." && value !== ".." }
function payment(value: unknown, expected: { merchantId: string; orderId: string; amount: number }): TossPayment {
  if (!object(value) || value.mId !== expected.merchantId || value.orderId !== expected.orderId || value.totalAmount !== expected.amount ||
    value.currency !== "KRW" || value.status !== "DONE" || value.type !== "BILLING" || !object(value.card) ||
    typeof value.paymentKey !== "string" || !key(value.paymentKey, 200)) throw new TossResponseError()
  return { paymentKey: value.paymentKey, orderId: expected.orderId, amount: expected.amount }
}

export function createTestTossClient(options: TossTestClientOptions) {
  if (!/^test_sk_[A-Za-z0-9_-]+$/.test(options.secretKey) || !key(options.merchantId, 100) || typeof options.fetch !== "function") {
    throw new Error("Toss test configuration required")
  }
  const { merchantId, fetch: transport, secretKey } = options
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`
  async function request(path: string, method: "GET" | "POST" | "DELETE", body?: object, charge = false): Promise<unknown> {
    // 응답·예외에 키나 공급자 메시지를 싣지 않는다. 요청 결과가 불명확하면 호출자가 보류한다.
    let response: Response
    try {
      response = await transport(`${ROOT}${path}`, {
        method,
        headers: { Authorization: authorization, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(70_000),
      })
    } catch { throw new TossApiError(0) }
    if (response.status !== 200) {
      if (charge && response.status === 403) {
        let error: unknown
        try { error = await response.json() } catch { /* 불명확한 응답은 보류한다. */ }
        if (object(error) && error.code === "REJECT_CARD_PAYMENT") throw new TossCardDeclined()
      }
      throw new TossApiError(response.status)
    }
    if (method === "DELETE") return undefined
    try { return await response.json() } catch { throw new TossResponseError() }
  }
  const client = {
    async issue(input: { authKey: string; customerKey: string }) {
      if (!key(input.authKey, 300) || !CUSTOMER.test(input.customerKey)) throw new Error("Invalid issue input")
      const result = await request("/v1/billing/authorizations/issue", "POST", { authKey: input.authKey, customerKey: input.customerKey })
      if (!object(result) || result.mId !== merchantId || result.customerKey !== input.customerKey ||
        typeof result.billingKey !== "string" || !pathKey(result.billingKey) || !object(result.card)) throw new TossResponseError()
      return { billingKey: result.billingKey, customerKey: input.customerKey }
    },
    async charge(input: { billingKey: string; customerKey: string; orderId: string; orderName: string; amount: number }) {
      if (!pathKey(input.billingKey) || !CUSTOMER.test(input.customerKey) || !ORDER.test(input.orderId) ||
        !key(input.orderName, 100) || !Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Invalid charge input")
      const { billingKey, ...body } = input
      return payment(await request(`/v1/billing/${encodeURIComponent(billingKey)}`, "POST", body, true), { merchantId, ...body })
    },
    async lookup(input: { orderId: string; amount: number }) {
      if (!ORDER.test(input.orderId) || !Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Invalid lookup input")
      return payment(await request(`/v1/payments/orders/${encodeURIComponent(input.orderId)}`, "GET"), { merchantId, ...input })
    },
    async deleteBillingKey(billingKey: string) {
      if (!pathKey(billingKey)) throw new Error("Invalid billing key")
      await request(`/v1/billing/${encodeURIComponent(billingKey)}`, "DELETE")
    },
  }
  testClients.set(client, merchantId)
  return Object.freeze(client)
}
