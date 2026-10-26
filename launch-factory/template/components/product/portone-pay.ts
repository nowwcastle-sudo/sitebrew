// 결제창을 여는 곳 — PortOne 브라우저 SDK 를 부르는 파일은 이 하나다(상점 조립 components/product/shop-blocks.tsx 가 결제 세션이 portone 일 때 부른다).
// SDK 는 결제 버튼을 눌렀을 때만 동적으로 불러온다(첫 화면 번들에 싣지 않는다). 판은 package.json 에 정확히 고정(0.1.13).
// 데스크톱은 창 안에서 끝나 결과가 바로 돌아오고, 모바일은 redirectUrl 로 나갔다 돌아온다 — 돌아오는 쪽(app/(product)/checkout/return)이 서버에 확정을 요청한다.
// 던지지 않는다: 실패·닫음은 { ok: false, code } 로 끝낸다(블록이 같은 주문으로 다시 결제하게 한다). 결제 금액·주문은 서버가 정한 세션 값 그대로이고 브라우저에서 만들지 않는다.
import type { PayResult } from "@/components/blocks/_shared/checkout-flow"
import type { PaymentSession } from "@/components/contract/commerce"

/** 결제창이 돌아오는 쪽 */
export const CHECKOUT_RETURN_PATH = "/checkout/return"

/** 예약금 결제창이 돌아오는 쪽(예약 항목 feature-booking-deposit) */
export const BOOKING_RETURN_PATH = "/book/return"

/** 돌아올 주소 — 어느 주문(예약)의 결제인지 싣는다(PortOne 이 paymentId 를 덧붙인다). path 를 주지 않으면 상점 반환 쪽 */
export const returnUrl = (origin: string, orderId: string, path: string = CHECKOUT_RETURN_PATH): string => `${origin}${path}?orderId=${encodeURIComponent(orderId)}`

export async function openPortOne(session: PaymentSession, returnPath: string = CHECKOUT_RETURN_PATH): Promise<PayResult> {
  const { storeId, channelKey, orderId } = session.client
  const fail = (code: string): PayResult => ({ ok: false, paymentId: session.paymentId, code })
  if (session.provider !== "portone" || !storeId || !channelKey || !orderId || session.total.currency !== "KRW") return fail("provider_unavailable")
  try {
    const { default: PortOne } = await import("@portone/browser-sdk/v2")
    const response = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId: session.paymentId,
      orderName: session.orderName,
      totalAmount: session.total.amount,
      currency: "KRW",
      payMethod: "CARD",
      locale: "EN_US",
      redirectUrl: returnUrl(window.location.origin, orderId, returnPath),
    })
    // 응답이 없으면 창을 열지 못했거나 닫았다
    if (!response) return fail("payment_canceled")
    if (response.code) return fail(response.code)
    return { ok: true, paymentId: response.paymentId }
  } catch {
    return fail("payment_failed")
  }
}
