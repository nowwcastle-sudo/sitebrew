// 계약 CommercePort 구현 — 도메인 결과가 ActionResult(코드·retryable·문구)로 바뀌는지, 승인 행동 문이 닫혀 있는지, 사용자 범위가 지켜지는지.
import { test, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { MESSAGES } from "@launch-factory/i18n"
import { mockGateway } from "@launch-factory/payments-kr"
import { cartItems, orders } from "@launch-factory/db"
import { commercePort, readCatalog, unavailablePort } from "../src/port.ts"
import { ADDRESS, makeDeps, newDb, stockOf } from "./helpers.mjs"

let d
before(async () => {
  d = await newDb()
})
beforeEach(async () => {
  await d.execute(sql`truncate table order_items, orders, cart_items, stock_levels cascade`)
})
after(async () => {
  await d?.$client.close()
})

const portFor = (userId, over = {}) => {
  const made = makeDeps(d, over)
  return { ...made, port: commercePort({ ...made.deps, userId }) }
}
const data = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}

test("catalog: 상품표 + 지금 남은 재고(DB 가 정본)", async () => {
  const { port } = portFor("buyer")
  const before = data(await port.catalog())
  assert.deepEqual(before.map((i) => [i.id, i.price.amount, i.stock]), [["mug", 12000, 5], ["tote", 8000, null], ["lamp", 60000, 1], ["pen", 1500, 3]])
  data(await port.setCartLine({ productId: "mug", quantity: 2 }))
  data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.equal(data(await port.catalog()).find((i) => i.id === "mug").stock, 3)
})

test("readCatalog: 로그인 없이 상품표 + 남은 재고 — 포트의 catalog() 와 같은 목록", async () => {
  const { port, deps } = portFor("buyer")
  data(await port.setCartLine({ productId: "mug", quantity: 2 }))
  data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  const open = await readCatalog(deps)
  assert.deepEqual(open, data(await port.catalog()))
  assert.equal(open.find((i) => i.id === "mug").stock, 3)
  assert.equal(open.find((i) => i.id === "tote").stock, null)
})

test("setCartLine: 상품 id 와 수량만 읽는다 — 클라이언트가 보낸 가격은 무시, add_to_cart 계측", async () => {
  const { port, events } = portFor("buyer")
  const cart = data(await port.setCartLine({ productId: "mug", quantity: 2, price: 1, unitPrice: { amount: 1 } }))
  assert.deepEqual(cart.lines.map((l) => [l.productId, l.unitPrice.amount, l.quantity]), [["mug", 12000, 2]])
  assert.deepEqual([cart.subtotal.amount, cart.shipping.amount, cart.total.amount], [24000, 3000, 27000])
  assert.deepEqual(events, [{ name: "add_to_cart", props: { productId: "mug", quantity: 2 } }])
  const trimmed = data(await port.setCartLine({ productId: "mug", quantity: 1 }))
  assert.equal(trimmed.lines[0].quantity, 1)
  assert.equal(events.length, 1, "줄이면 계측 없음")
  assert.deepEqual(data(await port.setCartLine({ productId: "mug", quantity: 0 })).lines, [])
})

test("setCartLine 실패: 재고 초과는 out_of_stock + 상품 id 칸 오류, 모르는 상품·잘못된 수량도 code 와 retryable 이 있다", async () => {
  const { port } = portFor("buyer")
  const stock = await port.setCartLine({ productId: "lamp", quantity: 2 })
  assert.equal(stock.ok, false)
  assert.deepEqual([stock.code, stock.retryable], ["out_of_stock", false])
  assert.match(stock.formError, /무드등\(예시\) 재고가 1개만 남았어요/)
  assert.deepEqual(Object.keys(stock.fieldErrors), ["lamp"])
  const unknown = await port.setCartLine({ productId: "nope", quantity: 1 })
  assert.deepEqual([unknown.code, unknown.retryable], ["unknown_product", false])
  const qty = await port.setCartLine({ productId: "mug", quantity: 100 })
  assert.deepEqual([qty.code, qty.formError], ["invalid_quantity", "수량은 1개부터 99개까지 고를 수 있어요."])
  assert.equal((await port.setCartLine(null)).code, "invalid_quantity", "입력이 이상해도 던지지 않는다")
})

