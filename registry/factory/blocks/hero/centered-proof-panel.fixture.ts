import type { HeroCenteredProofPanelProps } from "./centered-proof-panel"

const kpis = [
  { term: "근거 문장", value: "3,516" },
  { term: "출처 연결", value: "97.4%" },
  { term: "평균 응답", value: "2.4초" },
  { term: "없다고 답함", value: "37건" },
]

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r4-evidence B 히어로의 문구 그대로.
export const fixture: HeroCenteredProofPanelProps = {
  copy: {
    label: "첫 화면",
    title: "Every answer arrives with the page it came from.",
    lede: "사내 문서와 보고서에서만 답을 찾습니다. 답마다 근거 문장과 쪽수를 붙이고, 근거가 없으면 없다고 말합니다. 모든 숫자는 예시입니다.",
    primaryCta: { label: "내 문서로 해 보기", href: "#try" },
    secondaryCta: { label: "보관 방식 읽기", href: "#storage" },
    panelTitle: "이번 주 근거 현황",
    badges: ["보고서 12건", "검토 대기 3"],
    kpis,
    trendLabel: "근거 연결률 추이 선(예시)",
    proof: { lead: "탁도 초과 — 3쪽 12줄", rest: ["센서 오염 — 근거 없음", "수온 정상 — 96회 측정", "지류 유입 — 영상 판독"] },
  },
  faces: ["field-1", "field-2"],
}

// 최대: 긴 제목·설명, 배지 넷, 근거 여섯 줄.
export const fixtureMax: HeroCenteredProofPanelProps = {
  copy: {
    label: "첫 화면",
    title: "Every single answer arrives together with the exact page and line it came from.",
    lede: "사내 문서와 보고서, 회의록과 계약서에서만 답을 찾습니다. 답마다 근거 문장과 쪽수, 줄 번호를 붙이고, 근거가 둘 이상이면 서로 다른 점도 적습니다. 근거가 없으면 없다고 말합니다. 모든 숫자는 예시입니다.",
    primaryCta: { label: "내 문서로 해 보기", href: "#try" },
    secondaryCta: { label: "보관 방식 읽기", href: "#storage" },
    panelTitle: "이번 주 근거 현황 — 수질 점검 보고서",
    badges: ["보고서 12건", "검토 대기 3", "새 출처 5", "권한 변경 1"],
    kpis,
    trendLabel: "근거 연결률 추이 선(예시)",
    proof: { lead: "탁도 초과 — 3쪽 12줄", rest: ["센서 오염 — 근거 없음", "수온 정상 — 96회 측정", "지류 유입 — 영상 판독", "유량 감소 — 7쪽 3줄", "시료 누락 — 근거 없음"] },
  },
  faces: ["field-1", "field-2"],
}

// 최소: 설명·보조 버튼·배지 없음, 근거 한 줄, 면 없음.
export const fixtureMin: HeroCenteredProofPanelProps = {
  copy: {
    label: "첫 화면",
    title: "Answers with pages.",
    primaryCta: { label: "해 보기", href: "#try" },
    panelTitle: "근거 현황",
    badges: [],
    kpis: kpis.slice(0, 2),
    trendLabel: "추이 선(예시)",
    proof: { lead: "탁도 초과 — 3쪽", rest: [] },
  },
}
