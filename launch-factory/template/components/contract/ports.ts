import type { ActionResult } from "@/components/contract/block-contract"
import type { EventName, EventProps } from "@/components/contract/events"

/** ISO 8601 날짜·시각 문자열(예: "2026-10-31T15:00:00.000Z") */
export type IsoDate = string
export type Currency = "KRW" | "USD" | "EUR" | "JPY"

/**
 * 금액은 최소 단위 정수다(원·센트 — KRW·JPY 는 소수 없음). 표시는 formatMoney(content-core)로 한다.
 * vatIncluded 는 화면 총액 규칙(전자상거래법 §21-2①1 — 소비자가 실제로 내는 총액을 먼저 보인다)에 쓴다.
 */
export interface Money {
  amount: number
  currency: Currency
  vatIncluded: boolean
}

export type Interval = "month" | "year" | "once"

export interface Plan {
  id: string
  name: string
  price: Money
  interval: Interval
  trialDays?: number
  features: string[]
  recommended?: boolean
  limits?: Record<string, number>
}

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired"

/**
 * 예정된 가격 변경(마케팅 규칙 L6 — 무료→유료 전환·가격 인상은 청구 30일 전 안에 전후 가격·날짜·해지 버튼을 보이고 명시 동의를 받는다.
 * 무응답은 동의가 아니다). from·to 는 전후 금액, effectiveAt 은 새 가격이 적용되는 때, consentBy 는 동의를 받아야 하는 기한이다.
 * 동의는 acceptPriceChange, 거절은 cancel 로 한다.
 */
export interface PendingPriceChange {
  from: Money
  to: Money
  effectiveAt: IsoDate
  consentBy: IsoDate
  kind: "trial_to_paid" | "price_increase"
}

/**
 * 구독 한 건의 화면용 상태. 해지 예약은 status 가 그대로(active·trialing)이고 cancelAt 이 붙는다 — 그때까지 쓸 수 있다.
 * scheduledPlanId 는 changePlan({ when: "period_end" }) 로 예약된 다음 요금제다(currentPeriodEnd 에 바뀐다).
 * pendingPriceChange 가 있으면 동의를 기다리는 가격 변경이 있다(L6).
 */
export interface Subscription {
  planId: string | null
  status: SubscriptionStatus
  currentPeriodEnd?: IsoDate
  trialEnd?: IsoDate
  cancelAt?: IsoDate
  pausedUntil?: IsoDate
  scheduledPlanId?: string
  pendingPriceChange?: PendingPriceChange
  paymentIssue?: { reason: "card_declined" | "expired_card" | "insufficient_funds" | "unknown"; retryAt?: IsoDate }
  /** past_due 유예가 끝나는 때(선택, 계약 판 2 — 결제 실패 띠의 기한. 대장 D110·D57) */
  graceEndsAt?: IsoDate
  usage?: Record<string, { used: number; limit: number }>
}

export type CancelReason = "too_expensive" | "not_using" | "missing_feature" | "switching" | "temporary" | "other"

/**
 * 해지 대안(마케팅 규칙 R2 — 일시정지 → 다운그레이드 → 할인 순으로 하나만 보인다). 요금제와 따로 정의되고 kind 마다 칸이 하나다:
 * pause 는 pauseMonths, downgrade 는 planId, discount 는 discount(30% 이하·2~3개월 — lib retention-offer 의 retentionOfferIssues 가 검사한다).
 * 할인은 화면에 금액으로 보인다(퍼센트만 보이지 않는다).
 */
export interface RetentionOffer {
  id: string
  kind: "pause" | "downgrade" | "discount"
  discount?: { percent: number; months: number }
  pauseMonths?: number
  planId?: string
}

/**
 * 사람 확인 입력(P3-7 AXC — launch-factory LFAX R20, 감사 M03). 사람이 내용을 보고 확정해야 하는 승인 행동(human-actions 표)의 입력에 더하는 **선택 칸**이다 —
 * 블록이 자기 확인 단계(확정 버튼·동의 스위치) 뒤에 `confirmed: true` 를 직접 싣는다. 이 칸을 요구하는 어댑터는 없으면 아무것도 바꾸지 않고(공급자 호출 0)
 * `{ ok: false, code: "confirmation_required", retryable: false, fieldErrors: { confirmed: [...] } }` 로 거절한다(`checkout.withdrawalConsent` 와 같은 서술) —
 * 이것은 오류가 아니라 승인 대기다. 요구하지 않는 어댑터도 계약을 지킨다(칸을 무시한다). **한계**: `true` 는 「호출한 쪽이 사람의 확인을 받았다고 명시했다」는 선언이지
 * 사람이 눌렀다는 증명이 아니다(더 강한 서명 토큰은 후속 — docs/deferred-register.md).
 */
