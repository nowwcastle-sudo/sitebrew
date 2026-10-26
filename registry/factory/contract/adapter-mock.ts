// 목 어댑터(registry:lib "adapter-mock"). QA·렌더 감사가 블록의 7상태를 모두 강제로 그리게 한다(factory-rules.md §20-6).
// 결정적이다 — 같은 인자는 같은 결과(호출마다 새 객체). 타이머는 지연(delayMs·&delay=)을 명시했을 때만 쓴다.
import type { ActionResult, AsyncState } from "@/registry/factory/contract/block-contract"
import type {
  AnalyticsPort,
  Attribution,
  AuthMethod,
  AuthPort,
  BillingPort,
  BookingChange,
  BookingDay,
  BookingLookup,
  BookingPort,
  BookingReceipt,
  BookingRequest,
  BookingStatus,
  ConsentInput,
  ConsentState,
  DeviceSession,
  HumanConfirmation,
  IsoDate,
  ManagedBooking,
  MyRequest,
  MyRequestsPort,
  NewsletterPort,
  NotifyPort,
  Plan,
  PushSubscriptionInput,
  Question,
  RatingSummary,
  RetentionOffer,
  Review,
  ReviewKind,
  ReviewListInput,
  ReviewRating,
  ReviewsPort,
  SearchHit,
  SearchPort,
  Session,
  StorageKind,
  StoragePort,
  Subscription,
  TrackMeta,
  UploadTicket,
} from "@/registry/factory/contract/ports"
import type { EventName, EventProps } from "@/registry/factory/contract/events"
import { retentionOfferIssues } from "@/registry/factory/lib/retention-offer"

export const MOCK_STATES = ["loading", "empty", "error", "ready"] as const
export const MOCK_SUBMITS = ["ok", "field-error", "server-error", "pending", "rate-limited", "timeout", "approval-required"] as const
export type MockStateKind = (typeof MOCK_STATES)[number]
export type MockSubmitOutcome = (typeof MOCK_SUBMITS)[number]
export const MAX_DELAY_MS = 10_000
/** ?submit=rate-limited 가 알리는 기다릴 초(&retryAfter= 로 바꾼다, 1~3600) */
export const DEFAULT_RETRY_AFTER = 30
export const MAX_RETRY_AFTER = 3600

export interface MockStateOptions {
  reason?: string // empty
  message?: string // error
  retry?: () => void // error — 없으면 아무 일도 안 하는 함수(블록이 [다시 시도]를 그리게)
}

export interface MockSubmitOptions {
  fieldErrors?: Partial<Record<string, string[]>> // field-error
  formError?: string // field-error·server-error
  delayMs?: number // 주면 그만큼(0~10000ms) 기다린 뒤 결과를 돌려준다. 기본은 기다리지 않는다
  retryAfter?: number // rate-limited — 다시 보낼 수 있을 때까지 남은 초(1~3600, 기본 30)
}

/**
 * 블록 예시 콘텐츠의 상태 주입 재료(선택 — 예시 모듈이 `export const fixtureStates: FixtureStates<XProps>` 로 낸다, P3-2 Task 1c).
 * data 는 그 블록 props 의 `state: AsyncState<T>` 의 T, receipt 는 `submit: (…) => Promise<ActionResult<R>>` 의 R 로 타입이 잡힌다 —
 * 예시 props 에 없는 칸(receipt 등)을 props 타입 밖에서 받는다. 나머지는 stateFromQuery 의 문구 선택지다.
 */
export type FixtureStates<P> = {
  data?: P extends { state: AsyncState<infer T> } ? T : never
  receipt?: P extends { submit: (input: never) => Promise<ActionResult<infer R>> } ? R : never
  reason?: string
  message?: string
  // error 의 [다시 시도] — 없으면 갤러리가 관찰용 기본값(window.__wfRetried 를 1 올리고 ready 로 다시 그린다)을 쓴다(P3-2 레인 C 0)
  retry?: () => void
  fieldErrors?: Partial<Record<string, string[]>>
  formError?: string
}

const DEFAULT_ERROR ="정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
const DEFAULT_FIELD = { name: ["이 항목을 확인해 주세요."] }
const DEFAULT_FIELD_FORM = "입력한 내용을 다시 확인해 주세요."
const DEFAULT_SERVER = "일시적인 오류로 보내지 못했어요. 잠시 후 다시 시도해 주세요."
const NEED_DATA = 'mock: ready 상태에는 data 가 필요해요 — stateFromQuery(search, { data }) 또는 mockState("ready", data) 로 넘겨 주세요'
const NEED_RECEIPT = 'mock: ok 결과에는 접수 결과(receipt)가 필요해요 — stateFromQuery(search, { receipt }) 또는 mockSubmit("ok", receipt) 로 넘겨 주세요'
const noop = () => {}

function oneOf<K extends string>(key: string, value: string, allowed: readonly K[]): K {
  if ((allowed as readonly string[]).includes(value)) return value as K
  throw new Error(`mock: ${key}=${value} 는 쓸 수 없어요. 허용 값: ${allowed.join("|")}`)
}

const clampDelay = (ms: number) => Math.min(MAX_DELAY_MS, Math.max(0, ms))
const clampRetryAfter = (s: number) => Math.min(MAX_RETRY_AFTER, Math.max(1, Math.round(s)))

/**
 * 읽기 상태 하나. ready 는 data 가 있어야 한다(없으면 멈춘다 — 빈 준비 상태는 블록을 조용히 깨뜨린다).
 * error 의 retry 는 함수다 — 서버 컴포넌트에서 만든 상태는 클라이언트 블록으로 props 로 넘길 수 없으니 클라이언트 쪽에서 만든다.
 */
export function mockState<T>(kind: MockStateKind, data?: T, options: MockStateOptions = {}): AsyncState<T> {
  switch (oneOf("state", kind, MOCK_STATES)) {
    case "loading":
      return { status: "loading" }
    case "empty":
      return options.reason === undefined ? { status: "empty" } : { status: "empty", reason: options.reason }
    case "error":
      return { status: "error", message: options.message ?? DEFAULT_ERROR, retry: options.retry ?? noop }
    case "ready":
      if (data === undefined) throw new Error(NEED_DATA)
      return { status: "ready", data }
  }
}

/**
 * 제출 결과 하나를 돌려주는 포트 함수. 입력은 받지만 보지 않는다(결과는 outcome 이 정한다).
 * ok 는 data(접수 결과)가 있어야 한다. pending 은 끝나지 않는 약속(제출 중 화면 고정)이다.
 * rate-limited 는 { code: "rate_limited", retryAfter } 실패(문구는 남은 초가 든 고정 해요체 — formError 옵션은 적용하지 않는다)(계약 판 2 — 대장 A101·D136), timeout 은 pending 처럼 끝나지 않는다(서버가 답하지 않는 상황 —
 * 폼이 15초 뒤 스스로 「응답이 늦어요」를 그린다).
 * 포트는 함수라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockSubmit<T>(outcome: MockSubmitOutcome, data?: T, options: MockSubmitOptions = {}): () => Promise<ActionResult<T>> {
  const kind = oneOf("submit", outcome, MOCK_SUBMITS)
  if (kind === "ok" && data === undefined) throw new Error(NEED_RECEIPT)
  if (kind === "pending" || kind === "timeout") return () => new Promise<never>(noop)
  const retryAfter = clampRetryAfter(options.retryAfter ?? DEFAULT_RETRY_AFTER)
  const make = (): ActionResult<T> => {
    if (kind === "ok") return { ok: true, data: data as T }
    // 사람 승인이 필요한 행동을 확인 없이 불렀다(R20·R21) — 실패가 아니라 「승인 대기」, 다시 시도하지 않는다
    if (kind === "approval-required") return { ok: false, code: "confirmation_required", retryable: false, formError: "이 변경은 사람이 내용을 확인하고 직접 눌러야 해요. 아직 아무것도 바뀌지 않았어요." }
    if (kind === "rate-limited") return { ok: false, code: "rate_limited", retryAfter, retryable: true, formError: `요청이 너무 많아요. ${retryAfter}초 뒤에 다시 시도해 주세요.` }
    if (kind === "field-error")
      return { ok: false, formError: options.formError ?? DEFAULT_FIELD_FORM, fieldErrors: structuredClone(options.fieldErrors ?? DEFAULT_FIELD) }
    return { ok: false, formError: options.formError ?? DEFAULT_SERVER, retryable: true }
  }
  const delay = clampDelay(options.delayMs ?? 0)
  return async () => {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    return make()
  }
}

/**
 * 쿼리로 7상태를 강제한다. 입력은 "?a=b"·"a=b"·전체 URL·URLSearchParams.
 *   로딩 ?state=loading · 빈 값 ?state=empty · 오류 ?state=error · 준비 ?state=ready
 *   제출 성공 &submit=ok · 검증 실패 &submit=field-error · 서버 오류 &submit=server-error
 *   (덧붙여) 제출 중 &submit=pending(끝나지 않음) 또는 &delay=<ms>(0~10000, 그만큼 뒤에 결과)
 *   승인 대기 &submit=approval-required(code confirmation_required · retryable false — 블록이 오류 색이 아닌 「직접 확인해 주세요」 알림으로 보인다, P3-7 AXWF·AXC. 옛 이름 approval_required 와 같은 뜻) ·
 *   요청 제한 &submit=rate-limited(&retryAfter=<초>, 기본 30) · 시간 초과 &submit=timeout(pending 처럼 끝나지 않는다 — 폼이 15초 뒤에 스스로 알린다)
 * state 가 없으면 fixtures.data 가 있을 때 ready, 없을 때 empty. submit 이 없으면 ok(receipt 가 필요 — 없으면 submit() 이 알려 준다).
 * 돌려주는 submit·retry 는 함수라 서버 컴포넌트에서 클라이언트 블록으로 넘길 수 없다 — 클라이언트 쪽(useSearchParams 등)에서 부른다.
 */
export function stateFromQuery<T, R = unknown>(
  search: string | URLSearchParams,
  fixtures: { data?: T; receipt?: R } & MockStateOptions & MockSubmitOptions = {},
): { state: AsyncState<T>; submit: () => Promise<ActionResult<R>> } {
  const q = toParams(search)
  const state = oneOf("state", q.get("state") ?? (fixtures.data !== undefined ? "ready" : "empty"), MOCK_STATES)
  const outcome = oneOf("submit", q.get("submit") ?? "ok", MOCK_SUBMITS)
  const delayMs = readDelay(q, fixtures.delayMs)
  const retryAfter = readRetryAfter(q, fixtures.retryAfter)
  // 제출 함수는 부를 때 만든다 — 읽기 전용 블록은 receipt 없이도 쓸 수 있고, ok 에 receipt 가 없으면 submit() 이 한국어 오류로 거부한다.
  const submit = async () => mockSubmit(outcome, fixtures.receipt, { ...fixtures, delayMs, retryAfter })()
  return { state: mockState(state, fixtures.data, fixtures), submit }
}

