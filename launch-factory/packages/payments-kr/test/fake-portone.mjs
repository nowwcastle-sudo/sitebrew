// 가짜 PortOne 서버 클라이언트 — PortOneClient 의 payment.getPayment / cancelPayment 모양만 흉내 낸다.
// 오류는 진짜 SDK 의 오류 클래스(Payment.GetPaymentError 등)로 던진다 — 어댑터가 instanceof 로 읽는 것과 같은 길을 탄다.
import { Payment } from "@portone/server-sdk"

/** 결제 건 하나(SDK Payment 모양 중 어댑터가 읽는 칸만) */
export const payment = (status, total, currency = "KRW") => ({ status, id: "ignored", amount: { total }, currency })

export function fakePortOne() {
  /** @type {Map<string, any>} */
  const payments = new Map()
  const calls = { get: [], cancel: [] }
  /** @type {{ get?: Error, cancel?: Error }} */
  const failWith = {}
  const client = {
    payment: {
      async getPayment(options) {
        calls.get.push(options)
        if (failWith.get) throw failWith.get
        const p = payments.get(options.paymentId)
        if (!p) throw new Payment.GetPaymentError({ type: "PAYMENT_NOT_FOUND" })
        return p
      },
      async cancelPayment(options) {
        calls.cancel.push(options)
        if (failWith.cancel) throw failWith.cancel
        return { cancellation: { status: "SUCCEEDED" } }
      },
    },
  }
  return { client, payments, calls, failWith }
}
