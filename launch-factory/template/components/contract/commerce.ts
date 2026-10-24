import type { ActionResult } from "@/components/contract/block-contract"
import type { HumanConfirmation, IsoDate, Money } from "@/components/contract/ports"

/** 상품표의 한 줄. stock 이 null 이면 재고 제한이 없다 */
export interface CatalogItem {
  id: string
  name: string
  price: Money
  imageUrl?: string
  stock: number | null
}

/** 장바구니·주문의 한 줄. unitPrice 는 서버가 상품표에서 읽은 단가이고, available 은 지금 살 수 있는 남은 수(재고 제한이 있을 때만) */
export interface CartLine {
  productId: string
  name: string
  unitPrice: Money
  quantity: number
  imageUrl?: string
  available?: number
}

/** 소계·배송비·합계. 합계가 소비자가 실제로 내는 총액이다(총액 먼저 — 전자상거래법 §21-2①1) */
export interface CartTotals {
  subtotal: Money
  shipping: Money
  total: Money
}

export interface Cart extends CartTotals {
  lines: CartLine[]
}

export interface ShippingAddress {
  recipient: string
  phone: string
  postcode: string
  address1: string
  address2?: string
  note?: string
}

/**
 * 주문 상태. 전이 표(TRANSITIONS)는 launch-factory 의 order-states 가 데이터로 갖는다:
 * pending_payment → paid | canceled · paid → preparing | refunded · preparing → shipped | refunded · shipped → delivered.
 */
export type OrderStatus = "pending_payment" | "paid" | "preparing" | "shipped" | "delivered" | "canceled" | "refunded"

export interface Order extends CartTotals {
  id: string
  status: OrderStatus
  lines: CartLine[]
  address: ShippingAddress
  createdAt: IsoDate
  paidAt?: IsoDate
  trackingNumber?: string
  canceledAt?: IsoDate
}

/** 브라우저가 결제창을 열 때 쓰는 값. client 에는 공개해도 되는 값만 담는다(storeId·channelKey 등 — 비밀 키·서명은 넣지 않는다) */
export interface PaymentSession {
  provider: "portone" | "mock"
  paymentId: string
  orderName: string
  total: Money
  client: Record<string, string>
}

/**
 * 판매 포트. 모든 메서드는 거부(reject)하지 않고 ActionResult 로 끝난다. 사용자는 세션에서 읽는다(입력이 아니다).
 * 실패 code(알려진 값): out_of_stock(재고 부족 — fieldErrors 에 상품 id) · empty_cart · payment_amount_mismatch · confirmation_required(승인 대기) · sign_in_required ·
 * not_cancelable(취소할 수 없는 상태 — 배송 중·완료 등) · provider_unavailable(상점이 꺼짐 — 결제 키 없음, retryable false). 모르는 code 는 블록이 formError 로 그린다.
 */
export interface CommercePort {
  catalog(): Promise<ActionResult<CatalogItem[]>>
  cart(): Promise<ActionResult<Cart>>
  /** quantity 가 0 이면 줄을 뺀다 */
  setCartLine(input: { productId: string; quantity: number }): Promise<ActionResult<Cart>>
  /** 승인 행동(place-order) — confirmed: true 없이는 아무것도 바뀌지 않는다. 성공하면 결제 대기 주문과 결제창 값을 돌려준다 */
  placeOrder(input: { address: ShippingAddress } & HumanConfirmation): Promise<ActionResult<{ order: Order; payment: PaymentSession }>>
  /** 결제창을 닫은 뒤(리디렉션 반환·웹훅과 같은 확정 경로). 서버가 결제 공급자에 다시 물어 확인한다 */
  confirmPayment(input: { orderId: string; paymentId: string }): Promise<ActionResult<Order>>
  orders(): Promise<ActionResult<Order[]>>
  order(input: { orderId: string }): Promise<ActionResult<Order>>
  /** 승인 행동(cancel-order) — 결제 완료 주문은 환불까지 간다 */
  cancelOrder(input: { orderId: string; reason?: string } & HumanConfirmation): Promise<ActionResult<Order>>
}
