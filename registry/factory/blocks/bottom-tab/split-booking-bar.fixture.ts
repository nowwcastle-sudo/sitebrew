import type { BottomTabSplitBookingBarProps } from "./split-booking-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 치과, 문구마다 「예시」.
export const fixture: BottomTabSplitBookingBarProps = {
  copy: {
    regionLabel: "전화와 예약",
    note: "오늘 09:30–18:30 진료(예시)",
    call: { label: "전화하기", phone: "02-3456-7890" },
    booking: { label: "예약하기", href: "#booking" },
  },
}

// 최대: 긴 안내, 버튼 이름 6~7자(375 에서 두 버튼이 반씩 나눈 폭에 들어가는 상한).
export const fixtureMax: BottomTabSplitBookingBarProps = {
  copy: {
    regionLabel: "전화와 예약",
    note: "오늘 09:30–18:30 진료 · 점심 13:00–14:00 · 토요일은 오후 2시까지(예시)",
    call: { label: "진료 문의 전화", phone: "1588-3456" },
    booking: { label: "진료 예약하기", href: "#booking" },
  },
}

// 최소: 안내 없음.
export const fixtureMin: BottomTabSplitBookingBarProps = {
  copy: {
    regionLabel: "전화와 예약",
    call: { label: "전화", phone: "02-3456-7890" },
    booking: { label: "예약", href: "#booking" },
  },
}
