// 주문 생명주기 — 만들기 · 결제 확정 · 취소/환불 · 만료 · 앞걸음. 결제 공급자는 주입받은 PaymentGateway 로만 부른다(공급자를 모른다).
// 예상되는 실패는 던지지 않고 Outcome 으로 돌려준다. 던지는 것은 인프라 오류(DB 끊김·공급자 조회 실패)뿐이다 — 웹훅·Cron 이 다시 시도한다.
// 한 번만 일어나야 하는 일(결제 확정·환불·재고 반환)은 모두 moveOrder 의 조건부 UPDATE 를 이긴 쪽만 한다.
import { and, asc, count, eq, gt, lte } from "drizzle-orm"
import type { OrderStatus } from "@launch-factory/contract"
import { cartItems, orderItems, orders } from "@launch-factory/db"
import { t } from "@launch-factory/i18n"
import { won, type PaymentSession } from "@launch-factory/payments-kr"
import { checkAddress } from "./address.ts"
import type { Ctx } from "./deps.ts"
import { sendOrderConfirmation } from "./mail.ts"
import { moveOrder, restockOrder } from "./order-writes.ts"
import { FORWARD_STEPS, CUSTOMER_CANCELABLE, canMove } from "./order-states.ts"
import { fail, succeed, type Failure, type Outcome } from "./outcome.ts"
import { loadOrder, loadOrderByPayment, ownedOrder, type OrderRecord } from "./orders.ts"
import { totalsOf } from "./pricing.ts"
import { RULES } from "./rules.ts"
import { OutOfStock, reserve, seedStock, stockLevelsOf } from "./stock.ts"

const MINUTE = 60_000
const REFUNDABLE_BY_ADMIN = ["paid", "preparing"] as const satisfies readonly OrderStatus[]
const PAID_OR_LATER = new Set<OrderStatus>(["paid", "preparing", "shipped", "delivered", "refunded"])

/** 트랜잭션 안에서 실패를 알리고 되돌린다 */
class Refused extends Error {
  readonly failure: Failure
  constructor(failure: Failure) {
    super(failure.code)
    this.failure = failure
  }
}

const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

// ── 주문 만들기 ────────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  userId: string
  address: unknown
}
export interface PlacedOrder {
  order: OrderRecord
  payment: PaymentSession
}

/** 장바구니 → 결제 대기 주문. 가격은 상품표에서만 읽고, 재고를 붙들고(30분), 결제 세션을 만든다. 실패하면 장바구니·재고는 그대로다 */
export async function placeOrder(ctx: Ctx, input: PlaceOrderInput): Promise<Outcome<PlacedOrder>> {
  const checked = checkAddress(input.address)
  if (!checked.ok) return fail("invalid_address", { fields: checked.fields })
  const now = ctx.now()
  try {
    const placed = await ctx.db.transaction(async (tx) => {
      // 장바구니를 지우면서 읽는다 — 같은 사람이 동시에 두 번 눌러도 한쪽만 줄을 받는다(나머지는 empty_cart)
      const taken = await tx.delete(cartItems).where(eq(cartItems.userId, input.userId)).returning({ productId: cartItems.productId, quantity: cartItems.quantity })
      if (taken.length === 0) throw new Refused({ ok: false, code: "empty_cart" })
      const lines = taken
        .map((row) => ({ row, item: ctx.catalog.get(row.productId) }))
        .map(({ row, item }) => {
          if (!item) throw new Refused({ ok: false, code: "unknown_product", productId: row.productId })
          return { item, quantity: row.quantity }
        })
        .sort((a, b) => (a.item.id < b.item.id ? -1 : 1))

      const [pending] = await tx
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.userId, input.userId), eq(orders.status, "pending_payment"), gt(orders.expiresAt, now)))
      if ((pending?.n ?? 0) >= RULES.maxPendingOrders) throw new Refused({ ok: false, code: "too_many_pending" })

      const limited = lines.filter((l) => l.item.stock !== null)
      await seedStock(tx, limited.map((l) => ({ sku: l.item.id, quantity: l.item.stock as number })), now)
      await reserve(tx, limited.map((l) => ({ sku: l.item.id, quantity: l.quantity })), now)

      const priced = lines.map((l) => ({ productId: l.item.id, name: l.item.name, unitAmount: l.item.price.amount, quantity: l.quantity }))
      const totals = totalsOf(priced, ctx.shipping)
      const orderId = ctx.newId()
      const payment = await ctx.gateway.prepare({ orderId, orderName: orderNameOf(ctx, priced), total: won(totals.total) })

      await tx.insert(orders).values({
        id: orderId,
        userId: input.userId,
        status: "pending_payment",
        ...totals,
        currency: "KRW",
        paymentId: payment.paymentId,
        address: checked.address,
        createdAt: now,
        expiresAt: new Date(now.getTime() + RULES.holdMinutes * MINUTE),
      })
      await tx.insert(orderItems).values(priced.map((p) => ({ orderId, ...p })))
      const order = await loadOrder(tx, orderId)
      if (!order) throw new Error(`order ${orderId} vanished inside its own transaction`)
      return { order, payment }
    })
    ctx.emit("begin_checkout", { amount: placed.order.total, currency: "KRW" })
    return succeed(placed)
  } catch (e) {
    if (e instanceof Refused) return e.failure
    if (e instanceof OutOfStock) {
      const available = (await stockLevelsOf(ctx.db, [e.sku])).get(e.sku)
      return fail("out_of_stock", { productId: e.sku, ...(available !== undefined ? { available } : {}) })
    }
    throw e
  }
}

