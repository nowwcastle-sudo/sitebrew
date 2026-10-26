// 타입 검사(npm run typecheck 가 돈다 — P3-2 Task 10d, 계약 판 2 안의 선택 추가 묶음): 추가 칸·메서드의 울타리.
// 틀린 모양은 @ts-expect-error 로 적었다 — 타입이 느슨해지면(그 줄이 오류가 아니게 되면) typecheck 가 TS2578 로 실패한다.
// contract-additions.test.mjs 가 이 파일에서 @ts-expect-error 줄을 지운 사본을 tsc 로 돌려, 오류가 바로 그 줄들에서 나는지 본다(음성 대조).
import type { ActionFailureCode, ActionResult } from "@/registry/factory/contract/block-contract"
import type {
  AnalyticsPort,
  AuthPort,
  BillingPort,
  BookingChange,
  BookingPort,
  BookingReceipt,
  BookingRequest,
  ConsentInput,
  DeviceSession,
  ManagedBooking,
  MyRequestsPort,
  NewsletterPort,
  NotifyPort,
  ReviewsPort,
  SearchPort,
  Session,
  StoragePort,
  UploadTicket,
} from "@/registry/factory/contract/ports"
import type { EventName, EventProps } from "@/registry/factory/contract/events"

declare const track: AnalyticsPort["track"]

// ① 옛 호출은 그대로 통과한다(추가는 모두 선택 칸이다) — 판 2 그대로.
export const oldSignIn: Parameters<AuthPort["signIn"]>[0] = { method: "password", email: "kim@example.com", password: "pw" }
export const oldConsent: ConsentInput = { terms: true, privacy: true }
export const oldCheckout: Parameters<BillingPort["checkout"]>[0] = { planId: "pro" }

// ② 새 선택 칸. 확인 칸은 true 만 받는다(false 는 「동의 안 함」이 아니라 칸을 빼는 것이다).
export const newSignIn: Parameters<AuthPort["signIn"]>[0] = { method: "password", email: "kim@example.com", password: "pw", rememberMe: false, redirectTo: "/today" }
export const ageConsent: ConsentInput = { terms: true, privacy: true, ageOver14: true }
export const withdrawal: Parameters<BillingPort["checkout"]>[0] = { planId: "pro", withdrawalConsent: true }
// @ts-expect-error — 만 14세 확인은 true 만(체크하지 않으면 칸을 뺀다)
export const ageFalse: ConsentInput = { terms: true, privacy: true, ageOver14: false }
// @ts-expect-error — 청약철회 동의는 true 만
export const withdrawalFalse: Parameters<BillingPort["checkout"]>[0] = { planId: "pro", withdrawalConsent: false }

// ③ 실패 결과의 선택 칸. 알려진 code 는 ActionFailureCode, 공급자가 준 다른 문자열도 받는다(launch-factory 어댑터의 code: string).
export const rateLimited: ActionResult<never> = { ok: false, code: "rate_limited", retryAfter: 30, retryable: true, formError: "잠시 뒤에 다시 시도해 주세요." }
export const unsupported: ActionResult<never> = { ok: false, code: "provider_unsupported", manageUrl: "https://example.com/manage" }
export const vendorCode: ActionResult<never> = { ok: false, code: "vendor_specific_code" }
export const knownCodes: ActionFailureCode[] = ["rate_limited", "bot_check_failed", "bot_check_unavailable", "in_progress", "provider_unsupported", "scenario_unsupported"]
// @ts-expect-error — retryAfter 는 초(숫자)다
export const retryAfterText: ActionResult<never> = { ok: false, code: "rate_limited", retryAfter: "30초" }
// @ts-expect-error — 성공 결과에는 실패 칸이 없다
export const okWithCode: ActionResult<number> = { ok: true, data: 1, code: "rate_limited" }

