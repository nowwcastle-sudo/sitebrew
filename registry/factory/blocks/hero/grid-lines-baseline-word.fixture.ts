import type { HeroGridLinesBaselineWordProps } from "./grid-lines-baseline-word"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r8-dusk B 히어로의 문구 그대로(「숲 소리 듣기」는 이제 링크). 영상은 검수대 틀만 넘긴다.
export const fixture: HeroGridLinesBaselineWordProps = {
  copy: {
    label: "첫 화면",
    title: "Evergreen",
    captionLines: ["소나무 숲 끝,", "저녁에만 여는 다실"],
    filmCta: { label: "숲 소리 듣기", href: "#sound" },
  },
}

// 최대: 긴 한 낱말, 캡션 세 줄.
export const fixtureMax: HeroGridLinesBaselineWordProps = {
  copy: {
    label: "첫 화면",
    title: "Evergreens",
    captionLines: ["소나무 숲 끝, 계곡 옆", "저녁에만 여는 다실", "하루 네 팀(예시)"],
    filmCta: { label: "숲 소리 듣기", href: "#sound" },
  },
}

// 최소: 짧은 낱말, 캡션 한 줄.
export const fixtureMin: HeroGridLinesBaselineWordProps = {
  copy: {
    label: "첫 화면",
    title: "Pine",
    captionLines: ["숲 끝 다실(예시)"],
    filmCta: { label: "듣기", href: "#sound" },
  },
}
