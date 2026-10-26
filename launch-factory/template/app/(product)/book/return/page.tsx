import { BookingReturnConfirm } from "@/components/product/booking-return"
import { BookingReturnNotice } from "@/components/product/booking-return-notice"
import { parseCheckoutReturn } from "@/lib/shop-params"

export const metadata = { title: "Confirming your deposit", robots: { index: false } }

// 예약금 결제창을 마치고 돌아오는 쪽(모바일 리디렉션): ?orderId=<예약 번호>&paymentId=…(성공) 또는 &code=…(실패·취소). 성공이면 서버가 결제 공급자에 다시 물어 예약을 확정한다(confirmBookingDeposit).
// 예약은 로그인 없이 하므로 이 쪽도 공개다. 주소의 값은 믿지 않는다 — 모양이 맞는 것만 받고, 금액은 읽지도 않는다.
export default async function BookReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ret = parseCheckoutReturn(await searchParams)
  if (ret.kind === "confirm") return <BookingReturnConfirm reference={ret.orderId} paymentId={ret.paymentId} />
  return <BookingReturnNotice kind={ret.kind} />
}
