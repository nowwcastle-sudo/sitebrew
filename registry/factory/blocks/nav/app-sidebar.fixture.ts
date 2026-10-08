import type { NavAppSidebarProps } from "./app-sidebar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 물류 창고 운영판 「새벽창고(예시)」.
export const fixture: NavAppSidebarProps = {
  copy: {
    brand: { name: "새벽창고(예시)", href: "#home" },
    navLabel: "주 메뉴",
    groups: [
      {
        label: "운영",
        items: [
          { label: "대시보드", href: "#overview", icon: "home" },
          { label: "출고 관리", href: "#outbound", icon: "orders" },
          { label: "재고 현황", href: "#stock", icon: "file" },
          { label: "창고 위치", href: "#places", icon: "place" },
        ],
      },
      {
        label: "분석과 설정",
        items: [
          { label: "분석", href: "#analytics", icon: "analytics" },
          { label: "설정", href: "#settings", icon: "settings" },
        ],
      },
    ],
    collapse: "사이드바 접기",
    expand: "사이드바 펼치기",
  },
  currentHref: "#outbound",
}

// 최대: 묶음 셋, 항목 열 개(긴 이름).
export const fixtureMax: NavAppSidebarProps = {
  copy: {
    brand: { name: "새벽창고 통합 운영 플랫폼(예시)", href: "#home" },
    navLabel: "주 메뉴",
    groups: [
      {
        label: "오늘 할 일",
        items: [
          { label: "오늘의 대시보드", href: "#overview", icon: "home" },
          { label: "조치가 필요한 출고 건", href: "#todo", icon: "bell" },
          { label: "받은 문의와 알림 메일", href: "#mail", icon: "mail" },
        ],
      },
      {
        label: "물류",
        items: [
          { label: "출고 관리와 송장 출력", href: "#outbound", icon: "orders" },
          { label: "재고 현황과 안전 재고", href: "#stock", icon: "file" },
          { label: "입고 예정 일정", href: "#inbound", icon: "calendar" },
          { label: "창고 위치와 구역 설정", href: "#places", icon: "place" },
        ],
      },
      {
        label: "관리",
        items: [
          { label: "지표 분석", href: "#analytics", icon: "analytics" },
          { label: "팀 구성원", href: "#team", icon: "user" },
          { label: "도움말과 안내", href: "#help", icon: "help" },
        ],
      },
    ],
    collapse: "사이드바 접기",
    expand: "사이드바 펼치기",
  },
  currentHref: "#stock",
}

// 최소: 항목 둘, 묶음 이름 없음.
export const fixtureMin: NavAppSidebarProps = {
  copy: {
    brand: { name: "창고(예시)", href: "#home" },
    navLabel: "주 메뉴",
    groups: [{ items: [{ label: "대시보드", href: "#overview", icon: "home" }, { label: "설정", href: "#settings", icon: "settings" }] }],
    collapse: "접기",
    expand: "펼치기",
  },
}