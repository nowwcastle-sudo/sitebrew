// 주문 읽기 — orders·order_items 를 읽어 하나의 기록(OrderRecord)으로 합친다. 쓰기는 checkout 이 한다.
// 사용자 범위는 여기서 지킨다: ownedOrder 는 남의 주문을 「없음」으로 돌려준다(존재 여부도 알려 주지 않는다).
import { count, desc, eq, inArray } from "drizzle-orm"
import type { OrderStatus } from "@launch-factory/contract"
import { orderItems, orders, type StoredShippingAddress } from "@launch-factory/db"
import type { Executor } from "./deps.ts"

export interface OrderItemRecord {
  productId: string
  name: string
  unitAmount: number
  quantity: number
}

export interface OrderRecord {
  id: string
  userId: string | null
  status: OrderStatus
  subtotal: number
  shipping: number
  total: number
  paymentId: string | null
  address: StoredShippingAddress | null
  trackingNumber: string | null
  createdAt: Date
  paidAt: Date | null
  canceledAt: Date | null
  expiresAt: Date
  items: OrderItemRecord[]
}

type OrderRow = typeof orders.$inferSelect

async function withItems(x: Executor, rows: OrderRow[]): Promise<OrderRecord[]> {
  if (rows.length === 0) return []
  const items = await x
    .select({ orderId: orderItems.orderId, productId: orderItems.productId, name: orderItems.name, unitAmount: orderItems.unitAmount, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(orderItems.productId)
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    status: r.status,
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
    paymentId: r.paymentId,
    address: r.address,
    trackingNumber: r.trackingNumber,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    canceledAt: r.canceledAt,
    expiresAt: r.expiresAt,
    items: items.filter((i) => i.orderId === r.id).map((i) => ({ productId: i.productId, name: i.name, unitAmount: i.unitAmount, quantity: i.quantity })),
  }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadOrder(x: Executor, orderId: string): Promise<OrderRecord | null> {
  if (!UUID.test(orderId)) return null // uuid 칸에 형식이 틀린 값을 넣으면 DB 가 던진다 — 없는 주문으로 본다
  const [row] = await x.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  return row ? ((await withItems(x, [row]))[0] ?? null) : null
}

export async function loadOrderByPayment(x: Executor, paymentId: string): Promise<OrderRecord | null> {
  const [row] = await x.select().from(orders).where(eq(orders.paymentId, paymentId)).limit(1)
  return row ? ((await withItems(x, [row]))[0] ?? null) : null
}

/** 내 주문 — 남의 주문이면 null (없는 주문과 구별하지 않는다) */
export async function ownedOrder(x: Executor, orderId: string, userId: string): Promise<OrderRecord | null> {
  const order = await loadOrder(x, orderId)
  return order && order.userId === userId ? order : null
}

/** 내 주문 목록, 최근 순 */
export async function listOrders(x: Executor, userId: string): Promise<OrderRecord[]> {
  const rows = await x.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt), desc(orders.id))
  return withItems(x, rows)
}

/** 관리자용 전체 주문(최근 순). status 를 주면 그 상태만. limit 은 1~200, offset 은 건너뛸 줄 수(0 이상, 쪽 매김) */
export async function listAllOrders(x: Executor, opts: { status?: OrderStatus; limit?: number; offset?: number } = {}): Promise<OrderRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 200)
  const offset = Math.max(Math.trunc(opts.offset ?? 0), 0)
  const query = x.select().from(orders)
  const rows = await (opts.status ? query.where(eq(orders.status, opts.status)) : query).orderBy(desc(orders.createdAt), desc(orders.id)).limit(limit).offset(offset)
  return withItems(x, rows)
}

/** 관리자용 주문 수(상태를 주면 그 상태만) — 목록이 잘렸는지 알리는 total 과 개요의 할 일 수가 쓴다 */
export async function countOrders(x: Executor, status?: OrderStatus): Promise<number> {
  const query = x.select({ n: count() }).from(orders)
  const [row] = await (status ? query.where(eq(orders.status, status)) : query)
  return row?.n ?? 0
}
