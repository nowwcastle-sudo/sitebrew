import type { HeroFramedCardOutlineTitleProps } from "./framed-card-outline-title"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r9-clay A 히어로의 문구 그대로. 둥근 그림(영상)은 검수대 틀만 넘긴다.
export const fixture: HeroFramedCardOutlineTitleProps = {
  copy: {
    label: "첫 화면",
    rating: "4.8 · 동네 후기 207개(예시)",
    titleLines: [{ text: "Chewy", outline: true }, { text: "mochi,", outline: true }, { text: "rolled by hand." }],
    lede: "찹쌀 반죽을 손으로 굴려 한 알씩 빚습니다. 속은 팥·유자·흑임자 세 가지이고, 빚은 순서대로 진열대에 올립니다. 포장은 여섯 알 한 상자부터입니다(예시).",
    primaryCta: { label: "속 고르기", href: "#fillings" },
    secondaryCta: { label: "빚는 과정 보기", href: "#process" },
    badge: { text: "손으로 빚는 · 찹쌀 · 말랑 ·", label: "손으로 빚는 찹쌀떡" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최대: 네 줄 제목, 긴 설명·별점 줄.
export const fixtureMax: HeroFramedCardOutlineTitleProps = {
  copy: {
    label: "첫 화면",
    rating: "4.8 · 동네 후기 207개 · 단골 여든 명(예시)",
    titleLines: [{ text: "Chewy", outline: true }, { text: "mochi,", outline: true }, { text: "rolled slowly", outline: false }, { text: "by hand." }],
    lede: "찹쌀 반죽을 손으로 굴려 한 알씩 빚습니다. 속은 팥·유자·흑임자 세 가지이고, 빚은 순서대로 진열대에 올립니다. 반죽을 두 번 쳐서 반나절이 지나도 쉽게 굳지 않습니다. 포장은 여섯 알 한 상자부터입니다(예시).",
    primaryCta: { label: "속 고르기", href: "#fillings" },
    secondaryCta: { label: "빚는 과정 보기", href: "#process" },
    badge: { text: "손으로 빚는 · 찹쌀 · 말랑 ·", label: "손으로 빚는 찹쌀떡" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최소: 설명·보조 링크 없음, 제목 한 줄, 면 없음.
export const fixtureMin: HeroFramedCardOutlineTitleProps = {
  copy: {
    label: "첫 화면",
    rating: "4.8(예시)",
    titleLines: [{ text: "Mochi.", outline: true }],
    primaryCta: { label: "고르기", href: "#fillings" },
    badge: { text: "손으로 빚는 · 찹쌀 ·", label: "손으로 빚는 찹쌀떡" },
  },
}
