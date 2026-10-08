import type { StateScreenNotFoundProps } from "./not-found"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 앱의 404 화면, 문구마다 「예시」.
const COPY = {
  code: "404",
  title: "찾는 쪽이 없어요",
  body: "주소가 바뀌었거나 지워진 쪽이에요. 아래에서 다시 찾아 주세요(예시).",
  home: { label: "처음 화면으로", href: "/" },
  support: { label: "고객센터에 문의", href: "/contact" },
  linksTitle: "자주 가는 곳",
  links: [
    { label: "예약 목록", href: "/bookings" },
    { label: "요금제", href: "/pricing" },
    { label: "내 계정", href: "/account" },
  ],
  requestIdLabel: "요청 번호",
}

export const fixture: StateScreenNotFoundProps = { copy: COPY, headingLevel: 2 }

// 최대: 긴 문구, 갈 만한 곳 여섯, 요청 번호.
export const fixtureMax: StateScreenNotFoundProps = {
  copy: {
    ...COPY,
    title: "찾는 쪽이 없어요 — 주소를 다시 확인하거나 아래 링크에서 이어서 찾아 주세요(예시)",
    body: "주소가 바뀌었거나 지워진 쪽이에요. 북마크에서 열었다면 새 주소로 바꿔 주세요. 계속 같은 화면이 보이면 고객센터에 요청 번호를 알려 주세요(예시).",
    links: Array.from({ length: 6 }, (_, i) => ({ label: `자주 가는 곳 ${i + 1} — 예약 관리(예시)`, href: `/go/${i + 1}` })),
  },
  requestId: "req_01J9Z7Q4K3M8N2P5R6S7T8U9V0",
}

// 최소: 번호·지원·목록 없이 제목·한 줄·처음으로만.
export const fixtureMin: StateScreenNotFoundProps = { copy: { title: COPY.title, body: COPY.body, home: COPY.home } }
