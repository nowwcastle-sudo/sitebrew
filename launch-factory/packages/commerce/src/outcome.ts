// 도메인 결과 — 판매 규칙이 예상하는 실패는 던지지 않고 이 모양으로 돌려준다. 사람 글은 없다(포트가 i18n 에서 code 로 읽는다).
import type { OrderStatus } from "@launch-factory/contract"
import type { AddressProblem } from "./address.ts"

export type FailureCode =
  | "out_of_stock"
  | "empty_cart"
  | "unknown_product"
  | "invalid_quantity"
  | "invalid_address"
  | "too_many_pending"
  | "not_found"
  | "payment_pending"
  | "payment_failed"
  | "payment_amount_mismatch"
  | "order_canceled"
  | "not_cancelable"
  | "refund_failed"
  | "invalid_transition"
  | "invalid_input"

export interface Failure {
  ok: false
  code: FailureCode
  /** out_of_stock·unknown_product: 문제의 상품 id */
  productId?: string
  /** out_of_stock: 지금 살 수 있는 수 */
  available?: number
  /** invalid_address: 칸별 문제 */
  fields?: Record<string, AddressProblem>
  /** 결제 공급자가 본 결제 상태(payment_pending·payment_failed) */
  paymentStatus?: string
  /** 주문의 지금 상태(not_cancelable·invalid_transition·order_canceled) */
  status?: OrderStatus
  /** order_canceled: 늦게 들어온 결제를 자동으로 돌려줬는가 */
  refunded?: boolean
}

export type Outcome<T> = { ok: true; value: T } | Failure

export const succeed = <T>(value: T): Outcome<T> => ({ ok: true, value })
export const fail = (code: FailureCode, extra: Omit<Failure, "ok" | "code"> = {}): Failure => ({ ok: false, code, ...extra })
