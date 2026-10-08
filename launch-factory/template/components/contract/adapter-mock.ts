import type { ActionResult, AsyncState } from "@/components/contract/block-contract"
import type {
  AnalyticsPort,
  Attribution,
  AuthMethod,
  AuthPort,
  BillingPort,
  ConsentInput,
  ConsentState,
  DeviceSession,
  HumanConfirmation,
  IsoDate,
  NotifyPort,
  Plan,
  PushSubscriptionInput,
  RetentionOffer,
  Session,
  StoragePort,
  Subscription,
  TrackMeta,
} from "@/components/contract/ports"
import type { EventName, EventProps } from "@/components/contract/events"
import { retentionOfferIssues } from "@/lib/retention-offer"

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

/**
 * 파일 포트 목. 올릴 때마다 번호가 는다: key "mock/<kind>/<n>", url 은 options.url(kind, n) 또는 "#mock-upload/<kind>/<n>".
 * 빈 파일은 필드 오류(file)다. 네트워크를 쓰지 않는다.
 * 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 쪽('use client')에서 만든다.
 */
export function mockStorage(
  search: string | URLSearchParams,
  options: PortMockOptions & { url?: (kind: string, n: number) => string } = {},
): StoragePort {
  const ctx = portCtx(toParams(search), options)
  let n = 0
  const upload = writer(ctx, ({ file, kind }: { file: File | Blob; kind: string }) => {
    if (!file || file.size === 0) return fail("파일을 다시 선택해 주세요.", { file: ["빈 파일은 올릴 수 없어요."] })
    n += 1
    return { ok: true, data: { key: `mock/${kind}/${n}`, url: options.url?.(kind, n) ?? `#mock-upload/${kind}/${n}` } }
  })
  return { upload: (file, opts) => upload({ file, kind: opts?.kind }) }
}
