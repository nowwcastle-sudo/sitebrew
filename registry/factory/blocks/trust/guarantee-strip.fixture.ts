import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { TrustGuaranteeStripCopy, TrustGuaranteeStripProps } from "./guarantee-strip"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」의 상세페이지 구매 버튼 곁.
const COPY: TrustGuaranteeStripCopy = {
  title: "한 달 써 보고 결정하세요",
  lead: "솜결 차렵이불 퀸(예시) · 89,000원(VAT·배송비 포함)",
  cta: { label: "89,000원에 주문하기", href: "#order" },
  guarantee: { text: "{days}일 안에 마음에 들지 않으면 전액 돌려드려요", days: 30, conditions: ["세탁 전", "구성품 모두"], link: { label: "보증 조건 자세히", href: "#guarantee-terms" } },
  items: [
    { kind: "returns", text: "받은 날부터 7일 안에 반품 배송비 없이 반품돼요" },
    { kind: "secure", text: "결제는 결제대행사(예시)가 처리하고 카드 정보를 저장하지 않아요" },
    { kind: "reviews", text: "구매 인증 리뷰 1,284개 · 평균 4.7점(2026년 9월 28일 기준)" },
    { kind: "delivery", text: "오후 2시 전 주문은 오늘 출고해요" },
  ],
}

export const fixture: TrustGuaranteeStripProps = { copy: COPY }

export const fixtureMax: TrustGuaranteeStripProps = {
  copy: {
    ...COPY,
    title: "한 달 동안 덮어 보고 결정하세요 — 마음에 들지 않으면 전액 돌려드려요",
    lead: "솜결 차렵이불 퀸 사이즈 사계절용(예시) · 89,000원(VAT·배송비 포함) · 색상 네 가지 중 고를 수 있어요",
    guarantee: { ...COPY.guarantee, text: "{days}일 동안 덮어 보고 마음에 들지 않으면 받은 금액 전부를 3영업일 안에 돌려드려요" },
    items: COPY.items.map((it) => ({ ...it, text: `${it.text}(예시 — 자세한 기준은 고객센터 안내를 확인해 주세요)` })),
  },
}

export const fixtureMin: TrustGuaranteeStripProps = {
  copy: { title: COPY.title, lead: "89,000원(VAT·배송비 포함)", cta: COPY.cta, guarantee: { text: COPY.guarantee.text, days: 30, conditions: [] }, items: [] },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<TrustGuaranteeStripProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
