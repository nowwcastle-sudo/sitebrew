// 키 없는 미리보기용 게이트웨이 — PortOne 은 키 없는 샌드박스가 없어서 우리가 직접 흉내 낸다.
// 메모리에만 산다(프로세스가 바뀌면 사라진다 — 미리보기 한 바퀴용이다). 결제는 markPaid 로 일으킨다(mock 결제 화면·시험이 부른다).
import { randomUUID } from "node:crypto"
import { assertChargeable, won, type CancelInput, type CancelResult, type PaymentGateway, type PaymentSession, type PrepareInput, type VerifyResult } from "./gateway.ts"

type MockState = "pending" | "paid" | "failed" | "canceled"

export interface MockGateway extends PaymentGateway {
  /** 결제가 끝난 것으로 한다. 모르는 paymentId 는 던진다 */
  markPaid(paymentId: string): void
  /** 결제가 실패한 것으로 한다. 모르는 paymentId 는 던진다 */
  markFailed(paymentId: string): void
}

export interface MockGatewayOptions {
  /** paymentId 채번(시험에서 고정할 때). 기본 `mock-<uuid>` */
  newId?: () => string
}

export function mockGateway(options: MockGatewayOptions = {}): MockGateway {
  const newId = options.newId ?? (() => `mock-${randomUUID()}`)
  const payments = new Map<string, { state: MockState; amount: number; refunded: number }>()

  const entry = (paymentId: string) => {
    const found = payments.get(paymentId)
    if (!found) throw new Error(`mock 결제 건을 찾을 수 없어요: ${paymentId}`)
    return found
  }

  return {
    async prepare(input: PrepareInput): Promise<PaymentSession> {
      assertChargeable(input.total)
      const paymentId = newId()
      payments.set(paymentId, { state: "pending", amount: input.total.amount, refunded: 0 })
      return { provider: "mock", paymentId, orderName: input.orderName, total: input.total, client: { orderId: input.orderId } }
    },

    async verify(paymentId: string): Promise<VerifyResult> {
      const p = payments.get(paymentId)
      if (!p) return { status: "not_found" }
      return { status: p.state, total: won(p.amount) }
    },

    async cancel({ paymentId, amount }: CancelInput): Promise<CancelResult> {
      const p = payments.get(paymentId)
      if (!p) return { ok: false, code: "payment_not_found" }
      if (p.state === "canceled") return { ok: false, code: "already_canceled" }
      if (p.state !== "paid") return { ok: false, code: "payment_not_paid" }
      if (amount === undefined) {
        p.refunded = p.amount
        p.state = "canceled"
        return { ok: true }
      }
      // 일부 환불: 낸 금액에서 이미 돌려준 만큼을 뺀 나머지까지만. 다 돌려주면 전액 취소와 같다(PortOne 의 PARTIAL_CANCELLED → CANCELLED)
      if (!Number.isSafeInteger(amount) || amount < 1) return { ok: false, code: "invalid_request" }
      if (amount > p.amount - p.refunded) return { ok: false, code: "amount_exceeds_cancellable" }
      p.refunded += amount
      if (p.refunded === p.amount) p.state = "canceled"
      return { ok: true }
    },

    markPaid(paymentId: string) {
      entry(paymentId).state = "paid"
    },
    markFailed(paymentId: string) {
      entry(paymentId).state = "failed"
    },
  }
}
