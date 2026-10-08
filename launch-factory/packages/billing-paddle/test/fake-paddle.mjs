// 가짜 Paddle Billing API(샌드박스 주소 https://sandbox-api.paddle.com 만 받는다). 진짜 SDK(@paddle/paddle-node-sdk 3.10.0)가 전역 fetch 로 부르는
// HTTP 를 여기서 받아, 공식 문서 예시(fixtures/paddle-examples.mjs)와 같은 snake_case 모양으로 답한다 — SDK 엔터티 변환까지 실제처럼 돈다.
// 규칙은 문서로 확인한 것만 흉내 낸다: 항목 변경은 즉시·past_due 면 변경 불가·청구 30분 안 변경 불가·예약 변경이 있으면 다음 기간 청구 방식 불가,
// 일시정지 구독 해지는 즉시가 기본, custom_data 는 거래에서 구독으로 복사. 모르는 경로는 404 로 답해 테스트가 드러나게 한다.
import { createHmac } from "node:crypto"
import { FAILED_PAYMENT, SUBSCRIPTION_ENTITY, TRANSACTION_TOTALS } from "../fixtures/paddle-examples.mjs"

export const BASE = "https://sandbox-api.paddle.com"
/** 테스트 전용 비밀(실제 값 아님) */
export const TEST_WEBHOOK_SECRET = "test-only-webhook-secret-not-real"

const clone = (v) => structuredClone(v)
const DAY = 24 * 3600 * 1000

/** Paddle-Signature 헤더(ts=…;h1=HMAC-SHA256(ts:raw)) — https://developer.paddle.com/webhooks/signature-verification */
export function signature(raw, { secret = TEST_WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000) } = {}) {
  const h1 = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")
  return `ts=${ts};h1=${h1}`
}

let seq = 0
/** Paddle 모양 id(접두사_ 26자 소문자·숫자) */
const pid = (prefix) => `${prefix}_${(Date.now().toString(36) + (++seq).toString(36).padStart(8, "0")).padStart(26, "0").slice(-26)}`

function addInterval(d, interval) {
  const x = new Date(d)
  if (interval === "year") x.setUTCFullYear(x.getUTCFullYear() + 1)
  else x.setUTCMonth(x.getUTCMonth() + 1)
  return x
}

/**
 * @param {{ prices: Record<string, { amount: number, currency: string, interval: "month"|"year", trialDays?: number }>, onCheckout?: (txn: any) => Promise<void> }} opts
 */
