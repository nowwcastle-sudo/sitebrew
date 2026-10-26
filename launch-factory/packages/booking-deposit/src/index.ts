// @launch-factory/booking-deposit — 예약금 훅(DepositHook)의 결제 중개 구현(계획 3d L3).
// 예약 서비스(@launch-factory/booking)는 결제 공급자를 모르고, 결제 중개(@launch-factory/payments-kr)는 예약을 모른다 — 이 패키지가 둘을 잇는다.
// 여기서 하는 일은 세 가지뿐이다: 결제창을 열 세션 만들기(hold) · 공급자에 다시 물어 상태 보기(verify) · 낸 돈 돌려주기(refund).
// 금액은 예약 서비스가 서버 설정에서 정해 넘긴 값 그대로 쓴다(브라우저가 보낸 금액은 이 층에 닿지 않는다).
import type { DepositHook } from "@launch-factory/booking"
import type { PaymentGateway } from "@launch-factory/payments-kr"

/** 결제 중개를 예약금 훅으로 바꾼다. mock·PortOne 어느 쪽이든 PaymentGateway 면 된다 */
export function gatewayDeposit(gateway: PaymentGateway): DepositHook {
  return {
    async hold(booking, charge) {
      // 주문 번호는 예약 번호다 — 결제창이 돌아올 때 어느 예약의 결제인지 가리킨다(결제 번호는 공급자 쪽 채번)
      const session = await gateway.prepare({ orderId: booking.reference, orderName: charge.orderName, total: { amount: charge.amount, currency: charge.currency, vatIncluded: true } })
      return { ok: true, ref: session.paymentId, session }
    },

    async verify(booking) {
      if (!booking.depositRef) return { status: "not_found" }
      const seen = await gateway.verify(booking.depositRef)
      if (seen.status === "paid") return seen.total ? { status: "paid", amount: seen.total.amount, currency: seen.total.currency } : { status: "failed" }
      return { status: seen.status }
    },

    async refund(booking, input) {
      if (!booking.depositRef) return { ok: false, code: "payment_not_found" }
      // 먼저 지금 상태를 본다: 이미 취소(전액·일부)된 건은 우리 앞선 시도가 끝난 것이므로 다시 돌려주지 않는다 — 멈춘 환불을 이어받아도 이중 환불이 없다
      const seen = await gateway.verify(booking.depositRef)
      if (seen.status === "canceled") return { ok: true }
      if (seen.status !== "paid") return { ok: false, code: seen.status === "not_found" ? "payment_not_found" : "payment_not_paid" }
      const result = await gateway.cancel({ paymentId: booking.depositRef, reason: input.reason, ...(input.full ? {} : { amount: input.amount }) })
      if (result.ok || result.code === "already_canceled") return { ok: true }
      return { ok: false, code: result.code }
    },
  }
}
