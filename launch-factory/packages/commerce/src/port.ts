// 계약 CommercePort 구현 — 도메인 함수(cart·checkout·orders)를 묶어 블록이 받는 ActionResult 로 바꾼다.
// 사용자는 입력이 아니라 만든 때 정해진다(commercePort(deps) 의 deps.userId — 서버 액션이 세션에서 읽어 넘긴다). 요청 제한·대리 로그인 차단은 부르는 서버 액션의 몫이다.
// 사람 글은 모두 i18n(commerce.*)에서 읽는다. 던지지 않는다: 예상한 실패는 code 가 있는 실패 결과로, 인프라 오류(DB·결제 공급자)는 provider_unavailable(retryable)로 끝나고 운영 알림(onError)으로 남는다.
import type { ActionResult, Cart, CartLine, CatalogItem, CommercePort, Order, PaymentSession } from "@launch-factory/contract"
import { t, type Locale } from "@launch-factory/i18n"
import { requireConfirmation } from "@launch-factory/security/action"
import { won } from "@launch-factory/payments-kr"
import { readCart, setLine, type CartView } from "./cart.ts"
import { cancelOrder, confirmPayment, placeOrder } from "./checkout.ts"
import { withDefaults, type CommerceDeps, type Ctx } from "./deps.ts"
import { fail as failure, type Failure } from "./outcome.ts"
import { listOrders, ownedOrder, type OrderRecord } from "./orders.ts"
import { RULES } from "./rules.ts"
import { stockLevelsOf } from "./stock.ts"

/** 포트를 만드는 데 필요한 것 — 판매 주입 면 + 로그인한 사용자 */
export interface CommercePortDeps extends CommerceDeps {
  userId: string
}

/** 다시 보내면 성공할 수 있는 실패(기다리면 되거나 일시 오류) */
const RETRYABLE = new Set<string>(["payment_pending", "refund_failed", "provider_unavailable"])

type Fail = Extract<ActionResult<never>, { ok: false }>
const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data })

function shown(ctx: Pick<Ctx, "locale">, f: Failure, names: (id: string) => string): Fail {
  const code = f.code
  const ended = code === "not_cancelable" && (f.status === "canceled" || f.status === "refunded") // 코드는 계약대로 not_cancelable, 글은 「이미 취소된 주문」
  const key = code === "out_of_stock" && f.available !== undefined ? "out_of_stock_left" : code === "order_canceled" && f.refunded ? "order_canceled_refunded" : ended ? "order_canceled" : code
  const text = t(ctx.locale, `commerce.failure.${key}` as Parameters<typeof t>[1], {
    ...(f.productId ? { name: names(f.productId) } : {}),
    ...(f.available !== undefined ? { available: f.available } : {}),
    ...(code === "invalid_quantity" ? { max: RULES.maxLineQuantity } : {}),
  })
  const fieldErrors: Fail["fieldErrors"] =
    code === "invalid_address" && f.fields
      ? Object.fromEntries(Object.entries(f.fields).map(([field, problem]) => [field, [t(ctx.locale, `commerce.field.${problem === "too_long" ? "tooLong" : problem}`)]]))
      : code === "out_of_stock" && f.productId
        ? { [f.productId]: [text] }
        : undefined
  return { ok: false, code, retryable: RETRYABLE.has(code), formError: text, ...(fieldErrors ? { fieldErrors } : {}) }
}

/** 도메인 실패 → 사람 글이 든 계약 실패. 포트 밖(관리자 액션)에서 같은 문구를 쓰려고 연다. 상품 이름을 모르면 id 를 그대로 쓴다 */
export function failureResult(locale: Locale, f: Failure, nameOf: (productId: string) => string = (id) => id): Fail {
  return shown({ locale }, f, nameOf)
}

/** 상점이 꺼져 있을 때(결제 키 없음) 모든 메서드가 돌려주는 실패 */
export function unavailableResult(locale: Locale): Fail {
  return { ok: false, code: "provider_unavailable", retryable: false, formError: t(locale, "commerce.unavailable") }
}

/** 상점이 꺼진 포트 — 메서드마다 같은 실패. 서버 액션이 commerceEnabled() 가 false 일 때 쓴다 */
export function unavailablePort(locale: Locale = "ko"): CommercePort {
  const off = async (): Promise<Fail> => unavailableResult(locale)
  return { catalog: off, cart: off, setCartLine: off, placeOrder: off, confirmPayment: off, orders: off, order: off, cancelOrder: off }
}

function toLines(ctx: Ctx, record: OrderRecord): CartLine[] {
  return record.items.map((i) => {
    const imageUrl = ctx.catalog.get(i.productId)?.imageUrl
    return { productId: i.productId, name: i.name, unitPrice: won(i.unitAmount), quantity: i.quantity, ...(imageUrl ? { imageUrl } : {}) }
  })
}

const NO_ADDRESS = { recipient: "", phone: "", postcode: "", address1: "" }

