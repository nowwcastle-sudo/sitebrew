// 판매 포트 적합성 묶음(항목 contract-conformance — 계획 3a Task A4, J3). adapter-mock-commerce 의 ?cart=·?stock=·?order= 장면이 곧 시나리오 표다.
// 실제 어댑터(launch-factory commerce)는 make(setup) 이 그 장면의 새 포트(새 사용자·새 장바구니·그 상태의 주문 하나)를 돌려주게 해 같은 검사를 통과한다.
// 검사는 모양·합계·상태 전이·재고 증감만 본다 — 가격 값·배송비 규칙(무료 배송 기준)·날짜 값은 가게마다 다르다. 쓰기 검사는 상태를 바꾸므로 검사마다 make 를 새로 부른다.
// 승인 행동(placeOrder·cancelOrder)은 늘 `confirmed: true` 를 싣고 부른다 — 확인을 요구하는 어댑터도 옛 검사에서 떨어지지 않는다. 확인 입력 검사는 options.requireConfirmation 인 어댑터만 받는다.
import type { ActionResult } from "../block-contract.ts"
import type { Cart, CartLine, CartTotals, CatalogItem, CommercePort, Order, OrderStatus, PaymentSession, ShippingAddress } from "../commerce.ts"
import type { Money } from "../ports.ts"
import { type ConformanceOptions, type ConformanceResult, confirmationProblem, deepEqual, runCheck, show } from "./conformance-core.ts"

/**
 * make 에 넘기는 준비.
 *   cart  — empty: 담은 것 없음 · filled: 서로 다른 상품 둘 이상(재고 제한이 있는 상품 하나 포함)이 담겨 있다
 *   stock — ok: 평소 재고 · out: filled 장바구니의 줄 하나가 품절이다(주문하면 out_of_stock)
 *   order — none: 주문 없음 · 상태 이름: 그 상태의 주문 하나만 있다(목: ?order=)
 */
export interface CommerceSetup {
  cart: "empty" | "filled"
  stock: "ok" | "out"
  order: "none" | OrderStatus
}
export type MakeCommerce = (setup: CommerceSetup) => CommercePort | Promise<CommercePort>

/** 기계가 읽는 오류 이름(CommercePort 문서의 알려진 code) */
export const OUT_OF_STOCK = "out_of_stock"
export const EMPTY_CART = "empty_cart"
export const NOT_CANCELABLE = "not_cancelable"

/**
 * 주문 상태 표(adapter-mock MOCK_ORDER_STATUSES 와 같은 순서). paidAt·trackingNumber·canceledAt 은 그 상태에서 있어야(true)·없어야(false) 하는 칸,
 * cancel 은 확인과 함께 취소했을 때 결과 — canceled(결제 전 취소)·refunded(결제 뒤 환불)·refused(취소할 수 없는 주문: not_cancelable, 상태 그대로).
 */
export interface CommerceOrderState {
  status: OrderStatus
  paidAt: boolean
  trackingNumber: boolean
  canceledAt: boolean
  cancel: "canceled" | "refunded" | "refused"
}

export const COMMERCE_ORDER_STATES: readonly CommerceOrderState[] = [
  { status: "pending_payment", paidAt: false, trackingNumber: false, canceledAt: false, cancel: "canceled" },
  { status: "paid", paidAt: true, trackingNumber: false, canceledAt: false, cancel: "refunded" },
  { status: "preparing", paidAt: true, trackingNumber: false, canceledAt: false, cancel: "refunded" },
  { status: "shipped", paidAt: true, trackingNumber: true, canceledAt: false, cancel: "refused" },
  { status: "delivered", paidAt: true, trackingNumber: true, canceledAt: false, cancel: "refused" },
  { status: "canceled", paidAt: false, trackingNumber: false, canceledAt: true, cancel: "refused" },
  { status: "refunded", paidAt: true, trackingNumber: false, canceledAt: true, cancel: "refused" },
]

