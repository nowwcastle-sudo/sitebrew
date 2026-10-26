// launch-factory: 예약금 연결. 결제 중개(payments-kr)로 예약금을 받고(hold) · 다시 물어 확인하고(verify) · 돌려준다(refund).
// 금액·기한·환불 규정은 예약 설정(lib/launch/booking-config.ts)과 예약 서비스가 정한다 — 이 훅은 결제 공급자에 닿는 세 가지만 한다.
// 결제 중개가 꺼져 있으면(live 에서 PortOne 값 없음) 훅이 없다: 예약금이 있는 서비스만 접수가 꺼지고(provider_unavailable) 예약금 없는 서비스는 그대로 받는다.
import type { DepositHook } from "@launch-factory/booking"
import { gatewayDeposit } from "@launch-factory/booking-deposit"
import { payments } from "@/lib/launch/payments"

/** 예약금을 받을 수 있는가(결제 중개가 켜져 있는가). 네트워크·DB 에 닿지 않는다 */
export const bookingDepositEnabled = (): boolean => payments().enabled

export async function bookingDeposit(): Promise<DepositHook | undefined> {
  const config = payments()
  return config.enabled ? gatewayDeposit(config.gateway) : undefined
}