// ④ 선택 메서드 — 블록은 필요한 메서드만 받는다(없을 수 있으니 undefined 를 다룬다).
declare const auth: AuthPort
declare const billing: BillingPort
declare const notify: NotifyPort
declare const analytics: AnalyticsPort
export const deviceList: Promise<ActionResult<DeviceSession[]>> | undefined = auth.listSessions?.()
export const enabling: Promise<ActionResult<{ totpURI: string; backupCodes: string[] }>> | undefined = auth.enableTwoFactor?.({ password: "pw" })
export const removed: Promise<ActionResult<{ graceUntil: string }>> | undefined = auth.deleteAccount?.()
export const portal: Promise<ActionResult<{ redirectUrl: string; paymentMethodUrl?: string }>> | undefined = billing.portal?.()
export const pushed = notify.subscribePush?.({ endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } })
// @ts-expect-error — 푸시 구독에는 키(p256dh·auth)가 있어야 한다
export const pushNoKeys = notify.subscribePush?.({ endpoint: "https://push.example/abc" })
analytics.identify?.("user-1")
// @ts-expect-error — identify 는 내부 식별자 하나만 받는다(이메일·이름 같은 특성을 함께 넘기지 않는다)
analytics.identify?.("user-1", { email: "kim@example.com" })
// 없는 메서드를 가진 어댑터도 AuthPort 를 구현한다(모두 선택).
export const minimalAuth: AuthPort = {
  session: async () => ({ ok: true, data: null }),
  methods: async () => ({ ok: true, data: ["password"] }),
  signIn: async () => ({ ok: true, data: {} }),
  signUp: async () => ({ ok: true, data: {} }),
  verifyTwoFactor: async () => ({ ok: true, data: { userId: "u", twoFactor: true } }),
  requestPasswordReset: async () => ({ ok: true, data: { sent: true } }),
  signOut: async () => ({ ok: true, data: {} }),
}

// ⑤ launch-factory 의 계약 밖 확장(LaunchAuthPort 등)이 계약 판 2 의 선택 칸과 맞는다 — LF 가 선언한 모양을 그대로 옮긴 표본.
interface LfSession extends Session {
  emailVerified?: boolean
  locale?: string
  timeZone?: string
}
interface LfAuthPort extends AuthPort {
  session(): Promise<ActionResult<LfSession | null>>
  signIn(input: Parameters<AuthPort["signIn"]>[0] & { rememberMe?: boolean; redirectTo?: string }): ReturnType<AuthPort["signIn"]>
  verifyTwoFactor(input: Parameters<AuthPort["verifyTwoFactor"]>[0] & { redirectTo?: string }): Promise<ActionResult<Session & { redirectUrl?: string }>>
  changePassword(input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }): Promise<ActionResult<{ otherSessionsRevoked: boolean }>>
  changeEmail(input: { newEmail: string; currentPassword?: string; redirectTo?: string }): Promise<ActionResult<{ emailSent: true }>>
  sendVerificationEmail(input?: { redirectTo?: string }): Promise<ActionResult<{ sent: true }>>
  listSessions(): Promise<ActionResult<DeviceSession[]>>
  revokeSession(input: { sessionId: string }): Promise<ActionResult<Record<string, never>>>
  revokeOtherSessions(): Promise<ActionResult<Record<string, never>>>
  updatePreferences(input: { locale?: string | null; timeZone?: string | null }): Promise<ActionResult<{ locale: string | null; timeZone: string | null }>>
  deleteAccount(): Promise<ActionResult<{ graceUntil: string }>>
  exportMyData(): Promise<ActionResult<{ exportedAt: string; profile: { email: string } }>>
}
interface LfBillingPort extends BillingPort {
  checkout(input: Parameters<BillingPort["checkout"]>[0] & { withdrawalConsent?: boolean }): ReturnType<BillingPort["checkout"]>
  portal(): Promise<{ ok: true; data: { redirectUrl: string; paymentMethodUrl?: string } } | { ok: false; formError?: string; retryable?: boolean; code?: string }>
}
declare const lfAuth: LfAuthPort
declare const lfBilling: LfBillingPort
export const lfAsAuth: AuthPort = lfAuth
export const lfAsBilling: BillingPort = lfBilling

// ⑥ 새 이벤트 web_vital — 개인정보 키(name)가 없다. 필드 이름은 metric.
track("web_vital", { metric: "INP", value: 180, rating: "good", path: "/pricing" })
// @ts-expect-error — web_vital 의 지표는 INP·CLS·LCP
track("web_vital", { metric: "TTFB", value: 100, rating: "good", path: "/" })
// @ts-expect-error — web_vital props 에 name 을 쓰지 않는다(개인정보 키 금지 — metric)
track("web_vital", { name: "INP", value: 180, rating: "good", path: "/" })
export const webVitalIsEvent: EventName = "web_vital"
export const webVitalProps: keyof EventProps["web_vital"] = "metric"

