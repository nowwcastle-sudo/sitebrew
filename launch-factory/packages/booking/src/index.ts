// @launch-factory/booking — 예약 서버(계획 3b Task 1, 설계서 9.5 「booking」).
//
// 블록 연결: web-factory 의 예약 블록은 `submit: (input) => Promise<ActionResult<BookingReceipt>>` 포트를 받는다(WF 계약은 Task 7).
// `service.action(ctx)` 가 그 모양이고, 칸 오류는 블록이 보낸 칸 이름 그대로(`service`·`startsAt`·`partySize`·`name`·`contact`·`note`) 돌려준다.
// 조립 쪽이 폼에 숨은 입력 둘을 더한다(블록은 고치지 않는다): Turnstile 토큰 `cf-turnstile-response`, 폼을 열 때 만든 `idempotencyKey`.
//
// 예약 가능 시간은 **설정 데이터**(BookingConfig — 제품의 lib/launch/booking-config.ts) − DB 예약이다(slots.ts). 서비스는 설정을 켤 때 한 번 검사한다(config.ts).
//
// 접수 순서(문의와 같다): 요청 제한 → 멱등 키(같은 키의 성공 결과가 있으면 그대로) → 입력 검사(+슬롯인지) → 마감 확인 → Turnstile → 잠금 안에서 저장 → (예약금) → 메일·알림.
//   - 입력 검사를 Turnstile 앞에 둔다: 토큰은 한 번만 검증되므로 칸을 고쳐 다시 보낼 때 토큰을 태우지 않는다.
//   - 이미 찬 자리는 Turnstile 앞에서 알린다(같은 이유). 그래도 동시에 들어온 요청은 저장 트랜잭션(db bookByCapacity)이 수용량을 지킨다.
//   - 메일·알림은 멱등 구간 안에서 보낸다: 같은 제출이 두 번 와도 예약 행 하나·안내 한 번이다. 메일·알림이 실패해도 예약은 남고 onError 로 알린다.
// 예약금(계획 3d L3): 서비스 설정의 `deposit`(원, 정수)이 0 보다 크면 접수는 「결제 대기」(status requested + depositStatus pending)로 저장된다.
//   - 금액·기한·환불 비율은 모두 서버 설정이 정한다(브라우저가 보낸 금액은 읽지 않는다). 결제 확정은 `settle` 하나이고 반환 쪽(confirmDeposit)·웹훅(claimPayment)이 같은 길로 부른다.
//   - **결제 대기 예약도 자리를 차지한다**(status requested 이므로 수용량에 센다). depositDueAt(기본 30분)이 지나면 `expireDeposits`(Cron)·접수·가능 시간 조회가 자리를 풀고 닫는다.
//   - 취소: 결제 전이면 닫기만, 결제 후면 환불 규정(refundFor)대로 돌려준 **뒤에만** 취소로 바꾼다. 환불이 실패하면 예약은 그대로 두고(재시도 가능) 오류를 알린다.
// 조회·취소는 예약 번호 **와** 연락처가 맞아야 한다. 어느 쪽이 틀려도 같은 `not_found` 다(예약이 있는지 알려주지 않는다).
// 개인정보는 최소만(이름 선택·연락처·메모). IP·브라우저 정보는 저장하지 않는다(요청 제한 키에만 잠깐 쓴다).
import { bookByCapacity, claimReminder, getBookingByDepositRef, getBookingByReference, holdingBetween, listBookings, listDueReminders, listExpiredDepositHolds, moveDeposit, purgeExpiredBookings, retainUntil, transitionBooking, updateBooking, withIdempotency, type BookingRow, type Database } from "@launch-factory/db"
import type { Mailer } from "@launch-factory/email"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { maskPii } from "@launch-factory/security"
import { blockedByBot, blockedByRate, blockedResult } from "@launch-factory/security/protect"
import type { RateLimiter, RateRule } from "@launch-factory/security/rate-limit"
import { TURNSTILE_FIELD, type Turnstile } from "@launch-factory/security/turnstile"
import { isStaffActor, isSystemActor, type StaffRules } from "./actor.ts"
import { depositOf, depositRules, findService, parseBookingConfig, refundFor, type BookingConfig } from "./config.ts"
import { normalizeContact, sameContact } from "./contact.ts"
import type { DepositHook } from "./deposit.ts"
import { toResponse } from "./http.ts"
import { parseBookingInput, readFields, type BookingInput, type Parsed } from "./input.ts"
import { newReference, normalizeReference } from "./reference.ts"
import { computeSlots } from "./slots.ts"
import type { BookingActor, BookingChange, BookingDepositView, BookingFailure, BookingNotifier, BookingNoticeKind, BookingReceipt, BookingResult, BookingStaffQuery, BookingStaffRow, BookingView, DepositClaim, DepositConfirmation, SlotsResult, SubmitContext } from "./types.ts"
import { isCalendarDate } from "./zoned.ts"

export { BookingConfigError, BookingConfigSchema, DEFAULT_HOLD_MINUTES, MAX_DEPOSIT, depositOf, depositRules, parseBookingConfig, refundFor, type BookingConfig, type ServiceConfig, type Weekday } from "./config.ts"
export { computeSlots, type Slot, type SlotDay, type TakenRange } from "./slots.ts"
export { newReference, normalizeReference, REFERENCE_PATTERN } from "./reference.ts"
export { fakeDeposit, type DepositCharge, type DepositHold, type DepositHook, type DepositRefundInput, type DepositVerdict, type FakeDeposit } from "./deposit.ts"
export { isStaffActor } from "./actor.ts"
export { normalizeContact, sameContact } from "./contact.ts"
export { toResponse } from "./http.ts"
export type { BookingActor, BookingChange, BookingDepositOffer, BookingDepositView, BookingFailure, BookingFailureCode, BookingNotifier, BookingNoticeKind, BookingReceipt, BookingResult, BookingStaffQuery, BookingStaffRow, BookingView, DepositClaim, DepositConfirmation, DepositSession, SlotsResult, SubmitContext } from "./types.ts"
export type { BookingInput } from "./input.ts"

/** 요청 제한 경로 이름. 조립 쪽이 만든 제한기에 BOOKING_RATE_RULES 를 규칙으로 넘겨야 한다(규칙이 없는 경로는 제한기가 던진다) */
export const BOOKING_ROUTES = { submit: "booking", lookup: "bookingLookup" } as const
/** 기본 요청 제한: 접수 10분에 10번, 조회·취소는 10분에 10번(예약 번호 맞히기를 막는다) */
export const BOOKING_RATE_RULES = {
  [BOOKING_ROUTES.submit]: { max: 10, windowSec: 600 },
  [BOOKING_ROUTES.lookup]: { max: 10, windowSec: 600 },
} as const satisfies Record<string, RateRule>

