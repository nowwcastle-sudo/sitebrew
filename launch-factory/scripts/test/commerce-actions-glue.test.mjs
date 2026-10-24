// 상점 서버 액션(계획 3a B6) — 레지스트리가 싣는 진짜 파일(app/actions/commerce.ts)과 진짜 조립(lib/launch/commerce.ts · payments.ts · catalog.ts ·
// feature-security 의 guardAction → 진짜 제한기 + PGlite)을 그대로 불러 쓴다. 세션·설정·DB 핸들·메일만 대역이다. 모드는 mock(모의 결제).
// 지키는 것: 로그아웃 거절 · userId 는 세션에서만 · 승인 행동의 확인 입력 · 요청 제한 · 대리 로그인 차단 · 남의 주문 불가 · 모의 결제 한 바퀴. 관리자 쪽(주문 앞걸음·취소·재고)은 관리 화면 구획이 맡는다 — commerce-admin-section-glue.test.mjs.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq, sql } from "drizzle-orm"
import { db, orders, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  mailer: ["mailer"],
  security: ["guardAction"],
})

const at = new Date("2026-10-22T00:00:00.000Z")
const ADDRESS = { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1" }
let d
let session = null
let ip = "203.0.113.50"
const sent = []

const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)
const ordersOf = async (userId) => d.select().from(orders).where(eq(orders.userId, userId))
const stockOf = async (sku) => (await d.execute(sql`select quantity from stock_levels where sku = ${sku}`)).rows[0]?.quantity

let shop

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  for (const id of ["u1", "u2"]) {
    await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  }
  const mock = createMailer({ mode: "mock", log: () => {} })
  stubs.config = { PRODUCT_NAME: "예시 상점", DEFAULT_LOCALE: "ko", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.mailer = { mailer: () => ({ mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) }) }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": ip }) }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  shop = await importRegistryFile("feature-commerce/files/app/actions/commerce.ts")
})
after(async () => {
  await d?.$client.close()
})

const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}

test("로그아웃이면 모든 상점 액션이 sign_in_required 이고 아무것도 쓰지 않는다", async () => {
  setSession(null)
  const calls = [
    () => shop.catalog(),
    () => shop.cart(),
    () => shop.setCartLine({ productId: "example-mug", quantity: 1 }),
    () => shop.placeOrder({ address: ADDRESS, confirmed: true }),
    () => shop.confirmPayment({ orderId: "x", paymentId: "y" }),
    () => shop.orders(),
    () => shop.order({ orderId: "x" }),
    () => shop.cancelOrder({ orderId: "x", confirmed: true }),
    () => shop.payWithMock({ orderId: "x" }),
  ]
  for (const call of calls) {
    const r = await call()
    assert.equal(r.ok, false)
    assert.equal(r.code, "sign_in_required")
    assert.equal(r.retryable, false)
  }
  assert.equal((await d.select().from(orders)).length, 0)
})

