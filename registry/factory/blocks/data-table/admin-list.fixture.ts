import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"
import type { TableColumn, TableCopy, TableData, TableRowData } from "../_shared/data-table-kit"
import type { ExportCopy } from "../_shared/export-actions"

import type { DataTableAdminListProps } from "./admin-list"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 관리자 사용자 목록(대장 D140~D141: 이메일·가입일·상태·구독·2단계). 이메일은 모두 example.com.
export const COLUMNS: TableColumn[] = [
  { id: "email", label: "이메일", primary: true, sortable: true },
  { id: "joined", label: "가입일", kind: "date", sortable: true },
  { id: "status", label: "계정 상태", kind: "status", sortable: true, filter: true },
  { id: "plan", label: "구독", kind: "status", filter: true },
  { id: "twoFactor", label: "2단계 인증", kind: "status", secondary: true },
  { id: "logins", label: "최근 30일 접속", kind: "numeric", sortable: true, secondary: true },
]

const NAMES = ["kim", "lee", "park", "choi", "jung", "kang", "cho", "yoon", "jang", "lim", "han", "oh", "seo", "shin", "kwon", "hwang", "ahn", "song", "yoo", "hong", "jeon", "ko", "moon"]
const STATUS = ["활성", "활성", "활성", "정지", "활성", "탈퇴 유예", "활성"]
const PLAN = ["프로", "무료", "체험 중", "프로", "결제 실패", "무료", "베이직"]

const row = (i: number, email?: string): TableRowData => ({
  id: `user-${i + 1}`,
  href: `#user-${i + 1}`,
  cells: {
    email: email ?? `${NAMES[i]}.example${i + 1}@example.com`,
    joined: new Date(Date.UTC(2026, 8 - (i % 8), 1 + ((i * 7) % 27), 3)).toISOString(),
    status: STATUS[i % STATUS.length],
    plan: PLAN[(i * 3) % PLAN.length],
    twoFactor: i % 3 === 0 ? "켜짐" : "꺼짐",
    logins: (i * 37) % 41,
  },
})
export const ROWS: TableRowData[] = Array.from({ length: NAMES.length }, (_, i) => row(i))
export const DATA: TableData = { columns: COLUMNS, rows: ROWS }
export const DATA_MAX: TableData = {
  columns: COLUMNS,
  rows: [...ROWS, ...Array.from({ length: 8 }, (_, i) => row(i + NAMES.length, `very.long.address.for.layout.stress.${i + 1}@subdomain.example.com`))].slice(0, 31),
}
export const DATA_MIN: TableData = { columns: COLUMNS.slice(0, 3).map((c) => ({ ...c, filter: false })), rows: ROWS.slice(0, 3) }

export const COPY: TableCopy & { title: string; lead?: string } = {
  title: "사용자",
  lead: "이메일로 찾고, 상태·구독으로 거르고, 열 머리를 눌러 정렬해요(예시).",
  caption: "사용자 목록",
  regionLabel: "사용자 목록",
  search: { label: "이메일 검색", placeholder: "이메일 일부를 적어 주세요" },
  filterAll: "전체",
  reset: "필터 초기화",
  count: "전체 {total}건 중 {shown}건",
  sort: { asc: "{column} 오름차순으로 정렬돼 있어요. 누르면 내림차순으로 바꿔요", desc: "{column} 내림차순으로 정렬돼 있어요. 누르면 정렬을 풀어요", hint: "누르면 {column} 순으로 정렬해요" },
  pager: { label: "쪽 이동", prev: "이전", next: "다음", range: "{from}–{to} / 전체 {total}건", page: "{page} / {pages}쪽" },
  empty: { title: "아직 가입한 사용자가 없어요", body: "첫 사용자가 가입하면 여기에 보여요(예시).", action: { label: "초대 링크 만들기", href: "#invite" } },
  noResults: { title: "조건에 맞는 사용자가 없어요", body: "검색어나 거르기 조건을 바꾸거나 모두 풀어 보세요.", reset: "필터 초기화" },
  loading: "사용자 목록을 불러오는 중이에요",
  error: { title: "사용자 목록을 불러오지 못했어요", retryLabel: "다시 시도" },
}

export const fixture: DataTableAdminListProps = { copy: COPY, state: { status: "ready", data: DATA } }
// 내보내기 단추(선택 칸 copy.export) — fixtureMax 에서만 보인다(기본 그림은 그대로)
export const EXPORT_COPY: ExportCopy = { filename: "users-example", csv: "CSV로 내려받기", csvDone: "내려받았어요", copy: { copy: "표 복사", copied: "복사했어요", manual: "직접 복사해 주세요" } }
export const fixtureMax: DataTableAdminListProps = {
  copy: {
    ...COPY,
    export: EXPORT_COPY,
    title: "사용자 — 가입 경로별 가입일과 계정 상태·구독·2단계 인증 켬 여부를 한눈에 보는 관리자 목록(예시)",
    lead: "이메일로 찾고, 계정 상태·구독으로 거르고, 열 머리를 눌러 정렬해요. 좁은 화면에서는 덜 중요한 열이 숨어요. 이메일 주소가 길어도 줄바꿈으로 모두 보여 줘요(예시).",
  },
  state: { status: "ready", data: DATA_MAX },
}
// 최소: 검색·거르기 없이 표만(열 셋, 세 줄)
export const fixtureMin: DataTableAdminListProps = { copy: { ...COPY, lead: undefined, search: undefined }, state: { status: "ready", data: DATA_MIN } }
export const fixtureStates: FixtureStates<DataTableAdminListProps> = { reason: "아직 가입한 사용자가 없어요(예시).", message: "서버 응답이 늦어요. 잠시 뒤 다시 시도해 주세요(예시)." }