/** 결제창에 보이는 이름: 금액이 가장 큰 줄의 이름 + 「외 N건」 */
function orderNameOf(ctx: Ctx, lines: readonly { productId: string; name: string; unitAmount: number; quantity: number }[]): string {
  const ranked = [...lines].sort((a, b) => b.unitAmount * b.quantity - a.unitAmount * a.quantity || (a.productId < b.productId ? -1 : 1))
  const first = ranked[0]
  if (!first) throw new Error("order has no lines")
  return lines.length === 1 ? first.name : t(ctx.locale, "commerce.orderName.more", { name: first.name, count: lines.length - 1 })
}

// ── 결제 확정 ─────────────────────────────────────────────────────────────────

export interface ConfirmPaymentInput {
  paymentId: string
}
export interface Confirmed {
  order: OrderRecord
  /** 이번 호출이 상태를 바꿨는가(false = 이미 확정돼 있었다) */
  changed: boolean
}

/** 결제 공급자에 다시 물어 확정한다. 리디렉션 반환과 웹훅이 같은 함수를 부르고, 몇 번을 불러도 상태·메일·계측은 한 번이다 */
export async function confirmPayment(ctx: Ctx, input: ConfirmPaymentInput): Promise<Outcome<Confirmed>> {
  const order = await loadOrderByPayment(ctx.db, input.paymentId)
  if (!order) return fail("not_found")
  if (PAID_OR_LATER.has(order.status)) return succeed({ order, changed: false })
  if (order.status === "canceled") return refundLatePayment(ctx, order)

  const seen = await ctx.gateway.verify(input.paymentId)
  if (seen.status === "pending") return fail("payment_pending", { paymentStatus: seen.status })
  if (seen.status !== "paid") return fail("payment_failed", { paymentStatus: seen.status })
  if (!seen.total || seen.total.currency !== "KRW" || seen.total.amount !== order.total) {
    await refund(ctx, input.paymentId, "amount mismatch")
    return fail("payment_amount_mismatch")
  }

  const moved = await moveOrder(ctx.db, order.id, ["pending_payment"], "paid", { paidAt: ctx.now() })
  const current = await loadOrder(ctx.db, order.id)
  if (!current) return fail("not_found")
  if (!moved) {
    // 동시에 다른 호출이 확정했거나(그대로 성공), 그 사이 만료로 취소됐다(늦은 결제 — 돌려준다)
    return current.status === "canceled" ? refundLatePayment(ctx, current) : succeed({ order: current, changed: false })
  }
  await sendOrderConfirmation(ctx, current)
  ctx.emit("purchase", { orderId: current.id, amount: current.total, currency: "KRW" })
  return succeed({ order: current, changed: true })
}

