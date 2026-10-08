import type { HeroStepBandOrbitProps } from "./step-band-orbit"

const steps = [
  { value: "collect", number: "01", name: "COLLECT", description: "지상 기준점 12곳을 잽니다" },
  { value: "align", number: "02", name: "ALIGN", description: "궤도 값과 좌표를 맞춥니다" },
  { value: "report", number: "03", name: "REPORT", description: "오차를 날짜와 함께 남깁니다" },
]

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r1-measure A 히어로의 문구 그대로.
export const fixture: HeroStepBandOrbitProps = {
  copy: {
    label: "첫 화면",
    rail: { name: "DATASET", index: "/ 01" },
    title: { before: "Every ", highlight: "orbit", after: ", measured to the metre." },
    lede: "위성 궤도와 지상 측정값을 한 도면에서 맞춥니다. 오차는 센티미터 단위로 적고, 바뀐 값은 날짜와 함께 남깁니다(예시).",
    stepsLabel: "작업 단계",
    steps,
    defaultStep: "align",
    primaryCta: { label: "데모 요청", href: "#demo" },
    secondaryCta: { label: "데이터 보기", href: "#data" },
    drawingLabel: "궤도 도면(직접 그린 예시 도면)",
    drawingDescription: "동심원 두 개와 기울어진 궤도, 측정점 네 개",
    readouts: ["LAT 37.5665°N", "LON 126.978°E", "ALT 512 KM", "Δ 0.03 M"],
  },
}

// 최대: 긴 제목·설명·단계 설명.
export const fixtureMax: HeroStepBandOrbitProps = {
  copy: {
    label: "첫 화면",
    rail: { name: "DATASET", index: "/ 12" },
    title: { before: "Every single ", highlight: "orbit", after: ", measured to the metre and logged by date." },
    lede: "위성 궤도와 지상 측정값을 한 도면에서 맞춥니다. 오차는 센티미터 단위로 적고, 바뀐 값은 누가 언제 바꿨는지 날짜와 함께 남깁니다. 보고서는 매주 월요일 아침에 나갑니다(예시).",
    stepsLabel: "작업 단계",
    steps: steps.map((s) => ({ ...s, description: `${s.description} — 단계마다 담당자와 확인 날짜를 함께 적습니다` })),
    defaultStep: "report",
    primaryCta: { label: "데모 요청", href: "#demo" },
    secondaryCta: { label: "데이터 보기", href: "#data" },
    drawingLabel: "궤도 도면(직접 그린 예시 도면)",
    drawingDescription: "동심원 두 개와 기울어진 궤도, 측정점 네 개",
    readouts: ["LAT 37.5665°N", "LON 126.978°E", "ALT 512 KM", "Δ 0.03 M"],
  },
}

// 최소: 설명·보조 버튼 없음.
export const fixtureMin: HeroStepBandOrbitProps = {
  copy: {
    label: "첫 화면",
    rail: { name: "DATASET", index: "/ 01" },
    title: { before: "", highlight: "Orbit", after: "." },
    stepsLabel: "작업 단계",
    steps,
    primaryCta: { label: "데모", href: "#demo" },
    drawingLabel: "궤도 도면(예시)",
    drawingDescription: "동심원과 궤도",
    readouts: ["LAT", "LON", "ALT", "Δ"],
  },
}
