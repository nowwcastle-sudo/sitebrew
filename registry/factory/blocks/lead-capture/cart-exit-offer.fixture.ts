import { MOCK_NOW, mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { LeadCaptureCartExitOfferCopy, LeadCaptureCartExitOfferProps } from "./cart-exit-offer"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 장바구니 — 창 위 끝으로 마우스가 나갈 때 한 번 뜬다.
// 지금 시각은 목 기준(2026-10-01)으로 고정하고 끝나는 때는 실제 캠페인 값처럼 준다(남은 날이 흔들리지 않게).
const COPY: LeadCaptureCartExitOfferCopy = {
  title: "장바구니 쿠폰을 드릴게요",
  body: "지금 결제하면 바로 쓸 수 있는 할인 쿠폰이에요. 필요 없으면 닫아도 장바구니는 그대로예요.",
  conditions: "부가세 포함 50,000원 이상 결제할 때 · 이번 주문에 한 번",
  amountLabel: "할인 금액",
  countdown: "쿠폰 기간이 {days}일 남았어요",
  decline: "쿠폰 없이 계속 보기",
  accept: "3,000원 할인받고 결제하기",
  snooze: "7일간 보지 않기",
}
const AMOUNT = { amount: 3000, currency: "KRW" as const, vatIncluded: true }

export const fixture: LeadCaptureCartExitOfferProps = { copy: COPY, context: "cart", offer: { amount: AMOUNT, href: "#checkout?coupon=EXAMPLE3000", endsAt: "2026-10-04T15:00:00.000Z" }, now: MOCK_NOW }

export const fixtureMax: LeadCaptureCartExitOfferProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "결제 전에 장바구니 쿠폰을 한 장 드릴게요 — 이번 주문에 바로 쓸 수 있어요",
    body: "지금 결제하면 바로 쓸 수 있는 3,000원 할인 쿠폰이에요. 필요 없으면 닫아도 장바구니와 고른 옵션은 그대로 남아 있고, 이 창은 이번 방문에 다시 뜨지 않아요(예시).",
    conditions: "부가세 포함 50,000원 이상 결제할 때 · 이번 주문에 한 번 · 다른 쿠폰과 함께 쓸 수 없어요 · 배송비에는 적용되지 않아요",
  },
  context: "checkout",
}

// 끝나는 때가 없는 제안 — 남은 날을 그리지 않는다(L8: 고정·가짜 카운트다운 금지)
export const fixtureMin: LeadCaptureCartExitOfferProps = { copy: COPY, context: "cart", offer: { amount: AMOUNT, href: "#checkout?coupon=EXAMPLE3000" } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<LeadCaptureCartExitOfferProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