function toParams(search: string | URLSearchParams): URLSearchParams {
  return new URLSearchParams(typeof search === "string" && search.includes("://") ? new URL(search).search : search)
}

function readRetryAfter(q: URLSearchParams, fallback?: number): number | undefined {
  const raw = q.get("retryAfter")
  if (raw === null) return fallback
  const n = Number(raw)
  if (raw.trim() === "" || !Number.isFinite(n)) throw new Error(`mock: retryAfter=${raw} 는 쓸 수 없어요. 1~${MAX_RETRY_AFTER} 사이의 초를 주세요`)
  return clampRetryAfter(n)
}

function readDelay(q: URLSearchParams, fallback?: number): number | undefined {
  const raw = q.get("delay")
  if (raw === null) return fallback
  const n = Number(raw)
  if (raw.trim() === "" || !Number.isFinite(n)) throw new Error(`mock: delay=${raw} 는 쓸 수 없어요. 0~${MAX_DELAY_MS} 사이의 밀리초를 주세요`)
  return clampDelay(n)
}

// ── 기능 포트 목(P3-2 Task 10) ───────────────────────────────────────────
// 포트마다 쿼리 하나로 처음 상태를 고른다: 결제 ?sub= · 인증 ?auth= · 계측·알림 ?consent=. 공통으로
//   읽기 메서드(plans·subscription·session·methods·consents)는 ?state=loading(끝나지 않음)·error(다시 시도할 수 있는 오류)·empty(빈 값)를,
//   쓰기 메서드는 ?submit=ok|field-error|server-error|pending 을, 둘 다 &delay=<ms> 를 따른다.
// 인스턴스는 상태를 가진다 — cancel 뒤의 subscription() 은 해지가 예약된 구독이다(흐름 블록이 결과 화면까지 그린다).
// 같은 쿼리로 새로 만들면 같은 처음 상태다. 날짜는 고정값이라 스크린샷이 흔들리지 않는다.

export const MOCK_SUBS = ["none", "trialing", "active", "past_due", "paused", "canceled", "expired"] as const
/** 상태 7개 밖의 ?sub= 장면(Task 10b): pending-price-change — 동의를 기다리는 가격 인상이 있는 active 구독(L6) */
export const MOCK_SUB_SCENARIOS = ["pending-price-change"] as const
export const MOCK_AUTHS = ["signed-out", "signed-in", "two-factor"] as const
export const MOCK_CONSENTS = ["unset", "denied", "analytics", "all"] as const
export type MockSub = (typeof MOCK_SUBS)[number]
export type MockSubScenario = (typeof MOCK_SUB_SCENARIOS)[number]
export type MockAuth = (typeof MOCK_AUTHS)[number]
export type MockConsent = (typeof MOCK_CONSENTS)[number]
/** ?booking= 장면(예약 포트): open 은 모든 칸이 열려 있고, full 은 모든 칸이 마감이라 book 이 slot_taken 이다 */
export const MOCK_BOOKINGS = ["open", "full"] as const
export type MockBookingScenario = (typeof MOCK_BOOKINGS)[number]

/** 목이 「지금」으로 쓰는 고정 시각(동의 결정·수신 동의 변경·즉시 해지) */
export const MOCK_NOW: IsoDate = "2026-10-01T00:00:00.000Z"
const PERIOD_END: IsoDate = "2026-10-31T15:00:00.000Z"
const TRIAL_END: IsoDate = "2026-10-14T15:00:00.000Z"
const RETRY_AT: IsoDate = "2026-10-03T15:00:00.000Z"
const PAUSED_UNTIL: IsoDate = "2026-11-30T15:00:00.000Z"
const ENDED: IsoDate = "2026-09-30T15:00:00.000Z"

const won = (amount: number) => ({ amount, currency: "KRW" as const, vatIncluded: true })

/** 예시 요금제(원화, 부가세 포함). 이름에 「예시」 표시 */
export const MOCK_PLANS: readonly Plan[] = [
  { id: "basic", name: "베이직(예시)", price: won(9_900), interval: "month", features: ["프로젝트 3개", "기본 보고서"], limits: { projects: 3 } },
  { id: "pro", name: "프로(예시)", price: won(29_000), interval: "month", trialDays: 14, recommended: true, features: ["프로젝트 20개", "고급 보고서", "우선 지원"], limits: { projects: 20 } },
  { id: "team", name: "팀(예시)", price: won(99_000), interval: "month", features: ["프로젝트 무제한", "구성원 10명", "관리자 권한"], limits: { projects: 1000 } },
]

const SUBSCRIPTIONS: Record<MockSub, Subscription> = {
  none: { planId: null, status: "none" },
  trialing: { planId: "pro", status: "trialing", trialEnd: TRIAL_END, currentPeriodEnd: TRIAL_END, usage: { projects: { used: 2, limit: 20 } } },
  active: { planId: "pro", status: "active", currentPeriodEnd: PERIOD_END, usage: { projects: { used: 12, limit: 20 } } },
  past_due: { planId: "pro", status: "past_due", currentPeriodEnd: PERIOD_END, paymentIssue: { reason: "card_declined", retryAt: RETRY_AT } },
  paused: { planId: "pro", status: "paused", pausedUntil: PAUSED_UNTIL },
  canceled: { planId: "pro", status: "canceled", cancelAt: ENDED },
  expired: { planId: "pro", status: "expired", currentPeriodEnd: ENDED },
}
// 가격 변경 장면: 새 가격은 다음 갱신일(한국 시각 10월 31일 0시)에 적용 — 목의 「지금」에서 30일 안(L6 청구 30일 전 안에 묻는다)
const PRICE_CHANGE_AT: IsoDate = "2026-10-30T15:00:00.000Z"
const CONSENT_BY: IsoDate = "2026-10-23T15:00:00.000Z"
const SCENARIOS: Record<MockSubScenario, Subscription> = {
  "pending-price-change": {
    ...SUBSCRIPTIONS.active,
    currentPeriodEnd: PRICE_CHANGE_AT,
    pendingPriceChange: { from: won(29_000), to: won(33_000), effectiveAt: PRICE_CHANGE_AT, consentBy: CONSENT_BY, kind: "price_increase" },
  },
}
const SUB_QUERIES = [...MOCK_SUBS, ...MOCK_SUB_SCENARIOS] as const
const subOf = (k: (typeof SUB_QUERIES)[number]): Subscription => (k in SCENARIOS ? SCENARIOS[k as MockSubScenario] : SUBSCRIPTIONS[k as MockSub])

/** 예시 해지 대안(R2 순서: 일시정지 → 다운그레이드 → 할인, 할인은 30%·3개월 — lib retention-offer 한도 안) */
export const MOCK_RETENTION_OFFERS: readonly RetentionOffer[] = [
  { id: "pause-1m", kind: "pause", pauseMonths: 1 },
  { id: "downgrade-basic", kind: "downgrade", planId: "basic" },
  { id: "discount-30-3m", kind: "discount", discount: { percent: 30, months: 3 } },
]
function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = new Date(iso)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString()
}

/** 예시 로그인 사용자(가상 이름·example.com) */
export const MOCK_SESSION: Session = { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false }
/** mockAuth.resetPassword 가 받는 가상 재설정 토큰(D236) — 한 번만 쓰인다. 이 밖의 토큰은 모두 틀린 것으로 보고 code "invalid_token" 으로 거절한다 */
export const MOCK_RESET_TOKEN = "mock-reset-token"
const MOCK_METHODS: readonly AuthMethod[] = ["password", "kakao", "naver", "google"]
/** 예시 로그인 기기 목록(가상 기기·문서용 IP 대역) — 첫 줄이 이 기기다 */
export const MOCK_DEVICES: readonly DeviceSession[] = [
  { id: "device-current", current: true, device: "Chrome · Windows", ip: "203.0.113.*", createdAt: "2026-09-28T00:00:00.000Z", lastActiveAt: "2026-10-01T00:00:00.000Z", expiresAt: "2026-10-28T00:00:00.000Z" },
  { id: "device-phone", current: false, device: "Safari · iPhone", ip: "198.51.100.*", createdAt: "2026-09-20T00:00:00.000Z", lastActiveAt: "2026-09-29T00:00:00.000Z", expiresAt: "2026-10-20T00:00:00.000Z" },
]
const TOTP_URI = "otpauth://totp/Example:kim%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
const BACKUP_CODES = ["1111-2222", "3333-4444", "5555-6666", "7777-8888", "9999-0000", "1234-5678", "8765-4321", "0246-1357"]
const GRACE_UNTIL: IsoDate = "2026-10-08T00:00:00.000Z"
const NEED_LOGIN = "로그인이 필요해요. 다시 로그인해 주세요."
const NEED_AGE = { ageOver14: ["만 14세 이상인지 확인해 주세요(필수)."] }
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 포트 목 공통 선택지: 읽기 오류 문구(message), 쓰기 결과 문구(fieldErrors·formError), 지연(delayMs — &delay= 가 이긴다) */
export type PortMockOptions = Pick<MockStateOptions, "message"> & MockSubmitOptions

interface PortCtx {
  state: MockStateKind | null
  outcome: MockSubmitOutcome
  delay: number
  retryAfter: number | undefined
  opts: PortMockOptions
}

function portCtx(q: URLSearchParams, opts: PortMockOptions): PortCtx {
  const s = q.get("state")
  return {
    state: s === null ? null : oneOf("state", s, MOCK_STATES),
    outcome: oneOf("submit", q.get("submit") ?? "ok", MOCK_SUBMITS),
    delay: clampDelay(readDelay(q, opts.delayMs) ?? 0),
    retryAfter: readRetryAfter(q, opts.retryAfter),
    opts,
  }
}

const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : undefined)
function copy<T>(v: T): T {
  return structuredClone(v)
}
function omit<T extends object, K extends keyof T>(v: T, ...keys: K[]): Omit<T, K> {
  const out = { ...v }
  for (const k of keys) delete out[k]
  return out
}
// 실패 쪽 모양은 성공 데이터 타입과 무관하다 — 어느 ActionResult<T> 에도 들어간다(추론이 never 로 좁혀지지 않게).
type Failure = Extract<ActionResult<unknown>, { ok: false }>
const fail = (formError: string, fieldErrors?: Partial<Record<string, string[]>>): Failure =>
  fieldErrors ? { ok: false, formError, fieldErrors } : { ok: false, formError }

