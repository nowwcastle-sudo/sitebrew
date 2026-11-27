// 실제 결제와 독립된 개발용 모의 등록. 운영·키 누락·다른 모드는 닫는다.
import { createTestRegistration, createTestRegistrationEndpoints, createTestTossBilling, createTestTossClient, createTestTossLedger } from "@launch-factory/billing-toss"
import { authPort } from "@/lib/launch/auth"
import { database } from "@/lib/launch/db"
import { tossTestDatabase } from "@/lib/launch/toss-test-db"
import { ownTossTestSession, tossTestConfig } from "@/lib/toss-test-config"
export { tossTestConfig } from "@/lib/toss-test-config"

async function fakeTransport(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  // 이것은 토스 응답이 아니다. 화면에서 모의 결과로 표시하며 유료 권한을 만들지 않는다.
  if (String(url) === "https://api.tosspayments.com/v1/billing/fake_billing_key" && init?.method === "DELETE") return new Response(null, { status: 200 })
  let body: unknown
  try { body = JSON.parse(String(init?.body ?? "")) } catch { return new Response(null, { status: 400 }) }
  const customerKey = (body as { customerKey?: unknown } | null)?.customerKey
  if (typeof customerKey !== "string" || init?.method !== "POST") return new Response(null, { status: 400 })
  if (String(url) === "https://api.tosspayments.com/v1/billing/authorizations/issue") return Response.json({ mId: "fake-mid", customerKey, billingKey: "fake_billing_key", card: {} })
  if (String(url) === "https://api.tosspayments.com/v1/billing/fake_billing_key") {
    const { orderId, amount } = body as { orderId?: unknown; amount?: unknown }
    if (typeof orderId !== "string" || typeof amount !== "number") return new Response(null, { status: 400 })
    return Response.json({ mId: "fake-mid", orderId, totalAmount: amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `fake_${orderId}` })
  }
  return new Response(null, { status: 403 })
}

export async function realTossTestSession() {
  const result = await (await authPort()).session()
  return ownTossTestSession(result)
}

export async function tossTestService() {
  const config = tossTestConfig()
  if (!config || !config.merchantId || config.merchantId.length > 100) return null
  const db = tossTestDatabase(await database())
  const client = createTestTossClient({ secretKey: config.secretKey, merchantId: config.merchantId, fetch: config.fake ? fakeTransport : fetch })
  const productId = config.fake ? "test-product-mock" : "test-product-sandbox"
  const plan = { id: "test-monthly", name: "시험 월 구독", interval: "month" as const, price: { amount: 4900, currency: "KRW" as const, vatIncluded: true }, features: [] }
  const registration = createTestRegistration({ db, client, encryptionKey: config.encryptionKey, origin: config.origin, plans: [{ id: plan.id, productId, orderName: plan.name, amount: plan.price.amount }] })
  const endpoints = createTestRegistrationEndpoints({ registration, origin: config.origin, session: realTossTestSession })
  const ledger = createTestTossLedger({ db, client, encryptionKey: config.encryptionKey })
  const billing = createTestTossBilling({ db, ledger, productId, plan, origin: config.origin })
  return { config, productId, registration, endpoints, db, ledger, billing }
}
