// 송장 번호 저장 — 상태를 바꾸지 않고 번호만 정한다(관리 화면의 폼 저장). 배송 전 상태(TRACKING_EDITABLE)의 주문에만 쓴다.
// 상태 확인과 쓰기가 한 UPDATE 라서, 읽은 뒤 다른 곳에서 배송이 시작되어도 번호를 덮어쓰지 않는다.
import { and, eq, inArray } from "drizzle-orm"
import { orders } from "@launch-factory/db"
import type { Ctx } from "./deps.ts"
import { TRACKING_EDITABLE } from "./order-states.ts"
import { fail, succeed, type Outcome } from "./outcome.ts"
import { loadOrder, type OrderRecord } from "./orders.ts"
import { RULES } from "./rules.ts"

export interface SetTrackingInput {
  orderId: string
  trackingNumber: unknown
}

/** 송장 번호를 정한다(앞뒤 공백은 뗀다). 빈 값·긴 값 invalid_input · 없는 주문 not_found · 배송 전이 아니면 invalid_transition(status 를 싣는다) */
export async function setTrackingNumber(ctx: Ctx, input: SetTrackingInput): Promise<Outcome<OrderRecord>> {
  const tracking = typeof input.trackingNumber === "string" ? input.trackingNumber.trim() : ""
  if (!tracking || tracking.length > RULES.trackingNumberMax) return fail("invalid_input")
  const order = await loadOrder(ctx.db, input.orderId)
  if (!order) return fail("not_found")
  const rows = await ctx.db
    .update(orders)
    .set({ trackingNumber: tracking })
    .where(and(eq(orders.id, order.id), inArray(orders.status, [...TRACKING_EDITABLE])))
    .returning({ id: orders.id })
  const current = await loadOrder(ctx.db, order.id)
  if (!current) return fail("not_found")
  return rows.length > 0 ? succeed(current) : fail("invalid_transition", { status: current.status })
}
