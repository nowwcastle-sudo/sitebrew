import { MOCK_NOW, MOCK_PLANS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { OFFER_COPY } from "./upgrade-modal.fixture"
import type { PaywallLimitMeterCopy, PaywallLimitMeterProps } from "./limit-meter"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 프로 요금제(프로젝트 20개)의 사용량.
// 갤러리 예시별 사용량: 기본 17/20(85% — 인라인 제안) · 최대 20/20(100% — 부드러운 막음 + 무료로 계속할 길) · 최소 6/20(30% — 막대만).
// 갤러리 포트: ?sub= 상태(기본 active) · &state=(subscription·plans 읽기) · &submit=(checkout 결과).
const COPY: PaywallLimitMeterCopy = {
  title: "이번 달 사용량",
  lead: "요금제 한도 안에서 얼마나 썼는지 보여 드려요(예시).",
  resource: "프로젝트",
  usage: "{resource} {used}개 / {limit}개",
  warn: { title: "한도의 {percent}%를 썼어요", body: "{plan} 요금제로 올리면 {resource}를 {limit}개까지 만들 수 있어요.", later: "{days}일 동안 안 보기", look: "{plan} 요금제 살펴보기" },
  blocked: {
    title: "{resource} 한도에 닿았어요",
    body: "새로 만들 수는 없지만, 있는 프로젝트는 그대로 열고 고칠 수 있어요.",
    free: { label: "무료로 계속 쓰기 — 안 쓰는 프로젝트 보관하기", href: "#archive" },
  },
  offer: OFFER_COPY,
  noUsage: "아직 사용량이 없어요.",
  alert: { field: "확인이 필요해요", server: "결제 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "사용량을 불러오는 중이에요",
  error: "사용량을 불러오지 못했어요",
  retry: "다시 불러오기",
  done: "{plan} 요금제로 바꿨어요. 이제 새 프로젝트를 만들 수 있어요(예시).",
}

const usageSub = (used: number) => ({ planId: "pro", status: "active" as const, currentPeriodEnd: "2026-10-31T15:00:00.000Z", usage: { projects: { used, limit: 20 } } })

export const fixture: PaywallLimitMeterProps = {
  copy: COPY,
  limitKey: "projects",
  now: MOCK_NOW,
  subscription: async () => ({ ok: true, data: usageSub(17) }),
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  checkout: async () => ({ ok: true, data: { redirectUrl: "#checkout" } }),
}

export const fixtureMax: PaywallLimitMeterProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "이번 달 사용량 — 요금제 한도와 남은 양을 한눈에 봐요(예시)",
    lead: "요금제 한도 안에서 얼마나 썼는지 보여 드려요. 보관한 프로젝트는 한도에 세지 않고, 한도는 매달 1일이 아니라 결제일마다 다시 세요(예시).",
    blocked: { ...COPY.blocked, body: "새로 만들 수는 없지만, 있는 프로젝트는 그대로 열고 고치고 공유할 수 있어요. 안 쓰는 프로젝트를 보관하면 그만큼 새로 만들 수 있어요." },
  },
  subscription: async () => ({ ok: true, data: usageSub(20) }),
}

export const fixtureMin: PaywallLimitMeterProps = { ...fixture, copy: { ...COPY, lead: undefined }, subscription: async () => ({ ok: true, data: usageSub(6) }) }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<PaywallLimitMeterProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "active")
  const used = g.fx === "max" ? 20 : g.fx === "min" ? 6 : 17
  const billing = mockBilling(qq, { subscription: { usage: { projects: { used, limit: 20 } } }, requireWithdrawalConsent: true })
  return { subscription: billing.subscription, plans: billing.plans, checkout: billing.checkout, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: PaywallLimitMeterProps = {
  ...fixture,
  copy: {
    title: "Usage this month",
    lead: "See how much of your plan's limit you've used (example).",
    resource: "projects",
    usage: "{used} of {limit} {resource}",
    warn: {
      title: "You've used {percent}% of your limit",
      body: "Upgrade to {plan} to create up to {limit} {resource}.",
      later: "Hide for {days} days",
      look: "See the {plan} plan",
    },
    blocked: {
      title: "You've reached the limit on {resource}",
      body: "You can't create new ones, but you can still open and edit your existing projects.",
      free: {
        label: "Keep using it free: archive projects you don't use",
        href: "#archive",
      },
    },
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
    noUsage: "No usage yet.",
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
    loading: "Loading usage",
    error: "We couldn't load usage",
    retry: "Reload",
    done: "You're on {plan}. You can create new projects now (example).",
  },
}