// ⑦ 승인 행동 확인 입력(P3-7 AXC — launch-factory LFAX R20): 확인 칸은 모두 선택이다 — 옛 호출·확인 칸을 모르는 옛 어댑터도 판 2 를 지킨다. confirmed 는 true 만 받는다.
export const oldCancel: Parameters<BillingPort["cancel"]>[0] = { when: "now" }
export const confirmedCancel: Parameters<BillingPort["cancel"]>[0] = { when: "now", confirmed: true }
export const confirmedPlan: Parameters<BillingPort["changePlan"]>[0] = { planId: "pro", when: "period_end", confirmed: true }
export const confirmedOffer: Parameters<BillingPort["applyRetentionOffer"]>[0] = { offerId: "pause-1m", confirmed: true }
export const acceptBare = billing.acceptPriceChange()
export const acceptConfirmed = billing.acceptPriceChange({ confirmed: true })
export const confirmedEmail: Parameters<NonNullable<AuthPort["changeEmail"]>>[0] = { newEmail: "new@example.com", currentPassword: "pw", confirmed: true }
export const deleteBare = auth.deleteAccount?.()
export const deleteTyped = auth.deleteAccount?.({ confirmed: true, confirmEmail: "kim@example.com" })
export const exportConfirmed = auth.exportMyData?.({ confirmed: true })
export const consentConfirmed: Parameters<NotifyPort["setConsents"]>[0] = { email: true, confirmed: true }
// @ts-expect-error — 확인 칸은 true 만(확인하지 않았으면 칸을 뺀다)
export const cancelNotConfirmed: Parameters<BillingPort["cancel"]>[0] = { when: "now", confirmed: false }
// @ts-expect-error — 탈퇴의 입력 확인(confirmEmail)은 사람이 입력한 주소 문자열이다
export const deleteBadEmail = auth.deleteAccount?.({ confirmed: true, confirmEmail: 1 })
// 확인 칸을 모르는 옛 어댑터(입력을 받지 않거나 옛 모양만 받는 구현)도 포트를 구현한다
export const legacyBilling: Pick<BillingPort, "acceptPriceChange" | "cancel" | "changePlan"> = {
  acceptPriceChange: async () => ({ ok: true, data: { planId: null, status: "none" } }),
  cancel: async (input: { when: "period_end" | "now" }) => (input.when ? { ok: true, data: { planId: null, status: "none" } } : { ok: false }),
  changePlan: async () => ({ ok: true, data: { planId: null, status: "none" } }),
}
// 승인 대기는 오류가 아니라 정해진 결과 — code 가 있으면 retryable 도 준다(문서화). 새 code 값 여섯과 옛 이름 둘이 모두 ActionFailureCode 다.
export const awaiting: ActionResult<never> = { ok: false, code: "confirmation_required", retryable: false, formError: "확인이 먼저예요", fieldErrors: { confirmed: ["확인이 먼저예요"] } }
export const axcCodes: ActionFailureCode[] = ["confirmation_required", "sign_in_required", "provider_unavailable", "invalid_input", "invalid_credentials", "action_failed", "approval_required", "signInRequired"]