export type HumanConfirmation = { confirmed?: true }

/**
 * 결제 포트. 모든 메서드는 거부(reject)하지 않고 ActionResult 로 끝난다.
 * redirectUrl 이 오면 블록이 그 주소로 이동한다(호스팅 결제창·결제수단 변경 화면).
 */
export interface BillingPort {
  plans(): Promise<ActionResult<Plan[]>>
  subscription(): Promise<ActionResult<Subscription>>
  /**
   * trial 은 체험으로 시작할지다(마케팅 규칙 P13 — 체험 켬/끔 전환, 계약 판 2에서 더한 선택 칸). 주지 않으면 요금제의 trialDays 가 정한다(있으면 체험).
   * false 면 체험 기간이 있는 요금제도 체험 없이 바로 결제한다 — 「바로 결제」를 눌렀는데 체험으로 시작되면 화면이 거짓이 된다.
   * true 인데 요금제에 체험 기간(trialDays)이 없으면 { ok: false, code: "trial_unavailable" } 이고 구독은 그대로다(P3-2 10c 판정 — 적합성 묶음 billing.trial.trial-unavailable)
   */
  /**
   * withdrawalConsent 는 청약철회 제한 고지에 동의했는가(선택, 계약 판 2 — 대장 D61·A52). 결제 직전 블록이 체크를 받아 true 로 준다 —
   * 전자상거래법 제17조 제2항 제5호(디지털콘텐츠 제공 개시 뒤 철회 제한)와 제6항 단서(제한 사실의 표시)를 지킨 화면에서만 받는다.
   * 이 칸을 요구하는 어댑터(launch-factory 의 withWithdrawalConsent)는 없으면 fieldErrors.withdrawalConsent 로 거절한다
   */
  checkout(input: { planId: string; trial?: boolean; withdrawalConsent?: true }): Promise<ActionResult<{ redirectUrl?: string; subscription?: Subscription }>>
  /** when: 새 요금제가 적용되는 때. "period_end" 는 결과의 scheduledPlanId 로 보인다(예약 기능이 없는 공급자는 어댑터가 예약한다) */
  changePlan(input: { planId: string; when: "now" | "period_end" } & HumanConfirmation): Promise<ActionResult<Subscription>>
  /** detail 은 사용자가 쓴 자유 글이다 — 계측 props 로 옮기지 않는다(개인정보가 섞일 수 있다) */
  cancel(input: { reason?: CancelReason; detail?: string; when: "period_end" | "now" } & HumanConfirmation): Promise<ActionResult<Subscription>>
  pause(input: { until: IsoDate }): Promise<ActionResult<Subscription>>
  /** 일시정지를 풀고, 예약된 해지(cancelAt)도 거둔다 */
  resume(): Promise<ActionResult<Subscription>>
  updatePaymentMethod(): Promise<ActionResult<{ redirectUrl: string }>>
  /**
   * 결제 포털(선택, 계약 판 2 — 청구서·영수증·결제수단. 대장 D110·A48). redirectUrl 은 포털 첫 화면, paymentMethodUrl 은 결제수단 변경 바로가기.
   * 주소는 임시라 저장하지 않고 누를 때마다 부른다
   */
  portal?(): Promise<ActionResult<{ redirectUrl: string; paymentMethodUrl?: string }>>
  /** 예정된 가격 변경(pendingPriceChange)에 명시 동의한다(L6). 결과 구독에는 pendingPriceChange 가 없다. 동의할 것이 없으면 formError. 입력은 선택 — 확인 칸만 있다(HumanConfirmation) */
  acceptPriceChange(input?: HumanConfirmation): Promise<ActionResult<Subscription>>
  /** 해지 흐름에서 고른 대안(RetentionOffer.id)을 적용한다(R2). 예약된 해지(cancelAt)는 거둔다. 모르는 id 는 formError */
  applyRetentionOffer(input: { offerId: string } & HumanConfirmation): Promise<ActionResult<Subscription>>
}