/** 적합성 검사가 쓰는 가상 배송지(실제 주소가 아니다) */
export const CONFORMANCE_ADDRESS: ShippingAddress = { recipient: "김예시", phone: "010-0000-0000", postcode: "04524", address1: "서울시 가상구 예시로 1", address2: "101호" }
const REQUIRED_ADDRESS_FIELDS = ["recipient", "phone", "postcode", "address1"] as const
const NO_SUCH = "conf-no-such"
const MAX_QUANTITY = 99

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))
const moneyProblem = (m: Money | undefined, at: string, min = 0) =>
  !m || !Number.isInteger(m.amount) || m.amount < min || typeof m.vatIncluded !== "boolean" || typeof m.currency !== "string" ? `${at} 금액 모양이 틀렸어요(최소 단위 정수): ${show(m)}` : null

/** 합계 모양: 세 금액이 정수·같은 통화이고 합계 = 소계 + 배송비. lines 를 주면 소계 = 줄 단가 × 수량의 합 */
function totalsProblem(t: CartTotals, at: string, lines?: readonly CartLine[]): string | null {
  const bad = moneyProblem(t.subtotal, `${at} 소계`) ?? moneyProblem(t.shipping, `${at} 배송비`) ?? moneyProblem(t.total, `${at} 합계`)
  if (bad) return bad
  if (new Set([t.subtotal.currency, t.shipping.currency, t.total.currency]).size > 1) return `${at} 통화가 서로 달라요: ${show(t)}`
  if (t.total.amount !== t.subtotal.amount + t.shipping.amount) return `${at} 합계 ${t.total.amount} — 소계 ${t.subtotal.amount} + 배송비 ${t.shipping.amount} 여야 해요`
  if (lines) {
    const sum = lines.reduce((s, l) => s + l.unitPrice.amount * l.quantity, 0)
    if (t.subtotal.amount !== sum) return `${at} 소계 ${t.subtotal.amount} — 줄의 단가 × 수량 합 ${sum} 여야 해요`
  }
  return null
}

function lineProblem(l: CartLine, at: string): string | null {
  if (!l.productId || !l.name) return `${at} 줄에 productId·name 이 없어요: ${show(l)}`
  if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QUANTITY) return `${at} 수량 ${show(l.quantity)} — 1~${MAX_QUANTITY} 정수여야 해요`
  return moneyProblem(l.unitPrice, `${at} 단가`, 1)
}

function cartProblem(c: Cart, at: string): string | null {
  const bad = c.lines.map((l) => lineProblem(l, `${at} ${l.productId}`)).find(Boolean)
  return bad ?? totalsProblem(c, at, c.lines)
}

function orderProblem(o: Order, at: string): string | null {
  if (!o.id) return `${at} 주문 id 가 없어요`
  if (!isDate(o.createdAt)) return `${at} createdAt 이 날짜가 아니에요: ${show(o.createdAt)}`
  if (!o.lines.length) return `${at} 주문 줄이 없어요`
  const bad = o.lines.map((l) => lineProblem(l, `${at} ${l.productId}`)).find(Boolean)
  if (bad) return bad
  const missing = REQUIRED_ADDRESS_FIELDS.filter((k) => !String(o.address?.[k] ?? "").trim())
  if (missing.length) return `${at} 배송지에 없는 칸: ${missing.join(", ")}`
  return totalsProblem(o, at, o.lines)
}

// 읽기 결과를 꺼낸다 — 실패면 던져 runCheck 가 실패 결과로 바꾼다.
function data<T>(r: ActionResult<T>, what: string): T {
  if (!r.ok) throw new Error(`${what} 실패: ${show(r)}`)
  return r.data
}
const SCENE: CommerceSetup = { cart: "empty", stock: "ok", order: "none" }
const FILLED: CommerceSetup = { cart: "filled", stock: "ok", order: "none" }
const catalogOf = async (port: CommercePort) => data(await port.catalog(), "catalog()")
const cartOf = async (port: CommercePort) => data(await port.cart(), "cart()")
const ordersOf = async (port: CommercePort) => data(await port.orders(), "orders()")
const stockMap = (items: readonly CatalogItem[]) => new Map(items.map((i) => [i.id, i.stock]))
const unchanged = (a: Cart, b: Cart) => deepEqual(a.lines.map((l) => [l.productId, l.quantity]), b.lines.map((l) => [l.productId, l.quantity]))

