// 장바구니 — 로그인 사용자의 DB 장바구니(cart_items). 책임은 「담기·빼기·읽기」뿐이다.
// 입력은 상품 id 와 수량이고, 이름·단가는 읽을 때 서버 상품표에서 가져온다(표에 가격을 두지 않는다). 상품표에서 사라진 줄은 읽기에서 뺀다.
// 재고 제한이 있는 상품은 담을 때 남은 수량을 넘지 못한다 — 마지막 확인은 주문(placeOrder)의 재고 예약이 한다.
import { and, eq } from "drizzle-orm"
import { cartItems } from "@launch-factory/db"
import type { Catalog } from "./catalog.ts"
import type { Executor } from "./deps.ts"
import { fail, succeed, type Outcome } from "./outcome.ts"
import { totalsOf, type ShippingRule, type Totals } from "./pricing.ts"
import { RULES } from "./rules.ts"
import { stockLevelsOf } from "./stock.ts"

export interface CartLineView {
  productId: string
  name: string
  unitAmount: number
  quantity: number
  imageUrl?: string
  /** 지금 살 수 있는 남은 수(재고 제한이 있는 상품만) */
  available?: number
}

export interface CartView extends Totals {
  lines: CartLineView[]
}

/** 읽기에 필요한 것만 — 전체 주입 면을 알 필요가 없다 */
export interface CartContext {
  catalog: Catalog
  shipping: ShippingRule
}

export async function cartRows(x: Executor, userId: string): Promise<{ productId: string; quantity: number }[]> {
  return x.select({ productId: cartItems.productId, quantity: cartItems.quantity }).from(cartItems).where(eq(cartItems.userId, userId)).orderBy(cartItems.productId)
}

export async function clearCart(x: Executor, userId: string): Promise<void> {
  await x.delete(cartItems).where(eq(cartItems.userId, userId))
}

export async function readCart(x: Executor, ctx: CartContext, userId: string): Promise<CartView> {
  const rows = await cartRows(x, userId)
  const known = rows.filter((r) => ctx.catalog.get(r.productId))
  const limited = known.filter((r) => ctx.catalog.get(r.productId)?.stock !== null).map((r) => r.productId)
  const levels = await stockLevelsOf(x, limited)
  const lines: CartLineView[] = known.map((r) => {
    const item = ctx.catalog.get(r.productId)!
    const available = item.stock === null ? undefined : (levels.get(r.productId) ?? item.stock)
    return {
      productId: r.productId,
      name: item.name,
      unitAmount: item.price.amount,
      quantity: r.quantity,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(available !== undefined ? { available } : {}),
    }
  })
  return { lines, ...totalsOf(lines, ctx.shipping) }
}

/** 한 줄의 수량을 정한다(0 이면 뺀다). added = 이번에 늘어난 수량(계측용, 줄이면 0) */
export async function setLine(x: Executor, ctx: CartContext, userId: string, productId: string, quantity: unknown): Promise<Outcome<{ cart: CartView; added: number }>> {
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > RULES.maxLineQuantity) return fail("invalid_quantity")
  const item = ctx.catalog.get(productId)
  if (!item) return fail("unknown_product", { productId })

  if (quantity > 0 && item.stock !== null) {
    const available = (await stockLevelsOf(x, [productId])).get(productId) ?? item.stock
    if (quantity > available) return fail("out_of_stock", { productId, available })
  }

  const before = (await cartRows(x, userId)).find((r) => r.productId === productId)?.quantity ?? 0
  if (quantity === 0) await x.delete(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
  else await x.insert(cartItems).values({ userId, productId, quantity }).onConflictDoUpdate({ target: [cartItems.userId, cartItems.productId], set: { quantity } })
  return succeed({ cart: await readCart(x, ctx, userId), added: Math.max(0, quantity - before) })
}
