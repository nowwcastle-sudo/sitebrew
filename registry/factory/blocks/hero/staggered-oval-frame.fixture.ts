import type { HeroStaggeredOvalFrameProps } from "./staggered-oval-frame"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r3-woodblock A 히어로의 문구 그대로. 영상은 검수대 틀만 넘긴다.
export const fixture: HeroStaggeredOvalFrameProps = {
  copy: {
    label: "첫 화면",
    titleLines: ["Printed by hand,", "sold on Saturday."],
    primaryCta: { label: "장보기", href: "#shop" },
    secondaryCta: { label: "장날 보기", href: "#market" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최대: 긴 두 줄.
export const fixtureMax: HeroStaggeredOvalFrameProps = {
  copy: {
    label: "첫 화면",
    titleLines: ["Printed slowly by hand,", "sold every Saturday."],
    primaryCta: { label: "이번 장 보기", href: "#shop" },
    secondaryCta: { label: "장날 일정", href: "#market" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최소: 짧은 두 줄, 보조 버튼 없음, 면 없음(골격).
export const fixtureMin: HeroStaggeredOvalFrameProps = {
  copy: {
    label: "첫 화면",
    titleLines: ["Printed,", "sold."],
    primaryCta: { label: "보기", href: "#shop" },
  },
}