/** 재고 제한이 있고 1~98개 남은 상품(넘는 수량 시험이 99 상한 안에 든다) */
function limitedItem(items: readonly CatalogItem[]): CatalogItem {
  const it = items.find((i) => i.stock !== null && i.stock >= 1 && i.stock < MAX_QUANTITY)
  if (!it) throw new Error("재고 제한이 있고 1~98개 남은 상품이 상품표에 하나 있어야 해요(commerce.catalog.limited-stock)")
  return it
}
/** 두 개까지 담을 수 있는 상품(재고 제한 없음이거나 2개 이상 남음) */
function plainItem(items: readonly CatalogItem[]): CatalogItem {
  const it = items.find((i) => i.stock === null || i.stock >= 2)
  if (!it) throw new Error("재고 제한이 없거나 2개 이상 남은 상품이 상품표에 하나 있어야 해요")
  return it
}

/**
 * 판매 포트 적합성. make 는 준비(장바구니·재고·주문)마다 새 포트를 돌려준다
 * (목: `({ cart, stock, order }) => mockCommerce("?cart=" + cart + "&stock=" + stock + "&order=" + order)`).
 */
export async function commerceConformance(make: MakeCommerce, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  const place = async (port: CommercePort, address: ShippingAddress = CONFORMANCE_ADDRESS) => data(await port.placeOrder({ address, confirmed: true }), "placeOrder()")

  // 상품표
  await check("commerce.catalog.shape", async () => {
    const items = await catalogOf(await make(SCENE))
    if (!items.length) return "상품표가 비었어요"
    if (new Set(items.map((i) => i.id)).size !== items.length) return "상품 id 가 겹쳐요"
    for (const i of items) {
      if (!i.id || !i.name) return `상품에 id·name 이 없어요: ${show(i)}`
      const bad = moneyProblem(i.price, `상품 ${i.id} 가격`, 1)
      if (bad) return bad
      if (i.stock !== null && (!Number.isInteger(i.stock) || i.stock < 0)) return `상품 ${i.id} 재고 ${show(i.stock)} — null(제한 없음) 또는 0 이상 정수여야 해요`
    }
    return null
  })
  await check("commerce.catalog.limited-stock", async () => {
    limitedItem(await catalogOf(await make(SCENE)))
    plainItem(await catalogOf(await make(SCENE)))
    return null
  })

  // 장바구니
  await check("commerce.cart.empty", async () => {
    const c = await cartOf(await make(SCENE))
    if (c.lines.length) return `담은 것이 없는 장면인데 줄이 있어요: ${show(c.lines)}`
    return totalsProblem(c, "빈 장바구니", c.lines) ?? (c.total.amount === 0 ? null : `비어 있는데 합계가 ${c.total.amount} 이에요`)
  })
  await check("commerce.cart.filled-totals", async () => {
    const c = await cartOf(await make(FILLED))
    if (c.lines.length < 2) return `담긴 장면인데 줄이 ${c.lines.length}개예요`
    if (new Set(c.lines.map((l) => l.productId)).size !== c.lines.length) return "같은 상품이 두 줄이에요"
    return cartProblem(c, "장바구니")
  })
  await check("commerce.cart.set-line.add", async () => {
    const port = await make(SCENE)
    const item = plainItem(await catalogOf(port))
    const got = data(await port.setCartLine({ productId: item.id, quantity: 2 }), "setCartLine()")
    const line = got.lines.find((l) => l.productId === item.id)
    if (!line || line.quantity !== 2) return `담은 줄이 없거나 수량이 달라요: ${show(got.lines)}`
    if (line.unitPrice.amount !== item.price.amount) return `단가 ${line.unitPrice.amount} — 상품표 가격 ${item.price.amount} 여야 해요(가격의 정본은 상품표)`
    const bad = cartProblem(got, "담은 뒤")
    if (bad) return bad
    return deepEqual((await cartOf(port)).lines.map((l) => [l.productId, l.quantity]), got.lines.map((l) => [l.productId, l.quantity])) ? null : "cart() 가 방금 담은 줄과 달라요"
  })
  await check("commerce.cart.set-line.update", async () => {
    const port = await make(SCENE)
    const item = plainItem(await catalogOf(port))
    data(await port.setCartLine({ productId: item.id, quantity: 1 }), "setCartLine(1)")
    const got = data(await port.setCartLine({ productId: item.id, quantity: 2 }), "setCartLine(2)")
    if (got.lines.length !== 1 || got.lines[0].quantity !== 2) return `수량을 바꿨는데 줄이 늘었거나 수량이 그대로예요: ${show(got.lines)}`
    return cartProblem(got, "바꾼 뒤")
  })
  await check("commerce.cart.set-line.remove", async () => {
    const port = await make(SCENE)
    const item = plainItem(await catalogOf(port))
    data(await port.setCartLine({ productId: item.id, quantity: 2 }), "setCartLine(2)")
    const got = data(await port.setCartLine({ productId: item.id, quantity: 0 }), "setCartLine(0)")
    if (got.lines.length) return `수량 0 으로 줄을 뺐는데 남았어요: ${show(got.lines)}`
    return got.total.amount === 0 ? null : `다 뺐는데 합계가 ${got.total.amount} 이에요`
  })
  await check("commerce.cart.set-line.unknown-product", async () => {
    const port = await make(SCENE)
    const r = await port.setCartLine({ productId: `${NO_SUCH}-product`, quantity: 1 })
    if (r.ok) return `없는 상품이 담겼어요: ${show(r.data)}`
    return (await cartOf(port)).lines.length ? "거절했는데 장바구니가 바뀌었어요" : null
  })
  await check("commerce.cart.set-line.bad-quantity", async () => {
    const port = await make(SCENE)
    const item = plainItem(await catalogOf(port))
    for (const quantity of [-1, 1.5, MAX_QUANTITY + 1]) {
      const r = await port.setCartLine({ productId: item.id, quantity })
      if (r.ok) return `수량 ${quantity} 이 받아들여졌어요(0~${MAX_QUANTITY} 정수만): ${show(r.data)}`
    }
    return (await cartOf(port)).lines.length ? "거절했는데 장바구니가 바뀌었어요" : null
  })
  await check("commerce.cart.stock.over-limit", async () => {
    const port = await make(SCENE)
    const item = limitedItem(await catalogOf(port))
    const r = await port.setCartLine({ productId: item.id, quantity: (item.stock as number) + 1 })
    if (r.ok) return `남은 ${item.stock}개보다 많이 담겼어요: ${show(r.data.lines)}`
    if (r.code !== OUT_OF_STOCK) return `오류 code ${show(r.code)} — "${OUT_OF_STOCK}" 여야 해요`
    if (!r.fieldErrors?.[item.id]) return `fieldErrors 에 상품 id(${item.id}) 칸이 없어요: ${show(r.fieldErrors)}`
    return (await cartOf(port)).lines.length ? "거절했는데 장바구니가 바뀌었어요" : null
  })
  await check("commerce.cart.stock.at-limit", async () => {
    const port = await make(SCENE)
    const item = limitedItem(await catalogOf(port))
    const got = data(await port.setCartLine({ productId: item.id, quantity: item.stock as number }), "setCartLine(남은 수량)")
    return got.lines.find((l) => l.productId === item.id)?.quantity === item.stock ? null : `남은 수량만큼은 담겨야 해요: ${show(got.lines)}`
  })

  // 주문하기
  await check("commerce.place.empty-cart", async () => {
    const port = await make(SCENE)
    const r = await port.placeOrder({ address: CONFORMANCE_ADDRESS, confirmed: true })
    if (r.ok) return `빈 장바구니로 주문이 만들어졌어요: ${show(r.data.order)}`
    if (r.code !== EMPTY_CART) return `오류 code ${show(r.code)} — "${EMPTY_CART}" 여야 해요`
    return (await ordersOf(port)).length ? "거절했는데 주문이 생겼어요" : null
  })
  await check("commerce.place.address-required", async () => {
    const port = await make(FILLED)
    const before = await cartOf(port)
    const r = await port.placeOrder({ address: { recipient: " ", phone: "", postcode: "", address1: "" }, confirmed: true })
    if (r.ok) return `빈 배송지로 주문이 만들어졌어요: ${show(r.data.order)}`
    const missing = REQUIRED_ADDRESS_FIELDS.filter((k) => !r.fieldErrors?.[k])
    if (missing.length) return `fieldErrors 에 없는 칸: ${missing.join(", ")}(${show(r.fieldErrors)})`
    if ((await ordersOf(port)).length) return "거절했는데 주문이 생겼어요"
    return unchanged(before, await cartOf(port)) ? null : "거절했는데 장바구니가 바뀌었어요"
  })
  await check("commerce.place.pending", async () => {
    const port = await make(FILLED)
    const before = await cartOf(port)
    const { order, payment } = await place(port)
    if (order.status !== "pending_payment") return `주문 상태 ${order.status} — pending_payment 여야 해요`
    const bad = orderProblem(order, "주문")
    if (bad) return bad
    if (!deepEqual(order.lines.map((l) => [l.productId, l.quantity]), before.lines.map((l) => [l.productId, l.quantity]))) return `주문 줄이 장바구니와 달라요: ${show(order.lines)}`
    if (order.total.amount !== before.total.amount) return `주문 합계 ${order.total.amount} — 장바구니 합계 ${before.total.amount} 여야 해요`
    const paymentBad = paymentSessionProblem(payment, order)
    if (paymentBad) return paymentBad
    if ((await cartOf(port)).lines.length) return "주문한 뒤에도 장바구니가 비워지지 않았어요"
    const listed = (await ordersOf(port)).find((o) => o.id === order.id)
    return listed?.status === "pending_payment" ? null : "orders() 에 방금 만든 주문이 없어요"
  })
  await check("commerce.place.stock-reserved", async () => {
    const port = await make(FILLED)
    const before = stockMap(await catalogOf(port))
    const { order } = await place(port)
    const after = stockMap(await catalogOf(port))
    let limited = 0
    for (const l of order.lines) {
      const was = before.get(l.productId)
      if (typeof was !== "number") continue
      limited += 1
      if (after.get(l.productId) !== was - l.quantity) return `재고 ${l.productId}: ${was} → ${show(after.get(l.productId))} — ${was - l.quantity} 여야 해요(주문하면 수량만큼 한 번 잡는다)`
    }
    return limited ? null : "담긴 장바구니에 재고 제한이 있는 줄이 하나 있어야 해요"
  })
  await check("commerce.place.out-of-stock", async () => {
    const port = await make({ cart: "filled", stock: "out", order: "none" })
    const before = await cartOf(port)
    const r = await port.placeOrder({ address: CONFORMANCE_ADDRESS, confirmed: true })
    if (r.ok) return `품절 줄이 있는데 주문이 만들어졌어요: ${show(r.data.order)}`
    if (r.code !== OUT_OF_STOCK) return `오류 code ${show(r.code)} — "${OUT_OF_STOCK}" 여야 해요`
    if (!Object.keys(r.fieldErrors ?? {}).length) return "어느 상품이 모자란지 fieldErrors 에 없어요"
    if ((await ordersOf(port)).length) return "거절했는데 주문이 생겼어요"
    return unchanged(before, await cartOf(port)) ? null : "거절했는데 장바구니가 바뀌었어요"
  })

  // 결제 확정
  await check("commerce.confirm.paid", async () => {
    const port = await make(FILLED)
    const { order, payment } = await place(port)
    const got = data(await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId }), "confirmPayment()")
    if (got.status !== "paid") return `확정 뒤 status ${got.status} — paid 여야 해요`
    if (!isDate(got.paidAt)) return `paidAt 이 날짜가 아니에요: ${show(got.paidAt)}`
    const read = data(await port.order({ orderId: order.id }), "order()")
    return read.status === "paid" ? null : `order() 의 status ${read.status} — paid 여야 해요`
  })
  await check("commerce.confirm.idempotent", async () => {
    const port = await make(FILLED)
    const { order, payment } = await place(port)
    const input = { orderId: order.id, paymentId: payment.paymentId }
    const first = data(await port.confirmPayment(input), "confirmPayment(1)")
    const stockAfterFirst = stockMap(await catalogOf(port))
    const second = data(await port.confirmPayment(input), "confirmPayment(2)")
    if (second.status !== "paid" || second.paidAt !== first.paidAt) return `같은 확정을 또 불렀더니 결과가 달라요: ${show(first.status)}/${show(first.paidAt)} → ${show(second.status)}/${show(second.paidAt)}`
    if (!deepEqual(stockAfterFirst, stockMap(await catalogOf(port)))) return "같은 확정을 또 불렀더니 재고가 또 바뀌었어요"
    return (await ordersOf(port)).length === 1 ? null : "주문이 둘이 됐어요"
  })
  await check("commerce.confirm.wrong-payment-id", async () => {
    const port = await make(FILLED)
    const { order } = await place(port)
    const r = await port.confirmPayment({ orderId: order.id, paymentId: `${NO_SUCH}-payment` })
    if (r.ok) return `다른 결제 번호로 확정됐어요: ${show(r.data)}`
    const now = data(await port.order({ orderId: order.id }), "order()")
    return now.status === "pending_payment" ? null : `거절했는데 주문 상태가 ${now.status} 로 바뀌었어요`
  })
  await check("commerce.confirm.unknown-order", async () => {
    const r = await (await make(SCENE)).confirmPayment({ orderId: `${NO_SUCH}-order`, paymentId: `${NO_SUCH}-payment` })
    return r.ok ? `없는 주문이 확정됐어요: ${show(r.data)}` : null
  })

  // 취소 흐름: 결제 전 취소는 재고를 돌려주고, 결제 뒤 취소는 환불이다
  await check("commerce.cancel.flow-pending", async () => {
    const port = await make(FILLED)
    const before = stockMap(await catalogOf(port))
    const { order } = await place(port)
    const got = data(await port.cancelOrder({ orderId: order.id, reason: "단순 변심", confirmed: true }), "cancelOrder()")
    if (got.status !== "canceled") return `결제 전 취소 뒤 status ${got.status} — canceled 여야 해요`
    if (!isDate(got.canceledAt)) return `canceledAt 이 날짜가 아니에요: ${show(got.canceledAt)}`
    return deepEqual(before, stockMap(await catalogOf(port))) ? null : "취소했는데 재고가 돌아오지 않았어요"
  })
  await check("commerce.cancel.flow-paid", async () => {
    const port = await make(FILLED)
    const { order, payment } = await place(port)
    data(await port.confirmPayment({ orderId: order.id, paymentId: payment.paymentId }), "confirmPayment()")
    const got = data(await port.cancelOrder({ orderId: order.id, confirmed: true }), "cancelOrder()")
    if (got.status !== "refunded") return `결제 뒤 취소 뒤 status ${got.status} — refunded 여야 해요`
    return isDate(got.canceledAt) ? null : `canceledAt 이 날짜가 아니에요: ${show(got.canceledAt)}`
  })

  // 내 주문
  await check("commerce.order.read", async () => {
    const port = await make({ cart: "empty", stock: "ok", order: "paid" })
    const [first] = await ordersOf(port)
    if (!first) return "paid 주문 하나가 있는 장면인데 orders() 가 비었어요"
    return deepEqual(data(await port.order({ orderId: first.id }), "order()"), first) ? null : "order() 가 orders() 의 같은 주문과 달라요"
  })
  await check("commerce.order.unknown", async () => {
    const r = await (await make({ cart: "empty", stock: "ok", order: "paid" })).order({ orderId: `${NO_SUCH}-order` })
    return r.ok ? `없는 주문이 읽혔어요: ${show(r.data)}` : null
  })

  // 주문 상태 일곱: 모양(상태마다 있어야·없어야 할 칸)과 취소 결과
  for (const row of COMMERCE_ORDER_STATES) {
    const setup: CommerceSetup = { cart: "empty", stock: "ok", order: row.status }
    await check(`commerce.state.${row.status}`, async () => {
      const list = await ordersOf(await make(setup))
      if (list.length !== 1) return `${row.status} 주문 하나만 있는 장면인데 ${list.length}개예요`
      const [o] = list
      if (o.status !== row.status) return `status ${o.status} — ${row.status} 여야 해요`
      const bad = orderProblem(o, "주문")
      if (bad) return bad
      for (const key of ["paidAt", "trackingNumber", "canceledAt"] as const) {
        if (row[key] && !o[key]) return `${row.status} 주문에 ${key} 가 있어야 해요`
        if (!row[key] && o[key] !== undefined) return `${row.status} 주문에 ${key} 가 있으면 안 돼요: ${show(o[key])}`
      }
      for (const key of ["paidAt", "canceledAt"] as const) if (o[key] !== undefined && !isDate(o[key])) return `${key} 가 날짜가 아니에요: ${show(o[key])}`
      return null
    })
    await check(`commerce.cancel.${row.status}`, async () => {
      const port = await make(setup)
      const [o] = await ordersOf(port)
      if (!o) return `${row.status} 주문이 없어요`
      const r = await port.cancelOrder({ orderId: o.id, confirmed: true })
      if (row.cancel === "refused") {
        if (r.ok) return `취소할 수 없는 주문(${row.status})이 취소됐어요: ${show(r.data.status)}`
        if (r.code !== NOT_CANCELABLE) return `오류 code ${show(r.code)} — "${NOT_CANCELABLE}" 여야 해요`
        if (r.retryable === true) return "다시 시도해도 되는 오류가 아니에요(retryable 이 true)"
        const now = data(await port.order({ orderId: o.id }), "order()")
        return now.status === row.status ? null : `거절했는데 상태가 ${now.status} 로 바뀌었어요`
      }
      if (!r.ok) return `취소가 거절됐어요: ${show(r)}`
      return r.data.status === row.cancel ? null : `취소 뒤 status ${r.data.status} — ${row.cancel} 여야 해요`
    })
  }

  // 승인 행동의 확인 입력(G11(d) — options.requireConfirmation 인 어댑터만): ① 확인 없이 부르면 confirmation_required(retryable false)이고 상태 그대로 ② 확인과 함께면 성공
  if (options.requireConfirmation) {
    await check("commerce.confirmation.place-order", async () => {
      const port = await make(FILLED)
      const before = await cartOf(port)
      const refused = await port.placeOrder({ address: CONFORMANCE_ADDRESS })
      const problem = confirmationProblem(refused)
      if (problem) return problem
      if ((await ordersOf(port)).length) return "승인 대기인데 주문이 생겼어요"
      if (!unchanged(before, await cartOf(port))) return "승인 대기인데 장바구니가 바뀌었어요"
      const done = await port.placeOrder({ address: CONFORMANCE_ADDRESS, confirmed: true })
      return done.ok ? null : `확인과 함께 부르면 성공해야 해요: ${show(done)}`
    })
    await check("commerce.confirmation.cancel-order", async () => {
      const port = await make(FILLED)
      const { order } = await place(port)
      const refused = await port.cancelOrder({ orderId: order.id })
      const problem = confirmationProblem(refused)
      if (problem) return problem
      const now = data(await port.order({ orderId: order.id }), "order()")
      if (now.status !== "pending_payment") return `승인 대기인데 주문 상태가 ${now.status} 로 바뀌었어요`
      const done = await port.cancelOrder({ orderId: order.id, confirmed: true })
      return done.ok && done.data.status === "canceled" ? null : `확인과 함께 부르면 취소돼야 해요: ${show(done)}`
    })
  }
  return out
}

/** 결제창 값 모양: 결제 번호·주문 이름이 있고 합계가 주문과 같고, client 는 문자열 값뿐이다(공개해도 되는 값) */
function paymentSessionProblem(p: PaymentSession, order: Order): string | null {
  if (p.provider !== "portone" && p.provider !== "mock") return `provider ${show(p.provider)} — portone 또는 mock 이어야 해요`
  if (!p.paymentId || !p.orderName) return `결제 번호·주문 이름이 없어요: ${show(p)}`
  const bad = moneyProblem(p.total, "결제 금액", 1)
  if (bad) return bad
  if (p.total.amount !== order.total.amount) return `결제 금액 ${p.total.amount} — 주문 합계 ${order.total.amount} 여야 해요`
  const nonString = Object.entries(p.client ?? {}).filter(([, v]) => typeof v !== "string")
  return nonString.length ? `client 값은 문자열이어야 해요: ${nonString.map(([k]) => k).join(", ")}` : null
}