// 승인 행동 확인 입력(P3-7 AXC — launch-factory LFAX 와 같은 모양). options.requireConfirmation 이면 포트의 승인 행동 메서드가 `confirmed: true` 없이는 상태를 건드리지 않고
// { code: "confirmation_required", retryable: false, fieldErrors.confirmed } 로 끝난다 — 오류가 아니라 승인 대기다. 확인 검사가 ?submit= 결과보다 앞선다(지연도 없다).
const NEED_CONFIRM = "이 변경은 사람이 내용을 확인해야 해요. 확인했다는 표시(confirmed: true)와 함께 다시 보내 주세요. 아직 아무것도 바뀌지 않았어요."
const NEED_CONFIRM_EMAIL = "입력한 이메일 주소가 지금 로그인한 주소와 달라요. 아직 아무것도 바뀌지 않았어요."
const confirmationRequired = (formError = NEED_CONFIRM, field = "confirmed"): Failure => ({ ok: false, code: "confirmation_required", retryable: false, formError, fieldErrors: { [field]: [formError] } })
/** 확인 입력(confirmed === true — 문자열·1 은 받지 않는다)이 없으면 fn 을 부르지 않고 승인 대기로 끝내는 포트 메서드로 감싼다 */
const needsConfirmation =
  <A extends HumanConfirmation | undefined, T>(fn: (input: A) => Promise<ActionResult<T>>): ((input: A) => Promise<ActionResult<T>>) =>
  async (input) =>
    input?.confirmed === true ? fn(input) : confirmationRequired()

// 읽기: loading 은 끝나지 않고, error 는 다시 시도할 수 있는 오류, empty 는 빈 값(주면), 나머지는 make().
function reader<T>(ctx: PortCtx, make: () => T, empty?: () => T): () => Promise<ActionResult<T>> {
  return async () => {
    if (ctx.state === "loading") return new Promise<never>(noop)
    await wait(ctx.delay)
    if (ctx.state === "error") return { ok: false, formError: ctx.opts.message ?? DEFAULT_ERROR, retryable: true }
    return { ok: true, data: ctx.state === "empty" && empty ? empty() : make() }
  }
}

// 쓰기: ?submit= 이 ok 가 아니면 상태를 건드리지 않고 그 결과(mockSubmit 과 같은 모양), ok 면 apply 가 상태를 바꾸고 결과를 낸다.
function writer<I, T>(ctx: PortCtx, apply: (input: I) => ActionResult<T>): (input: I) => Promise<ActionResult<T>> {
  return async (input) => {
    if (ctx.outcome !== "ok") return mockSubmit<T>(ctx.outcome, undefined, { ...ctx.opts, delayMs: ctx.delay, retryAfter: ctx.retryAfter })()
    await wait(ctx.delay)
    return apply(input)
  }
}

const NO_PLAN = "선택한 요금제를 찾지 못했어요. 요금제를 다시 선택해 주세요."
const NO_SUB = "이용 중인 구독이 없어요."
const NO_PRICE_CHANGE = "동의할 가격 변경이 없어요."
const NO_OFFER = "선택한 혜택을 찾지 못했어요. 다시 선택해 주세요."
const NO_TRIAL = "이 요금제는 무료 체험이 없어요. 체험 없이 시작하거나 다른 요금제를 골라 주세요."
const NEED_WITHDRAWAL = { withdrawalConsent: ["청약철회 제한 안내를 확인하고 동의해 주세요."] }
const UNSUPPORTED = "이 결제 서비스에서는 여기서 바꿀 수 없어요. 결제 서비스 화면에서 직접 바꿔 주세요."
/** provider_unsupported·scenario_unsupported 로 끝낼 수 있는 결제 메서드(공급자가 API 로 할 수 없는 동작 — 대장 D160) */
export const MOCK_UNSUPPORTED_METHODS = ["changePlan", "cancel", "pause", "resume", "updatePaymentMethod", "acceptPriceChange", "applyRetentionOffer"] as const
export type MockUnsupportedMethod = (typeof MOCK_UNSUPPORTED_METHODS)[number]

