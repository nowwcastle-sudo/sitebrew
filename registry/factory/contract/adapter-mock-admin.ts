// 관리 포트 목(registry:lib "adapter-mock-admin"). 구획 둘(주문 · 후기)로 표 → 상세 → 행동 → 개요 한 바퀴를 키·서버 없이 그린다(계획 3d).
// 쿼리 규칙은 adapter-mock 과 같다(?state= ?submit= &delay=) — 그 파일이 내보내는 도우미(portCtx·reader·writer)를 그대로 쓴다. 장면은 ?admin= 하나가 더한다.
// 결정적이다 — 같은 인자는 같은 처음 상태이고, 인스턴스는 상태를 가진다(주문 상태·후기 보임/숨김). 날짜는 고정값(MOCK_NOW)이라 스크린샷이 흔들리지 않는다.
// 합성 순서는 launch-factory createAdminConsole 과 같다: 구획 찾기(모르면 not_found) → 접근 확인(장면) → 입력 검사 → 확인 입력 벽 → 구획 실행.
// 확인 입력 벽은 선택이 아니다 — 구획의 confirmActions(주문 취소·후기 숨기기)는 늘 `confirmed: true` 없이는 아무것도 바꾸지 않고 { code: "confirmation_required", retryable: false } 로 끝난다.
import type { ActionResult } from "@/registry/factory/contract/block-contract"
import type {
  AdminActInput,
  AdminActOutcome,
  AdminContribution,
  AdminFailureCode,
  AdminOverview,
  AdminPort,
  AdminRecord,
  AdminRow,
  AdminSectionInfo,
  AdminTable,
  AdminTableQuery,
} from "@/registry/factory/contract/admin"
import { MOCK_NOW, type Failure, type PortMockOptions, copy, oneOf, portCtx, reader, toParams, writer } from "@/registry/factory/contract/adapter-mock"

/** ?admin= 장면: admin(관리자 — 기본) · signed-out(로그아웃) · forbidden(관리자가 아님) · two-factor-required(2단계 인증 꺼짐) · impersonation(대리 로그인 세션) */
export const MOCK_ADMINS = ["admin", "signed-out", "forbidden", "two-factor-required", "impersonation"] as const
export type MockAdmin = (typeof MOCK_ADMINS)[number]
/** 관리자가 아닌 장면이 막히는 이유(access 의 code) */
export const MOCK_ADMIN_DENIALS = {
  "signed-out": "sign_in_required",
  forbidden: "forbidden",
  "two-factor-required": "two_factor_required",
  impersonation: "impersonation_blocked",
} as const satisfies Record<Exclude<MockAdmin, "admin">, AdminFailureCode>

/** 목이 가진 구획(등록 순서가 사이드바 순서). 어댑터 적합성 묶음이 이 목록을 쓰지 않는다 — sections() 가 돌려주는 것을 읽는다 */
export const MOCK_ADMIN_SECTIONS = ["orders", "reviews"] as const

const BASE = "/admin"
const MAX_ID = 128
const MAX_MEMO = 500
const MESSAGES = {
  not_found: "찾을 수 없는 관리 화면이에요.",
  no_record: "찾을 수 없는 기록이에요.",
  invalid_input: "요청 모양이 맞지 않아요.",
  confirmation_required: "이 행동은 사람이 내용을 확인해야 해요. 확인했다는 표시(confirmed: true)와 함께 다시 보내 주세요. 아직 아무것도 바뀌지 않았어요.",
  sign_in_required: "먼저 로그인해 주세요.",
  forbidden: "이 화면을 볼 권한이 없어요.",
  two_factor_required: "관리 화면을 쓰려면 2단계 인증을 켜 주세요.",
  impersonation_blocked: "다른 사용자로 로그인한 동안에는 관리 화면을 열 수 없어요.",
} as const
const deny = (code: AdminFailureCode, formError: string): Failure => ({ ok: false, code, retryable: false, formError })
const denial = (scene: Exclude<MockAdmin, "admin">): Failure => deny(MOCK_ADMIN_DENIALS[scene], MESSAGES[MOCK_ADMIN_DENIALS[scene]])
const invalidState = (formError: string): Failure => ({ ok: false, code: "invalid_state", retryable: false, formError })

// ── 구획 모듈(목 안의 작은 모듈 — launch-factory 의 AdminSection 과 같은 일을 한다) ────────────────────
interface MockSection {
  id: (typeof MOCK_ADMIN_SECTIONS)[number]
  label: string
  confirmActions: readonly string[]
  table(query: AdminTableQuery): AdminTable
  record(id: string): AdminRecord | null
  act(input: Omit<AdminActInput, "section">): ActionResult<AdminActOutcome>
  contribute(): AdminContribution
}

