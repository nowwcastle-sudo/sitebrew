import type { BrandOrganization, TrustBrandFactSheetCopy, TrustBrandFactSheetProps } from "./brand-fact-sheet"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」의 회사 소개 — 수치·번호는 모두 지어낸 예시 값이다.
const ORG: BrandOrganization = {
  name: "밀가루공방(예시)",
  representative: "박하늘(예시)",
  bizRegNo: "234-56-78901",
  mailOrderNo: "제2026-서울성동-0000호(예시)",
  address: "서울특별시 성동구 예시길 34, 1층(예시)",
  phone: "02-000-1234",
  foundedAt: "2019-03-02",
  url: "https://example.com",
  sameAs: ["https://example.com/channel", "https://example.com/blog"],
}
const COPY: TrustBrandFactSheetCopy = {
  title: "밀가루공방은 이런 곳이에요",
  definition: "밀가루공방(예시)은 국산 밀로 매일 아침 8시에 빵을 굽는 성동구의 동네 빵집이에요.",
  differentiatorsTitle: "숫자로 보면",
  differentiators: [
    { value: "100", unit: "%", label: "국산 밀가루로 반죽해요", source: "2026년 9월 원료 입고 기록 기준(예시)" },
    { value: "48", unit: "시간", label: "천천히 발효한 반죽만 구워요", source: "매장 반죽 일지 기준(예시)" },
    { value: "320", unit: "명", label: "하루 평균 찾아오는 손님", source: "2026년 8월 계산대 기록 기준(예시)" },
  ],
  representative: { label: "대표", role: "제빵사 · 2019년 가게를 열었어요", quote: "오늘 구운 빵은 오늘 다 팔고, 남으면 동네 복지관에 보내요(예시)." },
  factsTitle: "핵심 사실",
  labels: { founded: "설립", location: "위치", representative: "대표자", bizRegNo: "사업자등록번호", mailOrderNo: "통신판매업 신고번호", phone: "전화", website: "웹사이트", channels: "공식 채널" },
  faq: {
    title: "자주 묻는 질문",
    items: [
      { q: "주문 제작 케이크도 하나요?", a: "사흘 전까지 전화로 주문하면 만들어요(예시)." },
      { q: "빵은 몇 시에 나오나요?", a: "아침 8시와 오후 2시에 두 번 나와요(예시)." },
    ],
  },
}

export const fixture: TrustBrandFactSheetProps = { copy: COPY, organization: ORG, jsonLd: true }

export const fixtureMax: TrustBrandFactSheetProps = {
  copy: {
    ...COPY,
    title: "밀가루공방은 이런 곳이에요 — 국산 밀로 매일 아침 굽는 성동구 동네 빵집",
    definition: "밀가루공방(예시)은 국산 밀과 천연 발효종으로 매일 아침 8시와 오후 2시, 하루 두 번 빵을 굽는 서울 성동구의 동네 빵집이에요. 남은 빵은 그날 저녁 동네 복지관에 보내요(예시).",
    differentiators: [
      ...COPY.differentiators,
      { value: "2,400", unit: "개", label: "지난달 복지관에 보낸 빵", source: "2026년 8월 기부 확인서 기준(예시)" },
      { value: "4.8", unit: "점", label: "매장 방문 손님 만족도(설문 응답 212명)", source: "2026년 7월 매장 설문 기준(예시)" },
      { value: "6", unit: "번째", label: "여섯 번째 항목은 보이지 않아요", source: "사실표는 다섯 개까지만 그려요" },
    ],
    faq: { title: COPY.faq?.title ?? "", items: [...(COPY.faq?.items ?? []), { q: "주차할 곳이 있나요? 근처 공영 주차장을 이용하면 할인되나요?", a: "가게 앞 두 칸이 있고, 근처 공영 주차장(예시)을 쓰면 영수증을 보여 주실 때 한 시간 주차권을 드려요(예시)." }] },
  },
  organization: { ...ORG, address: "서울특별시 성동구 예시길 34, 밀가루빌딩 1층 101호(예시동, 예시 우편번호 00000)" },
  jsonLd: true,
}

export const fixtureMin: TrustBrandFactSheetProps = {
  copy: { ...COPY, representative: { label: COPY.representative.label, role: COPY.representative.role }, faq: undefined },
  organization: { name: ORG.name, representative: ORG.representative, address: ORG.address, phone: ORG.phone, foundedAt: ORG.foundedAt },
}