// ⑧ 후기·검색·뉴스레터·내 신청 내역·티켓식 올리기(p3-3c — 타입만, 모두 선택 추가라 판은 그대로 2). launch-factory 서비스의 결과 모양을 옮긴 표본.
declare const reviews: ReviewsPort
declare const searchPort: SearchPort
declare const newsletter: NewsletterPort
declare const myRequests: MyRequestsPort
declare const storage: StoragePort
export const reviewList = reviews.list({ subjectType: "product", subjectId: "p-1", sort: "latest", rating: 5, page: 1, pageSize: 10 })
export const questionList = reviews.list({ subjectType: "product", subjectId: "p-1", kind: "question" })
export const reviewSubmit = reviews.submit({ subjectType: "product", subjectId: "p-1", rating: 4, title: "좋아요", body: "잘 쓰고 있어요", locale: "ko" })
export const questionSubmit = reviews.submit({ subjectType: "product", subjectId: "p-1", kind: "question", body: "크기가 어떻게 되나요?", authorName: "김예시" })
// @ts-expect-error — 별점은 1~5 사이 정수 리터럴이다
export const reviewBadRating = reviews.submit({ subjectType: "product", subjectId: "p-1", rating: 6, body: "x" })
// @ts-expect-error — sort 는 정해진 값만(latest·rating_desc·rating_asc)
export const reviewBadSort = reviews.list({ subjectType: "product", subjectId: "p-1", sort: "popular" })
// 결과는 kind 로 갈린다 — 후기에는 요약이 있고 문의에는 없다
export async function reviewShapes() {
  const r = await reviews.list({ subjectType: "product", subjectId: "p-1" })
  if (r.ok && r.data.kind === "review") {
    const avg: number = r.data.summary.avg
    const stars: number = r.data.summary.distribution[5]
    const first: string | undefined = r.data.items[0]?.reply?.body
    return [avg, stars, first, r.data.pageCount]
  }
  if (r.ok && r.data.kind === "question") {
    // @ts-expect-error — 문의 결과에는 요약(summary)이 없다
    return r.data.summary
  }
  return null
}
export const searchHits = searchPort.search({ q: "청소기", kinds: ["product"], page: 1 })
export async function snippetShape() {
  const r = await searchPort.search({ q: "청소기" })
  if (!r.ok) return null
  const first = r.data.items[0]
  // 하이라이트는 HTML 이 아니라 [시작, 끝) 범위 배열이다
  const range: [number, number] | undefined = first?.snippet.ranges[0]
  // @ts-expect-error — 스니펫에 html 문자열 칸은 없다
  const html: string = first?.snippet.html
  return [range, html]
}
export const subscribed = newsletter.subscribe({ email: "kim@example.com", consent: true, source: "footer" })
// @ts-expect-error — 뉴스레터 동의는 true 만(체크하지 않았으면 칸을 뺀다, false 를 보내지 않는다)
export const subscribeNoConsent = newsletter.subscribe({ email: "kim@example.com", consent: false })
export const mine = myRequests.list({ page: 1 })
export const mineBare = myRequests.list()
// 티켓식 올리기는 선택 — upload 만 구현한 옛 어댑터도 StoragePort 를 지킨다
export const uploadOnly: StoragePort = { upload: async () => ({ ok: true, data: { url: "#u", key: "k" } }) }
export const ticketed = storage.createTicket?.({ kind: "attachment", contentType: "application/pdf", size: 1024, fileName: "견적.pdf" })
export const completed = storage.complete?.({ id: "ticket-1" })
export const ticketShape: UploadTicket = { id: "t", key: "attachment/2026/x.pdf", method: "PUT", url: "https://storage.example/x", headers: { "content-type": "application/pdf" }, expiresAt: "2026-10-01T00:15:00.000Z", maxBytes: 10 * 1024 * 1024 }
// @ts-expect-error — 올리기 종류는 avatar·attachment·image 뿐이다
export const ticketBadKind = storage.createTicket?.({ kind: "video", contentType: "video/mp4", size: 1 })

// ⑧ 예약 포트(sitebrew v0.2.0 계획 3b): 새 포트 하나 + 실패 코드 여섯 + 이벤트 셋 — 모두 판 2 안의 추가다. 접수 입력은 폼 칸 그대로라 값이 모두 문자열이다.
declare const booking: BookingPort
export const bookingSlots = booking.slots({ service: "consult", from: "2026-10-05", days: 3 })
export const bookingRequest: BookingRequest = { service: "consult", startsAt: "2026-10-05T01:00:00.000Z", contact: "kim@example.com", partySize: "2", name: "김예시", note: "창가 자리" }
export const bookingReceipt: Promise<ActionResult<BookingReceipt>> = booking.book(bookingRequest)
export const bookingView: Promise<ActionResult<ManagedBooking>> = booking.lookup({ reference: "B-1001", contact: "kim@example.com" })
export const bookingChange: Promise<ActionResult<BookingChange>> = booking.cancel({ reference: "B-1001", contact: "kim@example.com" })
export const bookingCodes: ActionFailureCode[] = ["slot_taken", "not_found", "cancel_closed", "invalid_state", "forbidden", "deposit_failed"]
export const bookingEvents: EventName[] = ["booking_view", "booking_submit", "booking_cancel"]
track("booking_view", { service: "consult" })
track("booking_submit", { service: "consult", status: "requested" })
track("booking_cancel", { service: "consult" })
// @ts-expect-error — booking_submit 의 status 는 접수 결과(requested·confirmed)뿐이다
track("booking_submit", { service: "consult", status: "cancelled" })
// @ts-expect-error — 접수 입력의 partySize 는 폼 칸이라 숫자 문자열이다
export const partyNumber: BookingRequest = { service: "consult", startsAt: "2026-10-05T01:00:00.000Z", contact: "kim@example.com", partySize: 2 }
// @ts-expect-error — 조회·취소는 예약 번호와 연락처가 함께 있어야 한다(번호만으로는 찾지 않는다)
export const referenceOnly = booking.lookup({ reference: "B-1001" })
// launch-factory 의 서버 액션(폼 칸 Record<string, string> 을 받는다)이 book 자리에 그대로 들어간다.
declare function lfSubmitBooking(input: Record<string, string>): Promise<ActionResult<BookingReceipt>>
export const lfAsBook: BookingPort["book"] = lfSubmitBooking
