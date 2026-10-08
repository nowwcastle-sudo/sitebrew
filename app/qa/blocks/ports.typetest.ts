// 타입 검사(npm run typecheck 가 돈다 — P3-2 Task 10): 기능 포트 타입의 울타리.
// 틀린 모양은 @ts-expect-error 로 적었다 — 타입이 느슨해지면(그 줄이 오류가 아니게 되면) typecheck 가 TS2578 로 실패한다.
// ports.test.mjs 가 이 파일에서 @ts-expect-error 줄을 지운 사본을 tsc 로 돌려, 오류가 바로 그 줄들에서 나는지 본다(음성 대조).
import type {
  AnalyticsPort,
  AuthMethod,
  BillingPort,
  CancelReason,
  ConsentInput,
  Currency,
  Interval,
  Money,
  RetentionOffer,
  Subscription,
  SubscriptionStatus,
} from "@/registry/factory/contract/ports"
import { CONTRACT_VERSION, type EventName, type EventProps } from "@/registry/factory/contract/events"
import type { MOCK_SUBS } from "@/registry/factory/contract/adapter-mock"
import { withAttribution } from "@/registry/factory/contract/attribution"

declare const track: AnalyticsPort["track"]
declare const email: string

// ① 필수 동의는 true 만 — 약관·개인정보를 끈 채 가입할 수 없다. 선택(마케팅)은 빠져도 된다(기본 false).
export const consentOk: ConsentInput = { terms: true, privacy: true }
export const consentMarketing: ConsentInput = { terms: true, privacy: true, marketing: { email: false, sms: true } }
// @ts-expect-error — 약관 동의는 true 만
export const consentNoTerms: ConsentInput = { terms: false, privacy: true }
// @ts-expect-error — 개인정보 수집·이용 동의는 약관과 별도 필수 항목이다
export const consentNoPrivacy: ConsentInput = { terms: true }

// ② 계측 props 에는 개인정보가 없다 — 이메일을 실으면 오류다.
track("cta_click", { id: "hero-primary", label: "무료로 시작하기(예시)", section: "hero" })
// @ts-expect-error — cta_click props 에 email 은 없다(개인정보 금지)
track("cta_click", { id: "hero-primary", label: "시작하기", section: "hero", email })
// @ts-expect-error — 이벤트 표에 없는 이름
track("button_clicked", {})

// ③ 금액은 최소 단위 정수(number)다 — 문자열 금액은 오류.
export const price: Money = { amount: 9900, currency: "KRW", vatIncluded: true }
// @ts-expect-error — amount 는 number
export const priceString: Money = { amount: "9900", currency: "KRW", vatIncluded: true }

// ④ 블록은 포트 전체가 아니라 메서드만 받는다 — 메서드 타입이 따로 떼어진다.
type CancelFlowProps = { cancel: BillingPort["cancel"]; pause?: BillingPort["pause"]; track?: AnalyticsPort["track"] }
export const cancelFlowProps = (billing: BillingPort, analytics?: AnalyticsPort): CancelFlowProps => ({
  cancel: billing.cancel,
  pause: billing.pause,
  track: analytics?.track,
})

// ⑤ 이벤트 표와 포트 타입이 어긋나지 않는다(events.ts 는 ports.ts 를 부르지 않아 순환 의존이 없다 — 값 목록이 같은지 여기서 본다).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <T extends true>(t: T) => t
same<Same<EventProps["login"]["method"], AuthMethod>>(true)
same<Same<EventProps["plan_select"]["interval"], Interval>>(true)
same<Same<NonNullable<EventProps["cancel_complete"]["reason"]>, CancelReason>>(true)
same<Same<EventProps["checkout_complete"]["currency"], Currency>>(true)
// 목의 ?sub= 값은 구독 상태 7개 전부다.
same<Same<(typeof MOCK_SUBS)[number], SubscriptionStatus>>(true)

// ⑥ 어떤 이벤트 props 에도 개인정보 키가 없다(이름·이메일·전화).
type PropKeys = { [E in EventName]: keyof EventProps[E] }[EventName]
same<Same<Extract<PropKeys, "email" | "phone" | "name">, never>>(true)

// ⑦ Task 10b — 가격 변경 동의(L6)·해지 대안(R2)·AI 유입(X8).
export const pending: Subscription["pendingPriceChange"] = { from: price, to: { ...price, amount: 12900 }, effectiveAt: "2026-10-31T15:00:00.000Z", consentBy: "2026-10-24T15:00:00.000Z", kind: "price_increase" }
// @ts-expect-error — 가격 변경 종류는 trial_to_paid·price_increase 둘뿐
export const pendingBad: Subscription["pendingPriceChange"] = { ...pending!, kind: "plan_change" }
export const discountOffer: RetentionOffer = { id: "discount-30-3", kind: "discount", discount: { percent: 30, months: 3 } }
// @ts-expect-error — 해지 대안 종류는 pause·downgrade·discount(환불은 대안이 아니다)
export const refundOffer: RetentionOffer = { id: "refund", kind: "refund" }
track("page_view", { path: "/", utmSource: "chatgpt.com", referrerKind: "ai" })
// @ts-expect-error — 유입 종류는 search·ai·social·direct·other
track("page_view", { path: "/", referrerKind: "email" })
// 해지 대안 종류는 계측 cancel_alternative_* 의 alternative 에서 "other" 를 뺀 것과 같다.
same<Same<RetentionOffer["kind"], Exclude<EventProps["cancel_alternative_accept"]["alternative"], "other">>>(true)

// ⑧ Task 10c(계약 판 2) — 출처 태그는 props 밖, track 의 선택 셋째 인자다. 블록의 두 인자 호출(선택 track?.)은 그대로 통과한다.
declare const blockTrack: AnalyticsPort["track"] | undefined
declare const analyticsPort: AnalyticsPort
blockTrack?.("cta_click", { id: "faq-more", label: "더 보기(예시)", section: "faq" })
track("cta_click", { id: "hero-primary", label: "시작하기(예시)", section: "hero" }, { attribution: { blockId: "hero-split", recipeId: "r1-measure", experiment: { key: "hero-cta", arm: "b" } } })
// @ts-expect-error — 출처 태그를 props 안에 넣지 않는다(셋째 인자 meta 로)
track("cta_click", { id: "hero-primary", label: "시작하기", section: "hero", blockId: "hero-split" })
export const wrapped: AnalyticsPort = withAttribution(analyticsPort, { recipeId: "r1-measure" })
export const contractVersion: 2 = CONTRACT_VERSION
export const trialCheckout: Parameters<BillingPort["checkout"]>[0] = { planId: "pro", trial: false }
