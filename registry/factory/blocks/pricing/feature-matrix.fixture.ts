import type { PricingFeatureMatrixProps } from "./feature-matrix"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 요금, 문구마다 「예시」.
const LABELS = { featureLabel: "기능", yesLabel: "포함", noLabel: "없음", perMonth: "/월", contactLabel: "별도 문의" }
const F = ["지점 1곳", "지점 3곳", "지점 무제한", "엑셀 가져오기", "세금계산서 자동 발행", "권한 세분화", "전담 매니저"]

export const fixture: PricingFeatureMatrixProps = {
  copy: {
    title: "요금제별 기능",
    lead: "필요한 기능이 어느 요금제에 있는지 한눈에 보세요(예시).",
    caption: "요금제 세 가지의 월 금액과 포함 기능(예시)",
    ...LABELS,
    features: F,
    plans: [
      { name: "혼자 쓰기", monthlyPrice: 0, currency: "KRW", features: ["지점 1곳", "엑셀 가져오기"] },
      { name: "팀", monthlyPrice: 12900, currency: "KRW", features: ["지점 3곳", "엑셀 가져오기", "세금계산서 자동 발행"] },
      { name: "여러 지점", monthlyPrice: 39000, currency: "KRW", features: ["지점 무제한", "엑셀 가져오기", "세금계산서 자동 발행", "권한 세분화", "전담 매니저"] },
    ],
    recommended: "팀",
    // 요금제 id(BillingPort Plan.id) — 행동 버튼이 로그인 상태를 따른다(P3-6 E01). 이 예시는 로그아웃이라 가입 주소 그대로다
    planIds: ["starter", "team", "multi"],
    cta: { label: "시작하기", href: "#signup" },
    footnote: "모든 금액은 VAT 포함이에요(예시).",
    vat: { included: "부가세 포함", excluded: "부가세 별도" },
  },
}

// 최대: 문구 끝까지, 요금제 5개(문의형 포함) · 기능 14줄(긴 이름).
const FM = Array.from({ length: 14 }, (_, i) => `세금계산서 자동 발행과 거래처별 월말 정산 보고서 ${i + 1}`)
export const fixtureMax: PricingFeatureMatrixProps = {
  copy: {
    title: "요금제별 기능 — 혼자부터 프랜차이즈 본사까지(예시)",
    lead: "금액은 모두 부가세 별도예요. 필요한 기능이 어느 요금제에 있는지 한눈에 비교하세요. 모든 요금제는 14일 동안 무료로 써 볼 수 있고, 한 달 단위로 바꿀 수 있어요(예시).",
    caption: "요금제 다섯 가지의 월 금액과 포함 기능, 부가세 별도(예시)",
    ...LABELS,
    features: FM,
    plans: [
      { name: "혼자 쓰는 가게", monthlyPrice: 0, currency: "KRW", features: FM.slice(0, 3) },
      { name: "직원이 있는 팀", monthlyPrice: 12900, currency: "KRW", features: FM.slice(0, 6) },
      { name: "지점이 여럿인 사업장", monthlyPrice: 39000, currency: "KRW", features: FM.slice(0, 10) },
      { name: "프랜차이즈 본사", monthlyPrice: 1239000, currency: "KRW", features: FM.slice(0, 13) },
      { name: "맞춤 계약", monthlyPrice: null, currency: "KRW", features: FM },
    ],
    recommended: "직원이 있는 팀",
    planIds: ["solo", "team", "branch", "franchise"],
    planCtas: [
      { label: "무료로 시작하기", href: "#a" },
      { label: "14일 무료로 써 보기", href: "#b" },
      { label: "14일 무료로 써 보기", href: "#c" },
      { label: "도입 상담 신청하기", href: "#d" },
      { label: "영업 담당자와 상담", href: "#e" },
    ],
    cta: { label: "시작하기", href: "#signup" },
  },
}

// 최소: 머리말 없이 요금제 1개 · 기능 1줄.
export const fixtureMin: PricingFeatureMatrixProps = {
  copy: { title: "요금제별 기능", lead: "금액은 부가세 별도예요(예시).", caption: "요금제 한 가지(예시)", ...LABELS, features: ["모든 기능"], plans: [{ name: "팀", monthlyPrice: 12900, currency: "KRW", features: ["모든 기능"] }], cta: { label: "시작하기", href: "#signup" } },
}
