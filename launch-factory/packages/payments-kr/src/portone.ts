// PortOne V2 어댑터 — 서버 SDK(@portone/server-sdk 0.19.0)의 클라이언트를 주입받아 PaymentGateway 로 감싼다.
// 클라이언트를 주입받는 이유: 시험이 가짜 클라이언트로 상태 사상을 보고, 키는 config.ts 한 곳에서만 만진다.
// 사실표: getPayment 는 없는 건에 null 이 아니라 Payment.GetPaymentError(PAYMENT_NOT_FOUND)를 던진다.
//   이행 조건은 「PAID + 금액·통화 일치」인데 금액 대조는 호출 쪽(commerce)의 몫이라 여기서는 서버가 본 금액을 그대로 돌려준다.
//   0.19.0 은 취소에 Idempotency-Key 를 보내지 않는다 → 같은 건 중복 취소의 멱등은 주문 행 상태 전이로 지킨다.
import { randomUUID } from "node:crypto"
import { Payment, type PortOneClient } from "@portone/server-sdk"
import { assertChargeable, KRW, UnsupportedCurrencyError, won, type CancelInput, type CancelResult, type PaymentGateway, type PaymentSession, type PrepareInput, type VerifyResult, type VerifyStatus } from "./gateway.ts"

/** 어댑터가 읽는 PortOneClient 의 부분. 진짜 `PortOneClient` 가 그대로 대입된다(아래 컴파일 검사) */
export interface PortOneClientLike {
  payment: {
    getPayment(options: { paymentId: string }): Promise<LoosePayment>
    cancelPayment(options: { paymentId: string; reason: string; amount?: number }): Promise<unknown>
  }
}
/** SDK 의 Payment 합집합 중 우리가 읽는 칸. 모르는 status(Unrecognized 기호 포함)도 받아야 해서 넓게 잡는다 */
interface LoosePayment {
  status: unknown
  amount?: { total: number }
  currency?: string
}
// 진짜 클라이언트가 이 모양을 채우는지 컴파일 때 확인한다(SDK 가 바뀌면 여기서 타입 오류가 난다).
const _clientFits = (c: PortOneClient): PortOneClientLike => c
void _clientFits

export interface PortOneGatewayConfig {
  client: PortOneClientLike
  /** 브라우저 노출 OK */
  storeId: string
  /** 브라우저 노출 OK */
  channelKey: string
  /** paymentId 채번(시험에서 고정할 때). 기본 `payment-<uuid>` — 토스 채널 규칙(영문·숫자·-·_ 6~64자)에 맞는다 */
  newPaymentId?: () => string
}

/** SDK status → 우리 상태. 모르는 값은 pending(이행하지 않고 다음 재조회를 기다린다) */
const STATUS: Record<string, VerifyStatus> = {
  PAID: "paid",
  READY: "pending",
  PAY_PENDING: "pending",
  VIRTUAL_ACCOUNT_ISSUED: "pending",
  FAILED: "failed",
  // 일부라도 취소된 건은 이행 대상으로 보지 않는다(주문은 전액만 취소한다 — 일부 환불은 예약금 환불뿐이고 결제 확정 전에는 일어나지 않는다)
  CANCELLED: "canceled",
  PARTIAL_CANCELLED: "canceled",
}

/** CancelPaymentError.data.type → 우리 코드. 표에 없는 값은 cancel_failed */
const CANCEL_CODE: Record<string, string> = {
  PAYMENT_NOT_FOUND: "payment_not_found",
  PAYMENT_NOT_PAID: "payment_not_paid",
  PAYMENT_ALREADY_CANCELLED: "already_canceled",
  CANCEL_AMOUNT_EXCEEDS_CANCELLABLE_AMOUNT: "amount_exceeds_cancellable",
  FORBIDDEN: "forbidden",
  UNAUTHORIZED: "unauthorized",
  INVALID_REQUEST: "invalid_request",
  PG_PROVIDER: "provider_error",
}

export function portoneGateway(config: PortOneGatewayConfig): PaymentGateway {
  const { client, storeId, channelKey } = config
  const newPaymentId = config.newPaymentId ?? (() => `payment-${randomUUID()}`)

  return {
    async prepare(input: PrepareInput): Promise<PaymentSession> {
      assertChargeable(input.total)
      return {
        provider: "portone",
        paymentId: newPaymentId(),
        orderName: input.orderName,
        total: input.total,
        client: { storeId, channelKey, orderId: input.orderId },
      }
    },

    async verify(paymentId: string): Promise<VerifyResult> {
      let found: LoosePayment
      try {
        found = await client.payment.getPayment({ paymentId })
      } catch (e) {
        if (e instanceof Payment.GetPaymentError && e.data.type === "PAYMENT_NOT_FOUND") return { status: "not_found" }
        throw e // 인증·네트워크 오류는 그대로 — 웹훅 처리기가 500 으로 답해 재전송을 받는다
      }
      const status = typeof found.status === "string" ? (STATUS[found.status] ?? "pending") : "pending"
      if (!found.amount) return { status }
      if (found.currency !== KRW) throw new UnsupportedCurrencyError(found.currency)
      return { status, total: won(found.amount.total) }
    },

    async cancel({ paymentId, reason, amount }: CancelInput): Promise<CancelResult> {
      // 일부 환불은 amount 를 싣고, 전액은 싣지 않는다(PortOne 이 남은 전액으로 읽는다)
      if (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 1)) return { ok: false, code: "invalid_request" }
      try {
        await client.payment.cancelPayment({ paymentId, reason, ...(amount !== undefined ? { amount } : {}) })
        return { ok: true }
      } catch (e) {
        if (e instanceof Payment.CancelPaymentError) return { ok: false, code: CANCEL_CODE[e.data.type as string] ?? "cancel_failed" }
        return { ok: false, code: "provider_unreachable" }
      }
    },
  }
}
