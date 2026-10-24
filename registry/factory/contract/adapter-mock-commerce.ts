// 판매 포트 목(registry:lib "adapter-mock-commerce"). 상품 담기 → 장바구니 → 배송지 → 결제 → 주문 확인 → 내 주문 한 바퀴를 키·서버 없이 그린다.
// 쿼리 규칙은 adapter-mock 과 같다(?state= ?submit= &delay=) — 그 파일이 내보내는 도우미(portCtx·reader·writer·needsConfirmation)를 그대로 쓴다.
// 결정적이다 — 같은 인자는 같은 처음 상태이고, 인스턴스는 상태를 가진다(담은 줄·주문·재고). 날짜는 고정값(MOCK_NOW)이라 스크린샷이 흔들리지 않는다.
import type { ActionResult } from "@/registry/factory/contract/block-contract"
import type { Cart, CartLine, CartTotals, CatalogItem, CommercePort, Order, OrderStatus, PaymentSession, ShippingAddress } from "@/registry/factory/contract/commerce"
import type { HumanConfirmation, Money } from "@/registry/factory/contract/ports"
import { MOCK_NOW, type Failure, type PortMockOptions, copy, fail, needsConfirmation, oneOf, portCtx, reader, toParams, writer } from "@/registry/factory/contract/adapter-mock"

export const MOCK_CARTS = ["empty", "filled"] as const
export const MOCK_STOCKS = ["ok", "out"] as const
/** 주문 상태 일곱 개(계약 OrderStatus 와 같다 — app/qa/blocks/ports.typetest.ts 가 typecheck 에서 맞춘다) */
export const MOCK_ORDER_STATUSES = ["pending_payment", "paid", "preparing", "shipped", "delivered", "canceled", "refunded"] as const satisfies readonly OrderStatus[]
export type MockCart = (typeof MOCK_CARTS)[number]
export type MockStock = (typeof MOCK_STOCKS)[number]

/** 배송비 규칙(원). 소계가 freeOver 이상이거나 비어 있으면 배송비 0 */
export interface MockShipping {
  fee: number
  freeOver: number
}
export const MOCK_SHIPPING: MockShipping = { fee: 3_000, freeOver: 50_000 }

const won = (amount: number): Money => ({ amount, currency: "KRW", vatIncluded: true })

/** 예시 상품표(가상 상품, 원화·부가세 포함). 첫 상품만 재고가 적어 ?stock=out 이 그것을 품절로 만든다 */
export const MOCK_CATALOG: readonly CatalogItem[] = [
  { id: "sku-mug", name: "머그컵(예시)", price: won(12_000), stock: 5 },
  { id: "sku-beans", name: "원두 200g(예시)", price: won(18_500), stock: null },
  { id: "sku-tumbler", name: "텀블러(예시)", price: won(32_000), stock: 2 },
]
/** 예시 배송지(가상 이름·번지) */
export const MOCK_ADDRESS: ShippingAddress = { recipient: "김예시", phone: "010-0000-0000", postcode: "04524", address1: "서울시 가상구 예시로 1", address2: "101호" }

/** ?cart=filled 의 처음 장바구니(상품 id → 수량) */
const FILLED: readonly (readonly [string, number])[] = [["sku-mug", 2], ["sku-beans", 1]]
/** ?order=<상태> 의 처음 주문 한 줄(상품 id → 수량) */
const SEEDED: readonly (readonly [string, number])[] = [["sku-beans", 2], ["sku-mug", 1]]
const SEED_PAID_AT = "2026-09-29T01:00:00.000Z"
const SEED_CANCELED_AT = "2026-09-30T01:00:00.000Z"
const PAID_STATUSES: readonly OrderStatus[] = ["paid", "preparing", "shipped", "delivered", "refunded"]
const MAX_QUANTITY = 99
const REQUIRED_ADDRESS = [
  ["recipient", "받는 분 이름을 입력해 주세요."],
  ["phone", "연락처를 입력해 주세요."],
  ["postcode", "우편번호를 입력해 주세요."],
  ["address1", "주소를 입력해 주세요."],
] as const

