import type { HeroScreenshotWindowProps } from "./screenshot-window"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 정산 서비스. 창 안의 제품 화면(media — 실제 화면이 필요한 칸, real-required)은 예시에 싣지 않는다:
// 비어 있으면 블록이 「실제 화면 필요」 틀을 그린다(앱 화면 글을 지어내지 않는다). 찍어낸 사이트는 운영자가 준 화면 이미지로 칸을 채운다.
export const fixture: HeroScreenshotWindowProps = {
  copy: {
    label: "첫 화면",
    title: "월말 정산을 한 화면에서 끝내요",
    lede: "카드 매출과 배달 정산, 현금 영수증을 한 장부에서 맞춰요. 아래 창이 실제 화면이에요. 모든 문구는 예시예요.",
    primaryCta: { label: "무료로 시작하기", href: "#signup" },
    secondaryCta: { label: "요금 보기", href: "#pricing" },
    frameLabel: "제품 화면",
    emptyLabel: "실제 제품 화면 필요",
  },
}

// 최대: 긴 제목, 긴 문단.
export const fixtureMax: HeroScreenshotWindowProps = {
  copy: {
    label: "첫 화면",
    title: "가게 세 곳의 월말 정산과 세금 신고 준비를 한 화면에서 끝내요",
    lede: "카드 매출과 배달 정산, 현금 영수증, 지점별 비용을 한 장부에서 맞춰요. 아래 창이 운영자가 직접 캡처해 준 실제 화면이에요. 모든 문구는 예시예요.",
    primaryCta: { label: "체험 기간으로 시작하기", href: "#signup" },
    secondaryCta: { label: "요금제 비교하기", href: "#pricing" },
    frameLabel: "제품 화면",
    emptyLabel: "실제 제품 화면 필요",
  },
}

// 최소: 짧은 제목, 문단·보조 버튼 없음.
export const fixtureMin: HeroScreenshotWindowProps = {
  copy: {
    label: "첫 화면",
    title: "정산 끝",
    primaryCta: { label: "시작", href: "#signup" },
    frameLabel: "제품 화면",
    emptyLabel: "실제 제품 화면 필요",
  },
}
