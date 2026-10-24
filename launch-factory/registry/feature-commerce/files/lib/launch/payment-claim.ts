// launch-factory: 상점이 모르는 결제 번호가 웹훅으로 오면 마지막으로 물어보는 자리. 기본은 「내 것 아님」.
// 같은 결제 중개를 쓰는 다른 기능(예약금 — feature-booking-deposit)이 이 파일을 대신해 자기 결제인지 확인하고 확정한다.
export type PaymentClaim = "confirmed" | "already_confirmed" | "pending" | "not_applicable" | "not_mine"

// 기본형은 결제 번호를 보지 않는다 — 같은 서명으로 이 파일을 대신하는 예약금 항목이 쓴다
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function claimOtherPayment(_paymentId: string): Promise<PaymentClaim> {
  return "not_mine"
}
