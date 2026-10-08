import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { DATA, DATA_MAX, DATA_MIN, EMPTY, ERROR, STATES } from "./kpi-first.fixture"
import type { DashboardPanelTrendPlusTableProps } from "./trend-plus-table"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 미용실 운영 대시보드, 문구마다 「예시」.
const COPY = {
  title: "예약 추세",
  lead: "지표를 눌러 차트를 바꾸고, 아래 표는 경로로 거를 수 있어요(예시).",
  asOfLabel: "기준",
  metricsLabel: "차트 지표",
  chartTitle: "{label}: {from} {first} → {to} {last}",
  targetLabel: "목표",
  pointsCaption: "차트 값",
  tableCaption: "오늘 예약 목록",
  filter: { label: "예약 경로", column: "channel", allLabel: "전체" },
  resultTemplate: "{n}건",
  loadingLabel: "추세와 예약 목록을 불러오는 중이에요",
  empty: EMPTY,
  error: ERROR,
}

export const fixture: DashboardPanelTrendPlusTableProps = { copy: COPY, state: { status: "ready", data: DATA } }
export const fixtureMax: DashboardPanelTrendPlusTableProps = {
  copy: { ...COPY, title: "예약 추세 — 지난 30일 예약·노쇼·대기 시간과 오늘 예약 목록(예시)", lead: "지표를 눌러 차트를 바꾸고, 아래 표는 예약 경로로 거를 수 있어요. 표는 가로로 밀어 볼 수 있어요(예시)." },
  state: { status: "ready", data: DATA_MAX },
}
// 최소: 필터 없이 지표 하나(고르기 버튼 없음), 표 한 줄.
export const fixtureMin: DashboardPanelTrendPlusTableProps = { copy: { ...COPY, lead: undefined, filter: undefined }, state: { status: "ready", data: DATA_MIN } }
export const fixtureStates: FixtureStates<DashboardPanelTrendPlusTableProps> = STATES
