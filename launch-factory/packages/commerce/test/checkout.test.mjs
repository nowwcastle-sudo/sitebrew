// 결제 흐름(checkout) — 주문 만들기 · 결제 확정(리디렉션과 웹훅이 같은 함수) · 취소/환불 · 만료 · 앞걸음.
// PGlite + mock 게이트웨이 + 진짜 mock 메일러. 이 파일이 Review Focus 1~4 를 잡는다(위조 금액·동시 확정·마지막 한 개·만료 반환).
import { test, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import { orders, orderItems, cartItems } from "@launch-factory/db"
import { advanceOrder, cancelOrder, confirmPayment, expirePending, placeOrder } from "../src/checkout.ts"
import { withDefaults } from "../src/deps.ts"
import { loadOrder, ownedOrder } from "../src/orders.ts"
import { ADDRESS, makeDeps, newDb, putCart, stockOf } from "./helpers.mjs"

let d
before(async () => {
  d = await newDb()
})
beforeEach(async () => {
  // 시험마다 판매 표를 비운다(사용자는 그대로) — 결제 대기 3개 제한·재고가 시험끼리 번지지 않게
  await d.execute(sql`truncate table order_items, orders, cart_items, stock_levels cascade`)
})
after(async () => {
  await d?.$client.close()
})

/** 매 시험마다 새 재료: 이 파일은 DB 하나를 나눠 쓰므로 사용자·상품을 시험마다 달리 쓴다 */
async function setup(over = {}) {
  const made = makeDeps(d, over)
  return { ...made, ctx: withDefaults(made.deps) }
}
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.value
}

async function orderFor(ctx, userId, lines, address = ADDRESS) {
  await d.delete(cartItems).where(eq(cartItems.userId, userId))
  await putCart(d, userId, lines)
  return ok(await placeOrder(ctx, { userId, address }))
}

// ── placeOrder ─────────────────────────────────────────────────────────────────

test("placeOrder: 장바구니 → 결제 대기 주문. 가격은 상품표에서, 재고 차감, 장바구니 비움, 결제 세션을 돌려준다", async () => {
  const { ctx, events } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["mug", 2], ["tote", 1]])
  assert.equal(order.status, "pending_payment")
  assert.deepEqual([order.subtotal, order.shipping, order.total], [32000, 3000, 35000])
  assert.deepEqual(order.items.map((i) => [i.productId, i.name, i.unitAmount, i.quantity]), [["mug", "머그컵(예시)", 12000, 2], ["tote", "에코백(예시)", 8000, 1]])
  assert.deepEqual(order.address, ADDRESS)
  assert.equal(order.userId, "buyer")
  assert.equal(order.paymentId, payment.paymentId)
  assert.equal(order.expiresAt.getTime() - order.createdAt.getTime(), 30 * 60_000, "재고를 30분 붙든다")
  assert.equal(payment.provider, "mock")
  assert.deepEqual(payment.total, { amount: 35000, currency: "KRW", vatIncluded: true })
  assert.match(payment.orderName, /머그컵\(예시\)/)
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, "buyer"))).length, 0, "장바구니는 비워진다")
  assert.deepEqual(events, [{ name: "begin_checkout", props: { amount: 35000, currency: "KRW" } }])
  assert.equal(await stockOf(d, "mug"), 3)
  assert.equal(await stockOf(d, "tote"), undefined, "재고 제한이 없는 상품은 재고 행을 만들지 않는다")
})

test("placeOrder: 주문 이름은 첫 상품 + 외 N건(i18n 글), 하나면 이름만", async () => {
  const { ctx } = await setup()
  const two = await orderFor(ctx, "other", [["tote", 1], ["pen", 1]])
  assert.match(two.payment.orderName, /에코백\(예시\) 외 1건/)
  const { ctx: en } = await setup({ deps: { locale: "en" } })
  const one = await orderFor(en, "third", [["tote", 1]])
  assert.equal(one.payment.orderName, "에코백(예시)")
})

