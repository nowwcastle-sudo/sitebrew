// 예약금 훅(계획 3d L3). 서비스가 예약금의 규칙(금액·기한·환불 비율·자리 잡기·멱등)을 지키고, 이 훅은 결제 공급자에 닿는 세 가지만 한다.
// 구현: `@launch-factory/booking-deposit` 의 gatewayDeposit(payments-kr 게이트웨이) · 시험용 가짜 fakeDeposit(아래). 서비스는 결제 공급자를 모른다.
import { randomUUID } from "node:crypto"
import type { BookingRow } from "@launch-factory/db"
import type { DepositSession } from "./types.ts"

/** 결제를 시작할 값. 금액은 서버 설정에서 온 값이다 — 훅은 그대로 쓴다 */
export interface DepositCharge {
  amount: number
  currency: "KRW"
  /** 결제창에 보일 이름 */
  orderName: string
}

export type DepositHold = { ok: true; ref: string; session: DepositSession } | { ok: false; error: string }

/**
 * 공급자가 지금 보는 결제 상태. 금액이 맞는지는 서비스가 예약 행의 금액과 대조한다(훅은 공급자가 본 값을 그대로 돌려준다).
 * canceled = 취소(환불)된 건 · not_found = 공급자에 그 결제 번호가 없다(결제창을 열기 전이거나 포기했다).
 */
export type DepositVerdict = { status: "paid"; amount: number; currency: string } | { status: "pending" | "failed" | "canceled" | "not_found" }

export interface DepositRefundInput {
  /** 돌려줄 금액(원). full 이면 낸 금액 전부 */
  amount: number
  /** true 면 전액 취소 요청(공급자에 금액을 싣지 않는다) */
  full: boolean
  reason: string
}

export interface DepositHook {
  /** 결제 세션을 만든다(결제 번호 채번 포함). 결제창을 여는 값은 session 이다. 던지거나 ok:false 면 예약은 만들어지지 않는다 */
  hold(booking: BookingRow, charge: DepositCharge): Promise<DepositHold>
  /** 공급자에 다시 물어 지금 상태를 돌려준다(반환 쪽·웹훅·만료 정리가 모두 이 길로 확정한다) */
  verify(booking: BookingRow): Promise<DepositVerdict>
  /** 낸 예약금을 돌려준다. 이미 돌려준 건을 또 부르면 ok 다(멱등) */
  refund(booking: BookingRow, input: DepositRefundInput): Promise<{ ok: boolean; code?: string }>
}

export interface FakeDeposit extends DepositHook {
  readonly holds: Array<{ booking: BookingRow; charge: DepositCharge }>
  readonly refunds: Array<{ booking: BookingRow; input: DepositRefundInput }>
  /** 결제가 끝난 것으로 한다(공급자 쪽 사건). 모르는 결제 번호는 던진다 */
  markPaid(ref: string, override?: { amount?: number; currency?: string }): void
  markFailed(ref: string): void
}

/** 시험용 가짜 구현. 호출을 기록하고, 옵션대로 성공·실패한다. 외부 호출은 없다 */
export function fakeDeposit(o: { failHold?: boolean; failRefund?: boolean | (() => boolean); throwVerify?: boolean; session?: Partial<DepositSession> } = {}): FakeDeposit {
  const holds: FakeDeposit["holds"] = []
  const refunds: FakeDeposit["refunds"] = []
  const state = new Map<string, { status: "pending" | "paid" | "failed" | "canceled"; amount: number; currency: string }>()
  const entry = (ref: string) => {
    const found = state.get(ref)
    if (!found) throw new Error(`fake deposit: unknown payment ${ref}`)
    return found
  }
  return {
    holds,
    refunds,
    markPaid(ref, override = {}) {
      const e = entry(ref)
      e.status = "paid"
      if (override.amount !== undefined) e.amount = override.amount
      if (override.currency !== undefined) e.currency = override.currency
    },
    markFailed(ref) {
      entry(ref).status = "failed"
    },
    async hold(booking, charge) {
      holds.push({ booking, charge })
      if (o.failHold) return { ok: false, error: "fake deposit declined" }
      const ref = `fake-pay-${randomUUID()}`
      state.set(ref, { status: "pending", amount: charge.amount, currency: charge.currency })
      return { ok: true, ref, session: { provider: "mock", paymentId: ref, orderName: charge.orderName, total: { amount: charge.amount, currency: charge.currency, vatIncluded: true }, client: { orderId: booking.reference }, ...o.session } }
    },
    async verify(booking) {
      if (o.throwVerify) throw new Error("fake deposit: provider unreachable")
      const e = booking.depositRef ? state.get(booking.depositRef) : undefined
      if (!e) return { status: "not_found" }
      return e.status === "paid" ? { status: "paid", amount: e.amount, currency: e.currency } : { status: e.status }
    },
    async refund(booking, input) {
      refunds.push({ booking, input })
      const fail = typeof o.failRefund === "function" ? o.failRefund() : o.failRefund
      if (fail) return { ok: false, code: "provider_error" }
      const e = booking.depositRef ? state.get(booking.depositRef) : undefined
      if (e && input.full) e.status = "canceled"
      return { ok: true }
    },
  }
}
