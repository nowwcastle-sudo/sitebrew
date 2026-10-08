import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { RetentionRenewalConsentCopy, RetentionRenewalConsentProps } from "./renewal-consent"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 프로 요금 인상(29,000원 → 33,000원, VAT 포함) 동의.
// 갤러리 포트: ?sub=pending-price-change(기본 — 10월 31일부터 적용, 10월 23일까지 동의) · 다른 ?sub= 은 동의할 것이 없어 비어 있다
// · &submit=(acceptPriceChange·cancel 결과).
const COPY: RetentionRenewalConsentCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: { price_increase: "다음 결제부터 요금이 바뀌어요", trial_to_paid: "무료 체험이 끝나면 유료로 바뀌어요" },
  lead: {
    price_increase: "{date} 결제부터 프로 요금제 요금이 올라요. 계속 쓰려면 새 요금에 동의해 주세요(예시).",
    trial_to_paid: "{date}부터 유료로 바뀌어요. 계속 쓰려면 결제에 동의해 주세요(예시).",
  },
  caption: "바뀌기 전과 뒤의 요금(부가세 포함)과 적용일",
  cols: { item: "항목", before: "지금", after: "바뀐 뒤" },
  rows: { price: "요금", billing: "결제 주기·부가세", from: "적용일" },
  consentBy: "{date}까지 알려 주세요",
  ifNot: "동의하지 않으면 오른 요금으로 결제되지 않아요. {date}에 구독이 멈추고, 만든 일정은 그대로 남아요.",
  accept: "새 요금에 동의하기",
  cancel: "해지하기",
  pending: "처리하는 중",
  later: "나중에 결정하기",
  paymentMethod: "결제 수단은 지금 등록한 카드 그대로예요. 바꾸려면 결제 관리에서 바꿀 수 있어요.",
  howToCancel: "동의하지 않으면 위의 [해지하기]를 눌러 주세요. 계정 > 결제 관리에서도 언제든 해지할 수 있고, 해지해도 기간 끝까지 쓸 수 있어요.",
  empty: { title: "동의할 가격 변경이 없어요", body: "지금은 동의를 기다리는 요금 변경이 없어요. 이미 답하셨다면 그대로 반영됐어요(예시).", label: "결제 관리로 가기", href: "#billing" },
  loading: "가격 변경을 불러오는 중이에요",
  error: "가격 변경을 불러오지 못했어요",
  retry: "다시 불러오기",
  accepted: "동의했어요. {date} 결제부터 {amount}이 결제돼요.",
  canceled: "해지했어요. {date}까지 쓸 수 있고, 그 뒤 결제되지 않아요.",
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  per: "월",
  alert: { field: "확인이 필요해요", server: "처리하지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
}
const PENDING = {
  planId: "pro",
  status: "active" as const,
  currentPeriodEnd: "2026-10-30T15:00:00.000Z",
  pendingPriceChange: {
    from: { amount: 29_000, currency: "KRW" as const, vatIncluded: true },
    to: { amount: 33_000, currency: "KRW" as const, vatIncluded: true },
    effectiveAt: "2026-10-30T15:00:00.000Z",
    consentBy: "2026-10-23T15:00:00.000Z",
    kind: "price_increase" as const,
  },
}

export const fixture: RetentionRenewalConsentProps = {
  copy: COPY,
  subscription: async () => ({ ok: true, data: PENDING }),
  acceptPriceChange: async () => ({ ok: true, data: { ...PENDING, pendingPriceChange: undefined } }),
  cancel: async () => ({ ok: true, data: { ...PENDING, cancelAt: PENDING.currentPeriodEnd } }),
}