test("placeOrder: 가격은 서버 상품표에서만 — 장바구니 표에는 가격 칸이 없고, 상품표가 바뀌면 새 주문은 새 가격이다(옛 주문은 그대로)", async () => {
  const { ctx } = await setup()
  const first = await orderFor(ctx, "buyer", [["tote", 1]])
  assert.equal(first.order.subtotal, 8000)
  const { defineCatalog } = await import("../src/catalog.ts")
  const repriced = withDefaults({ ...ctx, catalog: defineCatalog([{ id: "tote", name: "에코백(예시)", price: 9000 }]) })
  const second = await orderFor(repriced, "buyer", [["tote", 1]])
  assert.equal(second.order.subtotal, 9000)
  assert.equal((await loadOrder(d, first.order.id)).subtotal, 8000)
})

test("placeOrder: 빈 장바구니·잘못된 배송지·모르는 상품은 거절하고 아무것도 쓰지 않는다", async () => {
  const { ctx } = await setup()
  await d.delete(cartItems).where(eq(cartItems.userId, "buyer"))
  const before = (await d.select().from(orders)).length
  assert.equal((await placeOrder(ctx, { userId: "buyer", address: ADDRESS })).code, "empty_cart")

  await putCart(d, "buyer", [["tote", 1]])
  const bad = await placeOrder(ctx, { userId: "buyer", address: { ...ADDRESS, recipient: "", phone: "x" } })
  assert.deepEqual([bad.code, bad.fields], ["invalid_address", { recipient: "required", phone: "invalid" }])

  await putCart(d, "buyer", [["retired", 1]])
  assert.deepEqual(await placeOrder(ctx, { userId: "buyer", address: ADDRESS }), { ok: false, code: "unknown_product", productId: "retired" })
  assert.equal((await d.select().from(orders)).length, before)
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, "buyer"))).length, 2, "실패하면 장바구니는 그대로")
  await d.delete(cartItems).where(eq(cartItems.userId, "buyer"))
})

test("placeOrder: 재고가 모자라면 out_of_stock 이고 이미 예약한 다른 상품도 돌아온다(전부 되돌림)", async () => {
  const { ctx } = await setup()
  await d.execute(sql`delete from stock_levels where sku in ('lamp','pen')`)
  await d.delete(cartItems).where(eq(cartItems.userId, "other"))
  await putCart(d, "other", [["lamp", 2], ["pen", 1]]) // lamp 시작 재고 1
  const r = await placeOrder(ctx, { userId: "other", address: ADDRESS })
  assert.deepEqual([r.ok, r.code, r.productId], [false, "out_of_stock", "lamp"])
  assert.equal(await stockOf(d, "pen"), undefined, "pen 예약도 시드까지 되돌아갔다(행이 없다 = 시작 수량 그대로)")
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, "other"))).length, 2)
  await d.delete(cartItems).where(eq(cartItems.userId, "other"))
})

