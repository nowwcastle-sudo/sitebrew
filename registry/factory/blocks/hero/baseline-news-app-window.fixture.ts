import type { HeroBaselineNewsAppWindowProps } from "./baseline-news-app-window"

// 담당자 이름은 모두 가상이다 — 실존 인물·유명인과 겹치지 않게 드문 조합으로 지었다.
const rows = [
  { id: "SIG-2041", title: "결제 응답 지연 — 서울 2존", status: "조치 중", urgent: true, time: "2분 전", owner: "도하람", since: "14:02", impact: "주문 3.1%" },
  { id: "SIG-2038", title: "정산 배치 실패 — 3회차", status: "검토", time: "14분 전", owner: "문새결", since: "13:50", impact: "정산 1건" },
  { id: "SIG-2035", title: "로그인 오류율 상승 — 앱 4.2", status: "대기", time: "31분 전", owner: "변지오", since: "13:33", impact: "사용자 0.8%" },
  { id: "SIG-2031", title: "디스크 사용 85% — db-07", status: "해결", time: "1시간 전", owner: "염가을", since: "12:58", impact: "없음" },
  { id: "SIG-2027", title: "인증서 만료 14일 전 — api", status: "대기", time: "2시간 전", owner: "석이안", since: "11:40", impact: "없음" },
]
const menu = [
  { label: "지금 울리는 것", href: "#top", icon: "bell" as const, count: 5 },
  { label: "내가 맡은 것", href: "#top", icon: "user" as const, count: 2 },
  { label: "지켜보는 것", href: "#top", icon: "eye" as const },
  { label: "묶는 규칙", href: "#top", icon: "filter" as const },
  { label: "당번표", href: "#top", icon: "clock" as const },
]
const workspace = { name: "결제팀 작업 공간", count: "· 진행 중 알림 5", shortcut: "Ctrl K", menuLabel: "작업 공간 메뉴", teamsLabel: "팀", listLabel: "알림 목록", trendLabel: "지난 한 시간 오류율 추이(예시)" }

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r10-console B 히어로의 문구 그대로.
export const fixture: HeroBaselineNewsAppWindowProps = {
  copy: {
    label: "첫 화면",
    title: "Every alert in one row. Every fix, one keystroke away.",
    titleLines: ["Every alert in one row.", "Every fix, one keystroke away."],
    lede: "운영 신호를 한 줄로 모으고, 맡을 사람에게 바로 넘깁니다. 모든 숫자는 예시입니다.",
    news: { badge: "New", label: "알림 규칙 2.0", href: "#news" },
    workspace,
    menu,
    teams: ["결제", "정산", "앱"].map((label) => ({ label, href: "#top" })),
    rows,
    detailTerms: { owner: "담당", since: "시작", impact: "영향" },
    detailActions: ["맡기", "넘기기"],
  },
  faces: ["field-1"],
}

// 최대: 긴 제목·설명, 알림 여덟.
export const fixtureMax: HeroBaselineNewsAppWindowProps = {
  copy: {
    ...fixture.copy,
    title: "Every alert collected in one row. Every single fix, just one keystroke away.",
    titleLines: ["Every alert collected in one row.", "Every single fix, just one keystroke away."],
    lede: "운영 신호를 한 줄로 모으고, 같은 원인은 하나로 묶어, 맡을 사람에게 바로 넘깁니다. 새벽에는 깨어 있는 사람만 고릅니다. 모든 숫자는 예시입니다.",
    rows: [...rows, ...rows.slice(0, 3).map((r, i) => ({ ...r, id: `SIG-20${20 - i}`, title: `${r.title} — 같은 원인 두 번째 신호` }))],
  },
  faces: ["field-1"],
}

// 최소: 설명 없음, 알림 하나, 면 없음.
export const fixtureMin: HeroBaselineNewsAppWindowProps = {
  copy: {
    label: "첫 화면",
    title: "Every alert in one row.",
    news: { badge: "New", label: "규칙 2.0", href: "#news" },
    workspace,
    menu: menu.slice(0, 1),
    teams: [],
    rows: rows.slice(0, 1),
    detailTerms: { owner: "담당", since: "시작", impact: "영향" },
    detailActions: ["맡기", "넘기기"],
  },
}
