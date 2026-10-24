// 구획 작성 쪽 타입과 defineSection(LF 전용). 구획은 선언이다 — 누가 들어오는지(audience)·어떤 행동이 있는지(actions)만 적고,
// 접근 벽·확인 입력 벽·상태 검사·주소·기록은 콘솔이 한 곳에서 한다(console.ts). 구획은 세션을 못 본다: 행위자(AdminActor)는 콘솔만 만든다.
import { DEFAULT_ROWS, MAX_ROWS, SECTION_ID } from "./input.ts"
import type { AdminCell, AdminColumn, AdminFailureCode, AdminMetric, AdminRecordField, AdminRecordSummaryItem } from "./port.ts"

/** 템플릿이 세션과 사용자 행에서 읽어 온 사실 — 판단은 하지 않는다(판단은 admit.ts). 호출당 한 번 읽는다 */
export type AdminIdentity =
  | { kind: "signed_out" }
  | { kind: "impersonating" }
  | { kind: "user"; userId: string; role: string | null; banned: boolean; twoFactor: boolean; verifiedEmail: string | null }

/** 누가 이 구획에 들어오는가: 관리자만, 또는 소유자(확인된 이메일이 같은 사람) 또는 관리자 */
export type Audience = "admin" | { owner: () => string | null | undefined }

declare const ADMITTED: unique symbol // 타입 전용 — 콘솔 밖에서는 행위자를 만들 수 없다
/** 콘솔이 입장시킨 사람. 구획 서비스의 행위자 타입(InquiryActor 등)에 구조적으로 그대로 넘길 수 있다 */
export interface AdminActor {
  readonly userId: string
  readonly role: string | null
  /** 확인된 이메일이 소유자 이메일과 같다 */
  readonly isOwner: boolean
  /** 어떤 자격으로 들어왔는가 — adminOnly 행동은 admin 만 */
  readonly via: "admin" | "owner"
  readonly [ADMITTED]: true
}

const REFUSED: unique symbol = Symbol("admin.refusal")
/** 구획이 값으로 돌려주는 거절. 콘솔이 code 와 문구를 입혀 내보낸다 */
export interface Refusal {
  readonly [REFUSED]: true
  readonly code: AdminFailureCode | (string & {})
  readonly formError?: string
  readonly fieldErrors?: Partial<Record<string, string[]>>
}
export const refuse = (code: Refusal["code"], detail: { formError?: string; fieldErrors?: Refusal["fieldErrors"] } = {}): Refusal => ({ [REFUSED]: true, code, ...detail })
export const isRefusal = (v: unknown): v is Refusal => typeof v === "object" && v !== null && REFUSED in v

/** 행동이 끝난 모양: 아무것도 없음 · 안내 문구 · 거절 */
export type Outcome = void | { message?: string } | Refusal

/**
 * 행동·저장을 부른 요청의 부가 정보. idempotencyKey 는 화면이 폼을 열 때 만든 키다 — 같은 키로 다시 와도(두 번 누름 · 시간 초과 뒤 다시 시도) 한 번만 처리해야 하는 행동
 * (문의 답변처럼 메일이 나가는 쓰기)은 서비스의 멱등 처리에 이 키를 넘긴다. 키가 없으면 undefined.
 */
export interface ActContext {
  idempotencyKey?: string
}

/** 표 질의. status 는 구획이 선언한 statuses 안의 값만 온다(콘솔이 이미 검사) */
export interface ListQuery {
  search?: string
  status?: string
  /** 이 쪽의 줄 수(구획의 pageSize 이하) */
  limit: number
  /** 건너뛸 줄 수 = (쪽 - 1) × limit. 구획의 list 는 이 줄부터 limit 줄을 돌려준다(total 은 거른 전체) */
  offset: number
}

export interface ActionDef<Rec> {
  label: string
  /** 되돌리기 어려운 행동 — confirmed: true 없이는 run 을 부르지 않는다. 구획당 하나까지 */
  danger?: true
  /** 관리자 자격으로 들어온 사람만(소유자는 forbidden, 단추도 안 보인다) */
  adminOnly?: true
  /** 지금 이 기록에서 할 수 있는가(false 면 invalid_state, 단추도 안 보인다). 도착 상태로 이름 짓는다: mark-shipped */
  when?(rec: Rec): boolean
  run(actor: AdminActor, rec: Rec, fields: Record<string, string> | undefined, ctx: ActContext): Promise<Outcome>
}

/** 개요의 할 일 한 줄. 주소는 콘솔이 만든다(status 가 있으면 그 상태로 거른 표) */
export interface TodoDef {
  id: string
  severity: "critical" | "warning"
  title: string
  detail?: string
  count: number
  status?: string
}