test("재고 1개를 두 사람이 동시에 주문하면 한 사람만 성공한다(Review Focus 3)", async () => {
  const { ctx } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'lamp'`)
  await d.delete(cartItems).where(eq(cartItems.userId, "buyer"))
  await d.delete(cartItems).where(eq(cartItems.userId, "other"))
  await putCart(d, "buyer", [["lamp", 1]])
  await putCart(d, "other", [["lamp", 1]])
  const results = await Promise.all([placeOrder(ctx, { userId: "buyer", address: ADDRESS }), placeOrder(ctx, { userId: "other", address: ADDRESS })])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.find((r) => !r.ok).code, "out_of_stock")
  assert.equal(await stockOf(d, "lamp"), 0)
  const loserId = results[0].ok ? "other" : "buyer"
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, loserId))).length, 1, "진 사람의 장바구니는 남는다")
  await d.delete(cartItems).where(eq(cartItems.userId, loserId))
})

test("placeOrder: 결제 대기 주문은 한 사람당 3개까지(재고를 계속 붙들어 두지 못하게)", async () => {
  const { ctx } = await setup()
  await d.execute(sql`delete from orders where user_id = 'third'`)
  for (let i = 0; i < 3; i++) await orderFor(ctx, "third", [["tote", 1]])
  await d.delete(cartItems).where(eq(cartItems.userId, "third"))
  await putCart(d, "third", [["tote", 1]])
  const r = await placeOrder(ctx, { userId: "third", address: ADDRESS })
  assert.equal(r.code, "too_many_pending")
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, "third"))).length, 1)
  await d.delete(cartItems).where(eq(cartItems.userId, "third"))
})

test("placeOrder: 결제 세션을 못 만들면(공급자 설정 오류) 던지고 모든 변경이 되돌아간다", async () => {
  const { ctx } = await setup({ gateway: { prepare: async () => { throw new Error("gateway down") }, verify: async () => ({ status: "not_found" }), cancel: async () => ({ ok: true }) } })
  await d.execute(sql`delete from stock_levels where sku = 'mug'`)
  await d.delete(cartItems).where(eq(cartItems.userId, "buyer"))
  await putCart(d, "buyer", [["mug", 1]])
  const n = (await d.select().from(orders)).length
  await assert.rejects(placeOrder(ctx, { userId: "buyer", address: ADDRESS }), /gateway down/)
  assert.equal((await d.select().from(orders)).length, n)
  assert.equal(await stockOf(d, "mug"), undefined, "재고 시드까지 되돌아갔다")
  assert.equal((await d.select().from(cartItems).where(eq(cartItems.userId, "buyer"))).length, 1)
  await d.delete(cartItems).where(eq(cartItems.userId, "buyer"))
})

// ── confirmPayment ─────────────────────────────────────────────────────────────

test("confirmPayment: 결제가 안 끝났으면(pending) 상태 그대로 payment_pending, 끝나면 paid + 메일 1통 + purchase 이벤트", async () => {
  const { ctx, gateway, mailer, events } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  const early = await confirmPayment(ctx, { paymentId: payment.paymentId })
  assert.deepEqual([early.ok, early.code, early.paymentStatus], [false, "payment_pending", "pending"])
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
  assert.equal(mailer.sent.length, 0)

  gateway.markPaid(payment.paymentId)
  const done = ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  assert.equal(done.changed, true)
  assert.equal(done.order.status, "paid")
  assert.ok(done.order.paidAt instanceof Date)
  assert.equal(mailer.sent.length, 1)
  const { request, result } = mailer.sent[0]
  assert.equal(result.ok, true)
  assert.equal(request.to, "buyer@example.test")
  assert.equal(request.template, "shopOrderConfirmation")
  assert.equal(request.idempotencyKey, `shop-order-confirmation:${order.id}`)
  assert.equal(request.input.total.amount, 11000)
  assert.deepEqual(events.at(-1), { name: "purchase", props: { orderId: order.id, amount: 11000, currency: "KRW" } })
})

test("confirmPayment: 같은 paymentId 로 두 번(동시 포함) 와도 상태 paid 1번 · 메일 1통 · 재고 1회 차감(Review Focus 2)", async () => {
  const { ctx, gateway, mailer, events } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'pen'`)
  const { order, payment } = await orderFor(ctx, "buyer", [["pen", 2]])
  assert.equal(await stockOf(d, "pen"), 1)
  gateway.markPaid(payment.paymentId)
  const results = await Promise.all([1, 2, 3, 4].map(() => confirmPayment(ctx, { paymentId: payment.paymentId })))
  assert.ok(results.every((r) => r.ok && r.value.order.status === "paid"))
  assert.equal(results.filter((r) => r.value.changed).length, 1, "첫 호출만 changed")
  assert.equal(mailer.sent.length, 1)
  assert.equal(events.filter((e) => e.name === "purchase").length, 1)
  assert.equal(await stockOf(d, "pen"), 1, "확정은 재고를 건드리지 않는다")
  // 다 끝난 뒤 한 번 더(웹훅 재전송)
  const again = ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  assert.equal(again.changed, false)
  assert.equal(mailer.sent.length, 1)
  const [row] = await d.select().from(orders).where(eq(orders.id, order.id))
  assert.equal(row.status, "paid")
})

