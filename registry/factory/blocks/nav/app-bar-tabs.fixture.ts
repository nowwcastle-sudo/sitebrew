import type { NavAppBarTabsProps } from "./app-bar-tabs"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 가게 주문 앱, 문구마다 「예시」.
export const fixture: NavAppBarTabsProps = {
  copy: {
    title: "오늘의 주문(예시)",
    back: { label: "홈으로 돌아가기", href: "#home" },
    actions: [
      { label: "주문 검색", href: "#search", icon: "search" },
      { label: "알림 3개", href: "#alerts", icon: "bell" },
    ],
    tabsLabel: "주문 상태",
    tabs: [
      { label: "새 주문", href: "#new" },
      { label: "준비 중", href: "#preparing" },
      { label: "픽업 대기", href: "#ready" },
      { label: "완료", href: "#done" },
    ],
  },
  currentHref: "#new",
}

// 최대: 긴 제목, 행동 셋, 탭 7개(긴 이름).
export const fixtureMax: NavAppBarTabsProps = {
  copy: {
    title: "망원점 오늘의 주문과 예약 한눈에 보기(예시)",
    back: { label: "가게 목록으로 돌아가기", href: "#home" },
    actions: [
      { label: "주문 검색", href: "#search", icon: "search" },
      { label: "알림 12개", href: "#alerts", icon: "bell" },
      { label: "가게 설정", href: "#settings", icon: "settings" },
    ],
    tabsLabel: "주문 상태",
    tabs: [
      { label: "새로 들어온 주문", href: "#new" },
      { label: "준비하고 있는 주문", href: "#preparing" },
      { label: "픽업 기다리는 주문", href: "#ready" },
      { label: "배달 나간 주문", href: "#delivering" },
      { label: "예약 주문", href: "#reserved" },
      { label: "취소·환불", href: "#cancel" },
      { label: "끝난 주문", href: "#done" },
    ],
  },
  currentHref: "#reserved",
}

// 최소: 뒤로·행동 없음, 탭 하나.
export const fixtureMin: NavAppBarTabsProps = {
  copy: {
    title: "주문(예시)",
    tabsLabel: "주문 상태",
    tabs: [{ label: "새 주문", href: "#new" }],
  },
}
