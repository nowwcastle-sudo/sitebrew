// 주문 상태 전이 표 — 데이터다. 상태를 바꾸는 코드는 모두 canMove 를 지나고, 표에 없는 전이는 일어나지 않는다.
// 열쇠는 DB 의 상태 목록(ORDER_STATUSES, orders_status_ck)과 같아야 한다 — 시험이 대조한다.
import type { OrderStatus } from "@launch-factory/contract"

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ["paid", "canceled"],
  paid: ["preparing", "refunded"],
  preparing: ["shipped", "refunded"],
  shipped: ["delivered"],
  delivered: [],
  canceled: [],
  refunded: [],
}

export const canMove = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from]?.includes(to) === true

/** 관리자가 한 칸씩 미는 앞걸음(준비 → 배송 → 완료). 결제·취소·환불은 각자 길이 있다(checkout) */
export const FORWARD_STEPS = ["preparing", "shipped", "delivered"] as const satisfies readonly OrderStatus[]

/**
 * 손님이 스스로 취소할 수 있는 상태. 배송이 시작되면(shipped) 판매자에게 문의한다.
 * 준비 중(preparing)도 취소할 수 있다 — web-factory 적합성 묶음(commerce.cancel.preparing: 환불)과 주문 블록(order-kit)이 그렇게 정하고,
 * 청약철회는 상품을 받은 날부터 7일 안이면 준비 중에도 막을 수 없다(전자상거래법 제17조제1항). 준비 중 환불은 재고를 되돌리지 않는다(포장돼 나갔을 수 있다).
 */
export const CUSTOMER_CANCELABLE = ["pending_payment", "paid", "preparing"] as const satisfies readonly OrderStatus[]

/**
 * 송장 번호를 정하거나 고칠 수 있는 상태 — 배송으로 가는 길 위(결제 완료 → 준비 중)에 있는 주문뿐이다.
 * 배송이 시작된 주문(shipped)의 번호는 손님에게 이미 보인 값이라 바꾸지 않는다. 시험이 이 목록과 전이 표를 맞춰 본다.
 */
export const TRACKING_EDITABLE = ["paid", "preparing"] as const satisfies readonly OrderStatus[]