test("confirmPayment: 공급자가 본 금액이 주문 금액과 다르면 상태 그대로 + payment_amount_mismatch, 메일 없음 (위조 금액, Review Focus 1)", async () => {
  const { ctx, gateway, mailer } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 2]])
  const cancelled = []
  const tampered = { prepare: gateway.prepare, verify: async () => ({ status: "paid", total: { amount: 100, currency: "KRW", vatIncluded: true } }), cancel: async (i) => (cancelled.push(i), { ok: true }) }
  const forged = withDefaults({ ...ctx, gateway: tampered })
  const r = await confirmPayment(forged, { paymentId: payment.paymentId })
  assert.deepEqual([r.ok, r.code], [false, "payment_amount_mismatch"])
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
  assert.equal(mailer.sent.length, 0)
  assert.equal(cancelled.length, 1, "맞지 않는 결제는 돌려준다")
  assert.equal(cancelled[0].paymentId, payment.paymentId)
})

test("confirmPayment: 통화가 KRW 가 아니면 금액이 같아도 거절한다", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  const wrong = withDefaults({ ...ctx, gateway: { ...gateway, prepare: gateway.prepare, cancel: async () => ({ ok: true }), verify: async () => ({ status: "paid", total: { amount: order.total, currency: "USD", vatIncluded: true } }) } })
  assert.equal((await confirmPayment(wrong, { paymentId: payment.paymentId })).code, "payment_amount_mismatch")
})

test("confirmPayment: 결제 실패·취소는 payment_failed(주문은 대기 그대로 — 만료가 정리한다), 모르는 paymentId 는 not_found", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markFailed(payment.paymentId)
  const r = await confirmPayment(ctx, { paymentId: payment.paymentId })
  assert.deepEqual([r.code, r.paymentStatus], ["payment_failed", "failed"])
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
  assert.equal((await confirmPayment(ctx, { paymentId: "nope" })).code, "not_found")
})

test("confirmPayment: 공급자 조회가 던지면(네트워크) 주문은 그대로이고 오류가 그대로 올라간다 — 웹훅이 다시 보낸다", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  const flaky = withDefaults({ ...ctx, gateway: { prepare: gateway.prepare, cancel: gateway.cancel, verify: async () => { throw new Error("timeout") } } })
  await assert.rejects(confirmPayment(flaky, { paymentId: payment.paymentId }), /timeout/)
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
})

test("confirmPayment: 메일이 실패해도 주문은 paid 이고 운영 알림(onError)으로 남는다", async () => {
  const { ctx, gateway, mailer, errors } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  mailer.fail = true
  gateway.markPaid(payment.paymentId)
  const done = ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  assert.equal(done.order.status, "paid")
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, new RegExp(order.id))
  assert.doesNotMatch(errors[0].message, /buyer@example/, "받는 주소를 오류에 싣지 않는다")
})

test("confirmPayment: 이미 만료로 취소된 주문에 늦게 들어온 결제는 자동으로 돌려준다(order_canceled, refunded)", async () => {
  const { ctx, gateway, mailer, clock } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["mug", 1]])
  clock.tick(31 * 60_000)
  await expirePending(ctx)
  assert.equal((await loadOrder(d, order.id)).status, "canceled")
  gateway.markPaid(payment.paymentId)
  const late = await confirmPayment(ctx, { paymentId: payment.paymentId })
  assert.deepEqual([late.ok, late.code, late.refunded], [false, "order_canceled", true])
  assert.equal((await gateway.verify(payment.paymentId)).status, "canceled")
  assert.equal(mailer.sent.length, 0)
  assert.equal((await loadOrder(d, order.id)).status, "canceled")
})

