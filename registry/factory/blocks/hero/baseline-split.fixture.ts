import type { HeroBaselineSplitProps } from "./baseline-split"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r1-measure B 히어로의 문구 그대로. 사진은 갤러리에서 넣지 않는다(검수대 틀만 public/media 를 넘긴다).
export const fixture: HeroBaselineSplitProps = {
  copy: {
    label: "첫 화면",
    title: "Built on a baseline you can measure.",
    titleLines: ["Built on a baseline", "you can measure."],
    lede: "강판과 이음새를 같은 기준선에서 잽니다. 시험 성적서는 출고 전날 올리고, 치수가 바뀌면 도면 번호부터 바꿉니다. 모든 값은 예시입니다.",
    primaryCta: { label: "시험 성적 보기", href: "#reports" },
    drawingLabel: "단면 치수선 도면(직접 그린 예시 도면)",
    dims: { width: "12 000 mm", height: "3 600", section: "SECTION A–A" },
  },
}

// 최대: 긴 제목 세 줄, 긴 설명, 긴 버튼 이름.
export const fixtureMax: HeroBaselineSplitProps = {
  copy: {
    label: "첫 화면",
    title: "Every plate and every seam is built on a baseline you can measure twice.",
    titleLines: ["Every plate and every seam", "is built on a baseline", "you can measure twice."],
    lede: "강판과 이음새를 같은 기준선에서 잽니다. 시험 성적서는 출고 전날 올리고, 치수가 바뀌면 도면 번호부터 바꿉니다. 인장·굽힘·피로 시험은 한 건물에서 하고, 시험대마다 교정일과 담당자를 적어 둡니다. 모든 값은 예시입니다.",
    primaryCta: { label: "시험 성적서 내려받기", href: "#reports" },
    drawingLabel: "단면 치수선 도면(직접 그린 예시 도면)",
    dims: { width: "12 000 mm", height: "3 600", section: "SECTION A–A" },
  },
}

// 최소: 설명 없음, 제목 한 줄.
export const fixtureMin: HeroBaselineSplitProps = {
  copy: {
    label: "첫 화면",
    title: "Measured.",
    primaryCta: { label: "보기", href: "#reports" },
    drawingLabel: "단면 치수선 도면(예시)",
    dims: { width: "12 000 mm", height: "3 600", section: "A–A" },
  },
}