test("placeOrder: confirmed 없이는 아무것도 바뀌지 않는다(confirmation_required, 승인 대기 — 오류 아님)", async () => {
  const { port } = portFor("buyer")
  data(await port.setCartLine({ productId: "mug", quantity: 1 }))
  for (const input of [{ address: ADDRESS }, { address: ADDRESS, confirmed: false }, undefined, null, "yes"]) {
    const r = await port.placeOrder(input)
    assert.deepEqual([r.ok, r.code, r.retryable], [false, "confirmation_required", false])
  }
  assert.equal((await d.select().from(orders)).length, 0)
  assert.equal((await d.select().from(cartItems)).length, 1, "장바구니 그대로")
  assert.equal(await stockOf(d, "mug"), undefined, "재고를 건드리지 않았다")
})

test("placeOrder: 확인과 함께면 결제 대기 주문 + 결제 세션(계약 모양: ISO 문자열 날짜·Money)", async () => {
  const { port } = portFor("buyer")
  data(await port.setCartLine({ productId: "mug", quantity: 2 }))
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const { order, payment } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.equal(order.status, "pending_payment")
  assert.deepEqual(order.total, { amount: 35000, currency: "KRW", vatIncluded: true })
  assert.equal(typeof order.createdAt, "string")
  assert.ok(!Number.isNaN(Date.parse(order.createdAt)))
  assert.deepEqual(order.address, ADDRESS)
  assert.deepEqual(order.lines.map((l) => [l.productId, l.name, l.unitPrice.amount, l.quantity]), [["mug", "머그컵(예시)", 12000, 2], ["tote", "에코백(예시)", 8000, 1]])
  assert.equal(payment.provider, "mock")
  assert.deepEqual(payment.total, order.total)
  assert.deepEqual(data(await port.cart()).lines, [])
})

test("placeOrder 실패: 빈 장바구니 · 잘못된 배송지는 칸별 오류 · 재고 부족", async () => {
  const { port } = portFor("buyer")
  assert.equal((await port.placeOrder({ address: ADDRESS, confirmed: true })).code, "empty_cart")
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const addr = await port.placeOrder({ address: { ...ADDRESS, recipient: "", postcode: "!" }, confirmed: true })
  assert.deepEqual([addr.code, Object.keys(addr.fieldErrors)], ["invalid_address", ["recipient", "postcode"]])
  assert.equal(addr.fieldErrors.recipient[0], "꼭 입력해 주세요.")
})

test("confirmPayment: 내 주문 + 내 결제 건일 때만. 남의 주문·다른 paymentId 는 not_found, 결제 전은 payment_pending(retryable)", async () => {
  const { port, gateway } = portFor("buyer")
  const other = portFor("other", { gateway, deps: {} }).port
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const { order, payment } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.equal((await other.confirmPayment({ orderId: order.id, paymentId: payment.paymentId })).code, "not_found")
  assert.equal((await port.confirmPayment({ orderId: order.id, paymentId: "mock-other" })).code, "not_found")
  const early = await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId })
  assert.deepEqual([early.code, early.retryable], ["payment_pending", true])
  gateway.markPaid(payment.paymentId)
  const done = data(await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId }))
  assert.deepEqual([done.status, typeof done.paidAt], ["paid", "string"])
})

test("orders · order: 내 것만. 남의 주문은 not_found", async () => {
  const { port } = portFor("buyer")
  const other = portFor("other").port
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const { order } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.deepEqual(data(await port.orders()).map((o) => o.id), [order.id])
  assert.deepEqual(data(await other.orders()), [])
  assert.equal(data(await port.order({ orderId: order.id })).id, order.id)
  assert.equal((await other.order({ orderId: order.id })).code, "not_found")
  assert.equal((await port.order({ orderId: "not-a-uuid" })).code, "not_found")
})

test("cancelOrder: 확인 없이는 승인 대기, 확인하면 취소 + 재고 반환. 남의 주문은 not_found", async () => {
  const { port } = portFor("buyer")
  const other = portFor("other").port
  data(await port.setCartLine({ productId: "mug", quantity: 2 }))
  const { order } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  assert.equal((await port.cancelOrder({ orderId: order.id })).code, "confirmation_required")
  assert.equal((await other.cancelOrder({ orderId: order.id, confirmed: true })).code, "not_found")
  assert.equal(data(await port.order({ orderId: order.id })).status, "pending_payment")
  const done = data(await port.cancelOrder({ orderId: order.id, reason: "변심", confirmed: true }))
  assert.deepEqual([done.status, typeof done.canceledAt], ["canceled", "string"])
  assert.equal(await stockOf(d, "mug"), 5)
})

