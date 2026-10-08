import type { HeroPunchInStatementProps } from "./punch-in-statement"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 정산 도구. 틀의 그림(media)은 갤러리가 public/media(motkit/punch)에서 넘긴다 — 예시에는 싣지 않는다.
export const fixture: HeroPunchInStatementProps = {
  copy: {
    label: "첫 화면",
    title: "월말 정산이 이제 그냥 끝나요",
    lede: "카드 매출과 배달 정산, 현금 영수증을 한 장부에서 맞춰요. 표 파일을 한 번 올리면 다음 달부터는 따로 손댈 일이 거의 없어요. 모든 문구는 예시예요.",
    primaryCta: { label: "무료로 시작하기", href: "#signup" },
    secondaryCta: { label: "요금 보기", href: "#pricing" },
    pauseLabel: "배경 움직임 멈추기",
  },
}

// 최대: 긴 제목, 긴 문단.
export const fixtureMax: HeroPunchInStatementProps = {
  copy: {
    label: "첫 화면",
    title: "가게 세 곳의 월말 정산과 세금 신고 준비가 이제 그냥 끝나요",
    lede: "카드 매출과 배달 정산, 현금 영수증, 지점별 비용을 한 장부에서 맞춰요. 표 파일을 한 번 올리면 다음 달부터는 따로 손댈 일이 거의 없고, 세무사에게 보낼 자료도 한 번에 내려받아요. 모든 문구는 예시예요.",
    primaryCta: { label: "체험 기간으로 시작하기", href: "#signup" },
    secondaryCta: { label: "요금제 비교하기", href: "#pricing" },
    pauseLabel: "배경 움직임 멈추기",
  },
}

// 최소: 한 낱말 제목, 보조 버튼 없음.
export const fixtureMin: HeroPunchInStatementProps = {
  copy: {
    label: "첫 화면",
    title: "정산 끝",
    lede: "한 장부로 맞춰요(예시).",
    primaryCta: { label: "시작", href: "#signup" },
    pauseLabel: "배경 움직임 멈추기",
  },
}
