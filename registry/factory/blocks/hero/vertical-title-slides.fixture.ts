import type { HeroVerticalTitleSlidesProps } from "./vertical-title-slides"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r8-dusk A 히어로의 문구 그대로. 장면 그림은 검수대 틀만 넘긴다.
export const fixture: HeroVerticalTitleSlidesProps = {
  copy: {
    label: "첫 화면",
    title: "솔바람 부는 저녁",
    slides: ["해 질 녘 마당", "불 켜진 사랑채", "새벽 솔바람"],
    slidesLabel: "장면 고르기",
    slideButtonLabel: "{n}번 장면 — {name}",
    defaultSlide: 1,
  },
}

// 최대: 긴 세로 제목, 장면 다섯.
export const fixtureMax: HeroVerticalTitleSlidesProps = {
  copy: {
    label: "첫 화면",
    title: "솔바람 부는 저녁 마당에서",
    slides: ["해 질 녘 마당", "불 켜진 사랑채", "새벽 솔바람", "비 오는 안채 툇마루", "눈 덮인 솔밭"],
    slidesLabel: "장면 고르기",
    slideButtonLabel: "{n}번 장면 — {name}",
    defaultSlide: 0,
  },
}

// 최소: 장면 하나.
export const fixtureMin: HeroVerticalTitleSlidesProps = {
  copy: {
    label: "첫 화면",
    title: "솔바람",
    slides: ["마당"],
    slidesLabel: "장면 고르기",
    slideButtonLabel: "{n}번 장면 — {name}",
  },
}