test("cancelOrder: 배송이 시작된 주문은 not_cancelable (문구에 안내), 준비 중은 환불, 이미 취소된 주문은 not_cancelable + 「이미 취소」 문구", async () => {
  const { port, gateway, deps } = portFor("buyer")
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const { order, payment } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  gateway.markPaid(payment.paymentId)
  data(await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId }))
  const { advanceOrder } = await import("../src/checkout.ts")
  const { withDefaults } = await import("../src/deps.ts")
  assert.equal((await advanceOrder(withDefaults(deps), { orderId: order.id, to: "preparing" })).ok, true)
  assert.equal((await advanceOrder(withDefaults(deps), { orderId: order.id, to: "shipped", trackingNumber: "TRK-1" })).ok, true)
  const r = await port.cancelOrder({ orderId: order.id, confirmed: true })
  assert.deepEqual([r.code, r.retryable], ["not_cancelable", false])
  assert.match(r.formError, /판매자에게 문의/)

  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const second = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  gateway.markPaid(second.payment.paymentId)
  data(await port.confirmPayment({ orderId: second.order.id, paymentId: second.payment.paymentId }))
  assert.equal((await advanceOrder(withDefaults(deps), { orderId: second.order.id, to: "preparing" })).ok, true)
  assert.equal(data(await port.cancelOrder({ orderId: second.order.id, confirmed: true })).status, "refunded")
  const again = await port.cancelOrder({ orderId: second.order.id, confirmed: true })
  assert.deepEqual([again.code, again.retryable], ["not_cancelable", false])
  assert.match(again.formError, /이미 취소/)
})

test("인프라 오류는 던지지 않고 provider_unavailable(retryable)로 끝나며 onError 로 남는다", async () => {
  const base = mockGateway()
  const flaky = { prepare: base.prepare, cancel: base.cancel, verify: async () => { throw new Error("timeout") } }
  const { port, errors } = portFor("buyer", { gateway: flaky })
  data(await port.setCartLine({ productId: "tote", quantity: 1 }))
  const { order, payment } = data(await port.placeOrder({ address: ADDRESS, confirmed: true }))
  const r = await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId })
  assert.deepEqual([r.ok, r.code, r.retryable], [false, "provider_unavailable", true])
  assert.equal(r.formError, "처리하지 못했어요. 다시 시도해 주세요.")
  assert.deepEqual(errors.map((e) => e.message), ["timeout"])
})

test("영어 로캘이면 문구가 영어다", async () => {
  const { port } = portFor("buyer", { deps: { locale: "en" } })
  assert.equal((await port.placeOrder({ address: ADDRESS, confirmed: true })).formError, "Your cart is empty. Add something and try again.")
})

test("unavailablePort: 모든 메서드가 provider_unavailable · retryable false", async () => {
  const port = unavailablePort("ko")
  for (const call of [() => port.catalog(), () => port.cart(), () => port.setCartLine({ productId: "a", quantity: 1 }), () => port.placeOrder({ address: ADDRESS, confirmed: true }), () => port.confirmPayment({ orderId: "a", paymentId: "b" }), () => port.orders(), () => port.order({ orderId: "a" }), () => port.cancelOrder({ orderId: "a", confirmed: true })]) {
    const r = await call()
    assert.deepEqual([r.ok, r.code, r.retryable], [false, "provider_unavailable", false])
    assert.equal(r.formError, "아직 상점을 열지 않았어요. 곧 다시 열릴 거예요.")
  }
})

test("도메인 실패 code 마다 두 언어 문구가 있다 (빠지면 사용자에게 빈 글이 간다)", () => {
  const codes = ["out_of_stock", "out_of_stock_left", "empty_cart", "unknown_product", "invalid_quantity", "invalid_address", "too_many_pending", "not_found", "payment_pending", "payment_failed", "payment_amount_mismatch", "order_canceled", "order_canceled_refunded", "not_cancelable", "refund_failed", "invalid_transition", "invalid_input", "action_failed"]
  for (const locale of ["ko", "en"]) assert.deepEqual(Object.keys(MESSAGES[locale].commerce.failure).sort(), [...codes].sort(), locale)
})

test("failureResult: 포트 밖에서도 같은 code·retryable·문구를 낸다(관리자 액션이 쓴다)", async () => {
  const { failureResult } = await import("../src/port.ts")
  const ko = failureResult("ko", { ok: false, code: "not_cancelable", status: "shipped" })
  assert.deepEqual({ ok: ko.ok, code: ko.code, retryable: ko.retryable }, { ok: false, code: "not_cancelable", retryable: false })
  assert.ok(ko.formError && ko.formError.length > 0)
  assert.notEqual(failureResult("en", { ok: false, code: "not_cancelable", status: "shipped" }).formError, ko.formError)
  assert.equal(failureResult("ko", { ok: false, code: "refund_failed" }).retryable, true)
})