/** slots() 가 한 번에 돌려주는 최대 일수 */
export const MAX_SLOT_DAYS = 62
const DEFAULT_SLOT_DAYS = 7
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
/** 자리를 차지하는 상태(db BOOKING_HOLDING_STATUSES 와 같다) */
const isHolding = (status: BookingRow["status"]) => status === "requested" || status === "confirmed"

export interface BookingServiceOptions {
  db: Database
  mailer: Mailer
  limiter: RateLimiter
  turnstile: Turnstile
  /** 예약 설정(제품의 lib/launch/booking-config.ts). 켤 때 parseBookingConfig 로 검사한다 — 틀리면 던진다 */
  config: unknown
  /**
   * 새 예약 알림을 받을 운영자 메일. 알림 문구 언어는 locale(기본 ko), 시각은 timeZone(기본 설정의 시간대).
   * **없으면(undefined) 예약 접수만 꺼진다** — submit·slots 는 provider_unavailable(retryable false)로 거절한다.
   * 이미 받은 예약을 다루는 lookup·cancel·cancelAs·confirm·remindDue·purgeExpired 는 그대로 된다(보유 기간 파기·알림은 받는 창구와 별개의 의무다).
   * 주면 형식이 틀린 값은 던진다(빠르게 실패) — 켜진 척하며 메일이 안 가는 것이 가장 나쁘다.
   */
  owner?: { email: string; locale?: Locale; timeZone?: string }
  productName: string
  /** 예약 확인·취소 화면 주소(https). 확인 메일에 단추로 싣는다 */
  manageUrl?: string
  /** 다시 예약하는 화면 주소(https). 취소 메일에 단추로 싣는다 */
  bookUrl?: string
  /** 대표용 알림 메일의 「예약 보기」 주소(https) */
  adminUrl?: string
  /** 카카오 알림톡·SMS 같은 다른 안내 통로. 주지 않으면 메일만 간다 */
  notify?: BookingNotifier
  /**
   * 예약금 훅(결제 공급자에 닿는 hold·verify·refund). 구현은 `@launch-factory/booking-deposit`(payments-kr) 또는 시험용 fakeDeposit.
   * **예약금이 있는 서비스(설정의 deposit > 0)는 이 훅이 없으면 예약을 받지 않는다**(provider_unavailable) — 예약금 없이 받은 척하지 않는다. 예약금 없는 서비스에는 영향이 없다
   */
  deposit?: DepositHook
  /** 확정·대신 취소를 할 수 있는 관리자 규칙(소유자는 늘 된다) */
  adminRoles?: string[]
  adminUserIds?: string[]
  now?: () => Date
  /** 메일·알림·예약금 실패 등 — 예약은 저장됐으므로 결과는 성공이다. 운영 알림으로 보낸다. 메시지의 개인정보는 가려서 준다 */
  onError?: (error: Error) => void
}

export interface BookingService {
  /** 예약을 받는가(owner 가 있을 때만 true). false 면 접수 경로(submit·slots)는 provider_unavailable 로 거절한다 */
  readonly enabled: boolean
  /** 서비스·날짜 범위의 예약 가능 시간(공개 조회) */
  slots(input: { service: string; from: string; days?: number }, ctx?: Pick<SubmitContext, "locale">): Promise<BookingResult<SlotsResult>>
  submit(input: BookingInput, ctx?: SubmitContext): Promise<BookingResult<BookingReceipt>>
  /** 블록 submit 포트. ctx 는 요청마다 만든다(서버 액션 안에서 headers()·세션으로) */
  action(ctx?: SubmitContext): (input: Record<string, string>) => Promise<BookingResult<BookingReceipt>>
  /** 라우트 처리기(POST, FormData 또는 JSON). 429 + Retry-After · 봇 400 · 칸 오류 400 · 마감 409 · 확인 불가 503 · 처리 중 409 */
  handler(request: Request, ctx?: Omit<SubmitContext, "headers">): Promise<Response>
  /** 예약 번호 + 연락처가 맞을 때만 예약을 보여 준다. 아니면 모두 같은 not_found */
  lookup(input: { reference: string; contact: string }, ctx?: SubmitContext): Promise<BookingResult<BookingView>>
  /**
   * 결제 확정 — 반환 쪽(결제창이 돌아온 화면)이 부른다. 결제 번호로 공급자에 다시 물어 금액·상태를 확인한 뒤 확정한다(브라우저가 알려 준 금액은 읽지 않는다).
   * 이미 확정된 건은 같은 성공(changed false)이고, 아직 확인 못 했으면 payment_pending(retryable). 요청 제한은 조회와 같은 경로를 쓴다
   */
  confirmDeposit(input: { paymentId: string }, ctx?: SubmitContext): Promise<BookingResult<DepositConfirmation>>
  /** 결제 확정 — 웹훅이 부른다(서명 검증은 라우트가 한다). 이 서비스의 예약 결제가 아니면 not_mine. 같은 결제를 몇 번 불러도 확정은 한 번이다 */
  claimPayment(paymentId: string): Promise<DepositClaim>
  /** Cron: 결제 대기 시간이 지난 예약을 닫고 자리를 푼다(공급자에 다시 물어 결제됐으면 확정). 닫은 수를 돌려준다 */
  expireDeposits(): Promise<number>
  /** 예약한 사람이 직접 취소한다(예약 번호 + 연락처, 취소 마감 전까지). 이미 취소된 예약은 같은 성공을 돌려준다 */
  cancel(input: { reference: string; contact: string }, ctx?: SubmitContext): Promise<BookingResult<BookingChange>>
  /** 대표·관리자(또는 서버 작업)가 취소한다 — 취소 마감과 상관없다 */
  cancelAs(reference: string, actor: BookingActor): Promise<BookingResult<BookingChange>>
  /** mode "request" 에서 대표·관리자가 확정한다. 이미 확정된 예약은 같은 성공을 돌려준다 */
  confirm(reference: string, actor: BookingActor): Promise<BookingResult<BookingChange>>
  /**
   * 직원(대표·관리자)용 예약 목록 — 상태로 거르고 접수 번호 일부로 찾는다. 시작이 늦은 것부터, `total` 은 거른 전체 건수(페이지 넘기기는 limit·offset).
   * 연락처·이름·메모가 그대로 든다 — 화면에 내보낼 때 가리는 일은 부르는 쪽(관리 콘솔)이 한다. 직원이 아니면 forbidden
   */
  listForStaff(actor: BookingActor, query?: BookingStaffQuery): Promise<BookingResult<{ rows: BookingStaffRow[]; total: number }>>
  /** 직원이 예약 한 건을 본다(접수 번호만 알면 된다). 직원이 아니면 forbidden, 없으면 not_found */
  getForStaff(actor: BookingActor, reference: string): Promise<BookingResult<BookingStaffRow>>
  /** Cron: reminderBeforeMinutes 안에 든 확정 예약에 시작 전 안내를 한 번만 보낸다. 보낸(차지한) 예약 수를 돌려준다 */
  remindDue(): Promise<number>
  /** 보유 기간이 지난 예약을 지운다(Cron). 지운 수를 돌려준다 */
  purgeExpired(): Promise<number>
}

