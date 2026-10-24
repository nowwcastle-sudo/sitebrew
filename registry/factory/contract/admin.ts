// 관리 화면 포트(registry:lib "admin"). 운영자가 구획(주문·예약·후기 …)마다 표를 보고, 한 줄을 열어 고치고, 행동하고, 개요에서 지금 할 일을 보는 화면용 타입과 포트다(계획 3d 관리 화면).
// 열·행·편집 칸 모양은 블록 키트(_shared/data-table-kit·data-table/record-panel)의 TableColumn·TableRowData·RecordField 와 같다 — 계약 층은 블록을 부르지 않으므로(import 층 규칙) 다시 적고, app/qa/blocks/admin.typetest.ts 가 두 모양이 서로 받아들여지는지 typecheck 에서 맞춘다.
// 블록(data-table/admin-list·record-panel, dashboard-panel/*, nav/app-sidebar)은 구획이 무엇인지 모르고 이 모양의 값만 받는다 — 구현은 launch-factory 의 packages/admin-console(구획 모듈 + createAdminConsole), QA 는 adapter-mock-admin 의 목이다.
// 이 파일은 타입만 내보낸다(ports·commerce 와 같이 런타임 0). 모양의 정본은 launch-factory `packages/admin-console/src/types.ts` 이고 이름·모양을 그대로 옮겼다(scripts/test/wf-port-shapes.test.mjs 가 맞춘다). 계약 판은 그대로 2다(더하기만).
// **누가 이 화면을 쓸 수 있는가는 서버가 세션에서 읽어 정한다** — 입력으로 role·userId 를 받지 않는다(AdminPort 의 어떤 메서드도 사용자를 입력으로 받지 않는다).
// 모든 메서드는 거부(reject)하지 않고 ActionResult 로 끝난다(AdminResult = ActionResult). 표 칸·열 모양은 블록의 TableData(_shared/data-table-kit)와, 상세는 RecordData 와, 개요는 DashboardData 와 맞춰 쓴다.
import type { ActionResult } from "@/registry/factory/contract/block-contract"

/** 실패는 거부(reject)하지 않고 값으로 끝난다. ActionResult 와 같은 모양 */
export type AdminResult<T> = ActionResult<T>

/**
 * 관리 화면이 아는 실패 갈래(모두 ActionFailureCode 의 값이다 — 모르는 code 는 화면이 formError 로 그린다):
 * sign_in_required(로그아웃·만료) · forbidden(이 구획을 볼 권한 없음) · two_factor_required(관리자인데 2단계 인증이 꺼져 있음) · impersonation_blocked(대리 로그인 세션은 관리자가 아니다) ·
 * provider_unavailable(이 구획의 부품이 꺼져 있음) · not_found(모르는 구획·기록) · invalid_input(입력 모양이 틀림) · confirmation_required(사람 확인 없이는 실행하지 않는 행동 — 오류가 아니라 승인 대기) ·
 * invalid_state(지금 상태에서는 할 수 없는 행동) · action_failed(예기치 못한 실패 — 자세한 이유는 서버 로그에만).
 */
export type AdminFailureCode =
  | "sign_in_required"
  | "forbidden"
  | "two_factor_required"
  | "impersonation_blocked"
  | "provider_unavailable"
  | "not_found"
  | "invalid_input"
  | "confirmation_required"
  | "invalid_state"
  | "action_failed"

// ── 표 ──────────────────────────────────────────────────────────────────────────────────────
export type AdminCell = string | number | null
export interface AdminColumn {
  id: string
  label: string
  /** contact: 전화·메일 같은 연락처 열 — 서버가 값을 가려서(마스킹) 보낸다. 화면은 받은 글을 그대로 그린다 */
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
/** total 이 rows.length 보다 크면 최근 순으로 잘린 것이다(화면이 「최근 N건」이라고 알린다) */
export interface AdminTable {
  columns: AdminColumn[]
  rows: AdminRow[]
  total: number
}
export interface AdminTableQuery {
  search?: string
  /** 상태 거르기(구획이 아는 값만 받는다) */
  status?: string
  limit?: number
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
  /** contact 는 연락처 — 콘솔이 가려서 내보낸다 */
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
  /** 사람이 확인 단계를 거쳤다(ports 의 HumanConfirmation 과 같은 칸). 서버가 확인을 요구하는 행동(구획의 confirmActions)은 이것이 true 가 아니면 실행하지 않는다 */
  confirmed?: true
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
  /** 기여(contribute)가 던져서 개요에 못 실은 구획 id 들(선택 — 없으면 모두 실렸다). 화면이 「일부 구획의 현황을 못 불러왔어요」라고 알린다 */
  failed?: string[]
}

// ── 포트 ────────────────────────────────────────────────────────────────────────────────────
export interface AdminSectionInfo {
  id: string
  label: string
  href: string
}

/**
 * 관리 포트. 모든 메서드는 거부(reject)하지 않고 ActionResult 로 끝난다. 사용자는 세션에서 읽는다(입력이 아니다).
 * 접근 갈래(AdminFailureCode): 로그아웃 → sign_in_required · 권한 없음 → forbidden · 관리자인데 2단계 인증 꺼짐 → two_factor_required · 대리 세션 → impersonation_blocked.
 * sections() 는 볼 수 있는 구획만 돌려주고, 하나도 없을 때 앞의 셋(로그인·2단계·대리)은 그 이유로 실패하고 forbidden 뿐이면 빈 목록이다. 모르는 구획·기록은 not_found(접근 확인보다 앞선다).
 * act 는 확인 입력(confirmed: true)이 필요한 행동(구획의 confirmActions — AdminRecord.danger 가 보통 그것이다)을 확인 없이 받으면 아무것도 바꾸지 않고 confirmation_required(retryable false)로 끝난다.
 */
export interface AdminPort {
  sections(): Promise<AdminResult<AdminSectionInfo[]>>
  overview(): Promise<AdminResult<AdminOverview>>
  table(input: { section: string } & AdminTableQuery): Promise<AdminResult<AdminTable>>
  record(input: { section: string; id: string }): Promise<AdminResult<AdminRecord>>
  act(input: AdminActInput): Promise<AdminResult<AdminActOutcome>>
}
