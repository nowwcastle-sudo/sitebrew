import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import type { ActionItem, DashboardData, Kpi } from "../_shared/dashboard-kit"
import type { DashboardPanelKpiFirstProps } from "./kpi-first"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 미용실 운영 대시보드, 문구마다 「예시」. 세 변형이 같은 데이터를 쓴다.
export const KPI_COPY = { target: "목표 {v}", range: "정상 {a}~{b}", compare: "{p} 대비", up: "{v} 늘었어요", down: "{v} 줄었어요", flat: "변화 없음" }
const KPIS: Kpi[] = [
  { id: "bookings", label: "오늘 예약", value: 42, unit: "건", baseline: { target: 50 }, delta: -3, rank: 1 },
  { id: "noshow", label: "노쇼율", value: 3.1, unit: "%", baseline: { range: [0, 5] }, delta: 0.4, rank: 2 },
  { id: "wait", label: "평균 대기", value: 12, unit: "분", baseline: { target: 10 }, delta: 2, rank: 3 },
  { id: "revisit", label: "재방문율", value: 38, unit: "%", baseline: { comparePeriod: "지난달" }, delta: 1.5, rank: 4 },
  { id: "sales", label: "오늘 매출", value: 1284000, unit: "원", baseline: { comparePeriod: "지난주 같은 요일" }, delta: 96000, rank: 5 },
]
const DAYS7 = ["9/23", "9/24", "9/25", "9/26", "9/27", "9/28", "9/29"]
const TRENDS = [
  { kpi: "bookings", points: [38, 44, 41, 47, 52, 45, 42].map((value, i) => ({ label: DAYS7[i], value })) },
  { kpi: "noshow", points: [2.4, 2.9, 3.3, 2.7, 3.5, 2.7, 3.1].map((value, i) => ({ label: DAYS7[i], value })) },
  { kpi: "wait", points: [9, 11, 10, 14, 15, 10, 12].map((value, i) => ({ label: DAYS7[i], value })) },
]
const CH = ["네이버 예약", "전화", "방문"]
const TABLE = {
  columns: [
    { id: "no", label: "예약 번호", numeric: false },
    { id: "customer", label: "고객", numeric: false },
    { id: "channel", label: "경로", numeric: false },
    { id: "time", label: "시각", numeric: true },
    { id: "people", label: "인원", numeric: true },
    { id: "amount", label: "금액(원)", numeric: true },
  ],
  density: 40 as const,
  rows: Array.from({ length: 8 }, (_, i) => ({ no: `R-0929-${String(i + 1).padStart(3, "0")}`, customer: `예시 고객 ${i + 1}`, channel: CH[i % 3], time: `${10 + i}:00`, people: (i % 3) + 1, amount: 35000 + i * 5000 })),
}
const ACTIONS: ActionItem[] = [
  { id: "a1", severity: "warning", title: "오후 3시 예약 2건 담당 디자이너 미배정", owner: "예시 실장", due: "오늘 14:30", recordUrl: "/admin/bookings?time=15", actions: [{ label: "배정", href: "/admin/bookings/assign?time=15" }, { label: "열기", href: "/admin/bookings?time=15" }] },
  { id: "a2", severity: "critical", title: "미확정 예약 7건 — 1시간 안에 확정하지 않으면 자동 취소", detail: "네이버 예약에서 들어온 요청이에요(예시).", owner: "예시 매니저", due: "오늘 11:00", recordUrl: "/admin/bookings?status=pending", actions: [{ label: "열기", href: "/admin/bookings?status=pending" }, { label: "연락", href: "/admin/bookings/contact?status=pending" }] },
  { id: "a3", severity: "warning", title: "염색약 재고 3개 남음", detail: "평소 하루 사용량은 5개예요(예시).", owner: "예시 실장", recordUrl: "/admin/stock/dye", actions: [{ label: "열기", href: "/admin/stock/dye" }] },
  { id: "a4", severity: "critical", title: "어제 노쇼 고객 2명 — 보증금 환불 여부 결정", owner: "예시 원장", due: "오늘 18:00", recordUrl: "/admin/noshow", actions: [{ label: "열기", href: "/admin/noshow" }, { label: "연락", href: "/admin/noshow/contact" }] },
]
export const DATA: DashboardData = {
  asOf: "2026-09-29 09:40",
  kpis: KPIS,
  focus: { title: "미확정 예약 7건을 11시 전에 확정하세요", detail: "확정하지 않으면 자동으로 취소되어 오늘 목표(50건)에서 더 멀어져요(예시).", action: { label: "미확정 예약 열기", href: "/admin/bookings?status=pending" } },
  trends: TRENDS,
  table: TABLE,
  actions: ACTIONS,
}
// 최대: KPI 6개(긴 이름·큰 값), 30일 추세, 표 30줄, 할 일 12개(긴 제목).
const DAYS30 = Array.from({ length: 30 }, (_, i) => `9/${i + 1}`)
export const DATA_MAX: DashboardData = {
  asOf: "2026-09-29 09:40 (자동 갱신 5분마다)",
  kpis: [
    ...KPIS.map((k) => ({ ...k, label: `${k.label} — 전 지점 합계(예시)` })),
    { id: "cancel", label: "당일 취소 — 전 지점 합계(예시)", value: 1234567.89, unit: "원", baseline: { target: 1000000, range: [0, 2000000], comparePeriod: "지난달 같은 날" }, delta: -234567.89, rank: 6 },
  ],
  focus: { title: "미확정 예약 17건과 담당 미배정 9건을 오전 11시 전에 처리하세요 — 처리하지 않으면 자동 취소돼요(예시)", detail: "네이버 예약·전화 예약에서 들어온 요청이 몰렸어요. 확정 문자를 보내면 고객이 바로 받아요. 담당이 없으면 원장에게 알림이 가요(예시).", action: { label: "미확정 예약 모두 열기(예시)", href: "/admin/bookings?status=pending" } },
  trends: TRENDS.map((t) => ({ kpi: t.kpi, points: DAYS30.map((label, i) => ({ label, value: t.points[i % 7].value + (i % 5) })) })),
  table: { ...TABLE, rows: Array.from({ length: 30 }, (_, i) => ({ no: `R-0929-${String(i + 1).padStart(3, "0")}`, customer: `아주 긴 이름을 가진 예시 고객 ${i + 1}`, channel: CH[i % 3], time: `${10 + (i % 10)}:${i % 2 ? "30" : "00"}`, people: (i % 4) + 1, amount: 1235000 + i * 5000 })) },
  actions: Array.from({ length: 12 }, (_, i) => ({ ...ACTIONS[i % 4], id: `m${i}`, title: `${ACTIONS[i % 4].title} — 강남점·홍대점·성수점 동시 발생, 담당자 확인 필요(예시 ${i + 1})`, detail: "고객에게 확정 문자가 가지 않았어요. 확정하거나 다른 시간을 제안해 주세요. 30분 뒤 원장에게 알림이 다시 가요(예시)." })),
}
// 최소: KPI 하나(기준 하나), 추세 두 점, 표 한 줄, 할 일 하나 — 결정 문장·델타 없음.
export const DATA_MIN: DashboardData = {
  asOf: "2026-09-29 09:40",
  kpis: [{ id: "bookings", label: "오늘 예약", value: 42, unit: "건", baseline: { target: 50 }, rank: 1 }],
  trends: [{ kpi: "bookings", points: [{ label: "9/28", value: 45 }, { label: "9/29", value: 42 }] }],
  table: { ...TABLE, rows: TABLE.rows.slice(0, 1) },
  actions: [ACTIONS[2]],
}
export const EMPTY = { title: "아직 데이터가 없어요", body: "첫 예약이 들어오면 여기에 보여요(예시).", action: { label: "예약 받기 설정", href: "/admin/settings/booking" } }
export const ERROR = { title: "대시보드를 불러오지 못했어요", retryLabel: "다시 시도" }
export const STATES = { reason: "오늘은 아직 예약이 없어요(예시).", message: "서버 응답이 늦어요. 잠시 후 다시 시도해 주세요(예시)." }

const COPY = {
  title: "오늘 운영",
  lead: "지금 먼저 할 일과 핵심 숫자예요(예시).",
  asOfLabel: "기준",
  focusLabel: "지금 먼저",
  kpi: KPI_COPY,
  loadingLabel: "대시보드를 불러오는 중이에요",
  empty: EMPTY,
  error: ERROR,
}

export const fixture: DashboardPanelKpiFirstProps = { copy: COPY, state: { status: "ready", data: DATA } }
export const fixtureMax: DashboardPanelKpiFirstProps = { copy: { ...COPY, title: "오늘 운영 — 전 지점 예약·대기·매출 한눈에 보기(예시)", lead: "지금 먼저 할 일과 핵심 숫자예요. 숫자마다 목표·정상 범위·비교 기간을 함께 보여 드려요(예시)." }, state: { status: "ready", data: DATA_MAX } }
export const fixtureMin: DashboardPanelKpiFirstProps = { copy: { ...COPY, lead: undefined }, state: { status: "ready", data: DATA_MIN } }
export const fixtureStates: FixtureStates<DashboardPanelKpiFirstProps> = STATES