const NO_PRODUCT = "상품을 찾지 못했어요. 목록에서 다시 골라 주세요."
const NO_ORDER = "주문을 찾지 못했어요."
const EMPTY_CART = "장바구니가 비어 있어요. 상품을 담은 뒤 주문해 주세요."
const NOT_CANCELABLE = "이미 배송이 시작됐거나 끝난 주문은 여기서 취소할 수 없어요."
const BAD_PAYMENT = "이 주문의 결제 번호가 아니에요. 결제를 다시 확인해 주세요."
const notFound = (message: string, field?: string): Failure => ({ ok: false, code: "not_found", retryable: false, formError: message, ...(field ? { fieldErrors: { [field]: [message] } } : {}) })
const outOfStock = (item: Pick<CatalogItem, "id" | "name">, left: number): Failure => {
  const message = left > 0 ? `${item.name}은(는) ${left}개만 남았어요.` : `${item.name}은(는) 품절이에요.`
  return { ok: false, code: "out_of_stock", retryable: false, formError: message, fieldErrors: { [item.id]: [message] } }
}

/** 소계·배송비·합계. 모두 최소 단위 정수 — 목과 같은 규칙을 다른 곳에서 쓸 수 있게 내보낸다 */
export function mockTotalsOf(lines: readonly Pick<CartLine, "unitPrice" | "quantity">[], shipping: MockShipping = MOCK_SHIPPING): CartTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice.amount * l.quantity, 0)
  const fee = subtotal === 0 || subtotal >= shipping.freeOver ? 0 : shipping.fee
  return { subtotal: won(subtotal), shipping: won(fee), total: won(subtotal + fee) }
}

/** 상품표를 만들 때 검사한다 — 잘못된 목은 화면이 아니라 만든 자리에서 멈춘다 */
function checkCatalog(catalog: readonly CatalogItem[]): void {
  const seen = new Set<string>()
  for (const i of catalog) {
    if (seen.has(i.id)) throw new Error(`mock: 상품 id 가 중복돼요: ${i.id}`)
    seen.add(i.id)
    if (!Number.isInteger(i.price.amount) || i.price.amount <= 0) throw new Error(`mock: ${i.id} 의 가격은 0보다 큰 정수(원)여야 해요: ${i.price.amount}`)
    if (i.price.currency !== "KRW") throw new Error(`mock: ${i.id} 의 통화는 KRW 만 쓸 수 있어요: ${i.price.currency}`)
    if (i.stock !== null && (!Number.isInteger(i.stock) || i.stock < 0)) throw new Error(`mock: ${i.id} 의 재고는 0 이상의 정수이거나 null(제한 없음)이어야 해요: ${i.stock}`)
  }
}

