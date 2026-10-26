// 주문 쓰기의 공통 두 가지 — 상태 옮기기(조건부 UPDATE)와 재고 되돌리기. 책임은 「한 번만 일어나게 하는 것」뿐이다.
// 옮기기는 UPDATE … WHERE status IN (from) 라서 같은 전이를 동시에 여러 번 시도해도 한 번만 성공한다(true 를 받은 쪽만 뒷일 — 재고·메일·계측 — 을 한다).
// 전이 표(TRANSITIONS)에 없는 옮김은 프로그램 오류라 던진다.
import { and, inArray, eq } from "drizzle-orm"
import type { OrderStatus } from "@launch-factory/contract"
import { orders } from "@launch-factory/db"
import type { Executor } from "./deps.ts"
import { canMove } from "./order-states.ts"
import type { OrderItemRecord } from "./orders.ts"
import { release, stockLevelsOf } from "./stock.ts"

export interface MovePatch {
  paidAt?: Date
  canceledAt?: Date
  trackingNumber?: string
}

/** from 중 하나인 주문만 to 로 옮긴다. 옮겼으면 true, 이미 다른 상태라 못 옮겼으면 false */
export async function moveOrder(x: Executor, orderId: string, from: readonly OrderStatus[], to: OrderStatus, patch: MovePatch = {}): Promise<boolean> {
  for (const f of from) if (!canMove(f, to)) throw new Error(`order transition not allowed: ${f} -> ${to}`)
  const rows = await x
    .update(orders)
    .set({ status: to, ...patch })
    .where(and(eq(orders.id, orderId), inArray(orders.status, [...from])))
    .returning({ id: orders.id })
  return rows.length > 0
}

/** 주문이 붙들고 있던 재고를 돌려준다. 재고 행이 없는 상품(제한 없는 상품)은 건드리지 않는다 */
export async function restockOrder(x: Executor, items: readonly OrderItemRecord[], now: Date): Promise<void> {
  if (items.length === 0) return
  const levels = await stockLevelsOf(x, items.map((i) => i.productId))
  await release(x, items.filter((i) => levels.has(i.productId)).map((i) => ({ sku: i.productId, quantity: i.quantity })), now)
}
