import type { NavTopBarProps } from "./top-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 물류 창고 운영판 「새벽창고(예시)」.
export const fixture: NavTopBarProps = {
  copy: {
    title: "출고 관리",
    search: { label: "전체 검색", placeholder: "주문·품목·받는 분 검색", action: "#search" },
    notifications: { label: "알림", href: "#alerts", count: 3, countLabel: "읽지 않은 알림 {count}개" },
    account: { menuLabel: "운영 담당자", links: [{ label: "내 계정", href: "#account" }, { label: "알림 설정", href: "#alert-settings" }], signOutLabel: "로그아웃" },
  },
}

// 최대: 긴 쪽 이름 · 알림 120개(99+) · 계정 링크 넷 · 긴 이름.
export const fixtureMax: NavTopBarProps = {
  copy: {
    title: "A동 출고 지연 건과 조치가 필요한 재고 부족 품목 한눈에 보기(예시)",
    search: { label: "주문, 품목, 받는 분, 송장번호 전체 검색", placeholder: "주문번호·품목명·받는 분·송장번호로 한꺼번에 찾기", action: "#search" },
    notifications: { label: "알림", href: "#alerts", count: 120, countLabel: "읽지 않은 알림 {count}개" },
    account: {
      menuLabel: "김가나 · 새벽창고 운영 담당자",
      links: [{ label: "내 계정", href: "#account" }, { label: "알림 설정", href: "#alert-settings" }, { label: "팀 구성원 관리", href: "#team" }, { label: "도움말", href: "#help" }],
      signOutLabel: "로그아웃",
    },
  },
}

// 최소: 쪽 이름·알림 수·계정 링크 없음.
export const fixtureMin: NavTopBarProps = {
  copy: {
    search: { label: "검색", action: "#search" },
    notifications: { label: "알림", href: "#alerts" },
    account: { menuLabel: "계정", links: [] },
  },
}