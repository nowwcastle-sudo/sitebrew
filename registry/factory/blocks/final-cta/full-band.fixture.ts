import type { FinalCtaFullBandProps } from "./full-band"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 일정 관리 서비스, 문구마다 「예시」.
export const fixture: FinalCtaFullBandProps = {
  copy: {
    kicker: "14일 무료(예시)",
    title: "오늘 팀 일정표를 옮겨 보세요",
    primary: { label: "무료로 시작하기", href: "#signup" },
    secondary: { label: "도입 상담", href: "#contact" },
  },
}

// 최대: 머리말 20자, 긴 제목.
export const fixtureMax: FinalCtaFullBandProps = {
  copy: {
    kicker: "카드 등록 없이 14일 무료(예시)",
    title: "흩어진 팀 일정과 회의록을 이번 주 안에 한곳으로 옮겨 보세요(예시)",
    primary: { label: "무료로 시작하기", href: "#signup" },
    secondary: { label: "도입 상담 신청", href: "#contact" },
  },
}

// 최소: 머리말·보조 버튼 없음.
export const fixtureMin: FinalCtaFullBandProps = {
  copy: {
    title: "지금 시작하세요(예시)",
    primary: { label: "시작하기", href: "#signup" },
  },
}
