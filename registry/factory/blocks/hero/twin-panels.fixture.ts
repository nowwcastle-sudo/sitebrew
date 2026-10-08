import type { HeroTwinPanelsProps } from "./twin-panels"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r3-woodblock B 히어로의 문구 그대로. 사진은 검수대 틀만 넘긴다.
export const fixture: HeroTwinPanelsProps = {
  copy: {
    label: "첫 화면",
    title: "솔숲 인쇄소 — 이번 장에 새로 찍은 것(예시)",
    captions: ["두 도수 달력 · 18,000원(예시)", "목판 엽서 여섯 장 · 9,000원(예시)"],
    vatNote: "부가세 포함",
    moreNote: "이번 장에 새로 찍은 판 여섯 가지(예시)",
    moreCta: { label: "전부 보기", href: "#all" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최대: 긴 캡션·안내.
export const fixtureMax: HeroTwinPanelsProps = {
  copy: {
    label: "첫 화면",
    title: "솔숲 인쇄소 — 이번 장에 새로 찍은 것과 다음 장에 찍을 것 모음(예시)",
    captions: ["두 도수 목판 달력 — 모래·하늘 잉크, 열두 장 한 벌 · 18,000원(예시)", "목판 엽서 여섯 장 — 산호·자두 잉크, 봉투 포함 · 9,000원(예시)"],
    vatNote: "부가세 포함 · 봉투와 배송비는 별도",
    moreNote: "이번 장에 새로 찍은 판 여섯 가지와 다음 장 예고 두 가지(예시)",
    moreCta: { label: "전부 보기", href: "#all" },
  },
  faces: ["block-1", "block-2", "block-3", "block-4"],
}

// 최소: 안내 없음, 면 없음(골격), 사진 없음.
export const fixtureMin: HeroTwinPanelsProps = {
  copy: {
    label: "첫 화면",
    title: "솔숲 인쇄소(예시)",
    captions: ["달력(예시)", "엽서(예시)"],
    moreCta: { label: "보기", href: "#all" },
  },
}