/**
 * 결제 포트 목. ?sub= 로 구독 상태 7개(none·trialing·active·past_due·paused·canceled·expired, 기본 none)나
 * 장면 pending-price-change(동의를 기다리는 가격 인상이 있는 active — L6)를 고른다.
 * checkout 은 trial 을 주면 그대로(true → trialing, false → active — P13 체험 켬/끔. 체험 기간 없는 요금제에 true 면 code "trial_unavailable" 실패), 주지 않으면 체험 기간이 있는 요금제면 trialing, 아니면 active 로 바꾼다. cancel period_end 는 cancelAt 만 붙이고(그때까지 이용),
 * now 는 canceled. changePlan period_end 는 scheduledPlanId 로 예약한다. resume 은 일시정지와 예약된 해지를 함께 거둔다.
 * acceptPriceChange 는 pendingPriceChange 를 거둔다. applyRetentionOffer 는 대안(options.retentionOffers, 기본 MOCK_RETENTION_OFFERS)을
 * 적용하고 예약된 해지를 거둔다 — 대안은 만들 때 lib retention-offer 한도(할인 30% 이하·2~3개월)로 검사해 틀리면 바로 멈춘다.
 * 계약 판 2 안의 추가(P3-2 Task 10d): options.requireWithdrawalConsent 면 checkout 이 withdrawalConsent: true 없이는 fieldErrors.withdrawalConsent 로 거절한다
 * (launch-factory 의 withWithdrawalConsent 와 같은 동작 — 청약철회 체크를 빠뜨린 블록을 갤러리가 잡는다). portal 은 redirectUrl·paymentMethodUrl 을 돌려준다.
 * 계약 판 2 안의 추가(P3-7 AXC): options.requireConfirmation 이면 승인 행동(changePlan·cancel·applyRetentionOffer·acceptPriceChange)이 `confirmed: true` 없이는 구독을 바꾸지 않고
 * `{ code: "confirmation_required", retryable: false, fieldErrors.confirmed }` 로 끝난다(launch-factory 의 confirmedBillingActions 와 같은 동작 — 확인 단계 뒤에 confirmed 를 싣지 않은 블록을 갤러리가 잡는다).
 * options.unsupported 는 메서드마다 provider_unsupported(공급자 API 가 없음)·scenario_unsupported(그 상태 자체가 없음)로 끝내고 manageUrl 을 싣는다 — 지원 안 함은 오류가 아니라 정해진 결과다.
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockBilling(
  search: string | URLSearchParams,
  options: PortMockOptions & {
    plans?: readonly Plan[]
    subscription?: Partial<Subscription>
    redirectUrl?: string
    retentionOffers?: readonly RetentionOffer[]
    requireWithdrawalConsent?: boolean
    requireConfirmation?: boolean
    unsupported?: Partial<Record<MockUnsupportedMethod, "provider_unsupported" | "scenario_unsupported">>
    manageUrl?: string
    portalUrl?: string
  } = {},
): Required<BillingPort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const plans = options.plans ?? MOCK_PLANS
  const offers = options.retentionOffers ?? MOCK_RETENTION_OFFERS
  const issues = offers.flatMap((o) => retentionOfferIssues(o))
  if (issues.length) throw new Error(`mock: ${issues.join(" ")}`)
  let sub: Subscription = { ...copy(subOf(oneOf("sub", q.get("sub") ?? "none", SUB_QUERIES))), ...copy(options.subscription ?? {}) }
  const find = (id: string) => plans.find((p) => p.id === id)
  const set = (next: Subscription): ActionResult<Subscription> => {
    sub = next
    return { ok: true, data: copy(sub) }
  }
  const port: Required<BillingPort> = {
    plans: reader(ctx, () => copy([...plans]), () => []),
    subscription: reader(ctx, () => copy(sub), () => copy(SUBSCRIPTIONS.none)),
    checkout: writer(ctx, ({ planId, trial, withdrawalConsent }: { planId: string; trial?: boolean; withdrawalConsent?: true }) => {
      if (options.requireWithdrawalConsent && withdrawalConsent !== true) return fail(NEED_WITHDRAWAL.withdrawalConsent[0], NEED_WITHDRAWAL)
      const plan = find(planId)
      if (!plan) return fail(NO_PLAN)
      if (trial === true && !plan.trialDays) return { ...fail(NO_TRIAL), code: "trial_unavailable", retryable: false }
      const next: Subscription = (trial ?? Boolean(plan.trialDays))
        ? { planId, status: "trialing", trialEnd: TRIAL_END, currentPeriodEnd: TRIAL_END }
        : { planId, status: "active", currentPeriodEnd: PERIOD_END }
      sub = next
      return { ok: true, data: { subscription: copy(sub) } }
    }),
    changePlan: writer(ctx, ({ planId, when }: { planId: string; when: "now" | "period_end" } & HumanConfirmation) => {
      if (!find(planId)) return fail(NO_PLAN)
      if (sub.planId === null) return fail(NO_SUB)
      const rest = omit(sub, "scheduledPlanId")
      return set(when === "now" ? { ...rest, planId } : { ...rest, scheduledPlanId: planId })
    }),
    cancel: writer(ctx, ({ when }: { when: "period_end" | "now" } & HumanConfirmation) => {
      if (sub.planId === null || sub.status === "none") return fail(NO_SUB)
      return when === "now"
        ? set({ planId: sub.planId, status: "canceled", cancelAt: MOCK_NOW })
        : set({ ...sub, cancelAt: sub.currentPeriodEnd ?? sub.trialEnd ?? PERIOD_END })
    }),
    pause: writer(ctx, ({ until }: { until: IsoDate }) => {
      if (sub.planId === null || sub.status === "none") return fail(NO_SUB)
      return set({ planId: sub.planId, status: "paused", pausedUntil: until })
    }),
    resume: writer<void, Subscription>(ctx, () => {
      if (sub.planId === null || sub.status === "none") return fail(NO_SUB)
      const rest = omit(sub, "pausedUntil", "cancelAt")
      return set({ ...rest, status: "active", currentPeriodEnd: rest.currentPeriodEnd ?? PERIOD_END })
    }),
    updatePaymentMethod: writer<void, { redirectUrl: string }>(ctx, () => ({ ok: true, data: { redirectUrl: options.redirectUrl ?? "#mock-update-payment-method" } })),
    acceptPriceChange: writer<HumanConfirmation | undefined, Subscription>(ctx, () => {
      if (!sub.pendingPriceChange) return fail(NO_PRICE_CHANGE)
      return set(omit(sub, "pendingPriceChange"))
    }),
    applyRetentionOffer: writer(ctx, ({ offerId }: { offerId: string } & HumanConfirmation) => {
      if (sub.planId === null || sub.status === "none") return fail(NO_SUB)
      const offer = offers.find((o) => o.id === offerId)
      if (!offer) return fail(NO_OFFER)
      const rest = omit(sub, "cancelAt")
      if (offer.kind === "pause") return set({ planId: sub.planId, status: "paused", pausedUntil: addMonths(MOCK_NOW, offer.pauseMonths ?? 1) })
      if (offer.kind === "downgrade") return offer.planId && find(offer.planId) ? set({ ...rest, scheduledPlanId: offer.planId }) : fail(NO_PLAN)
      return set(rest)
    }),
    portal: writer<void, { redirectUrl: string; paymentMethodUrl?: string }>(ctx, () => ({
      ok: true,
      data: { redirectUrl: options.portalUrl ?? "#mock-billing-portal", paymentMethodUrl: `${options.portalUrl ?? "#mock-billing-portal"}-payment-method` },
    })),
  }
  // ?unsupported=cancel,pause — 그 메서드들이 provider_unsupported 로 끝난다(갤러리·브라우저 검사용, manageUrl 은 options 가 없으면 예시 주소)
  const fromQuery = (q.get("unsupported") ?? "").split(",").map((m) => m.trim()).filter(Boolean)
  const unsupported = { ...Object.fromEntries(fromQuery.map((m) => [m, "provider_unsupported"])), ...options.unsupported } as Partial<Record<MockUnsupportedMethod, "provider_unsupported" | "scenario_unsupported">>
  const manageUrl = options.manageUrl ?? (fromQuery.length ? "https://example.com/manage" : undefined)
  for (const [method, code] of Object.entries(unsupported) as [MockUnsupportedMethod, "provider_unsupported" | "scenario_unsupported"][]) {
    if (!MOCK_UNSUPPORTED_METHODS.includes(method)) throw new Error(`mock: unsupported.${method} 는 쓸 수 없어요. 허용 값: ${MOCK_UNSUPPORTED_METHODS.join("|")}`)
    ;(port as unknown as Record<string, unknown>)[method] = async (): Promise<Failure> => ({
      ok: false,
      code,
      retryable: false,
      formError: UNSUPPORTED,
      ...(manageUrl ? { manageUrl } : {}),
    })
  }
  // 확인 입력 요구(P3-2 AXC) — 지원 안 함 덮어쓰기 뒤에 감싼다(확인 없이는 지원 여부도 알리지 않고 승인 대기로 끝난다)
  if (options.requireConfirmation) {
    port.changePlan = needsConfirmation(port.changePlan)
    port.cancel = needsConfirmation(port.cancel)
    port.applyRetentionOffer = needsConfirmation(port.applyRetentionOffer)
    port.acceptPriceChange = needsConfirmation(port.acceptPriceChange)
  }
  return port
}

const NEED_EMAIL = { email: ["이메일 주소를 입력해 주세요."] }
const NEED_PASSWORD = { password: ["비밀번호를 입력해 주세요."] }
const SOCIAL = new Set<AuthMethod>(["kakao", "naver", "google"])

/**
 * 인증 포트 목. ?auth=signed-out(기본)·signed-in·two-factor. two-factor 는 비밀번호 로그인이 needsTwoFactor 를 돌려주고,
 * 6자리 코드(백업 코드는 아무 글자)를 verifyTwoFactor 에 주면 2단계 세션이 열린다. 소셜은 redirectUrl("#mock-oauth-<공급자>"),
 * magic-link 는 emailSent. signUp 은 필수 동의(terms·privacy)가 true 가 아니면 필드 오류다(타입을 건너뛰는 JS 호출도 막는다).
 * 계약 판 2 안의 추가(P3-2 Task 10d): signIn 은 rememberMe·redirectTo(→ data.redirectUrl)를 받고, options.requireAgeOver14 면 signUp 이 consents.ageOver14: true 없이는
 * fieldErrors.ageOver14 로 거절한다(launch-factory 기본과 같다 — 만 14세 체크를 빠뜨린 블록을 갤러리가 잡는다). 2단계 켜기(enableTwoFactor → 첫 코드 verifyTwoFactor → 켜짐)·끄기,
 * 재설정 마무리 resetPassword(D236)는 가상 토큰 MOCK_RESET_TOKEN 만 한 번 받는다(그 밖은 code invalid_token). 로그인 상태와 상관없다(메일 링크로 들어온 손님).
 * 계약 판 2 안의 추가(P3-7 AXC): options.requireConfirmation 이면 승인 행동(changeEmail·deleteAccount·exportMyData)이 `confirmed: true` 없이는 아무것도 바꾸지 않고(세션·계정 그대로)
 * `{ code: "confirmation_required", retryable: false, fieldErrors.confirmed }` 로 끝난다 — 로그인 확인이 먼저다. 탈퇴는 `confirmEmail` 을 주면 로그인한 주소와 같아야 한다(앞뒤 공백·대소문자 무시, 틀리면 fieldErrors.confirmEmail).
 * 비밀번호·이메일 변경, 기기 목록·끊기(?state= 로 읽기 4상태), 탈퇴(유예)·내 정보 내려받기는 로그인한 상태(?auth=signed-in)에서 동작하고 아니면 formError 다.
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockAuth(
  search: string | URLSearchParams,
  options: PortMockOptions & { methods?: readonly AuthMethod[]; session?: Session; requireAgeOver14?: boolean; requireConfirmation?: boolean } = {},
): Required<AuthPort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const mode = oneOf("auth", q.get("auth") ?? "signed-out", MOCK_AUTHS)
  const user = options.session ?? MOCK_SESSION
  let session: Session | null = mode === "signed-in" ? copy(user) : null
  let challenge = false
  let enabling = false
  let devices: DeviceSession[] = copy([...MOCK_DEVICES])
  const usedResetTokens = new Set<string>()
  const account =<T,>(body: () => ActionResult<T>): ActionResult<T> => (session ? body() : fail(NEED_LOGIN))
  const listDevices = reader(ctx, () => copy(devices), () => [])
  // 새 가입자는 아직 2단계를 켜지 않았다 — signUp 은 two-factor 모드에서도 바로 세션을 연다(signIn 만 코드를 묻는다).
  const start = (method: AuthMethod, email: string | undefined, password: string | undefined, askCode: boolean): ActionResult<{ redirectUrl?: string; needsTwoFactor?: boolean; emailSent?: boolean }> => {
    if (SOCIAL.has(method)) return { ok: true, data: { redirectUrl: `#mock-oauth-${method}` } }
    if (!email) return fail("입력한 내용을 다시 확인해 주세요.", NEED_EMAIL)
    if (method === "magic-link") return { ok: true, data: { emailSent: true } }
    if (!password) return fail("입력한 내용을 다시 확인해 주세요.", NEED_PASSWORD)
    if (askCode && mode === "two-factor") {
      challenge = true
      return { ok: true, data: { needsTwoFactor: true } }
    }
    session = copy(user)
    return { ok: true, data: {} }
  }
  const withRedirect = <T extends { redirectUrl?: string }>(r: ActionResult<T>, redirectTo?: string): ActionResult<T> =>
    r.ok && redirectTo && !r.data.redirectUrl && !(r.data as { needsTwoFactor?: boolean }).needsTwoFactor ? { ok: true, data: { ...r.data, redirectUrl: redirectTo } } : r
  const port: Required<AuthPort> = {
    session: reader(ctx, () => (session ? copy(session) : null), () => null),
    methods: reader(ctx, () => [...(options.methods ?? MOCK_METHODS)], () => []),
    signIn: writer(ctx, ({ method, email, password, redirectTo }: Parameters<AuthPort["signIn"]>[0]) => withRedirect(start(method, email, password, true), redirectTo)),
    signUp: writer(ctx, (input: Parameters<AuthPort["signUp"]>[0]) => {
      const c = (input.consents ?? {}) as Partial<Record<"terms" | "privacy" | "ageOver14", unknown>>
      const missing: Partial<Record<string, string[]>> = {}
      if (c.terms !== true) missing.terms = ["이용약관에 동의해 주세요(필수)."]
      if (c.privacy !== true) missing.privacy = ["개인정보 수집·이용에 동의해 주세요(필수)."]
      if (options.requireAgeOver14 && c.ageOver14 !== true) missing.ageOver14 = NEED_AGE.ageOver14
      if (Object.keys(missing).length) return fail("필수 동의 항목을 확인해 주세요.", missing)
      const r = start(input.method, input.email, input.password, false)
      if (!r.ok) return r
      const { redirectUrl, emailSent } = r.data
      return withRedirect({ ok: true, data: { ...(redirectUrl && { redirectUrl }), ...(emailSent && { emailSent }) } }, input.redirectTo)
    }),
    verifyTwoFactor: writer(ctx, ({ code, method = "totp", redirectTo }: Parameters<AuthPort["verifyTwoFactor"]>[0]) => {
      if (!challenge && !(enabling && session)) return fail("2단계 인증을 진행 중이 아니에요. 다시 로그인해 주세요.")
      if (method === "totp" ? !/^\d{6}$/.test(code) : !code.trim()) return fail("코드를 다시 확인해 주세요.", { code: ["인증 앱의 6자리 숫자를 입력해 주세요."] })
      challenge = false
      enabling = false
      session = { ...(session ?? copy(user)), twoFactor: true }
      return { ok: true, data: { ...copy(session), ...(redirectTo ? { redirectUrl: redirectTo } : {}) } }
    }),
    requestPasswordReset: writer<{ email: string }, { sent: true }>(ctx, () => ({ ok: true, data: { sent: true } as const })),
    // 재설정 마무리(D236): 가상 토큰 MOCK_RESET_TOKEN 만 한 번 통한다 — 빈 토큰은 token 칸 오류, 그 밖·이미 쓴 토큰은 code invalid_token, 8자 미만은 newPassword 칸 오류
    resetPassword: writer(ctx, ({ token, newPassword }: { token: string; newPassword: string }) => {
      if (!token) return fail("입력한 내용을 다시 확인해 주세요.", { token: ["재설정 링크의 토큰이 없어요. 메일의 링크로 다시 들어와 주세요."] })
      if (token !== MOCK_RESET_TOKEN || usedResetTokens.has(token)) return { ok: false, formError: "이 링크는 더 쓸 수 없어요. 재설정 링크를 다시 받아 주세요.", code: "invalid_token", retryable: false }
      if (!newPassword || newPassword.length < 8) return fail("입력한 내용을 다시 확인해 주세요.", { newPassword: ["새 비밀번호는 8자 이상으로 적어 주세요."] })
      usedResetTokens.add(token)
      return { ok: true, data: {} }
    }),
    signOut: writer<void, { redirectUrl?: string }>(ctx, () => {
      session = null
      challenge = false
      return { ok: true, data: {} }
    }),
    enableTwoFactor: writer(ctx, ({ password }: { password?: string }) =>
      account(() => {
        if (!password) return fail("입력한 내용을 다시 확인해 주세요.", NEED_PASSWORD)
        enabling = true
        return { ok: true, data: { totpURI: TOTP_URI, backupCodes: [...BACKUP_CODES] } }
      }),
    ),
    disableTwoFactor: writer(ctx, ({ password }: { password?: string }) =>
      account(() => {
        if (!password) return fail("입력한 내용을 다시 확인해 주세요.", NEED_PASSWORD)
        enabling = false
        if (session) session = { ...session, twoFactor: false }
        return { ok: true, data: {} }
      }),
    ),
    changePassword: writer(ctx, ({ currentPassword, newPassword, revokeOtherSessions }: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) =>
      account(() => {
        const errs: Partial<Record<string, string[]>> = {}
        if (!currentPassword) errs.currentPassword = ["지금 비밀번호를 입력해 주세요."]
        if (!newPassword || newPassword.length < 8) errs.newPassword = ["새 비밀번호는 8자 이상으로 적어 주세요."]
        if (Object.keys(errs).length) return fail("입력한 내용을 다시 확인해 주세요.", errs)
        if (revokeOtherSessions) devices = devices.filter((d) => d.current)
        return { ok: true, data: { otherSessionsRevoked: revokeOtherSessions === true } }
      }),
    ),
    changeEmail: writer(ctx, ({ newEmail, currentPassword }: { newEmail: string; currentPassword?: string } & HumanConfirmation) =>
      account(() => {
        if (!newEmail || !EMAIL_SHAPE.test(newEmail)) return fail("입력한 내용을 다시 확인해 주세요.", { newEmail: ["새 이메일 주소를 다시 확인해 주세요."] })
        if (!currentPassword) return fail("입력한 내용을 다시 확인해 주세요.", { currentPassword: NEED_PASSWORD.password })
        return { ok: true, data: { emailSent: true as const } }
      }),
    ),
    sendVerificationEmail: writer<{ redirectTo?: string } | undefined, { sent: true }>(ctx, () => account(() => ({ ok: true, data: { sent: true as const } }))),
    listSessions: async () => (session ? listDevices() : fail(NEED_LOGIN)),
    revokeSession: writer(ctx, ({ sessionId }: { sessionId: string }) =>
      account(() => {
        if (!devices.some((d) => d.id === sessionId)) return fail("이미 끝난 기기예요. 목록을 새로 불러와 주세요.")
        devices = devices.filter((d) => d.id !== sessionId)
        return { ok: true, data: {} }
      }),
    ),
    revokeOtherSessions: writer<void, Record<string, never>>(ctx, () =>
      account(() => {
        devices = devices.filter((d) => d.current)
        return { ok: true, data: {} }
      }),
    ),
    updatePreferences: writer(ctx, ({ locale, timeZone }: { locale?: string | null; timeZone?: string | null }) =>
      account(() => {
        if (session) session = { ...session, ...(locale !== undefined ? { locale: locale ?? undefined } : {}), ...(timeZone !== undefined ? { timeZone: timeZone ?? undefined } : {}) }
        return { ok: true, data: { locale: session?.locale ?? null, timeZone: session?.timeZone ?? null } }
      }),
    ),
    deleteAccount: writer<(HumanConfirmation & { confirmEmail?: string }) | undefined, { graceUntil: IsoDate }>(ctx, () => account(() => ({ ok: true, data: { graceUntil: GRACE_UNTIL } }))),
    exportMyData: writer<HumanConfirmation | undefined, object>(ctx, () => account(() => ({ ok: true, data: { exportedAt: MOCK_NOW, account: { userId: session?.userId, email: session?.email } } }))),
  }
  // 확인 입력 요구(P3-7 AXC). 로그인이 먼저다(로그아웃이면 원래 메서드의 로그인 요구 그대로 — launch-factory 와 같은 순서). 탈퇴는 입력한 이메일(confirmEmail)을 주면 지금 주소와 맞춰 본다.
  if (options.requireConfirmation) {
    const signedIn = <A extends HumanConfirmation | undefined, T>(fn: (input: A) => Promise<ActionResult<T>>) => {
      const gated = needsConfirmation(fn)
      return (input: A) => (session ? gated(input) : fn(input))
    }
    port.changeEmail = signedIn(port.changeEmail)
    port.exportMyData = signedIn(port.exportMyData)
    const del = port.deleteAccount
    port.deleteAccount = async (input) => {
      if (!session) return del(input)
      if (input?.confirmed !== true) return confirmationRequired()
      const want = session.email
      if (typeof input.confirmEmail === "string" && want && input.confirmEmail.trim().toLowerCase() !== want.toLowerCase()) return confirmationRequired(NEED_CONFIRM_EMAIL, "confirmEmail")
      return del(input)
    }
  }
  return port
}

type Channels = Required<NonNullable<ConsentInput["marketing"]>>

/**
 * 알림(마케팅 수신 동의) 포트 목. 채널 email·sms·kakao·push 는 기본 false(사전 선택 금지), ?consent=all 이면 모두 true.
 * setConsents 는 준 채널만 바꾸고 updatedAt(MOCK_NOW)을 남긴다(options.requireConfirmation 이면 `confirmed: true` 없이는 아무것도 바꾸지 않고 confirmation_required — P3-7 AXC). subscribePush(계약 판 2 — 대장 A35)는 endpoint 를 기억하고(같은 endpoint 는 한 번만), unsubscribePush 는 지운다 —
 * endpoint 가 비었거나 https 가 아니거나 keys 가 없으면 필드 오류다.
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockNotify(search: string | URLSearchParams, options: PortMockOptions & { requireConfirmation?: boolean } = {}): Required<NotifyPort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const on = oneOf("consent", q.get("consent") ?? "unset", MOCK_CONSENTS) === "all"
  let channels: Channels = { email: on, sms: on, kakao: on, push: on }
  let updatedAt: IsoDate | undefined = on ? MOCK_NOW : undefined
  const endpoints = new Set<string>()
  const setConsents = writer(ctx, (input: Partial<Channels> & HumanConfirmation) => {
    const next = { ...channels }
    for (const k of ["email", "sms", "kakao", "push"] as const) if (typeof input?.[k] === "boolean") next[k] = input[k]
    channels = next
    updatedAt = MOCK_NOW
    return { ok: true, data: { updatedAt } }
  })
  return {
    consents: reader(ctx, () => ({ ...channels, ...(updatedAt ? { updatedAt } : {}) })),
    setConsents: options.requireConfirmation ? needsConfirmation(setConsents) : setConsents,
    subscribePush: writer(ctx, (input: PushSubscriptionInput) => {
      if (!input?.endpoint || !input.endpoint.startsWith("https://")) return fail("입력한 내용을 다시 확인해 주세요.", { endpoint: ["푸시 구독 주소를 다시 확인해 주세요."] })
      if (!input.keys?.p256dh || !input.keys?.auth) return fail("입력한 내용을 다시 확인해 주세요.", { keys: ["푸시 구독 키를 다시 확인해 주세요."] })
      endpoints.add(input.endpoint)
      return { ok: true, data: { subscribedAt: MOCK_NOW } }
    }),
    unsubscribePush: writer<{ endpoint: string }, Record<string, never>>(ctx, ({ endpoint }) => {
      if (!endpoints.delete(endpoint)) return fail("이 기기의 푸시 구독을 찾지 못했어요.")
      return { ok: true, data: {} }
    }),
  }
}

// ── 예약 포트 목(계약 판 2 안의 선택 추가 — sitebrew v0.2.0 계획 3b) ─────────────────────────────
/** 목의 예약 서비스(가상). 시간 칸은 서비스마다 같은 격자고 칸마다 자리 1개다 */
export const MOCK_BOOKING_SERVICES = [{ id: "consult", name: "상담(예시)", durationMin: 60, partyMax: 4 }] as const
const BOOKING_HOURS = [10, 11, 14, 15] as const // 업장 시간대(한국)의 시각
const BOOKING_UTC_OFFSET = 9
const BOOKING_DEFAULT_DAYS = 7
const BOOKING_MAX_DAYS = 14
const BOOKING_CANCEL_HOURS = 24 // 시작 24시간 전까지 직접 취소할 수 있다
const BOOKING_FIRST_NUMBER = 1001
const STARTS_AT_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HOLDING: readonly BookingStatus[] = ["requested", "confirmed"] // 시간 칸을 차지하는 상태
const BOOKING_INVALID = "입력한 내용을 다시 확인해 주세요."
const BOOKING_NOT_FOUND = "예약 번호와 연락처가 맞는 예약을 찾지 못했어요. 두 가지를 다시 확인해 주세요."
const BOOKING_SLOT_TAKEN = "방금 다른 분이 이 시간을 예약했어요. 다른 시간을 골라 주세요."
const BOOKING_CANCEL_CLOSED = "직접 취소할 수 있는 기한이 지났어요. 업장에 직접 연락해 주세요."
const BOOKING_ALREADY_ENDED = "이미 취소됐거나 끝난 예약이라 취소할 수 없어요."
const bookingFailure = (code: "slot_taken" | "not_found" | "cancel_closed" | "invalid_state", formError: string): Failure => ({ ok: false, code, retryable: false, formError })

