// 가짜 Gumroad API(https://api.gumroad.com/v2) — 어댑터의 진짜 fetch 클라이언트가 부르는 GET /sales/:id·GET /subscribers/:id 에
// 공식 문서 예시(fixtures/gumroad-examples.mjs)와 같은 모양으로 답한다. 판매 알림 본문도 문서 매개변수 표 그대로 만든다
// (x-www-form-urlencoded, url_params[...] 괄호 키 — https://gumroad.com/ping).
import { randomBytes } from "node:crypto"
import { ERROR_RESPONSE, SALE_RESPONSE, SUBSCRIBER_RESPONSE } from "../fixtures/gumroad-examples.mjs"

export const TEST_ACCESS_TOKEN = "test-gumroad-token-not-real"
export const TEST_PING_SECRET = "test-ping-secret-not-real"
const BASE = "https://api.gumroad.com/v2"
const DAY = 24 * 3600 * 1000
const gid = () => randomBytes(16).toString("base64").replace(/\//g, "_")

export function createFakeGumroad({ products, now = () => new Date() }) {
  const sales = new Map()
  const subscribers = new Map()
  const calls = []

  function fetchImpl(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url)
    const auth = new Headers(init.headers).get("authorization")
    calls.push({ path: url.pathname, auth: !!auth })
    const reply = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))
    if (fake.failNext) {
      const status = fake.failNext
      fake.failNext = 0
      return reply(status, { success: false, message: "Something went wrong." })
    }
    if (auth !== `Bearer ${TEST_ACCESS_TOKEN}`) return reply(401, { success: false, message: "The access token is invalid." })
    let m = url.pathname.match(/^\/v2\/sales\/([^/]+)$/)
    if (m) {
      const s = fake.hidden.has(decodeURIComponent(m[1])) ? undefined : sales.get(decodeURIComponent(m[1]))
      return s ? reply(200, { success: true, sale: structuredClone(s) }) : reply(404, ERROR_RESPONSE)
    }
    m = url.pathname.match(/^\/v2\/subscribers\/([^/]+)$/)
    if (m) {
      const s = subscribers.get(decodeURIComponent(m[1]))
      return s ? reply(200, { success: true, subscribers: structuredClone(s) }) : reply(404, ERROR_RESPONSE)
    }
    return reply(404, ERROR_RESPONSE)
  }

  /** 구독 하나 + 첫 판매. productId 는 우리 설정의 상품 id */
  function purchase({ productId, urlParams = {}, trial = false, email = "calvin@gumroad.com", at = now() }) {
    const product = products[productId]
    if (!product) throw new Error(`fake: unknown product ${productId}`)
    const sub = {
      ...SUBSCRIBER_RESPONSE.subscribers,
      id: gid(),
      product_id: productId,
      product_name: product.name,
      user_email: email,
      created_at: at.toISOString(),
      recurrence: product.recurrence,
      free_trial_ends_at: trial ? new Date(at.getTime() + product.trialDays * DAY).toISOString() : null,
      status: "alive",
      purchase_ids: [],
    }
    const sale = charge(sub, { at, email })
    subscribers.set(sub.id, sub)
    return { sub, sale, ping: salePing(sale, { urlParams }) }
  }

  /** 청구 한 번(새 판매) */
  function charge(sub, { at = now(), email = sub.user_email } = {}) {
    const product = products[sub.product_id]
    const sale = { ...SALE_RESPONSE.sale, id: gid(), email, created_at: at.toISOString(), product_id: sub.product_id, product_name: product.name, price: product.price, currency: "usd", subscription_id: sub.id, subscription_duration: sub.recurrence, recurring_charge: sub.purchase_ids.length > 0 }
    sub.purchase_ids = [...sub.purchase_ids, sale.id]
    sales.set(sale.id, sale)
    return sale
  }

  /** 판매 알림 본문(문서 매개변수 이름) */
  function salePing(sale, { urlParams = {}, resource = "sale", overrides = {} } = {}) {
    const p = new URLSearchParams()
    p.set("sale_id", sale.id)
    p.set("sale_timestamp", sale.created_at)
    p.set("seller_id", sale.seller_id)
    p.set("product_id", sale.product_id)
    p.set("product_name", sale.product_name)
    p.set("email", sale.email)
    p.set("price", String(sale.price))
    if (sale.subscription_id) p.set("subscription_id", sale.subscription_id)
    p.set("recurrence", sale.subscription_duration ?? "")
    p.set("refunded", resource === "refund" ? "true" : "false")
    p.set("resource_name", resource)
    for (const [k, v] of Object.entries(urlParams)) p.set(`url_params[${k}]`, v)
    for (const [k, v] of Object.entries(overrides)) p.set(k, v)
    return p.toString()
  }

  /** 구독 알림 본문(cancellation 등, 문서 「In each POST request, Gumroad sends these parameters」) */
  function subscriptionPing(subId, resource, extra = {}) {
    const s = subscribers.get(subId)
    const p = new URLSearchParams()
    p.set("subscription_id", s.id)
    p.set("product_id", s.product_id)
    p.set("product_name", s.product_name)
    p.set("user_id", s.user_id)
    p.set("user_email", s.user_email)
    for (const id of s.purchase_ids) p.append("purchase_ids[]", id)
    p.set("created_at", s.created_at)
    p.set("recurrence", s.recurrence)
    p.set("resource_name", resource)
    for (const [k, v] of Object.entries(extra)) p.set(k, v)
    return p.toString()
  }

  const fake = {
    fetch: fetchImpl,
    calls,
    failNext: 0,
    /** 아직 API 에 안 보이는 판매 id(방금 만든 판매가 재조회에 늦게 나타나는 경우) */
    hidden: new Set(),
    purchase,
    charge,
    salePing,
    subscriptionPing,
    get: (id) => structuredClone(subscribers.get(id)),
    mutate(id, fn) {
      fn(subscribers.get(id))
    },
    /** 손님이 「Manage membership」에서 해지(기간 끝까지 이용) */
    requestCancel(id, cancelAt) {
      const s = subscribers.get(id)
      s.status = "pending_cancellation"
      s.user_requested_cancellation_at = now().toISOString()
      s.cancelled_at = cancelAt.toISOString()
      return subscriptionPing(id, "cancellation", { cancelled: "true", cancelled_at: s.cancelled_at, cancelled_by_buyer: "true" })
    },
    /** 구독에 속하지 않는 단발 판매를 심는다 */
    seedSale(sale) {
      sales.set(sale.id, sale)
    },
    seedSubscriber(sub) {
      subscribers.set(sub.id, sub)
    },
  }
  return fake
}

export function installFetch(fake) {
  const original = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url
    return url.startsWith(BASE) ? fake.fetch(input, init) : original(input, init)
  }
  return () => {
    globalThis.fetch = original
  }
}

/** 알림 요청(Gumroad 가 post_url 로 보내는 POST). key 를 주지 않으면 맞는 공유 비밀 */
export function pingRequest(body, { key = TEST_PING_SECRET, contentType = "application/x-www-form-urlencoded" } = {}) {
  const url = key === null ? "https://app.example.test/api/webhooks/gumroad" : `https://app.example.test/api/webhooks/gumroad?key=${encodeURIComponent(key)}`
  return new Request(url, { method: "POST", body, headers: { "content-type": contentType } })
}
