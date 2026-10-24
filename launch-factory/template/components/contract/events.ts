export const EVENTS = [
  "page_view", "cta_click", "form_start", "form_submit", "form_error",
  "signup_start", "signup_complete", "login", "onboarding_step_complete", "activation",
  "pricing_view", "plan_select", "checkout_start", "checkout_complete", "trial_start",
  "upgrade_prompt_view", "upgrade_click", "limit_reached",
  "cancel_start", "cancel_alternative_view", "cancel_alternative_accept", "cancel_complete", "pause", "resume",
  "payment_failed_view", "payment_method_update", "referral_share", "consent_update", "web_vital",
  "app_install", "booking_view", "booking_submit", "booking_cancel",
  "add_to_cart", "begin_checkout", "purchase",
] as const

export type EventName = (typeof EVENTS)[number]

/**
 * 계약 판 번호(접합면 J2). 이름을 바꾸거나 필드·이벤트·메서드를 빼면 올린다 — 더하는 것은 선택 필드로만 하고 판은 그대로다.
 * 판 2(P3-2 Task 10c): AnalyticsPort.track 의 선택 셋째 인자 meta(출처 태그 Attribution — 감싸기는 contract 항목 attribution 의 withAttribution),
 * BillingPort.checkout 의 선택 trial(체험 켬/끔).
 * 판 2 안의 추가 묶음(P3-2 Task 10d, 대장 A52 — 판은 그대로다): 모두 선택 칸·메서드·이벤트다. ActionResult 의 code·retryAfter·manageUrl, AuthPort 의 signIn rememberMe·redirectTo · 2단계 켜기·끄기 ·
 * 계정 편의 메서드 · deleteAccount·exportMyData, ConsentInput.ageOver14, checkout.withdrawalConsent, BillingPort.portal · Subscription.graceEndsAt,
 * NotifyPort 푸시 구독, AnalyticsPort.identify, 이벤트 web_vital(CWV — 필드 이름은 metric: 이벤트 props 에 name 을 쓰지 않는다).
 * 이벤트 app_install(2026-09-30 운영자 판정 C74 — pwa 원형의 전환 「설치 또는 첫 핵심 행동(activation)」 중 설치 쪽. 브라우저 appinstalled 또는 설치 안내에서 수락).
 * 이벤트 add_to_cart·begin_checkout·purchase(계획 3a 판매·결제 — commerce 원형의 전환 purchase. 구독 결제의 checkout_* 와 따로 센다: 상품 판매는 planId 가 없고 주문이 있다).
 * 이벤트 booking_view·booking_submit·booking_cancel(sitebrew v0.2.0 계획 3b — 예약 포트 BookingPort 의 화면 계측. 서비스 식별자만 싣고 예약 번호·연락처·이름은 싣지 않는다).
 */
export const CONTRACT_VERSION = 2

type Method = "password" | "kakao" | "naver" | "google" | "magic-link"
type PlanInterval = "month" | "year" | "once"
type Reason = "too_expensive" | "not_using" | "missing_feature" | "switching" | "temporary" | "other"
type Alternative = "pause" | "downgrade" | "discount" | "other"