const isMailLink = (value: string): boolean => {
  try {
    const u = new URL(value)
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))
  } catch {
    return false
  }
}

export function createBookingService(o: BookingServiceOptions): BookingService {
  const config: BookingConfig = parseBookingConfig(o.config)
  const owner = o.owner
  if (owner !== undefined && (typeof owner.email !== "string" || !EMAIL.test(owner.email))) throw new Error("booking service needs a valid owner.email — omit owner to turn bookings off")
  if (!o.productName) throw new Error("booking service needs productName")
  for (const [name, value] of [["manageUrl", o.manageUrl], ["bookUrl", o.bookUrl], ["adminUrl", o.adminUrl]] as const) {
    if (value !== undefined && !isMailLink(value)) throw new Error(`booking service ${name} must be an absolute https URL`)
  }
  const now = o.now ?? (() => new Date())
  const rules: StaffRules = { ...(o.adminRoles ? { adminRoles: o.adminRoles } : {}), ...(o.adminUserIds ? { adminUserIds: o.adminUserIds } : {}) }
  const ownerLocale: Locale = owner?.locale ?? "ko"
  const onError = (e: Error) => (o.onError ?? ((x: Error) => console.error(x.message)))(new Error(maskPii(e.message)))

  // ── 작은 도우미 ─────────────────────────────────────────────────────────────────
  const localeOf = (row: BookingRow): Locale => (isLocale(row.locale) ? row.locale : "ko")
  const serviceName = (id: string, locale: Locale): string => findService(config, id)?.name[locale] ?? id
  const defaultExpiry = (startsAt: Date) => new Date(startsAt.getTime() + config.retainDays * DAY_MS)
  /** 예약금을 받은 건은 계약·결제 기록이라 5년(전자상거래법 시행령 제6조①2·3) — 설정 보유 기간이 더 길면 그쪽 */
  const depositExpiry = (startsAt: Date) => new Date(Math.max(defaultExpiry(startsAt).getTime(), retainUntil("contract", startsAt).getTime()))
  const cancelByOf = (row: BookingRow) => new Date(row.startsAt.getTime() - config.cancelBeforeMinutes * MINUTE_MS)
  const failure = (code: NonNullable<BookingFailure["code"]>, locale: Locale, key: Parameters<typeof t>[1], retryable = false): BookingFailure => ({ ok: false, code, retryable, formError: t(locale, key) })
  const notFound = (locale: Locale) => failure("not_found", locale, "booking.notFound")
  const unavailable = (locale: Locale) => failure("provider_unavailable", locale, "booking.unavailable")
  const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

  /** 보조 일(메일·알림·예약금 훅)은 실패해도 던지지 않는다 — 이미 저장된 예약을 되돌리지 않고 onError 로만 알린다 */
  async function attempt<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn()
    } catch (e) {
      const err = toError(e)
      onError(new Error(`${what} threw (${err.name}): ${err.message}`))
      return undefined
    }
  }

  async function notify(kind: BookingNoticeKind, booking: BookingRow): Promise<void> {
    if (!o.notify) return
    const send = o.notify
    await attempt(`booking ${booking.reference}: ${kind} notification`, () => send({ kind, booking, locale: localeOf(booking) }))
  }

  // ── 예약금 도우미 ───────────────────────────────────────────────────────────────
  /** 예약금이 걸린 예약인가(금액이 박힌 행). 3b 의 옛 행(금액 칸 없음)은 예약금 없는 예약으로 다룬다 */
  const hasDeposit = (row: BookingRow): boolean => (row.depositAmount ?? 0) > 0 && row.depositStatus !== "none"
  const money = (amount: number) => ({ amount, currency: "KRW" as const, vatIncluded: true })
  const clock = (d: Date, locale: Locale): string => new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { timeZone: config.timeZone, dateStyle: "medium", timeStyle: "short" }).format(d)
  /** 환불 규정 안내(메일·조회 공통) — 같은 계산(refundFor)을 쓴다 */
  const refundNote = (row: BookingRow) => {
    const r = refundFor(config, row.startsAt, row.depositAmount ?? 0, now())
    return { fullBefore: r.fullBefore.toISOString(), laterPercent: depositRules(config).laterRefundPercent }
  }

  /** 예약한 사람에게 확인 메일(이메일 연락처만). 보냈으면 confirmationSentAt 을 남긴다 */
  async function mailBooker(row: BookingRow, mode: "status" | "reminder"): Promise<BookingRow> {
    if (row.contactKind !== "email") return row
    const locale = localeOf(row)
    const status = row.status === "confirmed" ? "confirmed" : "requested"
    const cancelBy = cancelByOf(row)
    // 결제 대기 건은 「예약금을 결제해 주세요」 안내이고(키도 따로 — 결제 뒤 확정 메일과 겹치지 않는다), 결제가 끝난 건은 보통 확정·접수 메일 + 예약금 줄이다
    const pending = hasDeposit(row) && row.depositStatus === "pending" && mode === "status"
    const deposit = hasDeposit(row) && (pending || row.depositStatus === "paid")
      ? { state: pending ? ("pending" as const) : ("paid" as const), amount: money(row.depositAmount ?? 0), ...(pending && row.depositDueAt ? { payBy: row.depositDueAt.toISOString() } : {}), refund: refundNote(row) }
      : undefined
    const sent = await attempt(`booking ${row.reference}: confirmation mail`, () =>
      o.mailer.send({
        to: row.contact,
        template: "bookingConfirmation",
        idempotencyKey: `booking-confirmation:${row.id}:${mode === "reminder" ? "reminder" : pending ? "deposit-pending" : status}`,
        input: {
          locale,
          productName: o.productName,
          timeZone: config.timeZone,
          reference: row.reference,
          serviceName: serviceName(row.service, locale),
          startsAt: row.startsAt.toISOString(),
          partySize: row.partySize,
          status,
          ...(mode === "reminder" ? { reminder: true } : {}),
          ...(cancelBy.getTime() > now().getTime() ? { cancelBy: cancelBy.toISOString() } : {}),
          ...(o.manageUrl ? { manageUrl: o.manageUrl } : {}),
          ...(deposit ? { deposit } : {}),
        },
      }),
    )
    if (!sent) return row
    if (!sent.ok) {
      onError(new Error(`booking ${row.reference}: confirmation mail failed (${sent.error.name})`))
      return row
    }
    return mode === "reminder" ? row : ((await updateBooking(o.db, row.id, { confirmationSentAt: now() })) ?? row)
  }

  /** 새 예약을 운영자께 알린다(예약금이 있으면 결제가 끝난 뒤에 — 결제 대기 건은 아직 예약이 아니다) */
  async function mailOwner(row: BookingRow): Promise<BookingRow> {
    if (!owner) return row
    const target = owner
    const sent = await attempt(`booking ${row.reference}: owner notice`, () =>
      o.mailer.send({
        to: target.email,
        template: "bookingNotice",
        idempotencyKey: `booking-notice:${row.id}`,
        input: {
          locale: ownerLocale,
          productName: o.productName,
          timeZone: target.timeZone ?? config.timeZone,
          reference: row.reference,
          serviceName: serviceName(row.service, ownerLocale),
          startsAt: row.startsAt.toISOString(),
          partySize: row.partySize,
          status: row.status === "confirmed" ? "confirmed" : "requested",
          ...(row.name ? { name: row.name } : {}),
          contact: row.contact,
          ...(row.note ? { note: row.note } : {}),
          deleteOn: row.expiresAt.toISOString(),
          ...(o.adminUrl ? { adminUrl: o.adminUrl } : {}),
          ...(hasDeposit(row) && row.depositStatus === "paid" ? { depositPaid: money(row.depositAmount ?? 0) } : {}),
        },
      }),
    )
    if (!sent) return row
    if (!sent.ok) {
      onError(new Error(`booking ${row.reference}: owner notice failed (${sent.error.name})`))
      return row
    }
    return (await updateBooking(o.db, row.id, { ownerNotifiedAt: now() })) ?? row
  }

  async function mailCancellation(row: BookingRow, by: "booker" | "owner" | "system", deposit?: { outcome: "expired" | "refunded" | "partial" | "forfeited"; refunded?: number }): Promise<void> {
    if (row.contactKind !== "email") return
    const locale = localeOf(row)
    const sent = await attempt(`booking ${row.reference}: cancellation mail`, () =>
      o.mailer.send({
        to: row.contact,
        template: "bookingCancellation",
        idempotencyKey: `booking-cancellation:${row.id}`,
        input: {
          locale,
          productName: o.productName,
          timeZone: config.timeZone,
          reference: row.reference,
          serviceName: serviceName(row.service, locale),
          startsAt: row.startsAt.toISOString(),
          cancelledBy: by,
          ...(o.bookUrl ? { bookUrl: o.bookUrl } : {}),
          ...(deposit ? { deposit: { outcome: deposit.outcome, ...(deposit.refunded ? { refunded: money(deposit.refunded) } : {}) } } : {}),
        },
      }),
    )
    if (sent && !sent.ok) onError(new Error(`booking ${row.reference}: cancellation mail failed (${sent.error.name})`))
  }

  // ── 접수 ────────────────────────────────────────────────────────────────────────
  /** 결제 대기를 닫는다(내지 않고 닫힘). 이긴 쪽만 행을 돌려준다 — 결제 확정·환불·만료가 동시에 와도 한 번만 닫힌다 */
  const voidHold = (row: BookingRow, by: "booker" | "owner" | "system", at: Date) =>
    moveDeposit(o.db, row.id, { status: ["requested"], deposit: ["pending"] }, { status: "cancelled", cancelledAt: at, cancelledBy: by, depositStatus: "voided", updatedAt: at })

  async function store(p: Extract<Parsed, { ok: true }>, ctx: SubmitContext, locale: Locale, at: Date): Promise<BookingResult<BookingReceipt>> {
    const price = depositOf(p.service)
    // 예약금이 있는 접수는 일단 「요청」으로 저장한다 — 결제가 끝나야 확정(instant)·운영자 확인(request)으로 이어진다
    const status = price > 0 ? "requested" : config.mode === "instant" ? "confirmed" : "requested"
    const rules = depositRules(config)
    const dueAt = new Date(Math.min(at.getTime() + rules.holdMinutes * MINUTE_MS, p.startsAt.getTime()))
    const saved = await bookByCapacity(o.db, {
      capacity: p.service.capacity,
      row: {
        reference: newReference(),
        service: p.service.id,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        partySize: p.partySize,
        name: p.name ?? null,
        contact: p.contact,
        contactKind: p.contactKind,
        note: p.note ?? null,
        status,
        locale,
        userId: ctx.userId ?? null,
        createdAt: at,
        updatedAt: at,
        expiresAt: price > 0 ? depositExpiry(p.startsAt) : defaultExpiry(p.startsAt),
        ...(price > 0 ? { depositStatus: "pending" as const, depositAmount: price, depositCurrency: "KRW", depositDueAt: dueAt } : {}),
      },
    })
    if (!saved.ok) return failure("slot_taken", locale, "booking.slotTaken", true)
    let row = saved.row

    if (price > 0) {
      const deposit = o.deposit as DepositHook // run() 이 훅 없음을 먼저 거절한다
      const charge = { amount: price, currency: "KRW" as const, orderName: t(locale, "booking.depositOrderName", { service: serviceName(p.service.id, locale) }) }
      const held = await attempt(`booking ${row.reference}: deposit hold`, () => deposit.hold(row, charge))
      if (!held?.ok) {
        // 결제를 열지 못했으면 자리를 풀어 준다(결제 없는 예약을 남기지 않는다)
        await voidHold(row, "system", now())
        if (held && !held.ok) onError(new Error(`booking ${row.reference}: deposit hold declined`))
        return failure("deposit_failed", locale, "booking.depositFailed", true)
      }
      row = (await updateBooking(o.db, row.id, { depositRef: held.ref, updatedAt: now() })) ?? row
      row = await mailBooker(row, "status")
      return {
        ok: true,
        data: {
          id: row.reference,
          startsAt: row.startsAt.toISOString(),
          status: "requested",
          message: t(locale, "booking.depositPending", { reference: row.reference, until: clock(dueAt, locale) }),
          deposit: { amount: price, currency: "KRW", payBy: dueAt.toISOString(), session: held.session },
        },
      }
    }

    row = await mailOwner(row)
    row = await mailBooker(row, "status")
    await notify(status === "confirmed" ? "confirmed" : "received", row)
    return { ok: true, data: { id: row.reference, startsAt: row.startsAt.toISOString(), status, message: t(locale, status === "confirmed" ? "booking.confirmed" : "booking.received", { reference: row.reference }) } }
  }

  async function submit(input: BookingInput, ctx: SubmitContext = {}): Promise<BookingResult<BookingReceipt>> {
    const f = readFields(input)
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : isLocale(f.get("locale")) ? (f.get("locale") as Locale) : "ko"
    // 받을 사람이 없으면 접수하지 않는다 — 저장하고 알림을 버리는 것(받은 척)이 가장 나쁘다. 요청 제한·봇 확인·DB 에 닿기 전에 거절한다
    if (!owner) return unavailable(locale)
    try {
      const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }
      const rate = blockedByRate(await o.limiter.check(BOOKING_ROUTES.submit, who))
      if (rate) return blockedResult(rate, locale)

      const key = f.get("idempotencyKey")
      const at = now()
      const run = async (): Promise<BookingResult<BookingReceipt>> => {
        const parsed = parseBookingInput(f, config, locale, at)
        if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
        // 예약금이 있는 서비스인데 결제 훅이 없으면 받지 않는다(예약금 없이 받은 척하지 않는다)
        if (depositOf(parsed.service) > 0 && !o.deposit) return failure("provider_unavailable", locale, "booking.depositRequired")
        // 결제 대기 시간이 지난 예약은 먼저 풀어서 그 자리를 다시 내준다
        await attempt("booking: release expired deposit holds", () => releaseExpired(parsed.service.id))
        // 이미 찬 자리는 Turnstile 앞에서 알린다(토큰을 태우지 않는다). 동시에 들어온 요청은 저장 트랜잭션이 막는다
        const held = await holdingBetween(o.db, parsed.service.id, parsed.startsAt, parsed.endsAt)
        if (held.length >= parsed.service.capacity) return failure("slot_taken", locale, "booking.slotTaken", true)
        const bot = blockedByBot(await o.turnstile.verify({ token: f.get(TURNSTILE_FIELD), remoteIp: o.limiter.ip(who), ...(key ? { idempotencyKey: key } : {}) }))
        if (bot) return blockedResult(bot, locale)
        return store(parsed, ctx, locale, at)
      }
      if (!key || !IDEMPOTENCY_KEY.test(key)) return await run()
      const outcome = await withIdempotency(o.db, { scope: `booking:${BOOKING_ROUTES.submit}`, key, now: at }, run)
      if ("inProgress" in outcome) return { ok: false, code: "in_progress", retryable: true, formError: t(locale, "protect.inProgress") }
      return outcome.result
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "booking.failed") }
    }
  }

  // ── 가능 시간 ───────────────────────────────────────────────────────────────────
  async function slots(input: { service: string; from: string; days?: number }, ctx: Pick<SubmitContext, "locale"> = {}): Promise<BookingResult<SlotsResult>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "ko"
    if (!owner) return unavailable(locale)
    const fieldErrors: Record<string, string[]> = {}
    const svc = typeof input?.service === "string" ? findService(config, input.service) : undefined
    if (!svc) fieldErrors.service = [t(locale, "booking.serviceUnknown")]
    if (!isCalendarDate(input?.from)) fieldErrors.from = [t(locale, "booking.invalidDate")]
    const days = input?.days ?? DEFAULT_SLOT_DAYS
    if (!Number.isInteger(days) || days < 1 || days > MAX_SLOT_DAYS) fieldErrors.days = [t(locale, "booking.invalidDate")]
    if (Object.keys(fieldErrors).length || !svc) return { ok: false, fieldErrors }
    try {
      await attempt("booking: release expired deposit holds", () => releaseExpired(svc.id))
      // 시간대 차이와 서비스 길이만큼 넉넉히 잡아 걸치는 예약을 놓치지 않는다(겹침은 computeSlots 가 정확히 센다)
      const base = Date.parse(`${input.from}T00:00:00Z`)
      const pad = 2 * DAY_MS + svc.durationMin * MINUTE_MS
      const taken = await holdingBetween(o.db, svc.id, new Date(base - pad), new Date(base + days * DAY_MS + pad))
      const result = computeSlots(config, svc, input.from, days, taken, now())
      return { ok: true, data: { days: result.map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ startsAt: s.startsAt.toISOString(), available: s.available })) })) } }
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "booking.failed") }
    }
  }

  // ── 결제 확정 · 만료 ─────────────────────────────────────────────────────────────
  type Settled = { kind: DepositClaim; result: BookingResult<DepositConfirmation> }
  const confirmation = (r: BookingRow, changed: boolean, locale: Locale): BookingResult<DepositConfirmation> => ({
    ok: true,
    data: { id: r.reference, status: r.status, depositStatus: r.depositStatus, changed, message: t(locale, r.status === "confirmed" ? "booking.confirmed" : "booking.received", { reference: r.reference }) },
  })

  /**
   * 닫힌(voided) 예약에 뒤늦게 들어온 결제를 돌려준다. 공급자가 「결제됨」으로 볼 때만 환불하므로 몇 번 불러도 한 번이다
   * (환불이 끝나면 공급자 상태가 canceled 가 된다). 환불이 실패하면 pending 으로 알려 웹훅·반환 쪽이 다시 부르게 한다.
   */
  async function refundLate(row: BookingRow, locale: Locale): Promise<Settled> {
    const deposit = o.deposit
    if (!deposit) return { kind: "pending", result: unavailable(locale) }
    let verdict
    try {
      verdict = await deposit.verify(row)
    } catch (e) {
      onError(new Error(`booking ${row.reference}: late payment check threw (${toError(e).message})`))
      return { kind: "pending", result: failure("payment_pending", locale, "booking.paymentPending", true) }
    }
    if (verdict.status !== "paid") return { kind: "not_applicable", result: failure("invalid_state", locale, "booking.paymentFailed", true) }
    const amount = verdict.amount
    const refunded = await attempt(`booking ${row.reference}: late payment refund`, () => deposit.refund(row, { amount, full: true, reason: "booking closed before payment" }))
    if (!refunded?.ok) {
      onError(new Error(`booking ${row.reference}: late payment refund failed — refund it by hand`))
      return { kind: "pending", result: failure("deposit_failed", locale, "booking.refundFailed", true) }
    }
    await moveDeposit(o.db, row.id, { deposit: ["voided"] }, { depositRefundedAmount: Math.min(amount, row.depositAmount ?? amount), depositPaidAt: now(), updatedAt: now() })
    return { kind: "not_applicable", result: failure("invalid_state", locale, "booking.paymentLate") }
  }

  /**
   * 결제 확정의 유일한 길. 공급자에 다시 물어(verify) 결제됐고 금액이 **예약 행에 박힌 금액**과 같을 때만 확정한다.
   * 확정은 조건부 UPDATE(pending → paid)라 반환 쪽과 웹훅이 동시에 와도 이긴 쪽만 메일·알림을 보낸다.
   */
  async function settle(row: BookingRow, locale: Locale, depth = 0): Promise<Settled> {
    if (!hasDeposit(row)) return { kind: "not_applicable", result: failure("invalid_state", locale, "booking.invalidState") }
    if (row.depositStatus === "paid" || row.depositStatus === "refunding" || row.depositStatus === "refunded" || row.depositStatus === "forfeited") return { kind: "already_confirmed", result: confirmation(row, false, locale) }
    if (row.depositStatus === "voided") return refundLate(row, locale)
    const deposit = o.deposit
    if (!deposit) return { kind: "pending", result: unavailable(locale) }
    let verdict
    try {
      verdict = await deposit.verify(row)
    } catch (e) {
      onError(new Error(`booking ${row.reference}: payment check threw (${toError(e).message})`))
      return { kind: "pending", result: failure("payment_pending", locale, "booking.paymentPending", true) }
    }
    if (verdict.status === "pending" || verdict.status === "not_found") return { kind: "pending", result: failure("payment_pending", locale, "booking.paymentPending", true) }
    if (verdict.status !== "paid") return { kind: "not_applicable", result: failure("deposit_failed", locale, "booking.paymentFailed", true) }
    if (verdict.amount !== row.depositAmount || verdict.currency !== "KRW") {
      // 금액이 서버 설정과 다르다(위조·설정 변경) — 결제를 돌려주고 예약을 닫는다
      onError(new Error(`booking ${row.reference}: paid amount differs from the booking deposit — refunding`))
      const closed = await voidHold(row, "system", now())
      const current = closed ?? (await getBookingByReference(o.db, row.reference)) ?? row
      if (current.depositStatus === "voided") await refundLate(current, locale)
      return { kind: "not_applicable", result: failure("deposit_failed", locale, "booking.paymentMismatch") }
    }
    const at = now()
    const status = config.mode === "instant" ? "confirmed" : "requested"
    const won = await moveDeposit(o.db, row.id, { status: ["requested"], deposit: ["pending"] }, { status, depositStatus: "paid", depositPaidAt: at, updatedAt: at })
    if (!won) {
      // 다른 쪽이 먼저 확정·취소·만료했다 — 지금 상태로 다시 판단한다(한 번만 되짚는다)
      const current = await getBookingByDepositRef(o.db, row.depositRef ?? "")
      if (!current || depth > 0) return { kind: "pending", result: failure("payment_pending", locale, "booking.paymentPending", true) }
      return settle(current, locale, depth + 1)
    }
    let paid: BookingRow = won
    paid = await mailOwner(paid)
    paid = await mailBooker(paid, "status")
    await notify(status === "confirmed" ? "confirmed" : "received", paid)
    return { kind: "confirmed", result: confirmation(paid, true, locale) }
  }

  async function confirmDeposit(input: { paymentId: string }, ctx: SubmitContext = {}): Promise<BookingResult<DepositConfirmation>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "ko"
    try {
      const rate = blockedByRate(await o.limiter.check(BOOKING_ROUTES.lookup, { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }))
      if (rate) return blockedResult(rate, locale)
      const id = typeof input?.paymentId === "string" ? input.paymentId.trim() : ""
      const row = id && id.length <= 200 ? await getBookingByDepositRef(o.db, id) : undefined
      if (!row) return notFound(locale)
      return (await settle(row, localeOf(row))).result
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "booking.failed") }
    }
  }

  async function claimPayment(paymentId: string): Promise<DepositClaim> {
    const row = typeof paymentId === "string" && paymentId ? await getBookingByDepositRef(o.db, paymentId) : undefined
    if (!row) return "not_mine"
    return (await settle(row, localeOf(row))).kind
  }

  /** 결제 대기 시간이 지난 예약을 풀어 준다. 공급자가 이미 결제됐다고 하면 닫지 않고 확정한다. 닫은 수를 돌려준다 */
  async function releaseExpired(serviceId?: string, limit = 50): Promise<number> {
    const at = now()
    const due = await listExpiredDepositHolds(o.db, at, { ...(serviceId ? { service: serviceId } : {}), limit })
    let closed = 0
    for (const row of due) {
      if (o.deposit) {
        // 기한 직전에 결제됐을 수 있다 — 공급자에 한 번 물어 본다. 못 물으면 닫지 않고 다음에 다시 본다(결제된 자리를 풀지 않는다)
        let verdict
        try {
          verdict = await o.deposit.verify(row)
        } catch (e) {
          onError(new Error(`booking ${row.reference}: expiry check threw (${toError(e).message}) — kept for the next sweep`))
          continue
        }
        if (verdict.status === "paid") {
          await settle(row, localeOf(row))
          continue
        }
      }
      const voided = await voidHold(row, "system", now())
      if (!voided) continue
      closed++
      await mailCancellation(voided, "system", { outcome: "expired" })
    }
    return closed
  }

  // ── 조회·취소·확정 ───────────────────────────────────────────────────────────────
  /** 예약 번호 + 연락처가 모두 맞는 예약. 예약이 없어도 같은 비교를 한 번 돌려 시간으로 존재를 알리지 않는다 */
  async function findOwned(reference: string, contact: string): Promise<BookingRow | null> {
    const ref = normalizeReference(reference)
    const row = ref ? await getBookingByReference(o.db, ref) : undefined
    const same = sameContact(typeof contact === "string" ? contact : "", row?.contact ?? "\u0000")
    return row && same && normalizeContact(row.contact) !== "" ? row : null
  }

  /** 환불 처리가 멈춘 것으로 보는 시간 — 이 시간이 지난 refunding 은 이어서 처리해도 된다 */
  const REFUND_STALE_MS = 5 * MINUTE_MS

  /** 취소 결과의 예약금 요약 */
  const depositChange = (r: BookingRow): BookingChange["deposit"] | undefined =>
    hasDeposit(r) ? { status: r.depositStatus, ...(r.depositRefundedAmount != null ? { refundedAmount: r.depositRefundedAmount } : {}) } : undefined

  /**
   * 상태 바꾸기 공통(취소). 이미 취소된 예약은 성공으로 돌려주고 아무것도 다시 하지 않는다.
   * 결제 대기 건은 닫기만 하고, 결제가 끝난 건은 환불 규정(refundFor)대로 **돌려준 뒤에만** 취소로 바꾼다 — 환불이 실패하면 예약은 그대로다(재시도 가능).
   */
  async function cancelRow(first: BookingRow, by: "booker" | "owner" | "system", locale: Locale, enforceDeadline: boolean): Promise<BookingResult<BookingChange>> {
    const done = (r: BookingRow, text: Parameters<typeof t>[1] = "booking.cancelled"): BookingResult<BookingChange> => {
      const deposit = depositChange(r)
      return { ok: true, data: { id: r.reference, status: "cancelled", message: t(locale, text), ...(deposit ? { deposit } : {}) } }
    }
    let row = first
    // 동시에 다른 쪽이 상태를 바꿔도 몇 번 되짚으면 끝난다(같은 요청이 같은 일을 두 번 하지 않는다)
    for (let turn = 0; turn < 3; turn++) {
      if (row.status === "cancelled") return done(row, row.depositStatus === "refunded" ? ((row.depositRefundedAmount ?? 0) >= (row.depositAmount ?? 0) ? "booking.cancelledRefunded" : "booking.cancelledPartial") : row.depositStatus === "forfeited" ? "booking.cancelledForfeited" : "booking.cancelled")
      if (!isHolding(row.status)) return failure("invalid_state", locale, "booking.invalidState")
      if (enforceDeadline && now().getTime() > cancelByOf(row).getTime()) return failure("cancel_closed", locale, "booking.cancelClosed")
      const at = now()

      if (hasDeposit(row) && row.depositStatus === "pending") {
        // 취소 직전에 결제가 끝났을 수 있다 — 한 번 확인해 결제됐으면 아래 환불 길로 간다
        if (o.deposit && turn === 0) {
          const settled = await attempt(`booking ${row.reference}: payment check before cancel`, () => settle(row, locale))
          if (settled && (settled.kind === "confirmed" || settled.kind === "already_confirmed")) {
            row = (await getBookingByReference(o.db, row.reference)) ?? row
            continue
          }
        }
        const voided = await voidHold(row, by, at)
        if (voided) {
          await mailCancellation(voided, by)
          return done(voided)
        }
        row = (await getBookingByReference(o.db, row.reference)) ?? row
        continue
      }

      const refundable = hasDeposit(row) && (row.depositStatus === "paid" || row.depositStatus === "refunding")
      if (refundable) {
        const price = row.depositAmount ?? 0
        const stale = row.depositStatus === "refunding" && row.updatedAt.getTime() <= at.getTime() - REFUND_STALE_MS
        if (row.depositStatus === "refunding" && !stale) return { ok: false, code: "in_progress", retryable: true, formError: t(locale, "protect.inProgress") }
        const plan = refundFor(config, row.startsAt, price, at, by)
        // 환불하겠다는 표시를 먼저 차지한다 — 같은 취소가 겹쳐 와도 환불은 한 번이다
        const claimed = await moveDeposit(
          o.db,
          row.id,
          { status: ["requested", "confirmed"], deposit: [row.depositStatus], ...(stale ? { updatedBefore: new Date(at.getTime() - REFUND_STALE_MS) } : {}) },
          { depositStatus: "refunding", updatedAt: at },
        )
        if (!claimed) {
          row = (await getBookingByReference(o.db, row.reference)) ?? row
          continue
        }
        if (plan.amount > 0) {
          const hook = o.deposit
          const refund = hook ? await attempt(`booking ${row.reference}: deposit refund`, () => hook.refund(claimed, { amount: plan.amount, full: plan.amount === price, reason: `booking cancelled by ${by}` })) : undefined
          if (!refund?.ok) {
            // 돌려주지 못했다 — 취소하지 않고 결제 끝 상태로 되돌린다. 운영자께 알려 직접 처리하거나 다시 시도하게 한다
            await moveDeposit(o.db, row.id, { deposit: ["refunding"] }, { depositStatus: "paid", updatedAt: now() })
            onError(new Error(`booking ${row.reference}: deposit refund failed (${refund?.code ?? "no result"}) — booking kept; retry the cancel or refund it by hand`))
            return failure("deposit_failed", locale, "booking.refundFailed", true)
          }
        }
        const finished = await moveDeposit(
          o.db,
          row.id,
          { deposit: ["refunding"] },
          { status: "cancelled", cancelledAt: at, cancelledBy: by, depositStatus: plan.amount > 0 ? "refunded" : "forfeited", depositRefundedAmount: plan.amount, updatedAt: now() },
        )
        const closed = finished ?? (await getBookingByReference(o.db, row.reference)) ?? claimed
        const outcome = plan.amount === 0 ? "forfeited" : plan.amount === price ? "refunded" : "partial"
        await mailCancellation(closed, by, { outcome, ...(plan.amount > 0 ? { refunded: plan.amount } : {}) })
        await notify("cancelled", closed)
        return done(closed, outcome === "refunded" ? "booking.cancelledRefunded" : outcome === "partial" ? "booking.cancelledPartial" : "booking.cancelledForfeited")
      }

      // 예약금 없는 예약(또는 3b 의 옛 행) — 예전 그대로
      // 상태가 아직 자리를 차지하는 동안에만 취소로 바꾼다 — 동시에 확정·취소가 와도 한쪽만 이긴다
      const cancelledRow = await transitionBooking(o.db, row.id, ["requested", "confirmed"], { status: "cancelled", cancelledAt: at, cancelledBy: by, updatedAt: at })
      if (!cancelledRow) {
        const current = await getBookingByReference(o.db, row.reference)
        return current?.status === "cancelled" ? done(current) : failure("invalid_state", locale, "booking.invalidState")
      }
      await mailCancellation(cancelledRow, by)
      await notify("cancelled", cancelledRow)
      return done(cancelledRow)
    }
    return failure("invalid_state", locale, "booking.invalidState")
  }

  function depositView(row: BookingRow): BookingDepositView | undefined {
    if (!hasDeposit(row)) return undefined
    const plan = refundFor(config, row.startsAt, row.depositAmount ?? 0, now())
    return {
      status: row.depositStatus,
      amount: row.depositAmount ?? 0,
      currency: "KRW",
      ...(row.depositStatus === "pending" && row.depositDueAt ? { payBy: row.depositDueAt.toISOString() } : {}),
      ...(row.depositRefundedAmount != null ? { refundedAmount: row.depositRefundedAmount } : {}),
      fullRefundBy: plan.fullBefore.toISOString(),
      laterRefundPercent: depositRules(config).laterRefundPercent,
    }
  }

  async function lookup(input: { reference: string; contact: string }, ctx: SubmitContext = {}): Promise<BookingResult<BookingView>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "ko"
    try {
      const rate = blockedByRate(await o.limiter.check(BOOKING_ROUTES.lookup, { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }))
      if (rate) return blockedResult(rate, locale)
      const row = await findOwned(input?.reference, input?.contact)
      if (!row) return notFound(locale)
      const cancelBy = cancelByOf(row)
      const deposit = depositView(row)
      return {
        ok: true,
        data: {
          id: row.reference,
          service: row.service,
          serviceName: serviceName(row.service, locale),
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          partySize: row.partySize,
          status: row.status,
          canCancel: isHolding(row.status) && now().getTime() <= cancelBy.getTime(),
          cancelBy: cancelBy.toISOString(),
          ...(deposit ? { deposit } : {}),
        },
      }
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "booking.failed") }
    }
  }

  async function cancel(input: { reference: string; contact: string }, ctx: SubmitContext = {}): Promise<BookingResult<BookingChange>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "ko"
    try {
      const rate = blockedByRate(await o.limiter.check(BOOKING_ROUTES.lookup, { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }))
      if (rate) return blockedResult(rate, locale)
      const row = await findOwned(input?.reference, input?.contact)
      if (!row) return notFound(locale)
      return await cancelRow(row, "booker", locale, true)
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "booking.failed") }
    }
  }

  async function cancelAs(reference: string, actor: BookingActor): Promise<BookingResult<BookingChange>> {
    if (!isSystemActor(actor) && !isStaffActor(actor, rules)) return failure("forbidden", ownerLocale, "booking.forbidden")
    try {
      const ref = normalizeReference(reference)
      const row = ref ? await getBookingByReference(o.db, ref) : undefined
      if (!row) return notFound(ownerLocale)
      return await cancelRow(row, isSystemActor(actor) ? "system" : "owner", ownerLocale, false)
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(ownerLocale, "booking.failed") }
    }
  }

  async function confirm(reference: string, actor: BookingActor): Promise<BookingResult<BookingChange>> {
    if (!isStaffActor(actor, rules)) return failure("forbidden", ownerLocale, "booking.forbidden")
    try {
      const ref = normalizeReference(reference)
      const row = ref ? await getBookingByReference(o.db, ref) : undefined
      if (!row) return notFound(ownerLocale)
      const done = (r: BookingRow): BookingResult<BookingChange> => ({ ok: true, data: { id: r.reference, status: "confirmed", message: t(ownerLocale, "booking.confirmedByOwner") } })
      if (row.status === "confirmed") return done(row)
      // 예약금 결제를 기다리는 예약은 확정하지 않는다 — 결제가 끝나면 서비스가 알아서 이어 간다
      if (row.depositStatus === "pending") return failure("payment_pending", ownerLocale, "booking.paymentPending", true)
      // 지난 시각의 요청을 확정하는 것은 뜻이 없다(손님은 이미 오지 않았다) — 거절한다
      if (row.status !== "requested" || row.startsAt.getTime() <= now().getTime()) return failure("invalid_state", ownerLocale, "booking.invalidState")
      // 요청 상태일 때만 확정한다 — 그 사이 취소됐다면 되살리지 않는다(수용량이 이미 비어 다른 손님에게 갔을 수 있다)
      const confirmed = await transitionBooking(o.db, row.id, ["requested"], { status: "confirmed", updatedAt: now() })
      if (!confirmed) return failure("invalid_state", ownerLocale, "booking.invalidState")
      const mailed = await mailBooker(confirmed, "status")
      await notify("confirmed", mailed)
      return done(mailed)
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(ownerLocale, "booking.failed") }
    }
  }

  const staffRow = (r: BookingRow): BookingStaffRow => ({
    reference: r.reference,
    service: r.service,
    serviceName: serviceName(r.service, ownerLocale),
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    partySize: r.partySize,
    status: r.status,
    name: r.name,
    contact: r.contact,
    contactKind: r.contactKind,
    note: r.note,
    depositStatus: r.depositStatus,
    depositAmount: r.depositAmount,
    depositRefundedAmount: r.depositRefundedAmount,
    createdAt: r.createdAt.toISOString(),
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
    cancelledBy: r.cancelledBy,
  })

  const STAFF_MAX_ROWS = 200
  const STAFF_SEARCH_MAX = 40
  const STATUSES: readonly BookingRow["status"][] = ["requested", "confirmed", "cancelled", "completed", "no_show"]

  async function listForStaff(actor: BookingActor, query: BookingStaffQuery = {}): Promise<BookingResult<{ rows: BookingStaffRow[]; total: number }>> {
    if (!isStaffActor(actor, rules)) return failure("forbidden", ownerLocale, "booking.forbidden")
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    if (!Number.isInteger(limit) || limit < 1 || limit > STAFF_MAX_ROWS || !Number.isInteger(offset) || offset < 0) return failure("invalid_input", ownerLocale, "booking.failed")
    if (query.status !== undefined && !STATUSES.includes(query.status)) return failure("invalid_input", ownerLocale, "booking.failed")
    // 접수 번호는 헷갈리는 글자(I·L·O)가 없다 — 사람이 적은 대로 느슨하게 찾는다
    const loose = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, STAFF_SEARCH_MAX).toUpperCase().replace(/[\s_]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0") : "")
    const search = typeof query.search === "string" ? query.search.trim().slice(0, STAFF_SEARCH_MAX) : ""
    // 검색 칸의 글자는 접수 번호처럼도(느슨하게), 연락처·이름 일부로도 찾는다
    const reference = loose(query.reference ?? search)
    try {
      const { rows, total } = await listBookings(o.db, { limit, offset, ...(query.status ? { status: query.status } : {}), ...(reference ? { reference } : {}), ...(search ? { search } : {}) })
      return { ok: true, data: { rows: rows.map(staffRow), total } }
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(ownerLocale, "booking.failed") }
    }
  }

  async function getForStaff(actor: BookingActor, reference: string): Promise<BookingResult<BookingStaffRow>> {
    if (!isStaffActor(actor, rules)) return failure("forbidden", ownerLocale, "booking.forbidden")
    try {
      const ref = normalizeReference(reference)
      const row = ref ? await getBookingByReference(o.db, ref) : undefined
      return row ? { ok: true, data: staffRow(row) } : notFound(ownerLocale)
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(ownerLocale, "booking.failed") }
    }
  }

  async function remindDue(): Promise<number> {
    if (config.reminderBeforeMinutes === 0) return 0
    const at = now()
    const due = await listDueReminders(o.db, at, new Date(at.getTime() + config.reminderBeforeMinutes * MINUTE_MS))
    let claimed = 0
    for (const row of due) {
      // 차지한 쪽만 보낸다 — Cron 이 겹쳐 돌아도 한 예약에 한 번이다
      if (!(await claimReminder(o.db, row.id, at))) continue
      claimed++
      const sent = await mailBooker({ ...row, reminderSentAt: at }, "reminder")
      await notify("reminder", sent)
    }
    return claimed
  }

  return {
    enabled: owner !== undefined,
    slots,
    submit,
    action: (ctx = {}) => (input) => submit(input, ctx),
    async handler(request, ctx = {}) {
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } })
      let input: BookingInput
      try {
        input = (request.headers.get("content-type") ?? "").includes("application/json") ? ((await request.json()) as Record<string, unknown>) : await request.formData()
      } catch {
        input = {}
      }
      const result = await submit(input, { ...ctx, headers: request.headers })
      return toResponse(result, isLocale(ctx.locale) ? ctx.locale : "ko")
    },
    lookup,
    confirmDeposit,
    claimPayment,
    expireDeposits: () => releaseExpired(undefined, 200),
    cancel,
    cancelAs,
    confirm,
    listForStaff,
    getForStaff,
    remindDue,
    purgeExpired: () => purgeExpiredBookings(o.db, now()),
  }
}