interface StoredBooking {
  id: string
  service: (typeof MOCK_BOOKING_SERVICES)[number]
  startsAt: IsoDate
  partySize: number
  status: BookingStatus
  contact: string // 비교용으로 다듬은 값(앞뒤 공백 제거·소문자)
}

const normContact = (v: string) => v.trim().toLowerCase()
const normReference = (v: string) => v.trim().toUpperCase()
const isoOf = (ms: number): IsoDate => new Date(ms).toISOString()

/** 그날의 시간 칸(업장 시간대 10·11·14·15시) — 지난 칸(MOCK_NOW 이전)은 뺀다 */
function gridOf(date: string): IsoDate[] {
  const [, y, m, d] = DATE_ONLY.exec(date) as RegExpExecArray
  return BOOKING_HOURS.map((h) => isoOf(Date.UTC(Number(y), Number(m) - 1, Number(d), h - BOOKING_UTC_OFFSET))).filter((iso) => iso > MOCK_NOW)
}

/** YYYY-MM-DD 이고 실제 있는 날짜인가(2026-02-31 은 아니다) */
function isRealDate(v: string): boolean {
  const m = DATE_ONLY.exec(v)
  if (!m) return false
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return isoOf(t.getTime()).startsWith(v)
}

const addDays = (date: string, n: number): string => isoOf(Date.parse(`${date}T00:00:00.000Z`) + n * 86_400_000).slice(0, 10)

