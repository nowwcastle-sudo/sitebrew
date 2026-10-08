import type { SocialProofLogoRailProps } from "./logo-rail"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게·회사 이름, 문구마다 「예시」.
export const fixture: SocialProofLogoRailProps = {
  copy: {
    title: "이런 곳이 씁니다",
    claim: "가게와 작은 회사 1,200곳 — 2026년 9월 기준(예시)",
    logos: ["모래시계 상회", "달빛베이커리", "파란우산", "소금창고", "오늘공방", "초록 약국"].map((name) => ({ name })),
  },
}

// 최대: 문구 끝까지, 로고 10개(이름이 긴 것 포함).
export const fixtureMax: SocialProofLogoRailProps = {
  copy: {
    title: "전국의 가게와 작은 회사가 매일 씁니다(예시)",
    claim: "동네 가게부터 직원 50명 규모 회사까지 1,200곳이 매일 씁니다 — 2026년 9월 30일 기준, 해지한 곳은 뺀 수(예시)",
    logos: ["모래시계 상회", "달빛베이커리 연남점", "파란우산 협동조합", "소금창고", "오늘공방", "초록 약국", "한밤의 서점과 커피", "두 번째 부엌", "바람개비 어린이집", "새벽시장 수산"].map((name) => ({ name })),
  },
}

// 최소: 근거 줄 없이 로고 1개.
export const fixtureMin: SocialProofLogoRailProps = {
  copy: { title: "이런 곳이 씁니다", logos: [{ name: "모래시계 상회" }] },
}
