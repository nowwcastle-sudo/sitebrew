// 주문과 탈퇴·내려받기(계획 3d L4). 근거(국가법령정보센터 Open API, 2026-09-30 확인 — 출처 값은 @launch-factory/db RETENTION_SOURCE):
//   - 전자상거래법 제6조제1항·시행령 제6조제1항제3호: 대금결제 및 재화등의 공급에 관한 기록은 5년 보존 → 주문 행(금액·상태·결제 id·줄)은 지우지 않는다.
//   - 개인정보 보호법 제21조제1항·제3항: 목적이 끝난 개인정보는 파기하고, 다른 법령 때문에 남기는 것은 분리 저장 → 배송지(받는 분·전화·주소·메모)는 거래가 끝나면 비운다.
// 세 가지로 나눈다:
//   1. 수집기 orderCollector: 결제된 주문을 retained_transactions(kind payment, 파기 시각부터 5년)에 가명 참조(subject_ref)로 옮긴다.
//      사람과 주문을 잇는 길은 이 참조뿐이다(주문 행의 user_id 는 파기로 끊긴다). 줄에는 상품 id·수량·단가만 두고 이름·배송지는 싣지 않는다.
//   2. 파기자 anonymizeUserOrders: 거래가 끝난 주문(배송 완료·취소·환불)의 배송지를 비운다. 진행 중인 주문(결제 대기·결제 완료·준비 중·배송 중)은 배송에 필요하므로 둔다.
//   3. 정리 deidentifyOrphanOrders: 사용자가 없는 주문 중 거래가 끝난 것의 배송지를 비운다(2 에서 남긴 진행 중 주문이 끝난 뒤 — 파기 Cron 이 매번 부른다).
// 탈퇴를 막지 않는다: 진행 중인 주문이 있어도 계정은 지워진다(예약 모듈과 같은 선례) — 배송은 남은 배송지로 끝낸다.
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm"
import { orderItems, orders, type Database, type OrderStatus } from "@launch-factory/db"
import type { RetainedItem, RetentionCollector, Tx } from "./retention.ts"

/** 더 바뀌지 않는 상태(commerce 의 전이 표에서 나갈 곳이 없는 상태). 배송지가 더는 필요 없다 */
export const SETTLED_ORDER_STATUSES = ["delivered", "canceled", "refunded"] as const satisfies readonly OrderStatus[]

type Db = Database | Tx
const iso = (v: Date | null | undefined) => (v ? v.toISOString() : null)

/** 결제된 주문(결제 시각이 있는 것)을 보존 기록으로. 결제 전에 취소된 주문은 결제·공급이 없어 옮기지 않는다 */
export const orderCollector: RetentionCollector = async (tx, { userId, now }) => {
  const rows = await tx.select().from(orders).where(and(eq(orders.userId, userId), isNotNull(orders.paidAt))).orderBy(asc(orders.createdAt))
  const items: RetainedItem[] = []
  for (const o of rows) {
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(asc(orderItems.productId))
    items.push({
      kind: "payment",
      provider: "launch-factory",
      providerRef: `order:${o.id}`,
      occurredAt: now,
      record: {
        type: "order",
        statusAtDeletion: o.status,
        subtotal: o.subtotal,
        shipping: o.shipping,
        total: o.total,
        currency: o.currency,
        paymentId: o.paymentId,
        placedAt: iso(o.createdAt),
        paidAt: iso(o.paidAt),
        canceledAt: iso(o.canceledAt),
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitAmount: l.unitAmount })),
      },
    })
  }
  return items
}

/** 파기 트랜잭션 안에서: 이 사용자의 거래가 끝난 주문의 배송지를 비운다(user 행을 지우기 전). 비운 주문 수 */
export async function anonymizeUserOrders(tx: Tx, userId: string): Promise<number> {
  const done = await tx
    .update(orders)
    .set({ address: null })
    .where(and(eq(orders.userId, userId), isNotNull(orders.address), inArray(orders.status, [...SETTLED_ORDER_STATUSES])))
    .returning({ id: orders.id })
  return done.length
}

/** 사용자 연결이 끊긴 주문 중 거래가 끝난 것의 배송지를 비운다. 비운 주문 수 */
export async function deidentifyOrphanOrders(d: Db): Promise<number> {
  const done = await d
    .update(orders)
    .set({ address: null })
    .where(and(isNull(orders.userId), isNotNull(orders.address), inArray(orders.status, [...SETTLED_ORDER_STATUSES])))
    .returning({ id: orders.id })
  return done.length
}