/** 연락처 열(kind "contact")은 서버가 가려서 보낸다: 전화는 앞 3자리·끝 4자리만(010-****-1111), 메일은 첫 글자와 도메인만(k***@example.com) */
export function maskContact(value: string): string {
  const at = value.indexOf("@")
  if (at > 0) return `${value[0]}***${value.slice(at)}`
  const digits = value.replace(/\D/g, "")
  return digits.length >= 8 ? `${digits.slice(0, 3)}-****-${digits.slice(-4)}` : "****"
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
const matches = (cells: readonly (string | number | null)[], query: AdminTableQuery) => {
  const needle = (query.search ?? "").trim().toLowerCase()
  return needle === "" || cells.some((c) => String(c ?? "").toLowerCase().includes(needle))
}
const slice = (rows: AdminRow[], query: AdminTableQuery): { rows: AdminRow[]; total: number } => ({ rows: rows.slice(0, query.limit ?? 100), total: rows.length })

// 주문: 결제 완료 → 준비 중 → 발송. 취소는 결제 완료·준비 중에서만(확인 필요).
type OrderStatus = "결제 완료" | "준비 중" | "발송" | "취소"
interface MockOrder { id: string; customer: string; phone: string; status: OrderStatus; total: number; date: string; memo: string }
const ORDER_NEXT: Partial<Record<OrderStatus, OrderStatus>> = { "결제 완료": "준비 중", "준비 중": "발송" }

function ordersSection(): MockSection {
  const orders: MockOrder[] = [
    { id: "ord-1003", customer: "김예시", phone: "010-0000-1111", status: "결제 완료", total: 32_000, date: "2026-09-30", memo: "" },
    { id: "ord-1002", customer: "이가상", phone: "010-0000-2222", status: "준비 중", total: 18_500, date: "2026-09-29", memo: "선물 포장 요청(예시)" },
    { id: "ord-1001", customer: "박샘플", phone: "010-0000-3333", status: "발송", total: 44_000, date: "2026-09-28", memo: "" },
  ]
  const find = (id: string) => orders.find((o) => o.id === id)
  return {
    id: "orders",
    label: "주문",
    confirmActions: ["cancel"],
    table(query) {
      const rows = orders
        .filter((o) => (query.status ? o.status === query.status : true) && matches([o.id, o.customer, o.status], query))
        .map((o): AdminRow => ({ id: o.id, href: `${BASE}/orders/${o.id}`, cells: { number: o.id, customer: o.customer, phone: maskContact(o.phone), status: o.status, total: o.total, date: o.date } }))
      return {
        columns: [
          { id: "number", label: "주문번호", primary: true, sortable: true },
          { id: "customer", label: "주문자", sortable: true },
          { id: "phone", label: "연락처", kind: "contact", secondary: true },
          { id: "status", label: "상태", kind: "status", filter: true },
          { id: "total", label: "금액", kind: "numeric", sortable: true },
          { id: "date", label: "주문일", kind: "date", sortable: true, secondary: true },
        ],
        ...slice(rows, query),
      }
    },
    record(id) {
      const o = find(id)
      if (!o) return null
      return {
        id: o.id,
        title: `주문 ${o.id}`,
        summary: [
          { label: "주문자", value: o.customer },
          { label: "연락처", value: maskContact(o.phone), kind: "contact" },
          { label: "상태", value: o.status, kind: "status" },
          { label: "금액", value: won(o.total), kind: "numeric" },
          { label: "주문일", value: o.date },
        ],
        fields: [{ name: "memo", label: "운영 메모", type: "textarea", value: o.memo }],
        save: "save",
        actions: ORDER_NEXT[o.status] ? [{ id: "advance", label: `${ORDER_NEXT[o.status]}(으)로 바꾸기` }] : [],
        danger: { id: "cancel", label: "주문 취소" },
      }
    },
    act({ id, action, fields }) {
      const o = find(id)
      if (!o) return deny("not_found", MESSAGES.no_record)
      if (action === "save") {
        const memo = fields?.memo ?? ""
        if (memo.length > MAX_MEMO) return { ok: false, retryable: false, formError: "칸을 다시 확인해 주세요.", fieldErrors: { memo: [`메모는 ${MAX_MEMO}자까지 적을 수 있어요.`] } }
        o.memo = memo
        return { ok: true, data: { message: "저장했어요." } }
      }
      if (action === "advance") {
        const next = ORDER_NEXT[o.status]
        if (!next) return invalidState("더 앞으로 보낼 수 없는 상태예요.")
        o.status = next
        return { ok: true, data: { message: `${next}(으)로 바꿨어요.` } }
      }
      if (action === "cancel") {
        if (o.status !== "결제 완료" && o.status !== "준비 중") return invalidState("이미 발송했거나 취소한 주문은 여기서 취소할 수 없어요.")
        o.status = "취소"
        return { ok: true, data: { message: "주문을 취소했어요." } }
      }
      return deny("invalid_input", MESSAGES.invalid_input)
    },
    contribute() {
      const ready = orders.filter((o) => o.status === "결제 완료").length
      return {
        todo: ready ? [{ id: "orders-to-prepare", severity: "warning", title: `발송 준비할 주문 ${ready}건`, href: `${BASE}/orders`, count: ready }] : [],
        metrics: [{ id: "orders-week", label: "이번 주 주문", value: orders.filter((o) => o.status !== "취소").length, previous: 2, unit: "건", comparePeriod: "지난 7일" }],
      }
    },
  }
}

// 후기: 보임 ↔ 숨김. 숨기기는 확인 필요, 다시 보이기는 바로. 편집 칸이 없는 구획(fields 비어 있음 — 편집 폼을 그리지 않는다).
type ReviewStatus = "보임" | "숨김"
interface MockReview { id: string; author: string; rating: number; status: ReviewStatus; body: string; date: string }

function reviewsSection(): MockSection {
  const reviews: MockReview[] = [
    { id: "rev-2003", author: "김예시", rating: 2, status: "보임", body: "포장이 아쉬웠어요(예시).", date: "2026-09-30" },
    { id: "rev-2002", author: "이가상", rating: 5, status: "보임", body: "아주 만족해요(예시).", date: "2026-09-29" },
    { id: "rev-2001", author: "박샘플", rating: 4, status: "숨김", body: "광고성 글이라 숨겼어요(예시).", date: "2026-09-27" },
  ]
  const find = (id: string) => reviews.find((r) => r.id === id)
  return {
    id: "reviews",
    label: "후기",
    confirmActions: ["hide"],
    table(query) {
      const rows = reviews
        .filter((r) => (query.status ? r.status === query.status : true) && matches([r.id, r.author, r.body, r.status], query))
        .map((r): AdminRow => ({ id: r.id, href: `${BASE}/reviews/${r.id}`, cells: { author: r.author, rating: r.rating, status: r.status, body: r.body, date: r.date } }))
      return {
        columns: [
          { id: "author", label: "작성자", primary: true, sortable: true },
          { id: "rating", label: "별점", kind: "numeric", sortable: true },
          { id: "status", label: "상태", kind: "status", filter: true },
          { id: "body", label: "내용", secondary: true },
          { id: "date", label: "작성일", kind: "date", sortable: true, secondary: true },
        ],
        ...slice(rows, query),
      }
    },
    record(id) {
      const r = find(id)
      if (!r) return null
      return {
        id: r.id,
        title: `${r.author}님의 후기`,
        summary: [
          { label: "별점", value: `${r.rating}점`, kind: "numeric" },
          { label: "상태", value: r.status, kind: "status" },
          { label: "작성일", value: r.date },
          { label: "내용", value: r.body },
        ],
        fields: [],
        actions: r.status === "숨김" ? [{ id: "show", label: "다시 보이기" }] : [],
        ...(r.status === "보임" ? { danger: { id: "hide", label: "후기 숨기기" } } : {}),
      }
    },
    act({ id, action }) {
      const r = find(id)
      if (!r) return deny("not_found", MESSAGES.no_record)
      if (action === "hide") {
        if (r.status === "숨김") return invalidState("이미 숨긴 후기예요.")
        r.status = "숨김"
        return { ok: true, data: { message: "후기를 숨겼어요." } }
      }
      if (action === "show") {
        if (r.status === "보임") return invalidState("이미 보이는 후기예요.")
        r.status = "보임"
        return { ok: true, data: { message: "후기를 다시 보이게 했어요." } }
      }
      return deny("invalid_input", MESSAGES.invalid_input)
    },
    contribute() {
      const low = reviews.filter((r) => r.status === "보임" && r.rating <= 2).length
      return {
        todo: low ? [{ id: "reviews-low", severity: "critical", title: `낮은 별점 후기 ${low}건 확인`, href: `${BASE}/reviews`, count: low }] : [],
        metrics: [{ id: "reviews-week", label: "이번 주 후기", value: reviews.filter((r) => r.status === "보임").length, previous: 1, unit: "건", comparePeriod: "지난 7일" }],
      }
    },
  }
}

const SECTION_ID = /^[a-z][a-z0-9-]{0,31}$/
const idOf = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= MAX_ID ? v.trim() : null)

