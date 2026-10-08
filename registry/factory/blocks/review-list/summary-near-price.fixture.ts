import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { KIT, makeReviews, summarize } from "./distribution-filter.fixture"
import type { ReviewListSummaryNearPriceCopy, ReviewListSummaryNearPriceProps } from "./summary-near-price"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 상세페이지 윗부분 — 가격 곁으로 올린 후기.
const COPY: ReviewListSummaryNearPriceCopy = {
  kit: KIT,
  priceNote: "VAT·배송비 포함",
  cta: { label: "장바구니에 담기", href: "#cart" },
  shipping: "오후 2시 전 주문은 오늘 출고 · 받은 날부터 7일 안에 무료 반품",
  highlightsTitle: "먼저 읽어 볼 리뷰",
  critical: "가장 낮은 별점 리뷰",
  all: { label: "리뷰 {count}개 모두 보기", href: "#reviews" },
}
const PRODUCT = { name: "솜결 차렵이불 퀸(예시)", price: 89000, currency: "KRW" }

const R12 = makeReviews(12)
export const fixture: ReviewListSummaryNearPriceProps = { copy: COPY, product: PRODUCT, summary: summarize(R12), reviews: R12 }

const R40 = makeReviews(40)
export const fixtureMax: ReviewListSummaryNearPriceProps = {
  copy: { ...COPY, shipping: "오후 2시 전 주문은 오늘 출고해요 · 받은 날부터 7일 안에는 반품 배송비 없이 반품돼요 · 제주·도서 지역은 하루 더 걸려요(예시)" },
  product: { ...PRODUCT, name: "솜결 차렵이불 퀸 사이즈 사계절용 — 크림·그레이·세이지·코랄 네 가지 색(예시)" },
  summary: summarize(R40),
  reviews: R40.map((r, i) => (i === 0 ? { ...r, body: `${r.body} 두 달째 쓰고 있는데 세 번 세탁해도 모양이 그대로예요. 다만 건조기는 쓰지 않았어요(예시).` } : r)),
}

const R1 = makeReviews(1, false)
export const fixtureMin: ReviewListSummaryNearPriceProps = { copy: COPY, product: PRODUCT, summary: summarize(R1), reviews: R1 }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReviewListSummaryNearPriceProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
