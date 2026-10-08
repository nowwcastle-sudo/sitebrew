import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import type { DashboardPanelActionListProps } from "./action-list"
import { DATA, DATA_MAX, DATA_MIN, ERROR, STATES } from "./kpi-first.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 미용실 운영 대시보드, 문구마다 「예시」.
const COPY = {
  title: "조치가 필요한 일",
  lead: "긴급한 것부터 순서대로입니다(예시).",
  asOfLabel: "기준",
  severity: { critical: "긴급", warning: "주의" },
  countTemplate: "긴급 {critical} · 주의 {warning}",
  ownerLabel: "담당",
  dueLabel: "기한",
  loadingLabel: "할 일을 불러오는 중입니다",
  empty: { title: "지금 조치할 일이 없습니다", body: "새로 생기면 여기에 먼저 보입니다(예시)." },
  error: ERROR,
}

export const fixture: DashboardPanelActionListProps = { copy: COPY, state: { status: "ready", data: DATA } }
export const fixtureMax: DashboardPanelActionListProps = {
  copy: { ...COPY, title: "조치가 필요한 일 — 전 지점 예약·재고·노쇼 처리 목록(예시)", lead: "긴급한 것부터 순서대로입니다. 처리하면 목록에서 사라지고, 기한이 지나면 원장에게 알림이 갑니다(예시)." },
  state: { status: "ready", data: DATA_MAX },
}
export const fixtureMin: DashboardPanelActionListProps = { copy: { ...COPY, lead: undefined }, state: { status: "ready", data: DATA_MIN } }
export const fixtureStates: FixtureStates<DashboardPanelActionListProps> = { ...STATES, reason: "오늘은 조치할 일이 없습니다(예시)." }