test("한 바퀴: 담기 → 확인 없이 주문은 승인 대기 → 주문 → 모의 결제 → 메일 한 통 → 내 주문 → 취소는 확인이 있어야 환불", async () => {
  ip = "203.0.113.51"
  setSession("u1")
  const items = ok(await shop.catalog())
  assert.deepEqual(items.map((i) => i.id), ["example-mug", "example-tote", "example-notebook"])
  // 입력의 userId 는 읽지 않는다 — u2 의 장바구니는 비어 있다
  const added = ok(await shop.setCartLine({ productId: "example-mug", quantity: 2, userId: "u2" }))
  assert.equal(added.lines.length, 1)
  assert.equal(added.total.amount, 24000 + 3000)
  setSession("u2")
  assert.equal(ok(await shop.cart()).lines.length, 0, "u2 는 u1 의 장바구니를 못 본다")
  setSession("u1")

  const gated = await shop.placeOrder({ address: ADDRESS })
  assert.equal(gated.ok, false)
  assert.equal(gated.code, "confirmation_required")
  assert.equal((await ordersOf("u1")).length, 0, "확인 없이는 주문이 생기지 않는다")
  assert.equal(await stockOf("example-mug"), undefined, "재고도 건드리지 않았다")

  const placed = ok(await shop.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.equal(placed.order.status, "pending_payment")
  assert.equal(placed.payment.provider, "mock")
  assert.equal(placed.payment.total.amount, 27000)
  assert.equal(await stockOf("example-mug"), 18)

  const paid = ok(await shop.payWithMock({ orderId: placed.order.id }))
  assert.equal(paid.status, "paid")
  assert.equal(sent.length, 1, "주문 확인 메일은 결제가 확정될 때 한 통")
  assert.ok(paid.paidAt)
  // 같은 확정을 한 번 더 불러도 상태·메일은 그대로(멱등)
  assert.equal(ok(await shop.payWithMock({ orderId: placed.order.id })).status, "paid")
  assert.equal(sent.length, 1)

  assert.deepEqual(ok(await shop.orders()).map((o) => o.id), [placed.order.id])
  assert.equal(ok(await shop.order({ orderId: placed.order.id })).status, "paid")

  const unconfirmed = await shop.cancelOrder({ orderId: placed.order.id })
  assert.equal(unconfirmed.code, "confirmation_required")
  assert.equal(ok(await shop.order({ orderId: placed.order.id })).status, "paid")
  const canceled = ok(await shop.cancelOrder({ orderId: placed.order.id, reason: "마음이 바뀌었어요", confirmed: true }))
  assert.equal(canceled.status, "refunded")
  assert.equal(await stockOf("example-mug"), 20, "환불하면 재고가 돌아온다")
})

test("남의 주문은 보이지도 취소·결제 확정도 안 된다(not_found)", async () => {
  ip = "203.0.113.52"
  setSession("u1")
  ok(await shop.setCartLine({ productId: "example-tote", quantity: 1 }))
  const placed = ok(await shop.placeOrder({ address: ADDRESS, confirmed: true }))
  setSession("u2")
  assert.equal((await shop.order({ orderId: placed.order.id })).code, "not_found")
  assert.deepEqual(ok(await shop.orders()), [])
  assert.equal((await shop.cancelOrder({ orderId: placed.order.id, confirmed: true })).code, "not_found")
  assert.equal((await shop.payWithMock({ orderId: placed.order.id })).code, "not_found")
  assert.equal((await shop.confirmPayment({ orderId: placed.order.id, paymentId: placed.payment.paymentId })).code, "not_found")
  assert.equal((await ordersOf("u1")).find((o) => o.id === placed.order.id).status, "pending_payment", "남의 시도로 상태가 변하지 않는다")
  setSession("u1")
  ok(await shop.cancelOrder({ orderId: placed.order.id, confirmed: true }))
})

test("요청 제한: 주문하기는 60초 5번 — 한도 밖은 rate_limited(기계 값·retryAfter)로 막히고 장바구니·주문에 닿지 않는다", async () => {
  ip = "203.0.113.53"
  setSession("u2")
  const max = RATE_LIMIT_DEFAULTS.shopOrder.max
  for (let i = 0; i < max; i++) assert.equal((await shop.placeOrder({ address: ADDRESS, confirmed: true })).code, "empty_cart", `${i + 1}번째는 통과(빈 장바구니)`)
  const refused = await shop.placeOrder({ address: ADDRESS, confirmed: true })
  assert.equal(refused.ok, false)
  assert.equal(refused.code, "rate_limited")
  assert.equal(refused.retryable, true)
  assert.ok(Number.isInteger(refused.retryAfter) && refused.retryAfter >= 1 && refused.retryAfter <= 60)
  // 읽기는 제한하지 않는다
  assert.equal((await shop.cart()).ok, true)
  // 다른 사용자(같은 IP)는 영향이 없다 — 한도는 사용자·IP 별이다
  setSession("u1")
  assert.equal((await shop.placeOrder({ address: ADDRESS, confirmed: true })).code, "empty_cart")
})

test("대리 로그인 중에는 읽기만 된다 — 쓰기·모의 결제는 상점 포트와 모의 게이트웨이에 닿기 전에 403", async () => {
  ip = "203.0.113.54"
  setSession("u1")
  ok(await shop.setCartLine({ productId: "example-notebook", quantity: 1 }))
  const placed = ok(await shop.placeOrder({ address: ADDRESS, confirmed: true }))
  setSession("u1", { impersonatedBy: "root" })
  assert.equal((await shop.cart()).ok, true)
  assert.equal((await shop.orders()).ok, true)
  assert.equal((await shop.order({ orderId: placed.order.id })).ok, true)
  for (const r of [
    await shop.setCartLine({ productId: "example-notebook", quantity: 5 }),
    await shop.placeOrder({ address: ADDRESS, confirmed: true }),
    await shop.cancelOrder({ orderId: placed.order.id, confirmed: true }),
    await shop.payWithMock({ orderId: placed.order.id }),
    await shop.confirmPayment({ orderId: placed.order.id, paymentId: placed.payment.paymentId }),
  ]) {
    assert.equal(r.ok, false)
    assert.equal(r.code, "impersonation_blocked")
  }
  setSession("u1")
  assert.equal(ok(await shop.order({ orderId: placed.order.id })).status, "pending_payment", "대리 세션이 모의 결제를 일으키지 못했다")
  ok(await shop.cancelOrder({ orderId: placed.order.id, confirmed: true }))
})
