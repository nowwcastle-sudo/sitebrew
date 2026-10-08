import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"
import type { TableColumn, TableData, TableRowData } from "../_shared/data-table-kit"

import type { DataTableCompactCopy, DataTableCompactProps } from "./compact"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」의 최근 결제 내역 — 대시보드·설정 안에 끼는 작은 표.
const COLUMNS: TableColumn[] = [
  { id: "item", label: "내역", primary: true, sortable: true },
  { id: "paidAt", label: "결제일", kind: "date", sortable: true },
  { id: "amount", label: "금액(원, VAT 포함)", kind: "numeric", sortable: true },
  { id: "state", label: "상태", kind: "status", secondary: true },
]
const ROWS: TableRowData[] = [
  ["프로(예시) 월 이용료", "2026-09-30T15:00:00.000Z", 29000, "결제 완료"],
  ["프로(예시) 월 이용료", "2026-08-31T15:00:00.000Z", 29000, "결제 완료"],
  ["추가 저장 공간 10GB(예시)", "2026-08-14T03:00:00.000Z", 3300, "결제 완료"],
  ["프로(예시) 월 이용료", "2026-07-31T15:00:00.000Z", 29000, "환불됨"],
  ["프로(예시) 월 이용료", "2026-06-30T15:00:00.000Z", 29000, "결제 완료"],
  ["베이직(예시) 월 이용료", "2026-05-31T15:00:00.000Z", 9900, "결제 완료"],
  ["베이직(예시) 월 이용료", "2026-04-30T15:00:00.000Z", 9900, "결제 완료"],
].map(([item, paidAt, amount, state], i) => ({ id: `pay-${i + 1}`, href: `#pay-${i + 1}`, cells: { item, paidAt, amount, state } }))
const DATA: TableData = { columns: COLUMNS, rows: ROWS }
const DATA_MAX: TableData = { columns: COLUMNS, rows: ROWS.map((r, i) => (i === 0 ? { ...r, cells: { ...r.cells, item: "프로(예시) 연간 이용료 — 팀 구성원 열 명 포함, 부가세 포함, 다음 갱신 때 자동으로 결제돼요" } } : r)) }
const DATA_MIN: TableData = { columns: COLUMNS.slice(0, 3), rows: ROWS.slice(0, 2) }

const COPY: DataTableCompactCopy = {
  title: "최근 결제",
  lead: "최근 다섯 건이에요. 열 머리를 누르면 정렬해요(예시).",
  caption: "최근 결제 내역",
  regionLabel: "최근 결제 내역",
  sort: { asc: "{column} 오름차순으로 정렬돼 있어요. 누르면 내림차순으로 바꿔요", desc: "{column} 내림차순으로 정렬돼 있어요. 누르면 정렬을 풀어요", hint: "누르면 {column} 순으로 정렬해요" },
  viewAll: { label: "전체 {total}건 보기", href: "#billing-history" },
  empty: { title: "아직 결제한 내역이 없어요", body: "요금제를 시작하면 결제 내역이 여기에 보여요(예시).", action: { label: "요금제 보기", href: "#pricing" } },
  loading: "최근 결제 내역을 불러오는 중이에요",
  error: { title: "결제 내역을 불러오지 못했어요", retryLabel: "다시 시도" },
}

export const fixture: DataTableCompactProps = { copy: COPY, state: { status: "ready", data: DATA }, limit: 5 }
export const fixtureMax: DataTableCompactProps = {
  copy: { ...COPY, export: { filename: "payments-example", csv: "CSV로 내려받기", csvDone: "내려받았어요", copy: { copy: "표 복사", copied: "복사했어요", manual: "직접 복사해 주세요" } }, title: "최근 결제 — 요금제 이용료와 추가 구매 내역을 최근 순서대로 보여 줘요(예시)", lead: "최근 다섯 건만 보여 드려요. 더 오래된 내역은 전체 보기에서 확인할 수 있고, 좁은 화면에서는 상태 열이 숨어요(예시)." },
  state: { status: "ready", data: DATA_MAX },
  limit: 5,
}
// 최소: 열 셋, 두 줄, 전체 보기 링크 없음(표에 다 담김)
export const fixtureMin: DataTableCompactProps = { copy: { ...COPY, lead: undefined }, state: { status: "ready", data: DATA_MIN }, limit: 5 }
export const fixtureStates: FixtureStates<DataTableCompactProps> = { reason: "아직 결제한 내역이 없어요(예시).", message: "서버 응답이 늦어요. 잠시 뒤 다시 시도해 주세요(예시)." }