export type AuthMethod = "password" | "kakao" | "naver" | "google" | "magic-link"

export interface Session {
  userId: string
  name?: string
  email?: string
  orgId?: string
  twoFactor: boolean
  /** 이메일 확인을 마쳤는가(선택, 계약 판 2 — 대장 D70) */
  emailVerified?: boolean
  /** 사용자가 고른 언어·시간대(선택, 계약 판 2 — 대장 D74) */
  locale?: string
  timeZone?: string
}

/** 로그인된 기기 한 줄(계정 보안 목록). device 는 사람이 읽는 이름, ip 는 끝자리를 가린 값이다. 세션 토큰은 담지 않는다 */
export interface DeviceSession {
  id: string
  current: boolean
  device: string
  ip?: string
  createdAt: IsoDate
  lastActiveAt: IsoDate
  expiresAt: IsoDate
}

/** 내 정보 내려받기(JSON) 결과. 모양은 어댑터가 정한다 — 블록은 파일로 저장할 뿐이다 */
export type MyData = object

/**
 * 인증 포트. 소셜(kakao·naver·google)은 redirectUrl 로 공급자 화면에 간다. magic-link 는 메일을 보내고 emailSent 로 알린다.
 * 비밀번호 로그인이 2단계를 요구하면 needsTwoFactor — 블록은 코드 입력으로 넘어가 verifyTwoFactor 를 부른다.
 * 아래 「선택」 칸·메서드는 계약 판 2 안의 추가(P3-2 Task 10d, 대장 A52)다 — 없는 어댑터도 계약을 지키고, 블록은 필요한 메서드만 props 로 받는다.
 */
export interface AuthPort {
  session(): Promise<ActionResult<Session | null>>
  methods(): Promise<ActionResult<AuthMethod[]>>
  /**
   * rememberMe: 「로그인 유지」(선택). 주지 않으면 어댑터 기본(Better Auth 는 true), false 면 브라우저를 닫을 때 세션이 끝난다.
   * redirectTo: 끝나면 돌아갈 같은 출처 경로(선택) — 어댑터가 안전한 주소만 받아 data.redirectUrl 로 돌려준다
   */
  signIn(input: { method: AuthMethod; email?: string; password?: string; rememberMe?: boolean; redirectTo?: string }): Promise<ActionResult<{ redirectUrl?: string; needsTwoFactor?: boolean; emailSent?: boolean }>>
  signUp(input: { method: AuthMethod; email?: string; password?: string; name?: string; consents: ConsentInput; redirectTo?: string }): Promise<ActionResult<{ redirectUrl?: string; emailSent?: boolean }>>
  /** method 기본값 "totp"(인증 앱 6자리). "backup-code" 는 1회용 백업 코드. trustDevice 면 이 기기에서 한동안 2단계를 묻지 않는다. 켜기 직후의 첫 확인도 이 메서드다 */
  verifyTwoFactor(input: { code: string; method?: "totp" | "backup-code"; trustDevice?: boolean; redirectTo?: string }): Promise<ActionResult<Session & { redirectUrl?: string }>>
  /** 계정이 있든 없든 같은 결과(sent: true)다 — 가입 여부를 드러내지 않는다 */
  requestPasswordReset(input: { email: string }): Promise<ActionResult<{ sent: true }>>
  /**
   * 비밀번호 재설정 마무리(선택, 계약 판 2 안의 추가 — D236). 메일 링크가 돌려보내는 주소의 token 과 새 비밀번호로 정한다. 토큰은 한 번만 쓰이고, 틀렸거나 만료·이미 썼으면
   * { ok: false, code: "invalid_token" }(블록이 「링크가 더는 열리지 않아요」 + 다시 요청으로 보낸다), 새 비밀번호가 짧으면 fieldErrors.newPassword 다. 성공하면 모든 기기가 로그아웃되는지는 공급자 설정이다
   */
  resetPassword?(input: { token: string; newPassword: string }): Promise<ActionResult<Record<string, never>>>
  signOut(): Promise<ActionResult<{ redirectUrl?: string }>>