/** 취소된 주문에 돈이 들어왔으면 전액 돌려준다(공급자에서 실제로 결제됐을 때만) */
async function refundLatePayment(ctx: Ctx, order: OrderRecord): Promise<Failure> {
  const seen = order.paymentId ? await ctx.gateway.verify(order.paymentId) : { status: "not_found" as const }
  const refunded = seen.status === "paid" && order.paymentId ? await refund(ctx, order.paymentId, "order already canceled") : false
  return fail("order_canceled", { status: order.status, refunded })
}

/** 최선을 다한 환불(던지지 않는다 — 실패하면 운영 알림). 돌려줬으면 true */
async function refund(ctx: Ctx, paymentId: string, reason: string): Promise<boolean> {
  try {
    const result = await ctx.gateway.cancel({ paymentId, reason })
    if (!result.ok && result.code !== "already_canceled") ctx.onError(new Error(`refund failed for payment ${paymentId} (${result.code})`))
    return result.ok || result.code === "already_canceled"
  } catch (e) {
    ctx.onError(asError(e))
    return false
  }
}

// ── 취소 · 환불 ───────────────────────────────────────────────────────────────

export interface CancelOrderInput {
  orderId: string
  /** 손님이 부르면 필수 — 내 주문만 취소한다. 관리자는 생략 */
  userId?: string
  reason?: string
  by: "customer" | "admin"
}

/** 결제 전이면 취소 + 재고 반환, 결제 후면 공급자 환불이 성공해야 refunded + 재고 반환(준비 중이면 재고는 그대로). 이미 끝난 주문: 관리자에게는 같은 결과(멱등), 손님에게는 not_cancelable */
export async function cancelOrder(ctx: Ctx, input: CancelOrderInput): Promise<Outcome<OrderRecord>> {
  const reason = (input.reason ?? "").trim().slice(0, RULES.reasonMax) || t(ctx.locale, "commerce.defaultCancelReason")
  for (let attempt = 0; attempt < 3; attempt++) {
    const order = input.by === "customer" ? (input.userId ? await ownedOrder(ctx.db, input.orderId, input.userId) : null) : await loadOrder(ctx.db, input.orderId)
    if (!order) return fail("not_found")
    // 이미 끝난 주문: 관리자는 같은 결과를 돌려받는다(멱등). 손님이 다시 부르면 취소할 수 없는 주문이다(계약 CommercePort — commerce.cancel.canceled·refunded)
    if (order.status === "canceled" || order.status === "refunded") return input.by === "admin" ? succeed(order) : fail("not_cancelable", { status: order.status })
    const allowed: readonly OrderStatus[] = input.by === "customer" ? CUSTOMER_CANCELABLE : ["pending_payment", ...REFUNDABLE_BY_ADMIN]
    if (!allowed.includes(order.status)) return fail("not_cancelable", { status: order.status })

    if (order.status === "pending_payment") {
      const now = ctx.now()
      const moved = await ctx.db.transaction(async (tx) => {
        const done = await moveOrder(tx, order.id, ["pending_payment"], "canceled", { canceledAt: now })
        if (done) await restockOrder(tx, order.items, now)
        return done
      })
      if (moved) return succeed((await loadOrder(ctx.db, order.id)) ?? order)
      continue // 그 사이 결제됐거나 다른 곳에서 취소됐다 — 다시 읽고 판단한다
    }

    // paid · preparing: 돈을 먼저 돌려주고(실패하면 상태 그대로) 상태를 맞춘다
    if (!order.paymentId || !(await refund(ctx, order.paymentId, reason))) return fail("refund_failed")
    const now = ctx.now()
    const closed = await ctx.db.transaction(async (tx) => {
      // 준비가 시작된 주문(상품이 포장돼 나갔을 수 있다)은 재고를 되돌리지 않는다
      if (await moveOrder(tx, order.id, ["paid"], "refunded", { canceledAt: now })) {
        await restockOrder(tx, order.items, now)
        return true
      }
      return moveOrder(tx, order.id, ["preparing"], "refunded", { canceledAt: now })
    })
    const after = (await loadOrder(ctx.db, order.id)) ?? order
    // 동시에 두 번 눌러 다른 쪽이 먼저 환불로 닫았으면 같은 결과다(멱등)
    if (!closed && after.status !== "refunded") {
      // 환불은 나갔는데 그 사이 주문이 배송 중으로 넘어갔다 — 성공이라고 알리지 않고 운영자이 직접 처리하도록 알린다
      ctx.onError(new Error(`order ${order.id}: refunded at the provider but the order is now ${after.status} — handle by hand`))
      return fail("not_cancelable", { status: after.status })
    }
    return succeed(after)
  }
  const last = await loadOrder(ctx.db, input.orderId)
  return last ? fail("not_cancelable", { status: last.status }) : fail("not_found")
}