export const fixtureMax: RetentionRenewalConsentProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: { ...COPY.title, price_increase: "다음 결제부터 요금이 바뀌어요 — 동의하시면 그대로 이어서 쓸 수 있어요(예시)" },
    lead: {
      ...COPY.lead,
      price_increase: "{date} 결제부터 프로 요금제 요금이 올라요. 서버·지원 비용이 늘어 2년 만에 요금을 조정해요. 계속 쓰려면 새 요금에 동의해 주시고, 원하지 않으면 해지해도 기간 끝까지 쓸 수 있어요(예시).",
    },
  },
}

// 최소: 무료 체험 → 유료 전환(0원 → 29,000원) 동의.
const TRIAL_TO_PAID = { ...PENDING.pendingPriceChange, from: { amount: 0, currency: "KRW" as const, vatIncluded: true }, to: { amount: 29_000, currency: "KRW" as const, vatIncluded: true }, kind: "trial_to_paid" as const }
export const fixtureMin: RetentionRenewalConsentProps = { ...fixture, subscription: async () => ({ ok: true, data: { ...PENDING, status: "trialing" as const, pendingPriceChange: TRIAL_TO_PAID } }) }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<RetentionRenewalConsentProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "pending-price-change")
  const billing = mockBilling(qq, { requireConfirmation: true, ...(g.fx === "min" && qq.get("sub") === "pending-price-change" ? { subscription: { status: "trialing" as const, pendingPriceChange: TRIAL_TO_PAID } } : {}) })
  return { subscription: billing.subscription, acceptPriceChange: billing.acceptPriceChange, cancel: billing.cancel, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: RetentionRenewalConsentProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: {
      price_increase: "Your price changes from the next payment",
      trial_to_paid: "Your free trial turns into a paid plan when it ends",
    },
    lead: {
      price_increase: "The Pro plan price goes up from the {date} payment. Please agree to the new price to keep using it (example).",
      trial_to_paid: "It becomes a paid plan from {date}. Please agree to the payment to keep using it (example).",
    },
    caption: "Price before and after the change (VAT included) and the effective date",
    cols: {
      item: "Item",
      before: "Now",
      after: "After",
    },
    rows: {
      price: "Price",
      billing: "Billing cycle and VAT",
      from: "Effective date",
    },
    consentBy: "Please let us know by {date}",
    ifNot: "If you don't agree, you won't be charged the higher price. Your subscription stops on {date}, and what you've made stays as it is.",
    accept: "Agree to the new price",
    cancel: "Cancel subscription",
    pending: "Processing",
    later: "Decide later",
    paymentMethod: "Your payment method stays the same as the card on file. You can change it under Billing.",
    howToCancel: "If you don't agree, press [Cancel subscription] above. You can also cancel any time under Account > Billing, and you can keep using the service until the end of the period.",
    empty: {
      title: "No price change to agree to",
      body: "There's no price change waiting for your agreement. If you've already answered, it's been applied (example).",
      label: "Go to Billing",
      href: "#billing",
    },
    loading: "Loading the price change",
    error: "We couldn't load the price change",
    retry: "Reload",
    accepted: "You agreed. From the {date} payment, you'll be charged {amount}.",
    canceled: "Canceled. You can use the service until {date}, and you won't be charged after that.",
    vatIncluded: "VAT included",
    vatExcluded: "VAT not included",
    per: "month",
    alert: {
      field: "Please check this",
      server: "We couldn't process that. Please try again in a moment.",
    },
    notices: {
      rateLimited: "You can send again in {seconds} seconds",
      timeout: {
        title: "Taking longer than expected",
        body: "The server has not answered yet. What you wrote is still here, so please try again.",
        retry: "Try again",
      },
      unsupported: {
        title: "This cannot be changed here",
        link: "Go to where you manage it",
      },
      approval: {
        title: "Please confirm this yourself",
        attempted: "We received the change you asked for.",
        progress: "Nothing has changed yet.",
        reason: "A person has to review this change and press the button.",
        next: "Please press the confirm button on the screen yourself.",
        route: {
          label: "Contact support",
          href: "#contact",
        },
      },
    },
  },
}
