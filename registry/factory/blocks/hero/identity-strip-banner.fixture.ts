import type { HeroIdentityStripBannerProps } from "./identity-strip-banner"

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

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r6-civic 머리 히어로의 문구 그대로.
export const fixture: HeroIdentityStripBannerProps = {
  copy: {
    label: "첫 화면",
    bannerLabel: "대표 안내",
    eyebrow: "No. 2026-0927 · Online",
    title: "서류 발급, 방문 없이 끝냅니다",
    titleLines: ["서류 발급,", "방문 없이 끝냅니다"],
    lede: "주민 등본부터 건축 서류까지 스물네 종을 집에서 받습니다. 도장이 필요한 서류만 창구로 안내합니다.",
    primaryCta: { label: "발급 신청", href: "#apply" },
    figureLabel: "서류 더미와 확인 도장(직접 그린 예시 그림)",
    figureAlt: "겹쳐 쌓인 서류 세 장, 맨 위 장의 글줄, 확인 도장",
    services,
  },
  faces: ["field-1"],
}

// 최대: 긴 제목·부제, 서비스 여덟 칸.
export const fixtureMax: HeroIdentityStripBannerProps = {
  copy: {
    ...fixture.copy,
    title: "증명서 발급과 신고, 이제 방문 없이 집에서 끝냅니다",
    titleLines: ["증명서 발급과 신고,", "이제 방문 없이 집에서 끝냅니다"],
    lede: "주민 등본부터 가족관계 증명·건축물 대장까지 서류 스물네 종을 집에서 받고, 전입·출생 신고도 온라인으로 마칩니다. 도장이나 원본 확인이 필요한 서류만 창구로 안내합니다(예시).",
    services: {
      ...services,
      items: [...services.items, { label: "지방세 납부", href: "#top", icon: "file" as const }, { label: "주차 민원", href: "#top", icon: "map" as const }],
    },
  },
  faces: ["field-1"],
}

// 최소: 머리 줄·부제 없음, 서비스 넷, 면 없음.
export const fixtureMin: HeroIdentityStripBannerProps = {
  copy: {
    label: "첫 화면",
    bannerLabel: "대표 안내",
    title: "서류 발급",
    primaryCta: { label: "신청", href: "#apply" },
    figureLabel: fixture.copy.figureLabel,
    figureAlt: fixture.copy.figureAlt,
    services: { ...services, items: services.items.slice(0, 4) },
  },
}
