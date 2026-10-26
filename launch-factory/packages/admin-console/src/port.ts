// 관리 화면의 와이어 모양(계획 3d). 의존 0 — 화면·서버 액션·시험이 모두 이 파일의 모양으로 만난다.
// 표·상세 모양은 web-factory 블록(data-table/admin-list·record-panel)이 받는 모양(TableData·RecordData)과 같고,
// 포트 모양(AdminPort)은 web-factory 계약 `contract/admin.ts` 와 같다 — scripts/test/wf-port-shapes.test.mjs 가 맞춘다.
// 구획을 쓰는 쪽(LF 전용)의 모양은 section.ts 에 있다.

/** 실패는 거부(reject)하지 않고 값으로 끝난다. web-factory ActionResult 와 같은 모양 */
export type AdminResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<string, string[]>>; retryable?: boolean; code?: AdminFailureCode | (string & {}) }

/** 알려진 실패 갈래. 모르는 code 는 화면이 formError 로 그린다 */
export type AdminFailureCode =
  | "sign_in_required" // 로그아웃·만료 — 로그인 안내
  | "forbidden" // 이 구획을 볼 권한 없음
  | "two_factor_required" // 관리자인데 2단계 인증이 꺼져 있음
  | "impersonation_blocked" // 대리 로그인 세션은 관리자가 아니다
  | "provider_unavailable" // 이 구획의 부품이 꺼져 있음(키 없음 등)
  | "not_found" // 모르는 구획·기록
  | "invalid_input" // 입력 모양이 틀림(모르는 상태값·행동·칸 이름 포함)
  | "confirmation_required" // 사람 확인(confirmed: true) 없이는 실행하지 않는 행동
  | "invalid_state" // 지금 상태에서는 할 수 없는 행동
  | "action_failed" // 예기치 못한 실패(자세한 이유는 서버 로그에만)

// ── 표 ──────────────────────────────────────────────────────────────────────────────────────
export type AdminCell = string | number | null
export interface AdminColumn {
  id: string
  label: string
  /** contact 는 연락처(전화·메일·주소) — 콘솔이 가려서 내보낸다 */
  kind?: "text" | "numeric" | "date" | "status" | "contact"
  sortable?: boolean
  filter?: boolean
  /** 사람이 읽는 식별자 열(행 머리·상세 링크) — 표마다 하나 */
  primary?: boolean
  /** 좁은 화면에서 숨겨도 되는 열 */
  secondary?: boolean
}
export interface AdminRow {
  id: string
  cells: Record<string, AdminCell>
  /** 상세 쪽 주소(예: /admin/orders/ord_1) */
  href?: string
}
/** total 은 거른 전체 줄 수다. 한 쪽(page)만 rows 에 있으므로 total 이 rows.length 보다 크면 다른 쪽이 더 있다(화면이 쪽 이동을 그린다) */
export interface AdminTable {
  columns: AdminColumn[]
  rows: AdminRow[]
  total: number
}
export interface AdminTableQuery {
  search?: string
  /** 상태 거르기(구획이 아는 값만 받는다) */
  status?: string
  /** 한 쪽의 줄 수(1~200, 기본 100 — 구획이 pageSize 를 선언하면 그 이하) */
  limit?: number
  /** 쪽 번호(1부터, 기본 1). (page - 1) × 줄 수 번째 줄부터 읽는다 */
  page?: number
}

// ── 상세 ────────────────────────────────────────────────────────────────────────────────────
export interface AdminRecordField {
  name: string
  label: string
  type?: "text" | "email" | "tel" | "textarea" | "number"
  required?: boolean
  value: string
}
export interface AdminRecordSummaryItem {
  label: string
  value: string
  /** contact 는 콘솔이 가려서 내보낸다 */
  kind?: "text" | "numeric" | "status" | "contact"
}
export interface AdminRecordAction {
  id: string
  label: string
}
export interface AdminRecord {
  id: string
  title: string
  summary: AdminRecordSummaryItem[]
  /** 편집 칸. 비어 있으면 편집 폼을 그리지 않는다 */
  fields: AdminRecordField[]
  /** 폼을 저장할 때 부르는 행동 id(fields 가 있을 때) */
  save?: string
  /** 한 번에 누르는 행동들(상태 한 칸 앞으로 …) */
  actions: AdminRecordAction[]
  /** 되돌리기 어려운 행동 하나(주문 취소·예약 취소 …) — 화면이 확인 단계를 둔다 */
  danger?: AdminRecordAction
}
export interface AdminActInput {
  section: string
  id: string
  action: string
  /** 폼 칸 값(저장 행동) */
  fields?: Record<string, string>
  /** 사람이 확인 단계를 거쳤다. 위험 행동(danger)은 이것이 정확히 true 가 아니면 실행하지 않는다 */
  confirmed?: true
  /** 폼을 열 때 만든 멱등 키(8~100자, 영문·숫자·_-). 같은 키로 다시 보내도 한 번만 처리해야 하는 행동(문의 답변 …)이 쓴다 */
  idempotencyKey?: string
}
export interface AdminActOutcome {
  message?: string
}

// ── 개요 ────────────────────────────────────────────────────────────────────────────────────
/** 지금 처리할 일 한 줄(예: 발송 준비할 주문 3건) */
export interface AdminTodo {
  id: string
  severity: "critical" | "warning"
  title: string
  detail?: string
  /** 처리하러 가는 쪽 */
  href: string
  count: number
}
/** 최근 변화 한 줄(이번 주 주문 12건, 지난주 9건) */
export interface AdminMetric {
  id: string
  label: string
  value: number
  previous: number
  unit: string
  /** 비교 기준 기간 이름(예: "지난 7일") */
  comparePeriod: string
}
export interface AdminContribution {
  todo: AdminTodo[]
  metrics: AdminMetric[]
}
export interface AdminOverview extends AdminContribution {
  /** ISO 시각 */
  asOf: string
  /** 개요를 못 만든 구획 id(던진 구획이 조용히 사라져 「할 일 없음」으로 보이지 않게). 없으면 생략 */
  failed?: string[]
}

// ── 포트 ────────────────────────────────────────────────────────────────────────────────────
export interface AdminSectionInfo {
  id: string
  label: string
  href: string
}
/** web-factory 계약 AdminPort 와 같은 모양 — 서버 액션이 이것을 그대로 내보낸다 */
export interface AdminPort {
  sections(): Promise<AdminResult<AdminSectionInfo[]>>
  overview(): Promise<AdminResult<AdminOverview>>
  table(input: { section: string } & AdminTableQuery): Promise<AdminResult<AdminTable>>
  record(input: { section: string; id: string }): Promise<AdminResult<AdminRecord>>
  act(input: AdminActInput): Promise<AdminResult<AdminActOutcome>>
}
