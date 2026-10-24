// 결제 중개 인터페이스 — 이 패키지가 밖에 약속하는 것은 이 파일의 모양 하나다.
// 구현은 둘(mock.ts · portone.ts)이고, 주문·재고·DB 는 모른다(주문 규칙은 commerce 패키지가 이 인터페이스만 보고 부른다).
// 금액은 최소 단위 정수(KRW 는 원)이고 통화는 KRW 만 받는다 — 다른 통화는 던진다(PortOne 간편결제가 KRW 위주).
import type { Money } from "@launch-factory/contract"

/** 지원하는 유일한 통화. PortOne 브라우저 SDK 의 통화 상수는 문자열 "KRW" 다(문서 예시의 CURRENCY_KRW 는 옛 표기) */
export const KRW = "KRW" as const

/**
 * 브라우저가 결제창을 열 때 쓰는 값. client 에는 공개해도 되는 값만 담는다(storeId·channelKey 등 + 결제창이 되돌아올 때 주문을 찾는 orderId — 구매자 본인의 것).
 * web-factory 계약 `contract/commerce.ts` 의 PaymentSession 과 구조가 같다(계약 동기화 뒤에는 그쪽 타입과 서로 대입된다).
 */
export interface PaymentSession {
  provider: "portone" | "mock"
  paymentId: string
  orderName: string
  total: Money
  client: Record<string, string>
}

export interface PrepareInput {
  orderId: string
  orderName: string
  total: Money
}

/**
 * 결제 건의 지금 상태. 금액이 맞는지는 여기서 판단하지 않는다 — total 은 공급자가 본 값 그대로이고, 주문 행과 대조하는 것은 호출 쪽(commerce)의 몫이다.
 * not_found 는 공급자에 그 paymentId 가 없다(결제창을 열기 전이거나 포기했다).
 */
export type VerifyStatus = "paid" | "pending" | "failed" | "canceled" | "not_found"
export interface VerifyResult {
  status: VerifyStatus
  total?: Money
}

export interface CancelInput {
  paymentId: string
  reason: string
  /** 돌려줄 금액(최소 단위 정수). 생략하면 전액. 예약금처럼 일부만 돌려줄 때만 준다 — 낸 금액을 넘으면 amount_exceeds_cancellable */
  amount?: number
}
export type CancelResult = { ok: true } | { ok: false; code: string }

export interface PaymentGateway {
  /** 결제창을 열 값을 만든다(paymentId 채번 포함). 공급자를 부르지 않는다 */
  prepare(input: PrepareInput): Promise<PaymentSession>
  /** 공급자에 다시 물어 지금 상태를 돌려준다(리디렉션 반환·웹훅 모두 이 길로 확정한다) */
  verify(paymentId: string): Promise<VerifyResult>
  /** 취소(amount 를 생략하면 전액). 이미 전액 취소된 건을 또 취소하면 already_canceled */
  cancel(input: CancelInput): Promise<CancelResult>
}

/** 환경 설정이 잘못됐다(LF_MODE 누락·웹훅 비밀 형식 오류 등). 요청 탓이 아니라 운영자 탓이라 거절(400)이 아니라 오류로 올린다 */
export class PaymentsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PaymentsConfigError"
  }
}

export class UnsupportedCurrencyError extends Error {
  constructor(currency: unknown) {
    super(`결제 통화는 KRW 만 지원해요 (받은 통화: ${String(currency)})`)
    this.name = "UnsupportedCurrencyError"
  }
}

export class InvalidAmountError extends Error {
  constructor(amount: unknown) {
    super(`결제 금액은 1 이상의 정수(원)여야 해요 (받은 금액: ${String(amount)})`)
    this.name = "InvalidAmountError"
  }
}

/** 결제를 시작할 수 있는 금액인지 본다: 원화, 1 이상의 안전한 정수 */
export function assertChargeable(total: Money): void {
  if (total.currency !== KRW) throw new UnsupportedCurrencyError(total.currency)
  if (!Number.isSafeInteger(total.amount) || total.amount < 1) throw new InvalidAmountError(total.amount)
}

/** 공급자가 돌려준 금액 → 계약 Money. 카드·간편결제 총액은 부가세를 포함한 값이다 */
export function won(amount: number): Money {
  return { amount, currency: KRW, vatIncluded: true }
}
