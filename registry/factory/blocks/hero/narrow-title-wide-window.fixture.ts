import type { HeroNarrowTitleWideWindowProps } from "./narrow-title-wide-window"

const tree = [
  { label: "오늘", depth: 0 as const },
  { label: "메모함", depth: 0 as const, count: 5 },
  { label: "고정한 판", depth: 0 as const },
  { label: "배송 조사", depth: 0 as const },
  { label: "질문 목록", depth: 1 as const },
  { label: "인터뷰 기록", depth: 1 as const },
  { label: "현장 사진", depth: 1 as const },
  { label: "가설 판", depth: 1 as const, on: true },
  { label: "결론 초안", depth: 1 as const },
  { label: "매장 동선 조사", depth: 0 as const },
  { label: "참고 자료", depth: 0 as const },
  { label: "보관함", depth: 0 as const },
]
// 판 위 자료 카드 넷 — 가설 하나에 인터뷰·실험·사진이 선으로 붙는다.
const nodes = [
  { tag: "가설", title: "오후 배송 불만은 포장 탓", id: "H-07", status: "검토 중" },
  { tag: "인터뷰", title: "편의점 점주 세 명", id: "INT-14", status: "정리됨" },
  { tag: "실험", title: "봉투 두께 비교", id: "E-3", status: "진행 중" },
  { tag: "사진", title: "젖은 상자 모서리", id: "P-22", status: "새로 붙음" },
]
const window = { label: "조사 판 앱 화면(예시)", root: "갈피", tree, board: "배송 조사 / 가설 판", share: "공유", nodes }

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r7-docs B 히어로의 문구 그대로.
export const fixture: HeroNarrowTitleWideWindowProps = {
  copy: {
    label: "첫 화면",
    title: "Every note finds its place on the map.",
    titleLines: ["Every note", "finds its", "place on", "the map."],
    lede: "인터뷰·사진·메모를 판에 올리면 같은 질문을 다룬 것끼리 선으로 이어집니다. 조사가 끝나면 그 선을 따라 결론 초안이 쓰입니다(예시).",
    primaryCta: { label: "빈 판 열기", href: "#new" },
    secondaryCta: { label: "사용 예 보기", href: "#examples" },
    pill: { label: "새로 — 인터뷰 녹음이 메모로 바로 들어옵니다(예시)", href: "#news" },
    window,
  },
  faces: ["field-1"],
}

// 최대: 긴 제목·설명·알약.
export const fixtureMax: HeroNarrowTitleWideWindowProps = {
  copy: {
    ...fixture.copy,
    title: "Every single note finds its own place on the research map.",
    titleLines: ["Every single note", "finds its own", "place on the", "research map."],
    lede: "인터뷰·사진·메모·녹음을 판에 올리면 같은 질문을 다룬 것끼리 선으로 이어집니다. 조사가 끝나면 그 선을 따라 결론 초안이 쓰이고, 초안마다 근거 자료가 따라 들어갑니다(예시).",
    pill: { label: "새로 — 인터뷰 녹음이 받아쓰기 메모로 바로 들어옵니다(예시)", href: "#news" },
  },
  faces: ["field-1"],
}

// 최소: 설명·보조 버튼 없음, 나무 둘·카드 하나, 면 없음.
export const fixtureMin: HeroNarrowTitleWideWindowProps = {
  copy: {
    label: "첫 화면",
    title: "Notes on a map.",
    primaryCta: { label: "열기", href: "#new" },
    pill: { label: "새로(예시)", href: "#news" },
    window: { ...window, tree: tree.slice(0, 2), nodes: nodes.slice(0, 1) },
  },
}
