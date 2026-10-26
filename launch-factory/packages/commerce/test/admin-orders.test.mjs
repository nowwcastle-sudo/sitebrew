// 관리자용 주문 읽기·송장 번호 저장 — 센 수(countOrders)와 송장 번호는 배송 전 상태(결제 완료·준비 중)에서만 정한다.
import { test, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import { cartItems } from "@launch-factory/db"
import { advanceOrder, confirmPayment, placeOrder } from "../src/checkout.ts"
import { withDefaults } from "../src/deps.ts"
import { canMove, TRACKING_EDITABLE } from "../src/order-states.ts"
import { countOrders, loadOrder } from "../src/orders.ts"
import { setTrackingNumber } from "../src/tracking.ts"
import { makeDeps, newDb, putCart } from "./helpers.mjs"

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

const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.value
}

async function paidOrder(ctx, gateway, userId = "buyer") {
  await d.delete(cartItems).where(eq(cartItems.userId, userId))
  await putCart(d, userId, [["tote", 1]])
  const { order, payment } = ok(await placeOrder(ctx, { userId, address: { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1" } }))
  gateway.markPaid(payment.paymentId)
  ok(await confirmPayment(ctx, { paymentId: payment.paymentId }))
  return order.id
}

test("송장 번호를 정할 수 있는 상태는 배송 전(배송으로 갈 수 있고 아직 배송이 아닌 상태)뿐이다", () => {
  assert.deepEqual([...TRACKING_EDITABLE], ["paid", "preparing"])
  for (const s of TRACKING_EDITABLE) assert.ok(s === "preparing" ? canMove(s, "shipped") : canMove(s, "preparing"), s)
  for (const s of ["pending_payment", "shipped", "delivered", "canceled", "refunded"]) assert.ok(!TRACKING_EDITABLE.includes(s), s)
})

test("setTrackingNumber: 결제 완료·준비 중 주문에 저장하고, 배송 때 그 번호가 그대로 남는다", async () => {
  const { deps, gateway } = makeDeps(d)
  const ctx = withDefaults(deps)
  const id = await paidOrder(ctx, gateway)
  assert.equal(ok(await setTrackingNumber(ctx, { orderId: id, trackingNumber: "  TRK-1  " })).trackingNumber, "TRK-1", "앞뒤 공백은 뗀다")
  assert.equal((await loadOrder(d, id)).status, "paid", "상태는 안 바뀐다")
  ok(await advanceOrder(ctx, { orderId: id, to: "preparing" }))
  assert.equal(ok(await setTrackingNumber(ctx, { orderId: id, trackingNumber: "TRK-2" })).trackingNumber, "TRK-2", "준비 중에도 고친다")
  const shipped = ok(await advanceOrder(ctx, { orderId: id, to: "shipped", trackingNumber: ok(await setTrackingNumber(ctx, { orderId: id, trackingNumber: "TRK-3" })).trackingNumber }))
  assert.equal(shipped.trackingNumber, "TRK-3")
})

test("setTrackingNumber: 배송 뒤·결제 전·없는 주문·빈 값/긴 값은 거절하고 아무것도 바꾸지 않는다", async () => {
  const { deps, gateway } = makeDeps(d)
  const ctx = withDefaults(deps)
  await putCart(d, "buyer", [["tote", 1]])
  const pending = ok(await placeOrder(ctx, { userId: "buyer", address: { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1" } })).order
  const r1 = await setTrackingNumber(ctx, { orderId: pending.id, trackingNumber: "X" })
  assert.deepEqual([r1.ok, r1.code, r1.status], [false, "invalid_transition", "pending_payment"], "결제 전")
  const id = await paidOrder(ctx, gateway, "other")
  for (const bad of ["", "   ", "x".repeat(101), 5, undefined]) assert.equal((await setTrackingNumber(ctx, { orderId: id, trackingNumber: bad })).code, "invalid_input", String(bad))
  assert.equal((await loadOrder(d, id)).trackingNumber, null)
  assert.equal((await setTrackingNumber(ctx, { orderId: "00000000-0000-4000-8000-0000000000ff", trackingNumber: "X" })).code, "not_found")
  ok(await advanceOrder(ctx, { orderId: id, to: "preparing" }))
  ok(await advanceOrder(ctx, { orderId: id, to: "shipped", trackingNumber: "TRK-9" }))
  const late = await setTrackingNumber(ctx, { orderId: id, trackingNumber: "CHANGED" })
  assert.deepEqual([late.ok, late.code, late.status], [false, "invalid_transition", "shipped"])
  assert.equal((await loadOrder(d, id)).trackingNumber, "TRK-9", "배송된 주문의 송장은 그대로")
})

test("countOrders: 전체 수와 상태별 수", async () => {
  const { deps, gateway } = makeDeps(d)
  const ctx = withDefaults(deps)
  const a = await paidOrder(ctx, gateway)
  await paidOrder(ctx, gateway, "other")
  ok(await advanceOrder(ctx, { orderId: a, to: "preparing" }))
  assert.equal(await countOrders(d), 2)
  assert.equal(await countOrders(d, "paid"), 1)
  assert.equal(await countOrders(d, "preparing"), 1)
  assert.equal(await countOrders(d, "delivered"), 0)
})
