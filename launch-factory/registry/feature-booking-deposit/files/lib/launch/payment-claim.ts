// launch-factory: 상점(commerce)이 모르는 결제 번호가 웹훅으로 오면 여기서 예약금 결제인지 본다 — 같은 PortOne 웹훅 주소 하나로 두 기능의 결제를 받는다.
// 예약금을 받는 제품(예약이 켜져 있고, 결제 중개가 켜져 있고, 예약금이 있는 서비스가 하나라도 있다)일 때만 예약 서비스를 부른다.
// 아니면 「내 것 아님」 — 상점만 있는 제품이 예약 서비스(DB)에 닿지 않는다. 확정은 반환 쪽과 같은 함수(booking().claimPayment)다.
import { depositOf } from "@launch-factory/booking"
import { booking, bookingConfig, bookingEnabled } from "@/lib/launch/booking"
import { payments } from "@/lib/launch/payments"

export type PaymentClaim = "confirmed" | "already_confirmed" | "pending" | "not_applicable" | "not_mine"

export async function claimOtherPayment(paymentId: string): Promise<PaymentClaim> {
  if (!bookingEnabled() || !payments().enabled || !bookingConfig.services.some((s) => depositOf(s) > 0)) return "not_mine"
  return (await booking()).claimPayment(paymentId)
}
