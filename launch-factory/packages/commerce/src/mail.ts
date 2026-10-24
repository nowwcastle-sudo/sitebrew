// 주문 확인 메일 — 결제가 확정된 주문 하나에 메일 한 통. 책임은 「주문 기록 → 템플릿 입력 → 보내기」뿐이다.
// 받는 사람은 주문한 사용자의 가입 이메일이다. 메일 실패는 던지지 않고 결과로 돌려준다(주문은 이미 확정됐다 — 부르는 쪽이 운영 알림으로 보낸다).
// 멱등 키(shop-order-confirmation:<주문 id>)를 달아 공급자 쪽 재시도가 같은 메일을 두 번 보내지 않게 한다.
import { eq } from "drizzle-orm"
import type { ShopOrderConfirmationInput } from "@launch-factory/email"
import { user } from "@launch-factory/db"
import { won } from "@launch-factory/payments-kr"
import type { Ctx } from "./deps.ts"
import type { OrderRecord } from "./orders.ts"

/** 템플릿 입력(순수) — 금액은 주문 행 그대로 싣는다(다시 계산하지 않는다) */
export function orderMail(order: OrderRecord, who: { name?: string | null }, ctx: Pick<Ctx, "locale" | "timeZone" | "productName" | "ordersUrl">): ShopOrderConfirmationInput {
  const a = order.address
  return {
    locale: ctx.locale,
    productName: ctx.productName,
    ...(who.name ? { recipientName: who.name } : {}),
    ...(ctx.timeZone ? { timeZone: ctx.timeZone } : {}),
    orderId: order.id,
    orderedAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitAmount: won(i.unitAmount) })),
    subtotal: won(order.subtotal),
    shipping: won(order.shipping),
    total: won(order.total),
    address: {
      recipient: a?.recipient ?? "",
      address1: a?.address1 ?? "",
      ...(a?.phone ? { phone: a.phone } : {}),
      ...(a?.postcode ? { postcode: a.postcode } : {}),
      ...(a?.address2 ? { address2: a.address2 } : {}),
      ...(a?.note ? { note: a.note } : {}),
    },
    ordersUrl: ctx.ordersUrl,
  }
}

/** 보낸다. 사용자 행이 없거나(탈퇴) 보내기가 실패하면 false — 던지지 않는다 */
export async function sendOrderConfirmation(ctx: Ctx, order: OrderRecord): Promise<boolean> {
  try {
    if (!order.userId) return false
    const [row] = await ctx.db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, order.userId)).limit(1)
    if (!row) return false
    const result = await ctx.mailer.send({
      to: row.email,
      template: "shopOrderConfirmation",
      idempotencyKey: `shop-order-confirmation:${order.id}`,
      input: orderMail(order, row, ctx),
    })
    if (!result.ok) ctx.onError(new Error(`order ${order.id}: confirmation mail failed (${result.error.name})`))
    return result.ok
  } catch (e) {
    ctx.onError(e instanceof Error ? e : new Error(String(e)))
    return false
  }
}