  /** 2단계 켜기 시작(선택). 비밀번호가 있는 계정은 password 필수. totpURI 는 QR 로, backupCodes 는 이때 한 번만 보인다 — 첫 코드 확인(verifyTwoFactor) 전에는 켜지지 않는다 */
  enableTwoFactor?(input: { password?: string }): Promise<ActionResult<{ totpURI: string; backupCodes: string[] }>>
  /** 2단계 끄기(선택). 비밀번호가 있는 계정은 password 필수 */
  disableTwoFactor?(input: { password?: string }): Promise<ActionResult<Record<string, never>>>
  /** 비밀번호 바꾸기(선택). 지금 비밀번호가 맞아야 한다. revokeOtherSessions 면 이 기기 말고 모두 로그아웃 */
  changePassword?(input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }): Promise<ActionResult<{ otherSessionsRevoked: boolean }>>
  /** 이메일 바꾸기(선택). 확인 메일이 나가고 바로 바뀌지 않는다(emailSent). 비밀번호가 있는 계정은 currentPassword 필수 */
  changeEmail?(input: { newEmail: string; currentPassword?: string; redirectTo?: string } & HumanConfirmation): Promise<ActionResult<{ emailSent: true }>>
  /** 지금 세션 주소로 확인 메일을 다시 보낸다(선택) */
  sendVerificationEmail?(input?: { redirectTo?: string }): Promise<ActionResult<{ sent: true }>>
  /** 로그인된 기기 목록(선택). 토큰은 내보내지 않는다 */
  listSessions?(): Promise<ActionResult<DeviceSession[]>>
  /** 내 세션 하나를 끝낸다(선택). 목록에 없는 id 는 formError */
  revokeSession?(input: { sessionId: string }): Promise<ActionResult<Record<string, never>>>
  /** 이 기기 말고 모두 로그아웃(선택) */
  revokeOtherSessions?(): Promise<ActionResult<Record<string, never>>>
  /** 언어·시간대 저장(선택). null 은 지움 */
  updatePreferences?(input: { locale?: string | null; timeZone?: string | null }): Promise<ActionResult<{ locale: string | null; timeZone: string | null }>>
  /**
   * 셀프 탈퇴(선택, 대장 C5). 구독을 먼저 해지하고 유예 기간(graceUntil까지)을 둔다 — 유예 중 다시 로그인하면 취소된다.
   * 입력은 선택(P3-7 AXC): confirmed 는 사람 확인(HumanConfirmation), confirmEmail 은 사람이 화면에 직접 입력한 이메일 주소(DESIGN §7-B 입력 확인) — 이 칸을 보는 어댑터는
   * 지금 로그인한 주소와 같지 않으면(앞뒤 공백·대소문자 무시) `confirmation_required` + `fieldErrors.confirmEmail` 로 거절한다. 이메일이 없는 계정(소셜 가입)은 confirmed 만이다
   */
  deleteAccount?(input?: HumanConfirmation & { confirmEmail?: string }): Promise<ActionResult<{ graceUntil: IsoDate }>>
  /** 내 정보 내려받기(선택, JSON — 개인정보 보호법 제35조 열람). 입력은 선택 — 확인 칸만 있다(HumanConfirmation) */
  exportMyData?(input?: HumanConfirmation): Promise<ActionResult<MyData>>
}

/**
 * 가입 동의. 한국 개인정보 보호법·정보통신망법: 필수(약관·개인정보 수집·이용)와 선택(마케팅 수신)을 따로 받는다.
 * 약관과 개인정보(와 만 14세 확인)는 각각 true 만 받는 별도 필수 항목이다. 선택 동의는 기본 false 이고 미리 체크해 두지 않는다(전자상거래법 §21-2①2).
 */
export interface ConsentInput {
  terms: true
  privacy: true
  /**
   * 만 14세 이상 확인(선택, 계약 판 2 — 대장 D60·C5). 개인정보 보호법 제22조의2 제1항: 만 14세 미만은 법정대리인 동의가 필요한데 그 절차가 없는 제품은
   * 가입 때 「만 14세 이상입니다」를 필수 체크로 받는다. 이 칸을 요구하는 어댑터는 없으면 fieldErrors.ageOver14 로 거절한다
   */
  ageOver14?: true
  marketing?: { email?: boolean; sms?: boolean; kakao?: boolean; push?: boolean }
}