/**
 * 예약 포트 목. 서비스 `consult`(60분·한 번에 4명까지) 하나, 시간 칸은 `from` 부터 하루 네 칸(한국 시각 10·11·14·15시)이고 칸마다 자리 1개다 — 지난 칸(MOCK_NOW 이전)은 없다.
 * book 은 `B-1001` 부터 순서대로 예약 번호를 주고(확정으로 접수) 그 칸을 잡는다(같은 칸을 또 잡으면 slot_taken, 취소하면 풀린다). lookup·cancel 은 번호 + 연락처(앞뒤 공백·대소문자 무시)가 맞아야 하고,
 * 틀린 조합은 번호를 모르는 경우와 연락처가 틀린 경우를 구별하지 않는 같은 not_found 다. 취소는 시작 24시간 전까지(MOCK_NOW 기준 — 지나면 cancel_closed), 끝난 예약을 또 취소하면 invalid_state 다.
 * ?booking=full 이면 모든 칸이 자리 0이고 book 은 slot_taken 이다. ?state=(slots·lookup)·?submit=(book·cancel·lookup)·&delay= 는 다른 포트 목과 같다.
 * 예약 장부는 인스턴스마다 따로다(같은 쿼리로 새로 만들면 같은 처음 상태). 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockBooking(search: string | URLSearchParams, options: PortMockOptions = {}): Required<BookingPort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const full = oneOf("booking", q.get("booking") ?? "open", MOCK_BOOKINGS) === "full"
  const ledger: StoredBooking[] = []
  const holds = (service: string, startsAt: IsoDate) => ledger.some((b) => b.service.id === service && b.startsAt === startsAt && HOLDING.includes(b.status))
  const find = ({ reference, contact }: BookingLookup) => ledger.find((b) => b.id === normReference(reference) && b.contact === normContact(contact))
  const cancelBy = (b: StoredBooking): IsoDate => isoOf(Date.parse(b.startsAt) - BOOKING_CANCEL_HOURS * 3_600_000)
  const view = (b: StoredBooking): ManagedBooking => ({
    id: b.id,
    service: b.service.id,
    serviceName: b.service.name,
    startsAt: b.startsAt,
    endsAt: isoOf(Date.parse(b.startsAt) + b.service.durationMin * 60_000),
    partySize: b.partySize,
    status: b.status,
    canCancel: HOLDING.includes(b.status) && MOCK_NOW <= cancelBy(b),
    cancelBy: cancelBy(b),
  })
  const pairProblem = (input: BookingLookup): Failure | null => {
    const errors: Record<string, string[]> = {}
    if (!input?.reference?.trim()) errors.reference = ["예약 번호를 입력해 주세요."]
    if (!input?.contact?.trim()) errors.contact = ["예약할 때 적은 연락처를 입력해 주세요."]
    return Object.keys(errors).length ? { ok: false, code: "invalid_input", retryable: false, formError: BOOKING_INVALID, fieldErrors: errors } : null
  }

  // slots 는 읽기: 입력이 틀리면 칸 오류, 맞으면 ?state= 를 따른다(empty 는 날짜가 없는 목록)
  const slots: BookingPort["slots"] = async (input) => {
    const errors: Record<string, string[]> = {}
    if (!MOCK_BOOKING_SERVICES.some((s) => s.id === input?.service)) errors.service = ["예약할 수 있는 서비스를 골라 주세요."]
    if (!isRealDate(input?.from ?? "")) errors.from = ["날짜를 YYYY-MM-DD 로 적어 주세요."]
    if (Object.keys(errors).length) return fail(BOOKING_INVALID, errors)
    const asked = Number.isFinite(input.days) ? Math.trunc(input.days as number) : BOOKING_DEFAULT_DAYS
    const count = Math.min(BOOKING_MAX_DAYS, Math.max(1, asked))
    return reader<{ days: BookingDay[] }>(
      ctx,
      () => ({
        days: Array.from({ length: count }, (_, i) => addDays(input.from, i)).map((date) => ({
          date,
          slots: gridOf(date).map((startsAt) => ({ startsAt, available: full || holds(input.service, startsAt) ? 0 : 1 })),
        })),
      }),
      () => ({ days: [] }),
    )()
  }

  const book = writer<BookingRequest, BookingReceipt>(ctx, (input) => {
    const errors: Record<string, string[]> = {}
    const service = MOCK_BOOKING_SERVICES.find((s) => s.id === input?.service)
    if (!service) errors.service = ["예약할 수 있는 서비스를 골라 주세요."]
    let startsAt: IsoDate | undefined
    const rawStart = input?.startsAt ?? ""
    if (!STARTS_AT_WITH_ZONE.test(rawStart) || Number.isNaN(Date.parse(rawStart))) errors.startsAt = ["예약할 시간을 골라 주세요."]
    else {
      const iso = isoOf(Date.parse(rawStart))
      const localDate = isoOf(Date.parse(iso) + BOOKING_UTC_OFFSET * 3_600_000).slice(0, 10) // 업장 시간대의 그 날짜
      const onGrid = gridOf(localDate).includes(iso)
      if (onGrid) startsAt = iso
      else errors.startsAt = ["예약할 수 없는 시간이에요. 다른 시간을 골라 주세요."]
    }
    let partySize = 1
    if (input?.partySize !== undefined && input.partySize !== "") {
      partySize = /^\d{1,3}$/.test(input.partySize) ? Number(input.partySize) : 0
      if (partySize < 1 || (service && partySize > service.partyMax)) errors.partySize = [`인원은 1명부터 ${service?.partyMax ?? 1}명까지예요.`]
    }
    if (input?.name && input.name.length > 100) errors.name = ["이름은 100자까지 적을 수 있어요."]
    if (input?.note && input.note.length > 1000) errors.note = ["요청 사항은 1000자까지 적을 수 있어요."]
    const contact = input?.contact?.trim() ?? ""
    if (!contact) errors.contact = ["연락처를 입력해 주세요."]
    else if (!EMAIL_SHAPE.test(contact) && !/^\+?[\d\s-]{8,20}$/.test(contact)) errors.contact = ["이메일 주소나 전화번호를 다시 확인해 주세요."]
    if (Object.keys(errors).length || !service || !startsAt) return fail(BOOKING_INVALID, errors)
    if (full || holds(service.id, startsAt)) return bookingFailure("slot_taken", BOOKING_SLOT_TAKEN)
    const id = `B-${BOOKING_FIRST_NUMBER + ledger.length}`
    ledger.push({ id, service, startsAt, partySize, status: "confirmed", contact: normContact(contact) })
    return { ok: true, data: { id, startsAt, status: "confirmed", message: `예약했어요. 예약 번호는 ${id} 예요. 조회와 취소에 쓰니 적어 두세요.` } }
  })

  const lookup = writer<BookingLookup, ManagedBooking>(ctx, (input) => {
    const bad = pairProblem(input)
    if (bad) return bad
    const found = find(input)
    return found ? { ok: true, data: view(found) } : bookingFailure("not_found", BOOKING_NOT_FOUND)
  })

  const cancel = writer<BookingLookup, BookingChange>(ctx, (input) => {
    const bad = pairProblem(input)
    if (bad) return bad
    const found = find(input)
    if (!found) return bookingFailure("not_found", BOOKING_NOT_FOUND)
    if (!HOLDING.includes(found.status)) return bookingFailure("invalid_state", BOOKING_ALREADY_ENDED)
    if (MOCK_NOW > cancelBy(found)) return bookingFailure("cancel_closed", BOOKING_CANCEL_CLOSED)
    found.status = "cancelled"
    return { ok: true, data: { id: found.id, status: "cancelled", message: "예약을 취소했어요." } }
  })

  // lookup 은 읽는 일이라 ?state=loading·error 도 따른다(그 밖은 쓰기와 같은 ?submit= 결과)
  const lookupWithState: BookingPort["lookup"] = async (input) => {
    if (ctx.state === "loading") return new Promise<never>(noop)
    if (ctx.state === "error") return { ok: false, formError: ctx.opts.message ?? DEFAULT_ERROR, retryable: true }
    return lookup(input)
  }
  return { slots, book, lookup: lookupWithState, cancel }
}

/** 목 계측이 남긴 호출 하나. attribution 은 track 의 meta 로 출처 태그가 왔을 때만 있다(없으면 키도 없다 — 옛 호출의 기록 모양 그대로) */
export interface TrackedEvent {
  name: EventName
  props: EventProps[EventName]
  attribution?: Attribution
}

const CONSENTS: Record<MockConsent, ConsentState> = {
  unset: { analytics: false, marketing: false },
  denied: { analytics: false, marketing: false, decidedAt: MOCK_NOW },
  analytics: { analytics: true, marketing: false, decidedAt: MOCK_NOW },
  all: { analytics: true, marketing: true, decidedAt: MOCK_NOW },
}

