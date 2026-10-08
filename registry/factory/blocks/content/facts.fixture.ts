import type { ContentFactsProps } from "./facts"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방 「결마루(예시)」의 배송 안내와 사례 메타.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중", days: "{n}영업일 안에 보내요" }

export const fixture: ContentFactsProps = {
  copy: { title: "배송 안내", lead: "아래 금액은 모두 VAT 포함이에요(예시).", units: UNITS },
  rows: [
    { label: "배송비", value: { value: 3000, format: "money", currency: "KRW" } },
    { label: "무료배송 기준", value: { value: 50000, format: "money", currency: "KRW" } },
    { label: "택배사", value: { value: "예시택배" } },
    { label: "출고", value: { value: 2, format: "days" } },
  ],
}

export const fixtureMax: ContentFactsProps = {
  copy: { title: "사례 정보", lead: "의뢰와 역할을 먼저 적었어요(예시).", units: UNITS },
  rows: [
    { label: "의뢰인", value: { value: "결마루 카페(예시)" } },
    { label: "제공 서비스", value: { value: ["목재 수거", "가구 설계", "제작·설치"] } },
    { label: "연도", value: { value: 2025, format: "year" } },
    { label: "역할", value: { value: "설계와 제작 전체(예시)" } },
    { label: "기준 시각", value: { value: "2026-09-30", format: "date" } },
  ],
}

export const fixtureMin: ContentFactsProps = {
  copy: { title: "원산지", hideTitle: false, units: UNITS },
  rows: [{ label: "참나무 식탁(예시)", value: { value: "국산 참나무(예시)" } }],
}