/** 계측·마케팅 쿠키 동의. 결정 전 기본은 둘 다 false(decidedAt 없음) */
export interface ConsentState {
  analytics: boolean
  marketing: boolean
  decidedAt?: IsoDate
}

/** 마케팅 수신 동의(채널별). 정보통신망법 §50 — 바꿀 때마다 updatedAt 을 남기고 결과를 알린다 */
export interface NotifyPort {
  consents(): Promise<ActionResult<Required<NonNullable<ConsentInput["marketing"]>> & { updatedAt?: IsoDate }>>
  setConsents(input: NonNullable<ConsentInput["marketing"]> & HumanConfirmation): Promise<ActionResult<{ updatedAt: IsoDate }>>
  /**
   * 웹 푸시 구독 저장(선택, 계약 판 2 — 대장 A35). 브라우저의 PushSubscription.toJSON() 결과를 그대로 넘긴다. 권한 요청과 subscribe 는
   * 블록이 사용자가 누른 순간에만 부른다(스스로 띄우지 않는다). 푸시 채널 수신 동의(setConsents 의 push)와는 따로다 — 구독은 기기 단위, 동의는 사람 단위
   */
  subscribePush?(input: PushSubscriptionInput): Promise<ActionResult<{ subscribedAt: IsoDate }>>
  /** 이 기기의 푸시 구독 해제(선택) */
  unsubscribePush?(input: { endpoint: string }): Promise<ActionResult<Record<string, never>>>
}

/** PushSubscription.toJSON() 의 모양(https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/toJSON) */
export interface PushSubscriptionInput {
  endpoint: string
  expirationTime?: number | null
  keys: { p256dh: string; auth: string }
}

/**
 * 계측 출처 태그(접합면 J2 판 2 — 「공장이 배운다」, §9 Q15). 이벤트가 어느 블록·레시피·문구 변형·실험 갈래에서 났는지 적는다 —
 * 학습 집계기가 태그별 전환을 읽어 다음 찍어내기의 순서를 정한다. blockId 는 "<kind>-<variant>"(블록 뿌리 data-block 과 같다), recipeId 는 레시피 id.
 * 블록은 태그를 모른다 — 블록을 조립하는 쪽(찍어낸 페이지·갤러리)이 contract 항목 attribution 의 withAttribution 으로 감싼 track 을 블록에 넘긴다.
 */
export interface Attribution {
  blockId?: string
  recipeId?: string
  copyVariant?: string
  experiment?: { key: string; arm: string }
}

/** track 의 셋째 인자. 태그는 props 가 아니라 여기에 싣는다 — props 는 이름별 타입(events.ts) 그대로다 */
export interface TrackMeta {
  attribution?: Attribution
}

/**
 * 계측 포트. track 은 동의(analytics)가 false 면 어댑터가 버린다(태그도 함께). props 는 이름마다 타입이 있고 개인정보를 싣지 않는다(events.ts).
 * meta(선택, 계약 판 2)는 출처 태그다 — 블록은 두 인자로만 부르고, 감싼 track 이 meta 를 붙인다. 어댑터는 meta.attribution 을 이벤트 props 와 따로 보낸다.
 */
export interface AnalyticsPort {
  track<E extends EventName>(name: E, props: EventProps[E], meta?: TrackMeta): void
  /**
   * 로그인 뒤 익명 방문자를 사용자에게 잇는다(선택, 계약 판 2 — 대장 D30). userId 는 이메일·이름이 아닌 내부 식별자다(개인정보를 공급자에 넘기지 않는다).
   * track 처럼 동의(analytics)가 false 면 어댑터가 아무것도 하지 않는다. 로그아웃 때의 식별 끊기는 어댑터가 signOut 에 맞춰 한다
   */
  identify?(userId: string): void
  consent(): ConsentState
  setConsent(next: Pick<ConsentState, "analytics" | "marketing">): void
}

export interface StoragePort {
  upload(file: File | Blob, opts: { kind: "avatar" | "attachment" | "image" }): Promise<ActionResult<{ url: string; key: string }>>
}
