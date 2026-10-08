import type { PricingToggleAnnualProps } from "./toggle-annual"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 요금, 문구마다 「예시」.
const LABELS = {
  periodLabel: "결제 주기",
  monthlyLabel: "월 결제",
  annualLabel: "연 결제",
  discountTemplate: "연 결제 {p}% 할인",
  perMonth: "/월",
  billedAnnuallyTemplate: "연 {total} 한 번에 결제",
  savingTemplate: "월 결제보다 연 {saving} 아껴요",
  contactLabel: "별도 문의",
  recommendedLabel: "추천",
}

export const fixture: PricingToggleAnnualProps = {
  copy: {
    title: "요금제",
    lead: "연 결제로 바꾸면 두 달치가 빠져요(예시).",
    ...LABELS,
    annualDiscount: 0.2,
    plans: [
      { name: "혼자 쓰기", monthlyPrice: 0, currency: "KRW", features: ["지점 1곳", "직원 1명"] },
      { name: "팀", monthlyPrice: 12900, currency: "KRW", features: ["지점 3곳", "직원 10명", "세금계산서"] },
      { name: "여러 지점", monthlyPrice: 39000, currency: "KRW", features: ["지점 무제한", "권한 세분화", "전담 매니저"] },
    ],
    recommended: "팀",
    // 요금제 id(BillingPort Plan.id) — 행동 버튼이 로그인 상태를 따른다(P3-6 E01). 이 예시는 로그아웃이라 가입 주소 그대로다
    planIds: ["starter", "team", "multi"],
    annualPlanIds: ["starter-year", "team-year", "multi-year"],
    cta: { label: "시작하기", href: "#signup" },
    footnote: "모든 금액은 VAT 포함이에요. 연 결제는 20% 할인돼요(예시).",
    vat: { included: "부가세 포함", excluded: "부가세 별도" },
  },
}

// 최대: 문구 끝까지, 요금제 5개(문의형 포함) · 긴 기능 요약 · 연 결제로 시작.
export const fixtureMax: PricingToggleAnnualProps = {
  copy: {
    title: "요금제 — 월 결제와 연 결제 중에서 고르세요(예시)",
    lead: "금액은 모두 부가세 별도예요. 연 결제로 바꾸면 20% 할인되고, 남은 기간은 해지할 때 날짜만큼 돌려드려요. 요금제는 한 달 단위로 바꿀 수 있어요(예시).",
    ...LABELS,
    annualDiscount: 0.2,
    plans: [
      { name: "혼자 쓰는 가게", monthlyPrice: 0, currency: "KRW", features: ["지점 1곳", "직원 계정 1개", "엑셀·CSV 가져오기와 내보내기"] },
      { name: "직원이 있는 팀", monthlyPrice: 12900, currency: "KRW", features: ["지점 3곳", "직원 계정 10개", "세금계산서 자동 발행", "상담 창구 우선 답변"] },
      { name: "지점이 여럿인 사업장", monthlyPrice: 39000, currency: "KRW", features: ["지점 무제한", "직원 계정 무제한", "지점별 권한 세분화", "전담 매니저"] },
      { name: "프랜차이즈 본사", monthlyPrice: 1239000, currency: "KRW", features: ["가맹점 관리", "본사 보고서", "가맹점별 정산", "전용 교육"] },
      { name: "맞춤 계약", monthlyPrice: null, currency: "KRW", features: ["모든 기능", "계약서·보안 심사 대응", "전용 서버 선택"] },
    ],
    recommended: "직원이 있는 팀",
    planIds: ["solo", "team", "branch", "franchise"],
    annualPlanIds: ["solo-year", "team-year", "branch-year", "franchise-year"],
    planCtas: [
      { label: "무료로 시작하기", href: "#a" },
      { label: "14일 무료로 써 보기", href: "#b" },
      { label: "14일 무료로 써 보기", href: "#c" },
      { label: "도입 상담 신청하기", href: "#d" },
      { label: "영업 담당자와 상담", href: "#e" },
    ],
    cta: { label: "시작하기", href: "#signup" },
  },
  defaultPeriod: "annual",
}

// 최소: 머리말 없이 요금제 1개, 할인 없음(배지·연 금액 줄 없음).
export const fixtureMin: PricingToggleAnnualProps = {
  copy: {
    title: "요금제", lead: "금액은 부가세 별도예요(예시).",
    ...LABELS,
    annualDiscount: 0,
    plans: [{ name: "팀", monthlyPrice: 12900, currency: "KRW", features: [] }],
    cta: { label: "시작하기", href: "#signup" },
  },
}
