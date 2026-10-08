import type { HeroLeakingAppPanelProps } from "./leaking-app-panel"

// 패널 = 이 도구로 만든 예시 설명서(가상 정수기 「물빛 X2」). 목차는 그 설명서의 목차다.
const panel = {
  label: "이 도구로 만든 설명서 화면(예시)",
  book: "물빛 X2 설명서",
  side: [
    { label: "처음 쓰는 분께", icon: "star" as const },
    { label: "벽걸이 설치", icon: "home" as const },
    { label: "필터 교체", icon: "settings" as const },
    { label: "오류 코드", icon: "search" as const },
    { label: "정기 점검", icon: "file" as const },
    { label: "안전 수칙", icon: "share" as const },
    { label: "자주 묻는 질문", icon: "chevron" as const },
    { label: "바뀐 내용", icon: "file" as const },
    { label: "설명서 설정", icon: "home" as const },
  ],
  activeSide: 1,
  tabs: ["설명서", "부품 목록", "오류 코드"],
  search: "문장 찾기",
  section: "설치",
  heading: "벽걸이 설치 순서",
  intro: "공구 두 개로 20분이면 끝나는 네 단계입니다.",
  cards: [
    { title: "벽에 표시", text: "받침 틀을 대고 나사 구멍 넷을 연필로 표시합니다", icon: "star" as const },
    { title: "앵커 박기", text: "6mm 날로 뚫고 앵커를 끝까지 밀어 넣습니다", icon: "download" as const },
    { title: "본체 걸기", text: "본체 뒤 고리를 틀 위 턱에 걸어 내립니다", icon: "file" as const },
    { title: "물 연결", text: "냉수 밸브를 잠근 뒤 호스를 돌려 끼웁니다", icon: "share" as const },
  ],
}

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r7-docs A 히어로의 문구 그대로.
export const fixture: HeroLeakingAppPanelProps = {
  copy: {
    label: "첫 화면",
    chip: { label: "이번 주 저절로 맞춘 문단", count: "146", href: "#changes" },
    title: "Write the manual where the code lives",
    sub: [{ text: "바뀐 " }, { text: "코드", bold: true }, { text: " 줄 옆에 " }, { text: "설명서", bold: true }, { text: " 문단이 함께 떠서, 같은 내용을 두 번 고칠 일이 없습니다(예시)." }],
    primaryCta: { label: "무료로 써 보기", href: "#try" },
    secondaryCta: { label: "예시 설명서 보기", href: "#example" },
    panel,
  },
  faces: ["field-1"],
}

// 최대: 긴 제목·설명·칩.
export const fixtureMax: HeroLeakingAppPanelProps = {
  copy: {
    label: "첫 화면",
    chip: { label: "이번 주 저절로 맞춘 설명서 문단", count: "1,146", href: "#changes" },
    title: "Write every manual right where the code already lives",
    sub: [{ text: "바뀐 " }, { text: "코드", bold: true }, { text: " 줄 옆에 " }, { text: "설명서", bold: true }, { text: " 문단이 함께 떠서, 같은 내용을 두 번 고칠 일이 없습니다. 담당자가 확인하면 웹과 PDF가 함께 바뀝니다(예시)." }],
    primaryCta: { label: "무료로 써 보기", href: "#try" },
    secondaryCta: { label: "예시 설명서 보기", href: "#example" },
    panel,
  },
  faces: ["field-1"],
}

// 최소: 보조 버튼 없음, 굵은 낱말 없음, 면 없음.
export const fixtureMin: HeroLeakingAppPanelProps = {
  copy: {
    label: "첫 화면",
    chip: { label: "맞춘 문단", count: "1", href: "#changes" },
    title: "Manuals with code",
    sub: [{ text: "코드 옆에 설명서(예시)." }],
    primaryCta: { label: "써 보기", href: "#try" },
    panel: { ...panel, side: panel.side.slice(0, 2), cards: panel.cards.slice(0, 1) },
  },
}
