import { MOCK_ADDRESS, mockCommerce, mockTotalsOf } from "@/registry/factory/contract/adapter-mock-commerce"
import type { CartLine, Order, OrderStatus } from "@/registry/factory/contract/commerce"

import type { OrderStatusCopy, OrderStatusNotes } from "../_shared/order-kit"
import { SAMPLE_CART, orderLineOf, withCartDefaults } from "../cart/lines-table.fixture"
import type { AccountOrderHistoryCopy, AccountOrderHistoryProps } from "./order-history"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 주문 내역. 주문은 목 상품표의 가상 상품이고 금액은 원화·부가세 포함이다.
// 갤러리 포트: ?order=none|pending_payment|paid|preparing|shipped|delivered|canceled|refunded(기본 paid — 주문이 하나 있다) · &state=(orders 읽기).
// 이 모듈의 상태 글(ORDER_STATUS)·상태 안내(ORDER_NOTES)와 예시 주문(sampleOrder)은 account/order-detail 도 같이 쓴다.
export const ORDER_STATUS: OrderStatusCopy = {
  pending_payment: "결제 대기",
  paid: "결제 완료",
  preparing: "상품 준비 중",
  shipped: "배송 중",
  delivered: "배송 완료",
  canceled: "주문 취소",
  refunded: "환불 완료",
}
export const ORDER_NOTES: OrderStatusNotes = {
  pending_payment: "{date}에 주문했고 아직 결제하지 않았어요(예시).",
  paid: "{date}에 결제했어요. 곧 상품을 준비해요(예시).",
  preparing: "{date}에 결제했고 상품을 준비하고 있어요(예시).",
  shipped: "{date}에 결제한 상품이 배송 중이에요(예시).",
  delivered: "{date}에 결제한 상품이 도착했어요(예시).",
  canceled: "{date}에 주문을 취소했어요. 결제하지 않아 청구된 금액은 없어요(예시).",
  refunded: "{date}에 취소했고 결제 금액을 돌려드려요(예시).",
}

const PAID: readonly OrderStatus[] = ["paid", "preparing", "shipped", "delivered"]
/** 예시 주문 하나(목 어댑터의 씨앗 주문과 같은 모양) */
export const sampleOrder = (status: OrderStatus, id = "mock-order-1", lines: CartLine[] = SAMPLE_CART.lines.map(orderLineOf)): Order => ({
  id,
  status,
  lines,
  address: MOCK_ADDRESS,
  createdAt: "2026-10-01T03:00:00.000Z",
  ...mockTotalsOf(lines),
  ...(PAID.includes(status) ? { paidAt: "2026-10-01T03:05:00.000Z" } : {}),
  ...(status === "shipped" || status === "delivered" ? { trackingNumber: "1234567890" } : {}),
  ...(status === "canceled" || status === "refunded" ? { canceledAt: "2026-10-02T03:00:00.000Z" } : {}),
})
const ONE: CartLine[] = SAMPLE_CART.lines.slice(0, 1).map((l) => ({ ...orderLineOf(l), quantity: 1 }))
export const SAMPLE_ORDERS: Order[] = [sampleOrder("paid", "mock-order-3"), sampleOrder("delivered", "mock-order-2", ONE), sampleOrder("canceled", "mock-order-1")]

const COPY: AccountOrderHistoryCopy = {
  title: "주문 내역",
  lead: "최근 주문부터 보여 드려요. 주문을 누르면 배송 상황을 볼 수 있어요(예시).",
  caption: "주문번호, 주문일, 상품, 결제 금액, 상태",
  columns: { order: "주문번호", date: "주문일", items: "상품", total: "결제 금액", status: "상태" },
  status: ORDER_STATUS,
  itemsMore: "{name} 외 {count}건",
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  detail: { label: "자세히 보기", of: "주문 {id} 자세히 보기", href: "#order-{id}" },
  empty: { title: "아직 주문이 없어요", body: "주문하면 여기에 모여요(예시).", label: "상품 둘러보기", href: "#products" },
  loading: "주문 내역을 불러오는 중이에요",
  error: "주문 내역을 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountOrderHistoryProps = {
  copy: COPY,
  orders: async () => ({ ok: true, data: SAMPLE_ORDERS }),
}

export const fixtureMax: AccountOrderHistoryProps = {
  ...fixture,
  copy: { ...COPY, title: "주문 내역 — 지금까지 한 주문을 한눈에 봐요(예시)", lead: "최근 주문부터 보여 드려요. 주문번호를 누르면 배송 상황과 받는 분 정보, 취소 방법을 볼 수 있어요. 결제 전 주문은 24시간 뒤 자동으로 닫혀요(예시)." },
  orders: async () => ({ ok: true, data: [...SAMPLE_ORDERS, sampleOrder("shipped", "mock-order-0"), sampleOrder("refunded", "mock-order-00")] }),
}

export const fixtureMin: AccountOrderHistoryProps = { ...fixture, copy: { ...COPY, lead: undefined }, orders: async () => ({ ok: true, data: SAMPLE_ORDERS.slice(0, 1) }) }

export const fixturePorts = (q: URLSearchParams): Partial<AccountOrderHistoryProps> => {
  const commerce = mockCommerce(withCartDefaults(q, { order: "paid" }), { requireConfirmation: true })
  return { orders: commerce.orders }
}