export interface SectionDef<C extends string, Row, Rec> {
  /** URL 조각·키 — 소문자·숫자·하이픈 */
  id: string
  /** outcomes.yaml parts 의 부품 이름. 이 부품이 꺼지면 구획도 사라진다 */
  part: string
  label: string
  audience: Audience
  /** 런타임에 이 부품을 쓸 수 있는가(키 있음 등). false 면 provider_unavailable */
  available?(): boolean
  /** 정확히 하나가 primary */
  columns: readonly (AdminColumn & { id: C })[]
  /** 표가 거를 수 있는 상태값. 없으면 상태 거르기를 받지 않는다 */
  statuses?: readonly string[]
  /**
   * list 가 검색어(q.search)를 서버에서 가린 연락처 칸(메일·이름·전화)까지 맞춘다 — 화면이 받은 행을 보이는 칸으로 다시 거르지 않는다.
   * 연락처 칸은 가려서 나가므로(표 칸은 글자 검색 대상이 아니다) 이것이 없으면 이메일로 찾아도 화면이 맞는 행을 지운다. list 가 search 를 실제로 쓰는 구획만 켠다.
   */
  serverSearch?: true
  /** 한 쪽의 줄 수(1~200, 기본 100). list 의 서비스가 한 번에 주는 줄 수가 더 작으면 그 수로 적는다(검토 목록 50 …) — 쪽 이동이 줄을 빠뜨리지 않게 한다 */
  pageSize?: number
  list(actor: AdminActor, q: ListQuery): Promise<{ items: Row[]; total: number } | Refusal>
  key(row: Row): string
  cells(row: Row): Record<C, AdminCell>
  /** 기록 하나. null → not_found */
  load(actor: AdminActor, id: string): Promise<Rec | null | Refusal>
  view(rec: Rec): { title: string; summary: AdminRecordSummaryItem[] }
  /** 편집 폼. 저장 행동 id 는 콘솔이 정한 'save' */
  form?: {
    fields(rec: Rec): AdminRecordField[]
    save(actor: AdminActor, rec: Rec, values: Record<string, string>, ctx: ActContext): Promise<Outcome>
  }
  actions?: Readonly<Record<string, ActionDef<Rec>>>
  overview?(actor: AdminActor): Promise<{ todo?: TodoDef[]; metrics?: AdminMetric[] }>
}

declare const SECTION: unique symbol
/** 정의된 구획 — 안은 콘솔만 연다 */
export interface AdminSection {
  readonly id: string
  readonly part: string
  readonly [SECTION]: true
}

/** 콘솔 안에서 행/기록 타입을 지운 모양 */
export type AnySectionDef = SectionDef<string, unknown, unknown>
const DEFS = new WeakMap<AdminSection, AnySectionDef>()
/** 콘솔이 구획의 선언을 여는 문(index 에서 내보내지 않는다) */
export const definitionOf = (s: AdminSection): AnySectionDef => {
  const def = DEFS.get(s)
  if (!def) throw new Error("admin-console: defineSection 으로 만든 구획만 등록할 수 있다")
  return def
}

/** 이 구획의 한 쪽 줄 수(pageSize 선언, 없으면 기본 100). 등록된 구획이 아니면 기본값 */
export const pageSizeOf = (sections: readonly AdminSection[], id: string): number => {
  const s = sections.find((x) => x.id === id)
  return (s ? DEFS.get(s)?.pageSize : undefined) ?? DEFAULT_ROWS
}

/** 이 구획의 검색을 서버가 하는가(serverSearch 선언). 등록된 구획이 아니면 false */
export const hasServerSearch = (sections: readonly AdminSection[], id: string): boolean => {
  const s = sections.find((x) => x.id === id)
  return s ? DEFS.get(s)?.serverSearch === true : false
}

/** 행동 id: 입력 검사(input.ts)가 받는 길이와 맞춘다. 'save' 는 콘솔이 쓴다 */
export const ACTION_ID = /^[a-z][a-z0-9-]{0,47}$/
export const SAVE_ACTION = "save"
const MAX_STATUS = 32

const bad = (id: string, why: string): never => {
  throw new Error(`admin-console: 구획 '${id}' 정의 오류 — ${why}`)
}

/** 구획을 선언한다. 정의 오류(아이디·primary 열·위험 행동 수·중복·예약 id)는 이 자리에서 던진다 */
export function defineSection<const C extends string, Row, Rec = Row>(def: SectionDef<C, Row, Rec>): AdminSection {
  const id = String(def.id)
  if (!SECTION_ID.test(id)) bad(id, "id 는 소문자로 시작하는 소문자·숫자·하이픈 32자 이하")
  if (typeof def.part !== "string" || def.part === "") bad(id, "part 가 비어 있다")
  if (typeof def.label !== "string" || def.label === "") bad(id, "label 이 비어 있다")
  const aud = def.audience as unknown
  if (aud !== "admin" && !(typeof aud === "object" && aud !== null && typeof (aud as { owner?: unknown }).owner === "function")) bad(id, "audience 는 'admin' 또는 { owner }")
  const cols = def.columns
  if (cols.filter((c) => c.primary).length !== 1) bad(id, "primary 열은 정확히 하나")
  if (new Set(cols.map((c) => c.id)).size !== cols.length) bad(id, "열 id 가 겹친다")
  for (const s of def.statuses ?? []) if (s === "" || s.length > MAX_STATUS) bad(id, `상태값 '${s}' 은 1~${MAX_STATUS}자`)
  const actions = Object.entries(def.actions ?? {})
  for (const [aid] of actions) {
    if (aid === SAVE_ACTION) bad(id, `행동 id '${SAVE_ACTION}' 은 폼 저장이 쓴다`)
    if (!ACTION_ID.test(aid)) bad(id, `행동 id '${aid}' 모양이 틀리다`)
  }
  if (actions.filter(([, a]) => a.danger).length > 1) bad(id, "위험 행동은 하나까지")
  if (def.pageSize !== undefined && (!Number.isInteger(def.pageSize) || def.pageSize < 1 || def.pageSize > MAX_ROWS)) bad(id, `pageSize 는 1~${MAX_ROWS} 정수`)
  const section = { id, part: def.part } as AdminSection
  DEFS.set(section, def as unknown as AnySectionDef)
  return Object.freeze(section)
}
