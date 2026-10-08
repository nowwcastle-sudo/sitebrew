import type { FinalCtaKineticBandProps } from "./kinetic-band"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다).
export const fixture: FinalCtaKineticBandProps = {
  copy: {
    title: "다음 썰물에 가마를 함께 열어요",
    lead: "방문 예약은 하루 전까지 받아요(예시).",
    primary: { label: "방문 예약하기", href: "#booking" },
    secondary: { label: "문의하기", href: "#contact" },
  },
}

// 최대: 긴 제목·긴 한 줄·긴 버튼 이름.
export const fixtureMax: FinalCtaKineticBandProps = {
  copy: {
    title: "다음 썰물에는 가마를 함께 열고 첫 그릇을 꺼내 보세요",
    lead: "방문 예약은 하루 전까지 받아요. 물때가 바뀌면 시간을 다시 알려 드려요(예시).",
    primary: { label: "작업장 방문 예약하기", href: "#booking" },
    secondary: { label: "단체 방문 문의하기", href: "#contact" },
  },
}

// 최소: 한 줄 없음, 보조 버튼 없음.
export const fixtureMin: FinalCtaKineticBandProps = {
  copy: {
    title: "가마 열기",
    primary: { label: "예약", href: "#booking" },
  },
}
