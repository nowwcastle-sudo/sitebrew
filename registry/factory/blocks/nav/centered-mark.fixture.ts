import type { NavCenteredMarkProps } from "./centered-mark"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 향수 공방, 문구마다 「예시」.
export const fixture: NavCenteredMarkProps = {
  copy: {
    brand: "MOSS & INK",
    navLabel: "주 메뉴(예시)",
    links: [
      { label: "향", href: "#scents" },
      { label: "이야기", href: "#story" },
      { label: "매장", href: "#stores" },
      { label: "선물", href: "#gift" },
    ],
    action: { label: "방문 예약", href: "#visit" },
  },
  currentHref: "#scents",
}

// 최대: 긴 워드마크, 링크 8개(긴 이름), 긴 행동 이름.
export const fixtureMax: NavCenteredMarkProps = {
  copy: {
    brand: "MOSS & INK PERFUMERY",
    navLabel: "주 메뉴(예시)",
    links: [
      { label: "계절 향 모음", href: "#scents" },
      { label: "조향사 이야기", href: "#story" },
      { label: "원료와 산지", href: "#origin" },
      { label: "매장 안내", href: "#stores" },
      { label: "선물 포장", href: "#gift" },
      { label: "향 시향 수업", href: "#class" },
      { label: "정기 배송", href: "#subscribe" },
      { label: "자주 묻는 질문", href: "#faq" },
    ],
    action: { label: "성수 매장 방문 예약하기", href: "#visit" },
  },
  currentHref: "#origin",
}

// 최소: 링크 하나, 행동 없음.
export const fixtureMin: NavCenteredMarkProps = {
  copy: {
    brand: "MOSS & INK",
    navLabel: "주 메뉴(예시)",
    links: [{ label: "향", href: "#scents" }],
  },
}
