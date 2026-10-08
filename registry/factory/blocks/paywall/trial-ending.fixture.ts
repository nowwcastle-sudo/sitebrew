import { MOCK_PLANS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { OFFER_COPY } from "./upgrade-modal.fixture"
import type { PaywallTrialEndingCopy, PaywallTrialEndingProps } from "./trial-ending"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 프로 체험이 3일 남은 날.
// 「지금」은 고정값(2026-10-12 — 목의 체험 끝 2026-10-14T15:00Z 까지 3일)이라 남은 날이 흔들리지 않는다.
// 갤러리 포트: ?sub=trialing(기본 — 체험 중이 아니면 블록이 비어 있다) · &state=(subscription·plans 읽기) · &submit=(checkout 결과).
export const TRIAL_NOW = "2026-10-12T00:00:00.000Z"
const COPY: PaywallTrialEndingCopy = {
  title: "체험이 끝나면 어떻게 할까요?",
  daysLeft: "무료 체험이 {days}일 남았어요",
  endsOn: "{date}까지 무료예요",
  whatHappens: "{date}에 체험이 끝나요. 계속 쓰겠다고 하지 않으면 결제되지 않고 무료 요금제로 바뀌어요. 만든 일정은 그대로 남아요(예시).",
  valueTitle: "체험하는 동안 한 일",
  value: ["프로젝트 2개를 만들었어요", "보고서 5개를 PDF로 내려받았어요", "팀원 3명을 초대했어요"],
  offer: OFFER_COPY,
  decline: "체험만 쓰고 끝내기",
  cta: "{amount}으로 계속 쓰기",
  alert: { field: "확인이 필요해요", server: "결제 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "체험 정보를 불러오는 중이에요",
  error: "체험 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
  done: "{plan} 요금제로 계속 써요. 체험이 끝나는 날 첫 결제가 돼요(예시).",
}
const TRIAL = { planId: "pro", status: "trialing" as const, trialEnd: "2026-10-14T15:00:00.000Z", currentPeriodEnd: "2026-10-14T15:00:00.000Z" }

export const fixture: PaywallTrialEndingProps = {
  copy: COPY,
  now: TRIAL_NOW,
  subscription: async () => ({ ok: true, data: TRIAL }),
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  checkout: async () => ({ ok: true, data: { redirectUrl: "#checkout" } }),
}

export const fixtureMax: PaywallTrialEndingProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "체험이 끝나면 어떻게 할까요? 계속 쓸지 지금 정해도 되고, 끝나는 날까지 기다려도 돼요(예시)",
    whatHappens: "{date}에 체험이 끝나요. 계속 쓰겠다고 하지 않으면 결제되지 않고 무료 요금제로 바뀌어요. 만든 일정·보고서는 그대로 남고, 무료 한도(프로젝트 3개)를 넘는 프로젝트는 읽기 전용이 돼요(예시).",
    value: [...COPY.value, "정기 보고서를 2번 자동으로 보냈어요", "알림을 12번 받았어요"],
  },
}

export const fixtureMin: PaywallTrialEndingProps = { ...fixture, copy: { ...COPY, value: [] } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<PaywallTrialEndingProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "trialing")
  const billing = mockBilling(qq, { requireWithdrawalConsent: true })
  return { subscription: billing.subscription, plans: billing.plans, checkout: billing.checkout, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: PaywallTrialEndingProps = {
  ...fixture,
  copy: {
    title: "What would you like to do when your trial ends?",
    daysLeft: "{days} days left in your free trial",
    endsOn: "Free until {date}",
    whatHappens: "Your trial ends on {date}. If you don't choose to continue, you won't be charged and you'll move to the free plan. What you've made stays as it is (example).",
    valueTitle: "What you did during the trial",
    value: ["You created 2 projects", "You downloaded 5 reports as PDF", "You invited 3 teammates"],
    offer: {
      humanHint: "You'll confirm this yourself",
      perMonth: "month",
      perYear: "year",
      vatIncluded: "VAT included",
      vatExcluded: "VAT not included",
      equivalentMonth: "About {amount} a day",
      equivalentYear: "About {amount} a month",
      trial: "The first {days} days are free",
      firstCharge: "Your first payment of {amount} ({vat}) is charged on {date}, when the trial ends",
      chargeNow: "{amount} ({vat}) is charged today",
      autoRenewMonth: "After that, it renews and is charged automatically on the same day each month",
      autoRenewYear: "After that, it renews and is charged automatically on the same day each year",
      howToCancel: "You can cancel any time under Account > Billing. If you cancel during the trial, you won't be charged",
      termsLabel: "Terms of service",
      termsHref: "#terms",
      privacyLabel: "Privacy policy",
      privacyHref: "#privacy",
      ctaTrial: "Start your {days}-day free trial",
      ctaPay: "Pay {amount} and start",
      decline: "Maybe later",
      pendingLabel: "Opening checkout",
      withdrawal: {
        notice: "Once you start using a service or digital content, you can't withdraw from the part you've used. You can still withdraw from any part not yet provided, or provided differently from what was advertised or agreed (example).",
        trial: "We offer a trial and a preview so you can try before you pay (example).",
        consentLabel: "I understand I can't withdraw from the part I've started using",
        consentRequired: "Please read the withdrawal notice and check the box.",
      },
    },
    decline: "Finish with just the trial",
    cta: "Keep going for {amount}",
    alert: {
      field: "Please check this",
      server: "We couldn't open checkout. Please try again in a moment.",
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
    loading: "Loading trial details",
    error: "We couldn't load trial details",
    retry: "Reload",
    done: "You're continuing on {plan}. Your first payment is charged the day the trial ends (example).",
  },
}
