import type { HeroSteppedCropFigureProps } from "./stepped-crop-figure"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r4-evidence A 히어로의 문구 그대로.
export const fixture: HeroSteppedCropFigureProps = {
  copy: {
    label: "첫 화면",
    kicker: "연구 보고서를 대화로 읽는 도구(예시)",
    title: "Answers that show their sources.",
    titleLines: ["Answers that", "show their sources."],
    lede: [
      { text: "질문하면 " },
      { text: "보고서의 해당 문장", mark: true },
      { text: "을 먼저 보여 주고, 그 문장이 " },
      { text: "몇 쪽 몇 줄", mark: true },
      { text: "에 있는지 함께 적습니다. 근거가 없으면 없다고 답합니다." },
    ],
    primaryCta: { label: "무료로 써 보기", href: "#try" },
    backersLabel: "함께하는 곳(예시)",
    backers: ["누리 병원", "강변 연구소", "한빛 법률사무소", "솔 재단"],
  },
}

// 최대: 긴 제목 세 줄·긴 설명·함께하는 곳 여덟.
export const fixtureMax: HeroSteppedCropFigureProps = {
  copy: {
    label: "첫 화면",
    kicker: "연구 보고서와 판례를 대화로 읽는 도구 — 근거 문장부터 보여 줍니다(예시)",
    title: "Answers that always show every one of their sources.",
    titleLines: ["Answers that always", "show every one", "of their sources."],
    lede: [
      { text: "질문하면 " },
      { text: "보고서와 판례의 해당 문장", mark: true },
      { text: "을 먼저 보여 주고, 그 문장이 " },
      { text: "몇 쪽 몇 줄", mark: true },
      { text: "에 있는지 함께 적습니다. 근거가 둘 이상이면 서로 다른 점도 적고, 근거가 없으면 없다고 답합니다(예시)." },
    ],
    primaryCta: { label: "무료로 써 보기", href: "#try" },
    backersLabel: "함께하는 곳(예시)",
    backers: ["누리 병원", "강변 연구소", "한빛 법률사무소", "솔 재단", "바다 대학 도서관", "푸른 시청 정책실", "들녘 협동조합", "새벽 신문사"],
  },
}

// 최소: 머리말·함께하는 곳 없음, 형광 구절 없음.
export const fixtureMin: HeroSteppedCropFigureProps = {
  copy: {
    label: "첫 화면",
    title: "Answers with sources.",
    lede: [{ text: "근거가 없으면 없다고 답합니다(예시)." }],
    primaryCta: { label: "써 보기", href: "#try" },
    backersLabel: "함께하는 곳(예시)",
    backers: [],
  },
}
