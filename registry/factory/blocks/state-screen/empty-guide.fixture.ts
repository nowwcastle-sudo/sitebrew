import type { StateScreenEmptyGuideProps } from "./empty-guide"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 앱의 빈 화면, 문구마다 「예시」.
const COPY = {
  title: "아직 예약이 없어요",
  body: "예약 받기를 켜면 손님이 네이버 예약이나 가게 페이지에서 바로 예약할 수 있어요(예시).",
  primary: { label: "예약 받기 켜기", href: "/admin/settings/booking" },
  secondary: { label: "예약을 직접 넣기", href: "/admin/bookings/new" },
  stepsTitle: "시작하는 세 단계",
  steps: [
    { title: "영업시간 적기", body: "쉬는 날과 쉬는 시간을 먼저 적어 주세요(예시)." },
    { title: "시술 메뉴와 가격 넣기", body: "손님이 고를 수 있는 메뉴만 보여요(예시)." },
    { title: "예약 받기 켜기", body: "켜는 순간부터 예약이 이 화면에 쌓여요(예시)." },
  ],
}

export const fixture: StateScreenEmptyGuideProps = { copy: COPY }

// 최대: 문구 끝까지, 단계 6개.
export const fixtureMax: StateScreenEmptyGuideProps = {
  copy: {
    ...COPY,
    title: "아직 예약이 없어요 — 예약 받기를 켜고 영업시간과 메뉴를 넣으면 여기에 쌓여요(예시)",
    body: "예약 받기를 켜면 손님이 네이버 예약·카카오톡 채널·가게 페이지 어디서든 바로 예약할 수 있어요. 전화로 받은 예약은 직접 넣을 수 있고, 넣은 예약도 같은 목록에 보여요(예시).",
    primary: { label: "예약 받기 켜고 설정 마치기(예시)", href: "/admin/settings/booking" },
    secondary: { label: "전화로 받은 예약을 직접 넣기(예시)", href: "/admin/bookings/new" },
    steps: Array.from({ length: 6 }, (_, i) => ({ title: `설정 단계 ${i + 1} — 영업시간·메뉴·담당 디자이너·보증금 규칙을 차례로 적기(예시)`, body: "적은 내용은 언제든 바꿀 수 있고, 바꾸면 이미 받은 예약에는 영향이 없어요(예시)." })),
  },
}

// 최소: 보조 링크·단계 없이 제목·한 줄·행동 하나.
export const fixtureMin: StateScreenEmptyGuideProps = { copy: { title: COPY.title, body: COPY.body, primary: COPY.primary } }