/**
 * 판매 포트 목. ?cart=empty(기본)·filled 로 장바구니를, ?order=<상태>(pending_payment·paid·preparing·shipped·delivered·canceled·refunded)로 그 상태의 주문 하나를,
 * ?stock=out 으로 첫 상품의 품절을 고른다. 읽기(catalog·cart·orders·order)는 ?state=loading(끝나지 않음)·error(다시 시도할 수 있는 오류)·empty 를,
 * 쓰기(setCartLine·placeOrder·confirmPayment·cancelOrder)는 ?submit=ok|field-error|server-error|pending|rate-limited|timeout|approval-required 를 따른다(&delay=<ms> 도).
 * setCartLine 은 수량 0 이면 줄을 빼고, 재고보다 많이 담으면 { code: "out_of_stock", fieldErrors[상품 id] } 로 거절한다(재고 제한 없는 상품은 stock null).
 * 합계는 서버 상품표 단가로만 센다(mockTotalsOf — 소계가 options.shipping.freeOver 이상이면 배송비 0). placeOrder 는 재고를 잡고 장바구니를 비우며
 * 결제 대기 주문과 결제창 값(provider "mock", client {})을 돌려준다 — 배송지 필수 칸이 비거나 장바구니가 비면(empty_cart) 아무것도 바꾸지 않는다.
 * confirmPayment 는 결제 번호가 맞는 대기 주문을 paid 로 바꾼다(이미 paid 면 같은 결과 — 멱등). cancelOrder: 결제 전은 canceled(재고 반환), 결제 완료·준비 중은 refunded, 그 밖은 not_cancelable.
 * options.requireConfirmation 이면 승인 행동(placeOrder·cancelOrder)이 `confirmed: true` 없이는 아무것도 바꾸지 않고 { code: "confirmation_required", retryable: false } 로 끝난다(mockBilling 과 같다).
 * 금액은 최소 단위 정수(KRW 원, 부가세 포함)다. 네트워크·타이머를 쓰지 않는다(지연 옵션 없이는).
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockCommerce(
  search: string | URLSearchParams,
  options: PortMockOptions & { catalog?: readonly CatalogItem[]; shipping?: MockShipping; requireConfirmation?: boolean } = {},
): CommercePort {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const cartScene = oneOf("cart", q.get("cart") ?? "empty", MOCK_CARTS)
  const stockScene = oneOf("stock", q.get("stock") ?? "ok", MOCK_STOCKS)
  const orderScene = oneOf("order", q.get("order") ?? "none", ["none", ...MOCK_ORDER_STATUSES] as const)
  const base = options.catalog ?? MOCK_CATALOG
  checkCatalog(base)
  const shipping = options.shipping ?? MOCK_SHIPPING

  // 상태: 남은 재고(null = 제한 없음) · 담은 줄(상품 id → 수량, 담은 순서) · 주문(만든 순서, 결제 번호는 주문과 짝)
  const stock = new Map<string, number | null>(base.map((i, n) => [i.id, stockScene === "out" && n === 0 ? 0 : i.stock]))
  const cart = new Map<string, number>(cartScene === "filled" ? FILLED.filter(([id]) => stock.has(id)) : [])
  const orders: Order[] = []
  const paymentOf = new Map<string, string>()
  let serial = 0

  const item = (id: string) => base.find((i) => i.id === id)
  const lineOf = (id: string, quantity: number): CartLine => {
    const it = item(id) as CatalogItem
    const left = stock.get(id) ?? null
    return { productId: id, name: it.name, unitPrice: copy(it.price), quantity, ...(it.imageUrl ? { imageUrl: it.imageUrl } : {}), ...(left === null ? {} : { available: left }) }
  }
  const cartView = (): Cart => {
    const lines = [...cart].map(([id, n]) => lineOf(id, n))
    return { lines, ...mockTotalsOf(lines, shipping) }
  }
  // 주문 줄은 그때의 값을 남긴다 — 남은 수량(available)은 지금 장바구니의 안내라 주문에는 없다
  const snapshot = (line: CartLine): CartLine => {
    const rest = { ...line }
    delete rest.available
    return rest
  }
  const nextId = () => {
    serial += 1
    return { orderId: `mock-order-${serial}`, paymentId: `mock-pay-${serial}` }
  }
  const stampOrder = (status: OrderStatus, lines: CartLine[], address: ShippingAddress): Order => {
    const { orderId, paymentId } = nextId()
    paymentOf.set(orderId, paymentId)
    const order: Order = { id: orderId, status, lines, address: copy(address), createdAt: MOCK_NOW, ...mockTotalsOf(lines, shipping) }
    if (PAID_STATUSES.includes(status)) order.paidAt = SEED_PAID_AT
    if (status === "shipped" || status === "delivered") order.trackingNumber = "1234567890"
    if (status === "canceled" || status === "refunded") order.canceledAt = SEED_CANCELED_AT
    orders.push(order)
    return order
  }
  if (orderScene !== "none") {
    const lines = SEEDED.filter(([id]) => item(id)).map(([id, n]) => snapshot(lineOf(id, n)))
    stampOrder(orderScene, lines, MOCK_ADDRESS)
  }
  const release = (lines: readonly CartLine[]) => {
    for (const l of lines) {
      const left = stock.get(l.productId)
      if (typeof left === "number") stock.set(l.productId, left + l.quantity)
    }
  }
  const find = (id: string) => orders.find((o) => o.id === id)

  const orderList = reader(ctx, () => copy([...orders].reverse()), () => [])

  const port: CommercePort = {
    catalog: reader(ctx, () => base.map((i) => ({ ...copy(i), stock: stock.get(i.id) ?? null })), () => []),
    cart: reader(ctx, () => copy(cartView()), () => copy({ lines: [], ...mockTotalsOf([], shipping) })),
    setCartLine: writer(ctx, ({ productId, quantity }: { productId: string; quantity: number }): ActionResult<Cart> => {
      const it = item(productId)
      if (!it) return notFound(NO_PRODUCT, "productId")
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return fail("수량을 다시 확인해 주세요.", { quantity: [`수량은 0부터 ${MAX_QUANTITY}까지 정수로 입력해 주세요.`] })
      const left = stock.get(productId) ?? null
      if (left !== null && quantity > left) return outOfStock(it, left)
      if (quantity === 0) cart.delete(productId)
      else cart.set(productId, quantity)
      return { ok: true, data: copy(cartView()) }
    }),
    placeOrder: writer(ctx, ({ address }: { address: ShippingAddress } & HumanConfirmation): ActionResult<{ order: Order; payment: PaymentSession }> => {
      if (cart.size === 0) return { ok: false, code: "empty_cart", retryable: false, formError: EMPTY_CART }
      const missing = REQUIRED_ADDRESS.filter(([key]) => !String(address?.[key] ?? "").trim())
      if (missing.length) return fail("배송지를 다시 확인해 주세요.", Object.fromEntries(missing.map(([key, message]) => [key, [message]])))
      const lines = [...cart].map(([id, n]) => lineOf(id, n))
      const short = lines.find((l) => l.available !== undefined && l.quantity > l.available)
      if (short) return outOfStock({ id: short.productId, name: short.name }, short.available as number)
      for (const l of lines) {
        const left = stock.get(l.productId)
        if (typeof left === "number") stock.set(l.productId, left - l.quantity)
      }
      cart.clear()
      const order = stampOrder("pending_payment", lines.map(snapshot), address)
      const orderName = lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name
      const payment: PaymentSession = { provider: "mock", paymentId: paymentOf.get(order.id) as string, orderName, total: copy(order.total), client: {} }
      return { ok: true, data: copy({ order, payment }) }
    }),
    confirmPayment: writer(ctx, ({ orderId, paymentId }: { orderId: string; paymentId: string }): ActionResult<Order> => {
      const order = find(orderId)
      if (!order) return notFound(NO_ORDER)
      if (paymentOf.get(orderId) !== paymentId) return { ok: false, code: "payment_not_found", retryable: false, formError: BAD_PAYMENT }
      if (order.status === "pending_payment") {
        order.status = "paid"
        order.paidAt = MOCK_NOW
      }
      return PAID_STATUSES.includes(order.status) ? { ok: true, data: copy(order) } : { ok: false, code: "order_not_payable", retryable: false, formError: "이미 취소된 주문이라 결제를 확정할 수 없어요." }
    }),
    orders: orderList,
    order: async ({ orderId }) => {
      const list = await orderList()
      if (!list.ok) return list
      const found = list.data.find((o) => o.id === orderId)
      return found ? { ok: true, data: found } : notFound(NO_ORDER)
    },
    cancelOrder: writer(ctx, ({ orderId }: { orderId: string; reason?: string } & HumanConfirmation): ActionResult<Order> => {
      const order = find(orderId)
      if (!order) return notFound(NO_ORDER)
      if (order.status === "pending_payment") {
        release(order.lines)
        order.status = "canceled"
      } else if (order.status === "paid" || order.status === "preparing") order.status = "refunded"
      else return { ok: false, code: "not_cancelable", retryable: false, formError: NOT_CANCELABLE }
      order.canceledAt = MOCK_NOW
      return { ok: true, data: copy(order) }
    }),
  }
  // 확인 입력 요구 — 안 요구하면(기본) 확인 칸을 무시한다. 승인 행동 둘만 감싼다(mockBilling 의 requireConfirmation 과 같은 방식)
  if (options.requireConfirmation) {
    port.placeOrder = needsConfirmation(port.placeOrder)
    port.cancelOrder = needsConfirmation(port.cancelOrder)
  }
  return port
}