/** 이벤트마다 props. 문자열 칸은 식별자·화면 문구뿐이다(폼 칸 이름이지 입력값이 아니다) */
export interface EventProps {
  /**
   * path 는 쿼리·해시를 뺀 경로. utmSource 는 utm_source 값(예: "chatgpt.com"), referrerKind 는 유입 종류다 —
   * AI 답변에서 온 유입(ai)을 검색·소셜과 따로 잰다(마케팅 규칙 X8). 둘 다 사람이 아니라 유입 경로라 개인정보가 아니다
   */
  page_view: { path: string; utmSource?: string; referrerKind?: "search" | "ai" | "social" | "direct" | "other" }
  /** id 는 CTA 식별자, label 은 버튼 문구, section 은 블록 id */
  cta_click: { id: string; label: string; section: string }
  form_start: { form: string }
  form_submit: { form: string }
  /** fields 는 오류가 난 칸 이름(값이 아니다) */
  form_error: { form: string; fields: string[]; kind: "field" | "server" }
  signup_start: { method: Method }
  /** marketingConsent 는 선택 동의를 하나라도 켰는가 */
  signup_complete: { method: Method; marketingConsent: boolean }
  login: { method: Method }
  onboarding_step_complete: { step: string; index: number; total: number }
  activation: { milestone: string }
  pricing_view: { plans: number }
  plan_select: { planId: string; interval: PlanInterval }
  checkout_start: { planId: string }
  /** amount 는 최소 단위 정수(ports Money 와 같다) */
  checkout_complete: { planId: string; amount: number; currency: "KRW" | "USD" | "EUR" | "JPY" }
  trial_start: { planId: string; trialDays: number }
  /** trigger 는 프롬프트를 띄운 곳(한도·기능 이름 등) */
  upgrade_prompt_view: { trigger: string }
  upgrade_click: { trigger: string; planId?: string }
  limit_reached: { limit: string; used: number; max: number }
  cancel_start: { planId: string | null }
  cancel_alternative_view: { alternative: Alternative }
  cancel_alternative_accept: { alternative: Alternative }
  /** reason 만 싣는다 — 해지 사유 자유 글(detail)은 싣지 않는다 */
  cancel_complete: { reason?: Reason; when: "period_end" | "now" }
  /** days 는 일시정지 기간(일) */
  pause: { days: number }
  resume: Record<string, never>
  payment_failed_view: { reason: "card_declined" | "expired_card" | "insufficient_funds" | "unknown" }
  /** surface 는 누른 곳(배너·설정 등) */
  payment_method_update: { surface: string }
  referral_share: { channel: "link" | "kakao" | "sms" | "email" | "other" }
  consent_update: { analytics: boolean; marketing: boolean }
  /**
   * 실사용자 핵심 웹 지표(대장 D103, 판 2 안의 선택 이벤트). 동의(analytics) 뒤에만 보낸다. metric 은 web-vitals 의 Metric.name(INP·CLS·LCP),
   * value 는 그 값(INP·LCP 는 밀리초, CLS 는 점수), rating 은 web-vitals 가 매긴 등급, path 는 쿼리·해시를 뺀 경로다 — 사람이 아니라 페이지의 값이라 개인정보가 없다.
   * 필드 이름이 name 이 아니라 metric 인 것은 이 표의 개인정보 검사가 name 키를 막기 때문이다
   */
  web_vital: { metric: "INP" | "CLS" | "LCP"; value: number; rating: "good" | "needs-improvement" | "poor"; path: string }
  /** 홈 화면 설치. source: prompt = 우리 설치 안내에서 수락, browser = 브라우저 자체 메뉴(appinstalled 만 받은 경우) */
  app_install: { source: "prompt" | "browser" }
  /** 상품 담기. productId 는 상품표(서버)의 id, quantity 는 담은 수량이다 */
  add_to_cart: { productId: string; quantity: number }
  /** 주문하기(결제창 열기 전). amount 는 최소 단위 정수 합계(ports Money 와 같다) */
  begin_checkout: { amount: number; currency: "KRW" | "USD" | "EUR" | "JPY" }
  /** 결제 확정(서버가 결제 공급자에 다시 물어 확인한 뒤). orderId 는 주문 식별자 — 사람이 아니라 주문의 값이라 개인정보가 없다 */
  purchase: { orderId: string; amount: number; currency: "KRW" | "USD" | "EUR" | "JPY" }
  /** 예약 화면에서 시간 칸을 보여 줬다. service 는 서비스 식별자(예약 번호·연락처가 아니다) */
  booking_view: { service: string }
  /** 예약이 접수됐다(book 성공). status 는 접수 결과 그대로 — requested 는 운영자 확인 대기, confirmed 는 바로 확정 */
  booking_submit: { service: string; status: "requested" | "confirmed" }
  /** 예약한 사람이 직접 취소했다(cancel 성공) */
  booking_cancel: { service: string }
}
