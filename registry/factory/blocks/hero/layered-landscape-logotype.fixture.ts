import type { HeroLayeredLandscapeLogotypeProps } from "./layered-landscape-logotype"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r9-clay B 히어로의 문구 그대로. 풍경은 칸 색(block-1~4)이 있는 레시피(K8)에서 제 색으로 칠해진다.
export const fixture: HeroLayeredLandscapeLogotypeProps = {
  copy: {
    label: "첫 화면",
    title: "Little Clay Woods — 작은 점토 숲",
    logoLines: [
      { text: "LITTLE", size: "sm" },
      { text: "CLAY", size: "lg" },
      { text: "WOODS", size: "lg" },
    ],
    tagline: "손으로 빚고, 숲에서 놀아요 — 주말 점토 캠프(예시)",
  },
}

// 최대: 긴 낱말, 긴 태그라인.
export const fixtureMax: HeroLayeredLandscapeLogotypeProps = {
  copy: {
    label: "첫 화면",
    title: "Little Clay Woodland Camp — 작은 점토 숲 캠프",
    logoLines: [
      { text: "LITTLE", size: "sm" },
      { text: "CLAY", size: "lg" },
      { text: "WOODLAND", size: "lg" },
    ],
    tagline: "손으로 빚고, 숲에서 놀고, 구운 작품은 두 주 뒤 집으로 — 주말 점토 캠프(예시)",
  },
}

// 최소: 낱말 한 줄, 태그라인 없음.
export const fixtureMin: HeroLayeredLandscapeLogotypeProps = {
  copy: {
    label: "첫 화면",
    title: "Clay(예시)",
    logoLines: [{ text: "CLAY", size: "lg" }],
  },
}