/**
 * 계측 포트 목. ?consent=unset(기본, 결정 전 — 둘 다 false)·denied·analytics·all. 동의(analytics)가 false 면 track 은 아무것도
 * 남기지 않는다(출처 태그도 함께 버린다). 남긴 호출은 events 에 쌓인다(검사·갤러리용) — meta.attribution(계약 판 2, withAttribution 이 붙인다)이
 * 오면 그 태그를 attribution 에 함께 적는다. setConsent 는 decidedAt(MOCK_NOW)을 붙인다.
 * identify(계약 판 2 — 대장 D30)는 동의(analytics)가 true 일 때만 identified 에 userId 를 쌓는다(빈 문자열은 버린다).
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockAnalytics(
  search: string | URLSearchParams,
  options: { onTrack?: (e: TrackedEvent) => void } = {},
): Required<AnalyticsPort> & { readonly events: readonly TrackedEvent[]; readonly identified: readonly string[] } {
  const q = toParams(search)
  let consent: ConsentState = { ...CONSENTS[oneOf("consent", q.get("consent") ?? "unset", MOCK_CONSENTS)] }
  const events: TrackedEvent[] = []
  const identified: string[] = []
  return {
    events,
    identified,
    identify(userId: string) {
      if (!consent.analytics || !userId) return
      identified.push(userId)
    },
    track<E extends EventName>(name: E, props: EventProps[E], meta?: TrackMeta) {
      if (!consent.analytics) return
      const e: TrackedEvent = meta?.attribution ? { name, props: copy(props), attribution: copy(meta.attribution) } : { name, props: copy(props) }
      events.push(e)
      options.onTrack?.(e)
    },
    consent: () => ({ ...consent }),
    setConsent(next) {
      consent = { analytics: next.analytics === true, marketing: next.marketing === true, decidedAt: MOCK_NOW }
    },
  }
}

/** 올리기 정책(launch-factory `packages/storage` policy.ts 의 종류별 한도를 옮긴 것 — 바뀌면 이 표와 시험이 같이 바뀐다). 크기는 바이트 */
const MOCK_MB = 1024 * 1024
const MOCK_STORAGE_POLICY: Record<StorageKind, { maxBytes: number; types: readonly string[]; signInRequired: boolean; priv: boolean }> = {
  avatar: { maxBytes: 2 * MOCK_MB, types: ["image/png", "image/jpeg", "image/webp"], signInRequired: true, priv: false },
  image: { maxBytes: 5 * MOCK_MB, types: ["image/png", "image/jpeg", "image/webp", "image/avif"], signInRequired: false, priv: false },
  attachment: {
    maxBytes: 10 * MOCK_MB,
    types: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/x-hwp", "application/vnd.hancom.hwpx", "image/jpeg", "image/png"],
    signInRequired: false,
    priv: true,
  },
}
const MOCK_EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "application/pdf": "pdf", "application/x-hwp": "hwp", "application/vnd.hancom.hwpx": "hwpx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx" }
const MOCK_TICKET_SECONDS = 900

/**
 * 파일 포트 목. 올릴 때마다 번호가 는다: key "mock/<kind>/<n>", url 은 options.url(kind, n) 또는 "#mock-upload/<kind>/<n>".
 * 빈 파일은 필드 오류(file)다. 네트워크를 쓰지 않는다.
 * **티켓식 올리기(p3-3c 후속)**: createTicket 은 종류·형식·크기를 위 정책 표로 검사해(어기면 fieldErrors.kind·contentType·size) 15분짜리 티켓을 낸다 —
 * avatar 는 로그인이 필요하다(?auth=signed-out 이면 code sign_in_required, 기본은 로그인). 티켓의 url 은 실제로 PUT 하지 않는 가짜 주소("#mock-ticket/<id>")다.
 * complete 는 받은 티켓만 끝낸다(모르는 id 는 code not_found) — 두 번 불러도 같은 결과다. 비공개 종류(attachment)의 url 은 짧게 열리는 주소를 흉내 낸다("#mock-download/…?expires=…").
 * 반환은 Required<StoragePort> 다. 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockStorage(
  search: string | URLSearchParams,
  options: PortMockOptions & { url?: (kind: string, n: number) => string } = {},
): Required<StoragePort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const signedOut = oneOf("auth", q.get("auth") ?? "signed-in", MOCK_AUTHS) === "signed-out"
  let n = 0
  const upload = writer(ctx, ({ file, kind }: { file: File | Blob; kind: string }) => {
    if (!file || file.size === 0) return fail("파일을 다시 선택해 주세요.", { file: ["빈 파일은 올릴 수 없어요."] })
    n += 1
    return { ok: true, data: { key: `mock/${kind}/${n}`, url: options.url?.(kind, n) ?? `#mock-upload/${kind}/${n}` } }
  })
  const tickets = new Map<string, { kind: StorageKind; key: string; n: number }>()
  const createTicket = writer(ctx, (input: { kind: StorageKind; contentType: string; size: number; fileName?: string }) => {
    const policy = Object.hasOwn(MOCK_STORAGE_POLICY, input.kind) ? MOCK_STORAGE_POLICY[input.kind] : undefined
    if (!policy) return fail("올릴 수 없는 종류예요.", { kind: ["avatar, image, attachment 중에서 골라 주세요."] })
    if (policy.signInRequired && signedOut) return { ok: false, code: "sign_in_required", retryable: false, formError: NEED_LOGIN }
    const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : ""
    if (!policy.types.includes(contentType)) return fail("올릴 수 없는 파일 형식이에요.", { contentType: [`이 종류는 ${policy.types.map((t) => MOCK_EXTENSION[t] ?? t).join(", ")} 파일만 올릴 수 있어요.`] })
    if (!Number.isInteger(input.size) || input.size < 1) return fail("파일 크기를 확인해 주세요.", { size: ["빈 파일은 올릴 수 없어요."] })
    if (input.size > policy.maxBytes) return fail("파일이 너무 커요.", { size: [`${Math.floor(policy.maxBytes / MOCK_MB)}MB 이하 파일만 올릴 수 있어요.`] })
    n += 1
    const id = `mock-upload-${n}`
    const key = `mock/${input.kind}/${n}.${MOCK_EXTENSION[contentType] ?? "bin"}`
    tickets.set(id, { kind: input.kind, key, n })
    const data: UploadTicket = { id, key, method: "PUT", url: `#mock-ticket/${id}`, headers: { "content-type": contentType }, expiresAt: new Date(Date.parse(MOCK_NOW) + MOCK_TICKET_SECONDS * 1000).toISOString(), maxBytes: policy.maxBytes }
    return { ok: true, data }
  })
  const complete = writer(ctx, ({ id }: { id: string }) => {
    const ticket = tickets.get(id)
    if (!ticket) return { ok: false, code: "not_found", retryable: false, formError: "올리기를 찾지 못했어요. 처음부터 다시 올려 주세요." }
    const priv = MOCK_STORAGE_POLICY[ticket.kind].priv
    const url = options.url?.(ticket.kind, ticket.n) ?? (priv ? `#mock-download/${ticket.key}?expires=${new Date(Date.parse(MOCK_NOW) + MOCK_TICKET_SECONDS * 1000).toISOString()}` : `#mock-upload/${ticket.kind}/${ticket.n}`)
    return { ok: true, data: { key: ticket.key, url } }
  })
  return { upload: (file, opts) => upload({ file, kind: opts?.kind }), createTicket, complete }
}

// ── 후기·검색·뉴스레터·내 신청 내역 목(p3-3c) ─────────────────────────────────────────────────────────────
// 읽기는 reader 와 같은 ?state= 규칙, 쓰기는 writer 와 같은 ?submit= 규칙을 따른다. 상태는 포트 하나 안에만 있다(새로 만들면 시드로 돌아간다).

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
function pageOf<T>(all: readonly T[], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)))
  const no = Math.max(1, Math.floor(page))
  return { items: all.slice((no - 1) * size, no * size), total: all.length, page: no, pageCount: Math.ceil(all.length / size) }
}
/** 입력을 받는 읽기: reader 와 같은 ?state= 규칙(loading 은 끝나지 않고, error 는 다시 시도할 수 있고, empty 는 empty(input)) */
function readerOf<I, T>(ctx: PortCtx, make: (input: I) => T, empty?: (input: I) => T): (input: I) => Promise<ActionResult<T>> {
  return (input) => reader(ctx, () => make(input), empty ? () => empty(input) : undefined)()
}
const DAY = (iso: IsoDate) => iso.slice(0, 10)

type StoredReview = { seq: number; subjectType: string; subjectId: string; kind: ReviewKind; status: "published" | "pending"; mine: boolean; rating?: ReviewRating; title?: string; body: string; author: string; date: IsoDate; verified?: boolean; reply?: Review["reply"] }
const OWNER_REPLY = (date: IsoDate) => ({ author: "판매자", body: "소중한 의견 고마워요.", date })
const REVIEW_SEED: readonly Omit<StoredReview, "seq">[] = [
  { subjectType: "product", subjectId: "example-1", kind: "review", status: "published", mine: false, rating: 5, title: "조용하고 가벼워요", body: "생각보다 훨씬 가볍고 소리가 작아서 아침에도 부담 없이 써요.", author: "김**", date: "2026-09-20", verified: true, reply: OWNER_REPLY("2026-09-21") },
  { subjectType: "product", subjectId: "example-1", kind: "review", status: "published", mine: false, rating: 4, body: "흡입력은 만족해요. 먼지통이 조금 작아요.", author: "이**", date: "2026-09-12", verified: true },
  { subjectType: "product", subjectId: "example-1", kind: "review", status: "published", mine: false, rating: 5, body: "배송이 빨랐고 설명서가 알기 쉬웠어요.", author: "박**", date: "2026-09-02" },
  { subjectType: "product", subjectId: "example-1", kind: "review", status: "published", mine: false, rating: 2, body: "배터리가 광고만큼 오래가지 않아요.", author: "최**", date: "2026-08-25" },
  { subjectType: "product", subjectId: "example-1", kind: "question", status: "published", mine: false, body: "충전은 얼마나 걸리나요?", author: "정**", date: "2026-09-15", reply: OWNER_REPLY("2026-09-16") },
]
/** 이름을 가린다: 첫 글자만 남기고 나머지는 별표(최대 둘) */
const maskName = (name: string) => `${[...name.trim()][0] ?? "익"}${"*".repeat(Math.min(2, Math.max(1, [...name.trim()].length - 1)))}`

function ratingSummary(rows: readonly StoredReview[]): RatingSummary {
  const distribution: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const r of rows) {
    distribution[r.rating as ReviewRating] += 1
    sum += r.rating as number
  }
  return { avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0, count: rows.length, asOf: DAY(MOCK_NOW), distribution }
}

