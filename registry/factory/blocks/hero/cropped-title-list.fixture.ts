import type { HeroCroppedTitleListProps } from "./cropped-title-list"

const lines = [
  "Night Market Signage — 밤시장 간판 체계",
  "Riverside Library Wayfinding System",
  "Two-Colour Posters for the Film Week",
  "Harbour Ferry Timetable, Redrawn",
  "Signal Type Specimen, Volume Three",
  "Rooftop Cinema Identity & Tickets",
  "Public Bath Revival Campaign",
  "Ceramic Fair Catalogue 2026",
].map((label) => ({ label, href: "#top" }))
const meta = [
  { term: "의뢰처", value: "시립 도서관", href: "#top" },
  { term: "매체", value: "간판·안내판", href: "#top" },
  { term: "기간", value: "6주", href: "#top" },
  { term: "상태", value: "설치 중", href: "#top" },
]

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r2-signal A 히어로의 문구 그대로.
export const fixture: HeroCroppedTitleListProps = {
  copy: { label: "첫 화면", title: "신호 연구소 작업 목록(예시)", listLabel: "작업 목록", lines, meta, metaNote: "작업 여덟 건 · 예시" },
  faces: ["field-1", "field-2"],
}

// 최대: 줄 열둘(긴 이름), 메타 여섯.
export const fixtureMax: HeroCroppedTitleListProps = {
  copy: {
    label: "첫 화면",
    title: "신호 연구소 작업 목록 — 간판·포스터·화면(예시)",
    listLabel: "작업 목록",
    lines: [...lines, ...lines.slice(0, 4).map((l) => ({ ...l, label: `${l.label} — Second Edition, Extended` }))],
    meta: [...meta, { term: "예산", value: "비공개", href: "#top" }, { term: "담당", value: "세 명", href: "#top" }],
    metaNote: "작업 열두 건 · 설치 중 두 건 · 예시",
  },
  faces: ["field-1", "field-2"],
}

// 최소: 줄 하나, 메타 하나, 면 없음(선).
export const fixtureMin: HeroCroppedTitleListProps = {
  copy: { label: "첫 화면", title: "작업 목록(예시)", listLabel: "작업 목록", lines: lines.slice(0, 1), meta: meta.slice(0, 1) },
}
