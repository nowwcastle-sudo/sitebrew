import type { HeroInlineChipTitleProps } from "./inline-chip-title"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r2-signal B 히어로의 문구 그대로. 칩 사진은 검수대 틀만 넘긴다.
export const fixture: HeroInlineChipTitleProps = {
  copy: {
    label: "첫 화면",
    captionTop: "[ 예시 — 신호 연구소 · 서울 ]",
    captionBottom: "[ Posters · Signs · Screens ]",
    title: "Loud ideas, quiet craft, signal for all.",
    lines: { chipBefore: "Loud", chipAfter: "ideas,", starBefore: "quiet", starAfter: "craft,", last: "signal for all." },
    primaryCta: { label: "작업 의뢰", href: "#brief" },
    secondaryCta: { label: "지난 작업", href: "#work" },
    cropWord: "SIGNAL",
  },
  faces: ["field-1", "field-2"],
}

// 최대: 긴 줄들.
export const fixtureMax: HeroInlineChipTitleProps = {
  copy: {
    label: "첫 화면",
    captionTop: "[ 예시 — 신호 연구소 · 서울 성수동 작업실 ]",
    captionBottom: "[ Posters · Signs · Screens · Books ]",
    title: "Loud public ideas, quiet careful craft, a clear signal for everyone.",
    lines: { chipBefore: "Loud public", chipAfter: "ideas,", starBefore: "quiet careful", starAfter: "craft,", last: "a clear signal for everyone." },
    primaryCta: { label: "작업 의뢰", href: "#brief" },
    secondaryCta: { label: "지난 작업", href: "#work" },
    cropWord: "SIGNAL",
  },
  faces: ["field-1", "field-2"],
}

// 최소: 보조 버튼·잘린 낱말 없음, 면 없음(선).
export const fixtureMin: HeroInlineChipTitleProps = {
  copy: {
    label: "첫 화면",
    captionTop: "[ 예시 ]",
    captionBottom: "[ Posters ]",
    title: "Loud ideas, quiet craft.",
    lines: { chipBefore: "Loud", chipAfter: "ideas,", starBefore: "quiet", starAfter: "craft.", last: "" },
    primaryCta: { label: "의뢰", href: "#brief" },
  },
}
