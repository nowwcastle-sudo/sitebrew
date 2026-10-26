// 판매 규칙의 숫자 — 한 곳에 모은 데이터. 코드가 값을 따로 들고 있지 않다(바꾸려면 여기 한 줄).

export const RULES = {
  /** 한 줄(상품 하나)의 최대 수량. 장바구니·재고 예약이 같은 값을 쓴다 */
  maxLineQuantity: 99,
  /** 결제 대기 주문이 재고를 붙들고 있는 시간(분). 지나면 만료 Cron 이 취소하고 재고를 돌려준다 */
  holdMinutes: 30,
  /** 한 사람이 동시에 가질 수 있는 결제 대기 주문 수 — 재고를 계속 붙들어 두는 것을 막는다 */
  maxPendingOrders: 3,
  /** 만료 Cron 한 번에 처리하는 주문 수(나머지는 다음 실행이 이어서 한다) */
  expireBatch: 100,
  /** 운송장 번호 최대 길이 */
  trackingNumberMax: 100,
  /** 취소 사유 최대 길이(결제 공급자에도 그대로 간다) */
  reasonMax: 200,
} as const

/** 배송지 칸별 길이 상한 */
export const ADDRESS_LIMITS = { recipient: 60, phone: 30, postcode: 10, address1: 200, address2: 200, note: 200 } as const