export function createFakePaddle({ prices, onCheckout } = { prices: {} }) {
  const subs = new Map()
  const txns = new Map()
  const discounts = new Map()
  const calls = []
  const failures = [] // { method, path: RegExp, status, code, times }
  const stale = new Map() // subId → 다음 GET 한 번에 돌려줄 옛 스냅숏
  let last = 0
  /** 단조 증가 시각(ms 단위 — 실제 Paddle 은 마이크로초) */
  const stamp = () => {
    last = Math.max(Date.now(), last + 1)
    return new Date(last)
  }
  const iso = (d) => d.toISOString()

  const priceJson = (priceId) => {
    const p = prices[priceId]
    if (!p) throw Object.assign(new Error(`fake: unknown price ${priceId}`), { status: 404, code: "entity_not_found" })
    const base = clone(SUBSCRIPTION_ENTITY.items[0].price)
    return {
      ...base,
      id: priceId,
      description: priceId,
      billing_cycle: { frequency: 1, interval: p.interval },
      trial_period: p.trialDays ? { interval: "day", frequency: p.trialDays, requires_payment_method: true } : null,
      unit_price: { amount: String(p.amount), currency_code: p.currency },
    }
  }

  function makeSub({ status, priceId, customData = null, at = stamp() }) {
    const s = clone(SUBSCRIPTION_ENTITY)
    const p = prices[priceId]
    s.id = pid("sub")
    s.customer_id = pid("ctm") // 구독마다 다른 고객(포털 소유 검사 — Task 19 D75)
    s.status = status
    s.custom_data = customData
    s.currency_code = p.currency
    s.created_at = s.started_at = s.first_billed_at = iso(at)
    s.scheduled_change = null
    s.discount = null
    s.paused_at = null
    s.canceled_at = null
    s.items[0].price = priceJson(priceId)
    s.items[0].quantity = 1
    s.items[0].trial_dates = null
    s.billing_cycle = { frequency: 1, interval: p.interval }
    const end = status === "trialing" ? new Date(at.getTime() + p.trialDays * DAY) : addInterval(at, p.interval)
    s.current_billing_period = { starts_at: iso(at), ends_at: iso(end) }
    s.next_billed_at = iso(end)
    if (status === "trialing") {
      s.items[0].trial_dates = { starts_at: iso(at), ends_at: iso(end) }
      s.first_billed_at = null
    }
    s.updated_at = iso(at)
    subs.set(s.id, s)
    return s
  }

  const touch = (s) => {
    s.updated_at = iso(stamp())
    return s
  }

  const error = (status, code, detail = code) => {
    return Object.assign(new Error(detail), { status, code })
  }

  function subOr404(id) {
    const s = subs.get(id)
    if (!s) throw error(404, "entity_not_found", `subscription ${id} not found`)
    return s
  }

  function patchSub(s, body) {
    const changesItems = Array.isArray(body.items)
    if (changesItems || body.next_billed_at) {
      if (!body.proration_billing_mode) throw error(400, "bad_request", "proration_billing_mode is required when changing items")
      if (s.status === "past_due") throw error(400, "subscription_locked_past_due", "past_due subscriptions cannot be changed")
      const next = s.next_billed_at ? Date.parse(s.next_billed_at) : null
      if (next !== null && next - Date.now() < 30 * 60_000) throw error(400, "subscription_locked_renewal", "next billing is within 30 minutes")
      if (s.scheduled_change && ["prorated_next_billing_period", "full_next_billing_period"].includes(body.proration_billing_mode)) {
        throw error(400, "subscription_invalid_billing_mode_for_scheduled_change")
      }
    }
    if (changesItems) {
      s.items = body.items.map((it) => ({ ...clone(s.items[0]), price: priceJson(it.price_id), quantity: it.quantity ?? 1, trial_dates: s.items[0].trial_dates }))
    }
    if ("custom_data" in body) s.custom_data = body.custom_data
    if ("scheduled_change" in body) {
      const sc = body.scheduled_change
      s.scheduled_change = sc ? { action: sc.action, effective_at: sc.effective_at, resume_at: sc.resume_at ?? null } : null
    }
    if ("discount" in body) {
      const d = body.discount ? discounts.get(body.discount.id) : null
      if (body.discount && !d) throw error(404, "entity_not_found", "discount not found")
      s.discount = d ? { id: d.id, starts_at: s.next_billed_at, ends_at: null } : null
    }
    return touch(s)
  }

  const routes = [
    ["POST", /^\/transactions$/, async (_m, body) => {
      const at = stamp()
      const id = pid("txn")
      const txn = {
        id,
        status: "ready",
        customer_id: null,
        address_id: null,
        business_id: null,
        custom_data: body.custom_data ?? null,
        currency_code: prices[body.items[0].price_id]?.currency ?? "USD",
        origin: "api",
        subscription_id: null,
        invoice_id: null,
        invoice_number: null,
        collection_mode: "automatic",
        discount_id: null,
        billing_details: null,
        billing_period: null,
        items: body.items.map((it) => ({ price: priceJson(it.price_id), quantity: it.quantity, proration: null })),
        details: null,
        payments: [],
        checkout: { url: `https://shop.example.test/pay?_ptxn=${id}` },
        created_at: iso(at),
        updated_at: iso(at),
        billed_at: null,
      }
      txns.set(id, txn)
      if (onCheckout) await onCheckout(clone(txn))
      return clone(txn)
    }],
    ["GET", /^\/transactions$/, async (_m, _b, url) => {
      const subId = url.searchParams.get("subscription_id")
      const status = url.searchParams.get("status")
      return [...txns.values()].filter((t) => (!subId || t.subscription_id === subId) && (!status || t.status === status)).map(clone)
    }],
    ["GET", /^\/subscriptions\/([^/]+)$/, async (m) => {
      if (stale.has(m[1])) {
        const old = stale.get(m[1])
        stale.delete(m[1])
        return old
      }
      return clone(subOr404(m[1]))
    }],
    ["PATCH", /^\/subscriptions\/([^/]+)$/, async (m, body) => clone(patchSub(subOr404(m[1]), body))],
    ["POST", /^\/subscriptions\/([^/]+)\/cancel$/, async (m, body) => {
      const s = subOr404(m[1])
      if (s.status === "canceled") throw error(400, "subscription_update_when_canceled")
      const immediately = body?.effective_from === "immediately" || (s.status === "paused" && !body?.effective_from)
      if (immediately) {
        const at = stamp()
        s.status = "canceled"
        s.canceled_at = iso(at)
        s.scheduled_change = null
        s.current_billing_period = null
        s.next_billed_at = null
        s.paused_at = null
      } else {
        if (!s.current_billing_period) throw error(400, "subscription_no_billing_period", "cannot cancel at next billing period")
        s.scheduled_change = { action: "cancel", effective_at: s.current_billing_period.ends_at, resume_at: null }
      }
      return clone(touch(s))
    }],
    ["POST", /^\/subscriptions\/([^/]+)\/pause$/, async (m, body) => {
      const s = subOr404(m[1])
      if (s.scheduled_change?.action === "cancel") throw error(400, "subscription_locked_pending_changes", "remove the scheduled cancellation first")
      if (body?.effective_from !== "immediately") {
        s.scheduled_change = { action: "pause", effective_at: s.current_billing_period.ends_at, resume_at: body?.resume_at ?? null }
        return clone(touch(s))
      }
      const at = stamp()
      s.status = "paused"
      s.paused_at = iso(at)
      s.current_billing_period = null
      s.next_billed_at = null
      s.scheduled_change = body.resume_at ? { action: "resume", effective_at: body.resume_at, resume_at: null } : null
      return clone(touch(s))
    }],
    ["POST", /^\/subscriptions\/([^/]+)\/resume$/, async (m) => {
      const s = subOr404(m[1])
      if (s.status !== "paused") throw error(400, "subscription_is_not_paused")
      const at = stamp()
      const interval = s.billing_cycle.interval
      s.status = "active"
      s.paused_at = null
      s.scheduled_change = null
      s.current_billing_period = { starts_at: iso(at), ends_at: iso(addInterval(at, interval)) }
      s.next_billed_at = s.current_billing_period.ends_at
      return clone(touch(s))
    }],
    ["GET", /^\/subscriptions\/([^/]+)\/update-payment-method-transaction$/, async (m) => {
      const s = subOr404(m[1])
      const at = stamp()
      const id = pid("txn")
      return { ...clone([...txns.values()][0] ?? {}), id, status: "ready", subscription_id: s.id, items: [], payments: [], details: null, checkout: { url: `https://shop.example.test/pay?_ptxn=${id}` }, created_at: iso(at), updated_at: iso(at), custom_data: null, currency_code: s.currency_code, collection_mode: "automatic", origin: "subscription_payment_method_change" }
    }],
    // 고객 포털 세션(https://developer.paddle.com/build/customers/integrate-customer-portal.md): 그 고객의 구독만 딥 링크를 준다
    ["POST", /^\/customers\/([^/]+)\/portal-sessions$/, async (m, body) => {
      const ids = body?.subscription_ids ?? []
      for (const id of ids) if (subOr404(id).customer_id !== m[1]) throw error(400, "invalid_field", "subscription does not belong to customer")
      const token = pid("pga")
      const portal = "https://customer-portal.paddle.test/cpl_test"
      return {
        id: pid("cpls"),
        customer_id: m[1],
        urls: {
          general: { overview: `${portal}?action=overview&token=${token}` },
          subscriptions: ids.map((id) => ({
            id,
            cancel_subscription: `${portal}?action=cancel_subscription&subscription_id=${id}&token=${token}`,
            update_subscription_payment_method: `${portal}?action=update_subscription_payment_method&subscription_id=${id}&token=${token}`,
          })),
        },
        created_at: iso(stamp()),
      }
    }],
    ["POST", /^\/discounts$/, async (_m, body) => {
      const at = stamp()
      const d = {
        id: pid("dsc"),
        status: "active",
        description: body.description,
        enabled_for_checkout: body.enabled_for_checkout ?? false,
        code: null,
        mode: "standard",
        type: body.type,
        amount: body.amount,
        currency_code: null,
        recur: body.recur ?? false,
        maximum_recurring_intervals: body.maximum_recurring_intervals ?? null,
        usage_limit: null,
        restrict_to: null,
        expires_at: null,
        custom_data: null,
        times_used: 0,
        created_at: iso(at),
        updated_at: iso(at),
        import_meta: null,
      }
      discounts.set(d.id, d)
      return clone(d)
    }],
  ]

  async function fetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url)
    if (url.origin !== BASE) throw new Error(`fake paddle: unexpected host ${url.origin}`)
    const method = (init.method ?? "GET").toUpperCase()
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, query: url.search, body })
    const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } })
    const f = failures.find((x) => x.method === method && x.path.test(url.pathname) && x.times > 0)
    if (f) {
      f.times -= 1
      return json(f.status, { error: { type: f.status >= 500 ? "api_error" : "request_error", code: f.code, detail: f.code, documentation_url: "https://developer.paddle.com/errors/overview" }, meta: { request_id: "fake" } })
    }
    for (const [m, re, handler] of routes) {
      const match = m === method && url.pathname.match(re)
      if (!match) continue
      try {
        const data = await handler(match, body, url)
        if (Array.isArray(data)) return json(200, { data, meta: { request_id: "fake", pagination: { per_page: 50, next: `${BASE}${url.pathname}?after=end`, has_more: false, estimated_total: data.length } } })
        return json(200, { data, meta: { request_id: "fake" } })
      } catch (e) {
        return json(e.status ?? 500, { error: { type: (e.status ?? 500) >= 500 ? "api_error" : "request_error", code: e.code ?? "internal_error", detail: e.message, documentation_url: "https://developer.paddle.com/errors/overview" }, meta: { request_id: "fake" } })
      }
    }
    return json(404, { error: { type: "request_error", code: "not_found", detail: `fake: no route ${method} ${url.pathname}`, documentation_url: "" }, meta: { request_id: "fake" } })
  }

  /** 이벤트 봉투(공식 예시와 같은 최상위 칸) */
  function envelope(eventType, data, occurredAt = stamp()) {
    return { event_id: pid("evt"), event_type: eventType, occurred_at: occurredAt.toISOString(), notification_id: pid("ntf"), data: clone(data) }
  }

  /** 손님이 호스팅 결제창에서 결제를 끝냈다: 구독을 만들고(custom_data 복사) 이벤트를 돌려준다 */
  function completeCheckout(txnId) {
    const txn = txns.get(txnId)
    const priceId = txn.items[0].price.id
    const trial = !!prices[priceId].trialDays
    const at = stamp()
    const s = makeSub({ status: trial ? "trialing" : "active", priceId, customData: txn.custom_data, at })
    txn.status = "completed"
    txn.subscription_id = s.id
    txn.billed_at = iso(at)
    txn.updated_at = iso(stamp())
    const amount = trial ? 0 : prices[priceId].amount
    txn.details = { tax_rates_used: [], totals: { ...TRANSACTION_TOTALS, total: String(amount), grand_total: String(amount), subtotal: String(amount), tax: "0", grand_total_tax: "0", balance: "0", currency_code: prices[priceId].currency }, adjusted_totals: null, payout_totals: null, adjusted_payout_totals: null, line_items: [] }
    return [envelope("subscription.created", s), envelope("transaction.completed", txn)]
  }

  /** 장면 준비: 상태를 바로 가진 구독을 만든다(past_due 면 결제 실패 거래도) */
  function seed({ status, priceId, customData, paymentError = "declined", resumeAt }) {
    const s = makeSub({ status: status === "past_due" || status === "paused" || status === "canceled" ? "active" : status, priceId, customData })
    if (status === "past_due") {
      s.status = "past_due"
      const at = stamp()
      const id = pid("txn")
      txns.set(id, {
        id, status: "past_due", customer_id: null, address_id: null, business_id: null, custom_data: customData, currency_code: s.currency_code, origin: "subscription_recurring",
        subscription_id: s.id, invoice_id: null, invoice_number: null, collection_mode: "automatic", discount_id: null, billing_details: null, billing_period: null,
        items: [{ price: priceJson(priceId), quantity: 1, proration: null }], details: null,
        payments: [{ ...clone(FAILED_PAYMENT), error_code: paymentError, created_at: iso(at) }], checkout: null, created_at: iso(at), updated_at: iso(at), billed_at: iso(at),
      })
    }
    if (status === "paused") {
      s.status = "paused"
      s.paused_at = iso(stamp())
      s.current_billing_period = null
      s.next_billed_at = null
      s.scheduled_change = { action: "resume", effective_at: resumeAt ?? iso(new Date(Date.now() + 60 * DAY)), resume_at: null }
    }
    if (status === "canceled") {
      s.status = "canceled"
      s.canceled_at = iso(stamp())
      s.current_billing_period = null
      s.next_billed_at = null
    }
    touch(s)
    return clone(s)
  }

  return {
    fetch,
    calls,
    subs,
    txns,
    completeCheckout,
    seed,
    envelope,
    /** 저장된 구독을 직접 바꾼다(다른 경로 — 고객 포털 등 — 에서 바뀐 것처럼) */
    mutate(subId, fn) {
      const s = subOr404(subId)
      fn(s)
      return clone(touch(s))
    },
    get: (subId) => clone(subOr404(subId)),
    /** 다음 GET /subscriptions/:id 한 번이 이 옛 스냅숏을 돌려준다(먼저 읽고 늦게 쓰는 처리기 흉내) */
    serveStale(subId, snapshot) {
      stale.set(subId, clone(snapshot))
    },
    /** 다음 method·path 호출 times 번을 status 로 실패시킨다 */
    failNext(method, path, status = 500, code = "internal_error", times = 1) {
      failures.push({ method, path, status, code, times })
    },
    count: (method, re) => calls.filter((c) => c.method === method && re.test(c.path)).length,
  }
}

/** 전역 fetch 를 가짜 Paddle 로 돌린다(다른 주소는 원래 fetch). 되돌리는 함수를 돌려준다 */
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

/** 서명된 웹훅 요청 */
export function webhookRequest(envelope, { secret, ts, tamper, headers } = {}) {
  const raw = typeof envelope === "string" ? envelope : JSON.stringify(envelope)
  const sig = signature(raw, { secret, ts })
  const body = tamper ? tamper(raw) : raw
  return new Request("https://app.example.test/api/webhooks/paddle", { method: "POST", body, headers: { "paddle-signature": sig, "content-type": "application/json", ...headers } })
}