/**
 * 관리 포트 목. ?admin=admin(기본)·signed-out·forbidden·two-factor-required·impersonation 으로 보는 사람을 고른다 — 관리자가 아니면 모든 메서드가 그 이유(sign_in_required·forbidden·
 * two_factor_required·impersonation_blocked)로 실패한다(sections() 는 forbidden 일 때만 빈 목록, overview 는 넷 모두 실패). 모르는 구획·기록은 not_found 이고 접근 확인보다 앞선다.
 * 읽기(sections·overview·table·record)는 ?state=loading(끝나지 않음)·error(다시 시도할 수 있는 오류)·empty(빈 표)를,
 * 쓰기(act)는 ?submit=ok|field-error|server-error|pending|rate-limited|timeout|approval-required 를 따른다(&delay=<ms> 도). 확인 입력 벽이 ?submit= 결과보다 앞선다.
 * 구획은 주문(결제 완료 → 준비 중 → 발송, 취소는 확인 필요, 편집 칸 = 운영 메모)과 후기(보임 ↔ 숨김, 숨기기는 확인 필요, 편집 칸 없음). 날짜·시각은 MOCK_NOW 기준 고정이다.
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockAdmin(search: string | URLSearchParams, options: PortMockOptions = {}): AdminPort {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const scene = oneOf("admin", q.get("admin") ?? "admin", MOCK_ADMINS)
  const sections: MockSection[] = [ordersSection(), reviewsSection()]
  const denied = scene === "admin" ? null : denial(scene)
  const open = (v: unknown): MockSection | null => {
    const key = typeof v === "string" ? v.trim() : ""
    return (SECTION_ID.test(key) && sections.find((s) => s.id === key)) || null
  }
  const list = (): AdminSectionInfo[] => sections.map((s) => ({ id: s.id, label: s.label, href: `${BASE}/${s.id}` }))
  const notFound = (): Failure => deny("not_found", MESSAGES.not_found)
  const bad = (): Failure => deny("invalid_input", MESSAGES.invalid_input)

  return {
    sections: () => (scene === "forbidden" ? reader(ctx, () => [] as AdminSectionInfo[])() : denied ? Promise.resolve(denied) : reader(ctx, () => copy(list()))()),
    overview: () => {
      if (denied) return Promise.resolve(denied)
      return reader<AdminOverview>(ctx, () => {
        const parts = sections.map((s) => s.contribute())
        const todo = parts.flatMap((p) => p.todo).sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "critical" ? -1 : 1))
        return copy({ asOf: MOCK_NOW, todo, metrics: parts.flatMap((p) => p.metrics), failed: [] })
      }, () => ({ asOf: MOCK_NOW, todo: [], metrics: [], failed: [] }))()
    },
    table: async (input) => {
      const section = open(input?.section)
      if (!section) return notFound()
      if (denied) return denied
      const limit = input.limit
      if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1)) return bad()
      if ((input.search !== undefined && typeof input.search !== "string") || (input.status !== undefined && typeof input.status !== "string")) return bad()
      const query: AdminTableQuery = { ...(input.search ? { search: input.search } : {}), ...(input.status ? { status: input.status } : {}), ...(limit ? { limit: Math.min(limit, 200) } : {}) }
      return reader<AdminTable>(ctx, () => copy(section.table(query)), () => ({ ...copy(section.table({})), rows: [], total: 0 }))()
    },
    record: async (input) => {
      const section = open(input?.section)
      if (!section) return notFound()
      if (denied) return denied
      const id = idOf(input.id)
      if (!id) return bad()
      const found = section.record(id)
      if (!found) return deny("not_found", MESSAGES.no_record)
      return reader<AdminRecord>(ctx, () => copy(section.record(id) as AdminRecord))()
    },
    act: async (input) => {
      const section = open(input?.section)
      if (!section) return notFound()
      if (denied) return denied
      const id = idOf(input.id)
      const action = idOf(input.action)
      if (!id || !action) return bad()
      // 구획에는 입력의 section·여분 칸을 넘기지 않고 쓰는 칸만 넘긴다
      const rest = { id, action, ...(input.fields ? { fields: input.fields } : {}), ...(input.confirmed === true ? { confirmed: true as const } : {}) }
      // 확인 입력 벽: confirmActions 에 든 행동은 confirmed === true 가 아니면 구획을 부르지도 않는다
      if (section.confirmActions.includes(action) && input.confirmed !== true) {
        return { ok: false, code: "confirmation_required", retryable: false, formError: MESSAGES.confirmation_required, fieldErrors: { confirmed: [MESSAGES.confirmation_required] } }
      }
      return writer(ctx, () => section.act(rest))(rest)
    },
  }
}
