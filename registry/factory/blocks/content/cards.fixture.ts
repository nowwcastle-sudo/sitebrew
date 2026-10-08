import type { ContentCardsProps } from "./cards"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방 「결마루(예시)」의 사람들과 작업.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중", external: "다른 사이트" }
const portrait = (alt: string) => ({ id: "portrait", aspect: "4:5", source: "real-required", alt })

export const fixture: ContentCardsProps = {
  copy: { title: "리더십", units: UNITS },
  items: [
    { title: "한도윤(예시)", meta: [{ value: "대표" }], summary: "가구 공방에서 열두 해 일했어요(예시).", image: portrait("한도윤 대표") },
    { title: "서지아(예시)", meta: [{ value: "작업실장" }], summary: "목재 손질과 마감을 맡아요(예시).", image: portrait("서지아 작업실장") },
    { title: "문태오(예시)", meta: [{ value: "디자이너" }], summary: "손님과 쓰임을 정해요(예시).", image: portrait("문태오 디자이너") },
  ],
}

export const fixtureMax: ContentCardsProps = {
  copy: { title: "작업", lead: "최근 작업을 골랐어요(예시).", units: UNITS },
  items: [
    { title: "마루판 식탁(예시)", href: "/work", meta: [{ value: "결마루 카페(예시)" }, { value: 2025, format: "year" }], tags: ["가구", "목재 재사용"], image: { id: "work-thumb", aspect: "3:2", source: "real-required", alt: "마루판 식탁" } },
    { title: "기둥 선반(예시)", meta: [{ value: "개인 의뢰(예시)" }, { value: 2025, format: "year" }], tags: ["선반"], image: { id: "work-thumb", aspect: "3:2", source: "real-required", alt: "기둥 선반" } },
    { title: "문짝 벤치(예시)", meta: [{ value: "동네 책방(예시)" }, { value: 2024, format: "year" }], points: ["옛 문짝 두 장", "오일 마감"], image: { id: "work-thumb", aspect: "3:2", source: "real-required", alt: "문짝 벤치" } },
    { title: "툇마루 계단(예시)", meta: [{ value: "한옥 수선(예시)" }, { value: 2024, format: "year" }], image: { id: "work-thumb", aspect: "3:2", source: "real-required", alt: "툇마루 계단" } },
  ],
}

export const fixtureMin: ContentCardsProps = {
  copy: { title: "주요 정책", units: UNITS },
  items: [{ title: "공방 견학 무료 개방(예시)", summary: "매달 둘째 토요일에 열어요(예시).", meta: [{ value: "신청 마감 9월 말(예시)" }] }],
}
