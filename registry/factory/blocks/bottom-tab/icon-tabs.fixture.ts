import type { BottomTabIconTabsProps } from "./icon-tabs"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 장보기 앱, 문구마다 「예시」.
export const fixture: BottomTabIconTabsProps = {
  copy: {
    navLabel: "주 메뉴(예시)",
    tabs: [
      { label: "홈", href: "#home", icon: "home" },
      { label: "찾기", href: "#search", icon: "search" },
      { label: "장바구니", href: "#cart", icon: "cart" },
      { label: "내 정보", href: "#me", icon: "user" },
    ],
  },
  currentHref: "#home",
}

// 최대: 탭 5개, 긴 이름.
export const fixtureMax: BottomTabIconTabsProps = {
  copy: {
    navLabel: "주 메뉴(예시)",
    tabs: [
      { label: "오늘 장보기", href: "#home", icon: "home" },
      { label: "상품 찾기", href: "#search", icon: "search" },
      { label: "찜한 상품", href: "#saved", icon: "heart" },
      { label: "장바구니", href: "#cart", icon: "cart" },
      { label: "내 정보", href: "#me", icon: "user" },
    ],
  },
  currentHref: "#saved",
}

// 최소: 탭 둘, 현재 위치 없음.
export const fixtureMin: BottomTabIconTabsProps = {
  copy: {
    navLabel: "주 메뉴(예시)",
    tabs: [
      { label: "홈", href: "#home", icon: "home" },
      { label: "내 정보", href: "#me", icon: "user" },
    ],
  },
}