// ── 취소 · 환불 ────────────────────────────────────────────────────────────────

test("cancelOrder: 결제 대기 주문은 취소되고 재고가 돌아온다", async () => {
  const { ctx } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'mug'`)
  const { order } = await orderFor(ctx, "buyer", [["mug", 2]])
  assert.equal(await stockOf(d, "mug"), 3)
  const done = ok(await cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "마음이 바뀌었어요", by: "customer" }))
  assert.equal(done.status, "canceled")
  assert.ok(done.canceledAt instanceof Date)
  assert.equal(await stockOf(d, "mug"), 5)
  // 손님이 다시 부르면 취소할 수 없는 주문이고(계약 적합성), 재고를 또 돌려주지 않는다. 관리자에게는 같은 결과(멱등)
  const again = await cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "again", by: "customer" })
  assert.deepEqual([again.code, again.status], ["not_cancelable", "canceled"])
  assert.equal(ok(await cancelOrder(ctx, { orderId: order.id, reason: "again", by: "admin" })).status, "canceled")
  assert.equal(await stockOf(d, "mug"), 5)
})

test("cancelOrder: 결제 완료 주문은 gateway.cancel 이 성공해야 refunded 가 되고 재고가 돌아온다", async () => {
  const { ctx, gateway } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'mug'`)
  const { order, payment } = await orderFor(ctx, "buyer", [["mug", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  const done = ok(await cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "단순 변심", by: "customer" }))
  assert.equal(done.status, "refunded")
  assert.equal((await gateway.verify(payment.paymentId)).status, "canceled")
  assert.equal(await stockOf(d, "mug"), 5)
})

test("cancelOrder: 환불이 실패하면(gateway.cancel 실패) 상태가 그대로 paid 이고 refund_failed", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  const refusing = withDefaults({ ...ctx, gateway: { prepare: gateway.prepare, verify: gateway.verify, cancel: async () => ({ ok: false, code: "provider_error" }) } })
  const r = await cancelOrder(refusing, { orderId: order.id, userId: "buyer", reason: "x", by: "customer" })
  assert.deepEqual([r.ok, r.code], [false, "refund_failed"])
  assert.equal((await loadOrder(d, order.id)).status, "paid")
})

test("cancelOrder: 환불하는 동안 주문이 배송 중으로 넘어가면 성공이라 하지 않고 직접 처리하라고 알린다(환불은 나갔다)", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  ok(await advanceOrder(ctx, { orderId: order.id, to: "preparing" }))
  const errors = []
  // 공급자가 환불을 처리하는 사이 다른 관리자가 배송 중으로 넘긴다
  const racing = withDefaults({
    ...ctx,
    onError: (e) => errors.push(e),
    gateway: { prepare: gateway.prepare, verify: gateway.verify, cancel: async (...a) => (await d.update(orders).set({ status: "shipped" }).where(eq(orders.id, order.id)), gateway.cancel(...a)) },
  })
  const r = await cancelOrder(racing, { orderId: order.id, reason: "x", by: "admin" })
  assert.deepEqual([r.ok, r.code, r.status], [false, "not_cancelable", "shipped"])
  assert.equal((await loadOrder(d, order.id)).status, "shipped")
  assert.match(errors[0]?.message ?? "", /refunded at the provider/)
})