// ── 만료 ──────────────────────────────────────────────────────────────────────

export interface ExpireReport {
  canceled: number
  confirmed: number
  skipped: number
}

/** 결제 대기 시간이 지난 주문을 정리한다. 웹훅을 놓쳐 결제는 됐는데 대기로 남은 주문은 취소하지 않고 확정한다 */
export async function expirePending(ctx: Ctx): Promise<ExpireReport> {
  const report: ExpireReport = { canceled: 0, confirmed: 0, skipped: 0 }
  const due = await ctx.db
    .select({ id: orders.id, paymentId: orders.paymentId })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lte(orders.expiresAt, ctx.now())))
    .orderBy(asc(orders.expiresAt))
    .limit(RULES.expireBatch)
  for (const row of due) {
    try {
      if (row.paymentId && (await ctx.gateway.verify(row.paymentId)).status === "paid") {
        const result = await confirmPayment(ctx, { paymentId: row.paymentId })
        if (result.ok && result.value.changed) report.confirmed++
        else if (!result.ok) report.skipped++
        continue
      }
      const order = await loadOrder(ctx.db, row.id)
      if (!order) continue
      const now = ctx.now()
      const moved = await ctx.db.transaction(async (tx) => {
        const done = await moveOrder(tx, order.id, ["pending_payment"], "canceled", { canceledAt: now })
        if (done) await restockOrder(tx, order.items, now)
        return done
      })
      if (moved) report.canceled++
    } catch (e) {
      ctx.onError(asError(e))
      report.skipped++
    }
  }
  return report
}

// ── 앞걸음 ────────────────────────────────────────────────────────────────────

export interface AdvanceOrderInput {
  orderId: string
  to: string
  trackingNumber?: string
}

/** 관리자가 준비 → 배송 → 완료로 한 칸씩 민다. 표에 없는 전이는 거절하고 상태를 바꾸지 않는다 */
export async function advanceOrder(ctx: Ctx, input: AdvanceOrderInput): Promise<Outcome<OrderRecord>> {
  const to = FORWARD_STEPS.find((s) => s === input.to)
  if (!to) return fail("invalid_input")
  let tracking: string | undefined
  if (input.trackingNumber !== undefined) {
    tracking = typeof input.trackingNumber === "string" ? input.trackingNumber.trim() : ""
    if (!tracking || tracking.length > RULES.trackingNumberMax) return fail("invalid_input")
  }
  const order = await loadOrder(ctx.db, input.orderId)
  if (!order) return fail("not_found")
  if (!canMove(order.status, to)) return fail("invalid_transition", { status: order.status })
  const moved = await moveOrder(ctx.db, order.id, [order.status], to, to === "shipped" && tracking ? { trackingNumber: tracking } : {})
  const current = await loadOrder(ctx.db, order.id)
  if (!current) return fail("not_found")
  return moved ? succeed(current) : fail("invalid_transition", { status: current.status })
}