function toOrder(ctx: Ctx, o: OrderRecord): Order {
  return {
    id: o.id,
    status: o.status,
    lines: toLines(ctx, o),
    subtotal: won(o.subtotal),
    shipping: won(o.shipping),
    total: won(o.total),
    address: o.address ?? NO_ADDRESS, // 탈퇴 파기로 비워진 배송지
    createdAt: o.createdAt.toISOString(),
    ...(o.paidAt ? { paidAt: o.paidAt.toISOString() } : {}),
    ...(o.trackingNumber ? { trackingNumber: o.trackingNumber } : {}),
    ...(o.canceledAt ? { canceledAt: o.canceledAt.toISOString() } : {}),
  }
}

const toCart = (v: CartView): Cart => ({
  lines: v.lines.map((l) => ({
    productId: l.productId,
    name: l.name,
    unitPrice: won(l.unitAmount),
    quantity: l.quantity,
    ...(l.imageUrl ? { imageUrl: l.imageUrl } : {}),
    ...(l.available !== undefined ? { available: l.available } : {}),
  })),
  subtotal: won(v.subtotal),
  shipping: won(v.shipping),
  total: won(v.total),
})

const text = (v: unknown): string => (typeof v === "string" ? v : "")
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * 상품표 + 지금 남은 재고(DB 가 정본). 로그인한 사람이 필요 없다 — 공개 상품 목록 쪽(서버 컴포넌트)이 같은 읽기를 쓰고, 포트의 catalog() 도 이것이다.
 * 던질 수 있다(DB 오류) — 포트는 provider_unavailable 로, 쪽은 오류 상태로 바꾼다.
 */
export async function readCatalog(deps: Pick<CommerceDeps, "db" | "catalog">): Promise<CatalogItem[]> {
  const limited = deps.catalog.items.filter((i) => i.stock !== null).map((i) => i.id)
  const levels = await stockLevelsOf(deps.db, limited)
  return deps.catalog.items.map((i) => ({ ...i, stock: i.stock === null ? null : (levels.get(i.id) ?? i.stock) }))
}

export function commercePort(deps: CommercePortDeps): CommercePort {
  const ctx = withDefaults(deps)
  const { userId } = deps
  const nameOf = (id: string) => ctx.catalog.get(id)?.name ?? id
  const bad = (f: Failure) => shown(ctx, f, nameOf)
  // 인프라 오류는 던지지 않고 일시 오류로 — 운영자는 onError 로 안다
  const guarded = async <T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
    try {
      return await run()
    } catch (e) {
      ctx.onError(e instanceof Error ? e : new Error(String(e)))
      return { ok: false, code: "provider_unavailable", retryable: true, formError: t(ctx.locale, "commerce.failure.action_failed") }
    }
  }
  const confirmed = (input: unknown) => requireConfirmation<Record<string, unknown>>(input, ctx.locale)

  return {
    catalog: () => guarded(async () => ok(await readCatalog(ctx))),
    cart: () => guarded(async () => ok(toCart(await readCart(ctx.db, ctx, userId)))),
    setCartLine: (input) =>
      guarded(async () => {
        const i = asRecord(input)
        const result = await setLine(ctx.db, ctx, userId, text(i.productId), i.quantity)
        if (!result.ok) return bad(result)
        if (result.value.added > 0) ctx.emit("add_to_cart", { productId: text(i.productId), quantity: result.value.added })
        return ok(toCart(result.value.cart))
      }),
    placeOrder: (input) =>
      guarded(async () => {
        const gate = confirmed(input)
        if (!gate.ok) return gate.failure
        const result = await placeOrder(ctx, { userId, address: gate.rest.address })
        if (!result.ok) return bad(result)
        const { order, payment } = result.value
        const session: PaymentSession = payment
        return ok({ order: toOrder(ctx, order), payment: session })
      }),
    confirmPayment: (input) =>
      guarded(async () => {
        const i = asRecord(input)
        const mine = await ownedOrder(ctx.db, text(i.orderId), userId)
        if (!mine || mine.paymentId === null || mine.paymentId !== text(i.paymentId)) return bad(failure("not_found"))
        const result = await confirmPayment(ctx, { paymentId: mine.paymentId })
        return result.ok ? ok(toOrder(ctx, result.value.order)) : bad(result)
      }),
    orders: () => guarded(async () => ok((await listOrders(ctx.db, userId)).map((o) => toOrder(ctx, o)))),
    order: (input) =>
      guarded(async () => {
        const found = await ownedOrder(ctx.db, text(asRecord(input).orderId), userId)
        return found ? ok(toOrder(ctx, found)) : bad(failure("not_found"))
      }),
    cancelOrder: (input) =>
      guarded(async () => {
        const gate = confirmed(input)
        if (!gate.ok) return gate.failure
        const reason = typeof gate.rest.reason === "string" ? gate.rest.reason : undefined
        const result = await cancelOrder(ctx, { orderId: text(gate.rest.orderId), userId, by: "customer", ...(reason ? { reason } : {}) })
        return result.ok ? ok(toOrder(ctx, result.value)) : bad(result)
      }),
  }
}