test("cancelOrder: 공급자에서 이미 취소된 결제(already_canceled)는 돈이 나간 것이므로 refunded 로 맞춘다 — 두 번 동시에 눌러도 한 번만 처리", async () => {
  const { ctx, gateway } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'pen'`)
  const { order, payment } = await orderFor(ctx, "buyer", [["pen", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  const both = await Promise.all([cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "a", by: "customer" }), cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "b", by: "customer" })])
  assert.ok(both.every((r) => r.ok && r.value.status === "refunded"))
  assert.equal(await stockOf(d, "pen"), 3, "재고는 한 번만 돌아온다")
})

test("cancelOrder: 배송 중·완료는 손님이 취소할 수 없다(not_cancelable). 관리자는 준비 중까지 환불한다", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  ok(await advanceOrder(ctx, { orderId: order.id, to: "preparing" }))
  ok(await advanceOrder(ctx, { orderId: order.id, to: "shipped", trackingNumber: "TRK-1" }))
  const denied = await cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "x", by: "customer" })
  assert.deepEqual([denied.code, denied.status], ["not_cancelable", "shipped"])
  const deniedAdmin = await cancelOrder(ctx, { orderId: order.id, reason: "x", by: "admin" })
  assert.deepEqual([deniedAdmin.code, deniedAdmin.status], ["not_cancelable", "shipped"])
})

test("cancelOrder: 준비 중 주문은 손님도 취소(환불)할 수 있고 재고는 되돌리지 않는다. 이미 끝난 주문은 손님에게 not_cancelable, 관리자에게는 같은 결과(멱등)", async () => {
  const { ctx, gateway } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'pen'`)
  const { order, payment } = await orderFor(ctx, "buyer", [["pen", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  const afterOrder = await stockOf(d, "pen")
  ok(await advanceOrder(ctx, { orderId: order.id, to: "preparing" }))
  const refunded = ok(await cancelOrder(ctx, { orderId: order.id, userId: "buyer", reason: "변심", by: "customer" }))
  assert.equal(refunded.status, "refunded")
  assert.equal(await stockOf(d, "pen"), afterOrder, "준비 중 환불은 재고를 되돌리지 않는다")
  const again = await cancelOrder(ctx, { orderId: order.id, userId: "buyer", by: "customer" })
  assert.deepEqual([again.code, again.status], ["not_cancelable", "refunded"])
  assert.equal(ok(await cancelOrder(ctx, { orderId: order.id, by: "admin" })).status, "refunded")
})

test("cancelOrder: 남의 주문은 없는 주문처럼 not_found (사용자 범위)", async () => {
  const { ctx } = await setup()
  const { order } = await orderFor(ctx, "buyer", [["tote", 1]])
  assert.equal((await cancelOrder(ctx, { orderId: order.id, userId: "other", reason: "x", by: "customer" })).code, "not_found")
  assert.equal((await cancelOrder(ctx, { orderId: "not-a-uuid", userId: "buyer", reason: "x", by: "customer" })).code, "not_found")
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
})

// ── 만료 ──────────────────────────────────────────────────────────────────────

test("expirePending: 30분이 지난 결제 대기만 취소하고 재고를 돌려준다(Review Focus 4)", async () => {
  const { ctx, clock } = await setup()
  await d.execute(sql`delete from stock_levels where sku = 'mug'`)
  const old = await orderFor(ctx, "buyer", [["mug", 2]])
  clock.tick(20 * 60_000)
  const fresh = await orderFor(ctx, "other", [["mug", 1]])
  assert.equal(await stockOf(d, "mug"), 2)
  clock.tick(11 * 60_000) // old 는 31분, fresh 는 11분
  const report = await expirePending(ctx)
  assert.deepEqual(report, { canceled: 1, confirmed: 0, skipped: 0 })
  assert.equal((await loadOrder(d, old.order.id)).status, "canceled")
  assert.equal((await loadOrder(d, fresh.order.id)).status, "pending_payment")
  assert.equal(await stockOf(d, "mug"), 4)
  assert.deepEqual(await expirePending(ctx), { canceled: 0, confirmed: 0, skipped: 0 }, "다시 돌려도 같은 주문을 또 돌려주지 않는다")
  assert.equal(await stockOf(d, "mug"), 4)
})

test("expirePending: 웹훅을 놓쳐 결제는 됐는데 대기로 남은 주문은 취소하지 않고 확정한다(메일 포함)", async () => {
  const { ctx, gateway, clock, mailer } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markPaid(payment.paymentId)
  clock.tick(40 * 60_000)
  const report = await expirePending(ctx)
  assert.deepEqual(report, { canceled: 0, confirmed: 1, skipped: 0 })
  assert.equal((await loadOrder(d, order.id)).status, "paid")
  assert.equal(mailer.sent.length, 1)
})

test("expirePending: 공급자 조회가 실패한 주문은 취소하지 않고 건너뛴다(다음 실행이 다시 본다)", async () => {
  const { ctx, gateway, clock, errors } = await setup()
  const { order } = await orderFor(ctx, "buyer", [["tote", 1]])
  clock.tick(40 * 60_000)
  const flaky = withDefaults({ ...ctx, gateway: { prepare: gateway.prepare, cancel: gateway.cancel, verify: async () => { throw new Error("timeout") } } })
  assert.deepEqual(await expirePending(flaky), { canceled: 0, confirmed: 0, skipped: 1 })
  assert.equal((await loadOrder(d, order.id)).status, "pending_payment")
  assert.equal(errors.length, 1)
  assert.deepEqual(await expirePending(ctx), { canceled: 1, confirmed: 0, skipped: 0 })
})

// ── 앞걸음 ────────────────────────────────────────────────────────────────────

test("advanceOrder: 준비 → 배송(운송장) → 완료. 표에 없는 전이는 invalid_transition 이고 상태가 안 바뀐다", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  assert.equal((await advanceOrder(ctx, { orderId: order.id, to: "preparing" })).code, "invalid_transition", "결제 전에는 준비로 못 간다")
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  assert.equal(ok(await advanceOrder(ctx, { orderId: order.id, to: "preparing" })).status, "preparing")
  assert.equal((await advanceOrder(ctx, { orderId: order.id, to: "delivered" })).code, "invalid_transition")
  const shipped = ok(await advanceOrder(ctx, { orderId: order.id, to: "shipped", trackingNumber: " 1234-5678 " }))
  assert.deepEqual([shipped.status, shipped.trackingNumber], ["shipped", "1234-5678"])
  assert.equal(ok(await advanceOrder(ctx, { orderId: order.id, to: "delivered" })).status, "delivered")
  assert.equal((await advanceOrder(ctx, { orderId: order.id, to: "shipped" })).code, "invalid_transition")
})

test("advanceOrder: 환불·취소·결제 완료로는 밀 수 없고(각자의 길이 있다), 모르는 주문은 not_found, 운송장이 너무 길면 invalid_input", async () => {
  const { ctx, gateway } = await setup()
  const { order, payment } = await orderFor(ctx, "buyer", [["tote", 1]])
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  for (const to of ["refunded", "canceled", "paid", "pending_payment", "bogus"]) assert.equal((await advanceOrder(ctx, { orderId: order.id, to })).code, "invalid_input", to)
  assert.equal((await advanceOrder(ctx, { orderId: "00000000-0000-4000-8000-00000000ffff", to: "preparing" })).code, "not_found")
  assert.equal((await advanceOrder(ctx, { orderId: order.id, to: "preparing", trackingNumber: "x".repeat(101) })).code, "invalid_input")
  assert.equal((await loadOrder(d, order.id)).status, "paid")
})

test("ownedOrder: 남의 주문은 null", async () => {
  const { ctx } = await setup()
  const { order } = await orderFor(ctx, "buyer", [["tote", 1]])
  assert.ok(await ownedOrder(d, order.id, "buyer"))
  assert.equal(await ownedOrder(d, order.id, "other"), null)
  const items = await d.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  assert.equal(items.length, 1)
})
