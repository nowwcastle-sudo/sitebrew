import type { HeroCrosshairQuadrantsProps } from "./crosshair-quadrants"

const services = {
  label: "자주 찾는 서비스",
  items: [
    { label: "주민 등본", href: "#top", icon: "file" as const },
    { label: "전입 신고", href: "#top", icon: "home" as const },
    { label: "시설 예약", href: "#top", icon: "calendar" as const },
    { label: "여권 발급", href: "#top", icon: "user" as const },
    { label: "민원실 위치", href: "#top", icon: "map" as const },
    { label: "서식 내려받기", href: "#top", icon: "download" as const },
  ],
}
const receipt = {
  label: "접수번호",
  number: "2026-0927-114",
  status: "전입 신고 — 검토 단계예요",
  steps: [
    { name: "접수", date: "9월 24일" },
    { name: "검토", date: "진행 중" },
    { name: "발급", date: "예정" },
  ],
  current: 1,
}

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r6-civic 십자 기준선 히어로의 문구 그대로.
export const fixture: HeroCrosshairQuadrantsProps = {
  copy: {
    label: "첫 화면",
    title: "One window. Every permit.",
    titleLines: ["One window.", "Every permit."],
    lede: "서류 스물네 종을 한 창구에서 신청하고, 처리 단계는 문자로 받아요. 방문 없이 끝나는 민원은 온라인이 먼저 안내해요(예시).",
    primaryCta: { label: "온라인 신청", href: "#apply" },
    secondaryCta: { label: "필요 서류 확인", href: "#documents" },
    stats: {
      caption: "처리 현황 · 9월 27일 기준(예시)",
      items: [
        { term: "처리 중인 민원", value: "836", unit: "건" },
        { term: "평균 처리 기간", value: "2.3", unit: "일" },
      ],
    },
    receipt,
    services,
  },
  faces: ["field-1"],
}

// 최대: 긴 제목·설명·단계 넷·서비스 여덟 칸.
export const fixtureMax: HeroCrosshairQuadrantsProps = {
  copy: {
    ...fixture.copy,
    title: "One single window. Every permit you need.",
    titleLines: ["One single window.", "Every permit you need."],
    lede: "주민 등본부터 여권·시설 예약까지 서류 스물네 종을 한 창구에서 신청하고, 처리 단계는 문자와 알림으로 받아요. 방문 없이 끝나는 민원은 온라인이 먼저 안내하고, 방문이 필요하면 예약 시간을 잡아 드려요(예시).",
    receipt: { ...receipt, steps: [...receipt.steps.slice(0, 2), { name: "보완 요청", date: "없음" }, { name: "발급", date: "예정" }] },
    services: {
      ...services,
      items: [...services.items, { label: "지방세 납부", href: "#top", icon: "file" as const }, { label: "주차 민원", href: "#top", icon: "map" as const }],
    },
  },
  faces: ["field-1"],
}

// 최소: 설명·보조 버튼 없음, 현황 하나·단계 둘·서비스 넷, 면 없음.
export const fixtureMin: HeroCrosshairQuadrantsProps = {
  copy: {
    label: "첫 화면",
    title: "One window.",
    primaryCta: { label: "신청", href: "#apply" },
    stats: { caption: "처리 현황(예시)", items: [fixture.copy.stats.items[0]] },
    receipt: { ...receipt, steps: receipt.steps.slice(0, 2), current: 0 },
    services: { ...services, items: services.items.slice(0, 4) },
  },
}
