import type { PricingThreeTierCardsProps } from "./three-tier-cards"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 요금, 문구마다 「예시」. 금액은 saas plans 모양(월 가격·통화·포함 기능).
export const fixture: PricingThreeTierCardsProps = {
  copy: {
    title: "요금제",
    lead: "14일 무료로 써 보고 고르세요(예시).",
    plans: [
      { name: "혼자 쓰기", monthlyPrice: 0, currency: "KRW", features: ["지점 1곳", "직원 계정 1개", "엑셀 가져오기"] },
      { name: "팀", monthlyPrice: 12900, currency: "KRW", features: ["지점 3곳", "직원 계정 10개", "세금계산서 자동 발행", "상담 창구 우선 답변"] },
      { name: "여러 지점", monthlyPrice: 39000, currency: "KRW", features: ["지점 무제한", "직원 계정 무제한", "권한 세분화", "전담 매니저"] },
    ],
    recommended: "팀",
    // 요금제 id(BillingPort Plan.id) — 행동 버튼이 로그인 상태를 따른다(P3-6 E01). 이 예시는 로그아웃이라 가입 주소 그대로다
    planIds: ["starter", "team", "multi"],
    recommendedLabel: "추천",
    perMonth: "/월",
    contactLabel: "별도 문의",
    cta: { label: "무료로 시작", href: "#signup" },
    footnote: "부가세 별도, 언제든 해지할 수 있어요(예시).",
    vat: { included: "부가세 포함", excluded: "부가세 별도" },
  },
}

// 최대: 문구 끝까지, 요금제 4개(문의형 포함) · 기능 8개 · 긴 이름.
export const fixtureMax: PricingThreeTierCardsProps = {
  copy: {
    title: "요금제 — 혼자부터 여러 지점까지, 언제든 바꿀 수 있어요(예시)",
    lead: "금액은 모두 부가세 별도예요. 14일 동안 모든 기능을 무료로 써 보고 고르세요. 요금제는 한 달 단위로 바꿀 수 있고, 올리면 그날부터 날짜만큼 계산하고 내리면 다음 결제일부터 적용해요(예시).",
    plans: [
      { name: "혼자 쓰는 가게", monthlyPrice: 0, currency: "KRW", features: Array.from({ length: 8 }, (_, i) => `엑셀·CSV 가져오기와 내보내기 기능 ${i + 1}`) },
      { name: "직원이 있는 팀", monthlyPrice: 12900, currency: "KRW", features: Array.from({ length: 8 }, (_, i) => `세금계산서 자동 발행과 거래처 관리 ${i + 1}`) },
      { name: "지점이 여럿인 사업장", monthlyPrice: 1239000, currency: "KRW", features: Array.from({ length: 8 }, (_, i) => `지점별 권한 세분화와 전담 매니저 ${i + 1}`) },
      { name: "맞춤 계약", monthlyPrice: null, currency: "KRW", features: ["모든 기능", "계약서·보안 심사 대응", "전용 서버 선택"] },
    ],
    recommended: "직원이 있는 팀",
    planIds: ["solo", "team", "branch"],
    recommendedLabel: "가장 많이 고름",
    perMonth: "/월",
    contactLabel: "별도 문의",
    planCtas: [
      { label: "무료로 시작하기", href: "#signup-free" },
      { label: "14일 무료로 써 보기", href: "#signup-team" },
      { label: "14일 무료로 써 보기", href: "#signup-branch" },
      { label: "영업 담당자와 상담", href: "#contact-sales" },
    ],
    cta: { label: "시작하기", href: "#signup" },
    footnote: "모든 금액은 부가세 별도예요. 연 결제는 20% 할인되고, 해지하면 남은 기간만큼 돌려드려요. 결제 수단은 카드와 계좌이체를 받아요(예시).",
  },
}

// 최소: 머리말·아래 줄 없이 요금제 1개(기능 1개).
export const fixtureMin: PricingThreeTierCardsProps = {
  copy: {
    title: "요금제", lead: "금액은 부가세 별도예요(예시).",
    plans: [{ name: "팀", monthlyPrice: 12900, currency: "KRW", features: ["모든 기능"] }],
    recommendedLabel: "추천",
    perMonth: "/월",
    contactLabel: "별도 문의",
    cta: { label: "시작하기", href: "#signup" },
  },
}
