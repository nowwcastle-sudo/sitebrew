// launch-factory: 예약금 연결 자리. 기본은 없음 — 예약금이 있는 서비스(설정의 deposit > 0)는 이 자리가 비어 있으면 접수를 받지 않는다(provider_unavailable).
// feature-booking-deposit 를 설치하면 이 파일을 그 항목의 것(결제 중개 payments-kr 로 예약금을 받고 돌려주는 훅)이 대신한다.
import type { DepositHook } from "@launch-factory/booking"

/** 예약금을 받을 수 있는가(결제 중개가 켜져 있는가). 네트워크·DB 에 닿지 않는다 */
export const bookingDepositEnabled = (): boolean => false

export async function bookingDeposit(): Promise<DepositHook | undefined> {
  return undefined
}