/**
 * 후기·상품 문의 포트 목. 시드는 subjectType "product" · subjectId "example-1" 후기 넷(5·4·5·2점)과 문의 하나이고, 다른 대상은 비어 있다.
 * submit 은 후기는 별점(1~5)·본문, 문의는 본문이 필요하고, 같은 대상에 후기는 한 번뿐이다(fieldErrors.body). 글쓴이 이름은 가려서 저장한다.
 * options.moderation "before" 면 새 글이 pending 이라 목록에 아직 없다(기본 "after" — 바로 게시). 요약은 게시된 후기 전체로 센다(별점 거르기·쪽과 무관).
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockReviews(search: string | URLSearchParams, options: PortMockOptions & { moderation?: "after" | "before" } = {}): Required<ReviewsPort> {
  const ctx = portCtx(toParams(search), options)
  const rows: StoredReview[] = REVIEW_SEED.map((r, i) => ({ ...copy(r), seq: i }))
  const published = (i: Pick<ReviewListInput, "subjectType" | "subjectId">, kind: ReviewKind) =>
    rows.filter((r) => r.subjectType === i.subjectType && r.subjectId === i.subjectId && r.kind === kind && r.status === "published")
  const newestFirst = (a: StoredReview, b: StoredReview) => (a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1)
  const toReview = (r: StoredReview): Review => ({ id: `rv-${r.seq}`, rating: r.rating as ReviewRating, ...(r.title ? { title: r.title } : {}), body: r.body, author: r.author, date: r.date, ...(r.verified ? { verified: true } : {}), ...(r.reply ? { reply: { ...r.reply } } : {}) })
  const toQuestion = (r: StoredReview): Question => ({ id: `rv-${r.seq}`, body: r.body, author: r.author, date: r.date, ...(r.reply ? { reply: { ...r.reply } } : {}) })
  return {
    list: readerOf(
      ctx,
      (input: ReviewListInput) => {
        const kind = input.kind ?? "review"
        const all = published(input, kind)
        if (kind === "question") return { kind, ...pageOf([...all].sort(newestFirst).map(toQuestion), input.page, input.pageSize) }
        const sort = input.sort ?? "latest"
        const shown = all
          .filter((r) => input.rating === undefined || r.rating === input.rating)
          .sort(sort === "rating_desc" ? (a, b) => (b.rating as number) - (a.rating as number) || newestFirst(a, b) : sort === "rating_asc" ? (a, b) => (a.rating as number) - (b.rating as number) || newestFirst(a, b) : newestFirst)
        return { kind, summary: ratingSummary(all), ...pageOf(shown.map(toReview), input.page, input.pageSize) }
      },
      (input: ReviewListInput) =>
        input.kind === "question"
          ? { kind: "question", ...pageOf<Question>([], input.page, input.pageSize) }
          : { kind: "review", summary: ratingSummary([]), ...pageOf<Review>([], input.page, input.pageSize) },
    ),
    submit: writer(ctx, (input) => {
      const kind = input.kind ?? "review"
      const body = input.body?.trim() ?? ""
      if (!body) return fail("입력한 내용을 다시 확인해 주세요.", { body: ["내용을 입력해 주세요."] })
      if (kind === "review" && !(Number.isInteger(input.rating) && (input.rating as number) >= 1 && (input.rating as number) <= 5)) return fail("입력한 내용을 다시 확인해 주세요.", { rating: ["별점을 1~5점 중에서 골라 주세요."] })
      if (kind === "review" && rows.some((r) => r.mine && r.kind === "review" && r.subjectType === input.subjectType && r.subjectId === input.subjectId)) return fail("이미 후기를 남겼어요.", { body: ["같은 상품에는 후기를 한 번만 남길 수 있어요."] })
      const status = options.moderation === "before" ? "pending" : "published"
      const row: StoredReview = { seq: rows.length, subjectType: input.subjectType, subjectId: input.subjectId, kind, status, mine: true, ...(kind === "review" ? { rating: input.rating, ...(input.title?.trim() ? { title: input.title.trim() } : {}) } : {}), body, author: maskName(input.authorName ?? MOCK_SESSION.name ?? ""), date: DAY(MOCK_NOW) }
      rows.push(row)
      return { ok: true, data: { id: `rv-${row.seq}`, status } }
    }),
  }
}

const SEARCH_SEED: readonly { kind: string; ref: string; locale: "ko" | "en"; title: string; body: string; url: string }[] = [
  { kind: "product", ref: "p-1", locale: "ko", title: "무선청소기 에어", body: "가볍고 조용한 무선청소기예요. 배터리는 한 번 충전으로 60분 쓸 수 있어요.", url: "/products/p-1" },
  { kind: "post", ref: "b-1", locale: "ko", title: "청소기 고르는 법", body: "흡입력과 배터리, 소음을 비교해 보세요. 주문하기 전에 크기와 배송 방법도 확인해요.", url: "/blog/b-1" },
  { kind: "page", ref: "shipping", locale: "ko", title: "배송 안내", body: "주문 뒤 2~3일 안에 보내 드려요. 청소기처럼 큰 상품은 따로 알려 드려요.", url: "/shipping" },
  { kind: "page", ref: "returns", locale: "ko", title: "반품과 교환", body: "받은 날부터 7일 안에 반품할 수 있어요. 반품 배송비는 상품 상태에 따라 달라요.", url: "/returns" },
]
const SEARCH_MAX_QUERY = 100
const SEARCH_MAX_WORDS = 5
const SNIPPET_LEAD = 20
const SNIPPET_LENGTH = 80

/** 글 안에서 낱말이 나오는 모든 자리를 [시작, 끝) 범위로(겹치면 합친다) */
function rangesOf(text: string, words: readonly string[]): [number, number][] {
  const lower = text.toLowerCase()
  const found: [number, number][] = []
  for (const w of words) for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + w.length)) found.push([i, i + w.length])
  found.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of found) {
    const last = merged.at(-1)
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/**
 * 검색 포트 목. 시드 문서 넷(상품·글·쪽 둘)을 낱말마다 부분 문자열로 찾는다 — 모든 낱말이 제목이나 본문에 있어야 하고(AND, 최대 5개, 질의는 100자까지),
 * 점수는 낱말마다 제목 3 + 본문 1이며 같으면 시드 순서다. 스니펫은 HTML 이 아니라 text 와 [시작, 끝) 범위 배열이다(본문에 맞은 데가 없으면 제목이 스니펫).
 * 빈 질의는 오류가 아니라 빈 결과다. 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockSearch(search: string | URLSearchParams, options: PortMockOptions = {}): Required<SearchPort> {
  const ctx = portCtx(toParams(search), options)
  const run = (input: Parameters<SearchPort["search"]>[0]) => {
    const words = input.q.normalize("NFC").trim().slice(0, SEARCH_MAX_QUERY).toLowerCase().split(/\s+/).filter(Boolean).slice(0, SEARCH_MAX_WORDS)
    const scored = words.length === 0 ? [] : SEARCH_SEED.flatMap((d, order) => {
      if ((input.kinds && !input.kinds.includes(d.kind)) || (input.locale && input.locale !== d.locale)) return []
      const title = d.title.toLowerCase()
      const body = d.body.toLowerCase()
      if (!words.every((w) => title.includes(w) || body.includes(w))) return []
      const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0)
      return [{ d, order, score }]
    })
    scored.sort((a, b) => b.score - a.score || a.order - b.order)
    const hits: SearchHit[] = scored.map(({ d }) => {
      const first = rangesOf(d.body, words)[0]
      const text = first ? d.body.slice(Math.max(0, first[0] - SNIPPET_LEAD)).slice(0, SNIPPET_LENGTH) : d.title
      return { kind: d.kind, ref: d.ref, title: d.title, url: d.url, snippet: { text, ranges: rangesOf(text, words) } }
    })
    return pageOf(hits, input.page, input.pageSize)
  }
  return { search: readerOf(ctx, run, () => pageOf<SearchHit>([])) }
}

/**
 * 뉴스레터 구독 포트 목. 동의(consent: true)와 이메일 모양을 검사하고, 성공하면 확인 메일을 보냈다고 답한다 — 같은 주소를 또 넣어도 같은 응답이다
 * (주소가 이미 구독자인지 알리지 않는다). 상태가 없다. 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockNewsletter(search: string | URLSearchParams, options: PortMockOptions = {}): Required<NewsletterPort> {
  const ctx = portCtx(toParams(search), options)
  return {
    subscribe: writer(ctx, (input) => {
      const fieldErrors: Partial<Record<string, string[]>> = {}
      if (!EMAIL_SHAPE.test(input.email?.trim() ?? "")) fieldErrors.email = ["이메일 주소를 다시 확인해 주세요."]
      if (input.consent !== true) fieldErrors.consent = ["수신 동의에 체크해 주세요."]
      if (Object.keys(fieldErrors).length) return fail("입력한 내용을 다시 확인해 주세요.", fieldErrors)
      return { ok: true, data: { confirmationSent: true } }
    }),
  }
}

const REQUEST_SEED: readonly MyRequest[] = [
  { reference: "INQ-2026-0003", kind: "contact", status: "in_progress", receivedAt: "2026-09-28T01:00:00.000Z", preview: "배송지를 바꾸고 싶어요. 주문 번호는 1234 이고 연락처는 010-****-5678 이에요" },
  { reference: "INQ-2026-0002", kind: "quote", status: "received", receivedAt: "2026-09-20T05:30:00.000Z", preview: "단체 주문 견적을 받고 싶어요" },
  { reference: "INQ-2026-0001", kind: "contact", status: "done", receivedAt: "2026-09-02T09:10:00.000Z", preview: "영수증 재발급을 부탁드려요" },
]
const clip40 = (s: string) => ([...s].length > 40 ? `${[...s].slice(0, 40).join("")}…` : s)

/**
 * 내 신청 내역 포트 목. 시드 세 건을 최신 순으로 쪽 나눠 보인다 — 미리보기는 앞 40자(넘으면 …). ?auth=signed-out 이면 로그인이 먼저다(code: sign_in_required, retryable false).
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockMyRequests(search: string | URLSearchParams, options: PortMockOptions = {}): Required<MyRequestsPort> {
  const q = toParams(search)
  const ctx = portCtx(q, options)
  const signedOut = oneOf("auth", q.get("auth") ?? "signed-in", MOCK_AUTHS) === "signed-out"
  const read = readerOf(ctx, (input: { page?: number; pageSize?: number } | undefined) => pageOf(REQUEST_SEED.map((r) => ({ ...r, preview: clip40(r.preview) })), input?.page, input?.pageSize), (input) => pageOf<MyRequest>([], input?.page, input?.pageSize))
  return { list: async (input) => (signedOut ? { ok: false, code: "sign_in_required", retryable: false, formError: NEED_LOGIN } : read(input)) }
}

// ── 목 어댑터 도우미 내보내기(계획 3a) ────────────────────────────────────────
// 포트마다 목 파일을 따로 두는 adapter-mock-* 파일(adapter-mock-commerce 등)이 같은 규칙(쿼리 읽기·?state=·?submit=·확인 입력)을 다시 쓰지 않고 이 도우미를 부른다.
// 이 아래는 내보내기만 있다 — 위 코드는 한 글자도 바뀌지 않았다(출력 불변).
export { copy, fail, needsConfirmation, oneOf, portCtx, reader, toParams, wait, writer }
export type { Failure, PortCtx }
