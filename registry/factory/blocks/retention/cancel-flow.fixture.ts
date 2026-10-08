import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { MOCK_PLANS, MOCK_RETENTION_OFFERS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { RetentionCancelFlowCopy, RetentionCancelFlowProps } from "./cancel-flow"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 프로 요금제 해지. 대안은 목의 예시(R2 순서 — 일시정지 1개월
// → 베이직으로 다운그레이드 → 3개월 30% 할인) — 보이는 것은 첫 하나(일시정지)뿐이다. 약관에 중도해지가 있다고 가정한다(최소 예시는 없음).
// 갤러리 포트: ?sub=active(기본)|trialing|past_due|… · &state=(subscription·plans 읽기) · &submit=(cancel·applyRetentionOffer 결과).
const COPY: RetentionCancelFlowCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "구독 해지",
  lead: "해지는 세 단계면 끝나요(예시).",
  steps: ["해지 방식", "다른 방법", "해지 완료"],
  reason: {
    legend: "해지하는 이유를 하나 골라 주세요",
    marker: "(선택)",
    hint: "고르지 않아도 해지할 수 있어요.",
    options: { too_expensive: "요금이 부담돼요", not_using: "자주 쓰지 않아요", missing_feature: "필요한 기능이 없어요", switching: "다른 서비스로 옮겨요", temporary: "잠시 쉬고 싶어요", other: "기타" },
  },
  when: {
    legend: "언제 해지할까요?",
    periodEnd: { label: "결제 기간이 끝나면 해지(일반 해지)", body: "{date}까지 쓸 수 있고, 그 뒤 결제되지 않아요." },
    now: { label: "지금 바로 해지(중도 해지)", body: "오늘 바로 끝나요. 남은 기간 요금은 약관에 따라 돌려받아요." },
    only: "결제 기간이 끝나는 {date}까지 쓸 수 있고, 그 뒤 결제되지 않아요.",
  },
  next: "해지 계속하기",
  keep: "계속 쓰기",
  offer: {
    title: "해지하는 대신 이렇게 할 수도 있어요",
    pause: { title: "{months}개월 쉬기", body: "{months}개월 동안 결제 없이 쉬고, 그 뒤 자동으로 다시 시작해요. 만든 일정은 그대로 남아요.", accept: "{months}개월 쉬기" },
    downgrade: { title: "{plan} 요금제로 바꾸기", body: "다음 결제부터 {amount}({vat})만 내요.", accept: "{plan} 요금제로 바꾸기" },
    discount: { title: "{months}개월 동안 {percent}% 할인", body: "{months}개월 동안 매달 {before} 대신 {after}({vat})을 내요.", accept: "할인받고 계속 쓰기" },
  },
  confirm: { title: "해지할까요?", body: "{date}까지 쓸 수 있고, 그 뒤 결제되지 않아요.", keep: "계속 쓰기" },
  cancel: "해지하기",
  pending: "처리하는 중",
  done: {
    title: "해지했어요",
    periodEnd: "{date}까지 쓸 수 있어요. 그 뒤로는 결제되지 않아요.",
    now: "{date}에 해지됐어요. 남은 기간 요금은 약관에 따라 돌려드려요.",
    again: "마음이 바뀌면 결제 관리에서 언제든 다시 시작할 수 있어요.",
    noMoreCharges: "다음 결제는 없어요. 더는 청구되지 않아요.",
    otherChannels: { title: "다른 곳에서 결제했다면", body: "앱스토어·통신사·결제 대행처럼 다른 곳에서 결제했다면 그곳에서도 해지해야 해요. 앱을 지우는 것은 해지가 아니에요(예시)." },
    back: { label: "결제 관리로 돌아가기", href: "#billing" },
  },
  // 이미 해지가 예약된 구독(F05) — 해지 흐름 대신 상태와 [계속 쓰기]
  scheduled: { title: "이미 해지를 예약했어요", body: "{date}까지 쓸 수 있고, 그 뒤 결제되지 않아요. 마음이 바뀌었다면 계속 쓸 수 있어요.", keep: "계속 쓰기", pending: "되돌리는 중", done: "해지를 취소했어요. 계속 쓸 수 있고 다음 결제일에 이어서 결제돼요." },
  offerDone: { title: "해지하지 않았어요", pause: "{date}까지 쉬어요. 그동안 결제되지 않아요.", downgrade: "다음 결제일부터 {plan} 요금제로 바뀌어요.", discount: "다음 결제부터 할인된 요금으로 결제돼요." },
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  none: { title: "해지할 구독이 없어요", body: "지금은 무료로 쓰고 있어요. 결제되는 요금이 없어요(예시)." },
  alert: { field: "확인이 필요해요", server: "처리하지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "구독 정보를 불러오는 중이에요",
  error: "구독 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}
const SUB = { planId: "pro", status: "active" as const, currentPeriodEnd: "2026-10-31T15:00:00.000Z" }

export const fixture: RetentionCancelFlowProps = {
  copy: COPY,
  offers: [...MOCK_RETENTION_OFFERS],
  terms: { midTerm: true },
  keepHref: "#billing",
  subscription: async () => ({ ok: true, data: SUB }),
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  cancel: async () => ({ ok: true, data: { ...SUB, cancelAt: SUB.currentPeriodEnd } }),
  applyRetentionOffer: async () => ({ ok: true, data: { planId: "pro", status: "paused", pausedUntil: "2026-11-01T00:00:00.000Z" } }),
}

export const fixtureMax: RetentionCancelFlowProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "구독 해지 — 세 단계면 끝나고, 해지해도 결제 기간 끝까지 쓸 수 있어요(예시)",
    lead: "해지는 세 단계면 끝나요. 해지해도 만든 일정·보고서는 90일 동안 보관되고, 그 안에 다시 시작하면 그대로 이어서 쓸 수 있어요(예시).",
  },
}

// 최소: 머리말 없이, 약관에 중도해지가 없고(일반 해지만) 대안도 없다(② 는 해지 확인 한 장).
export const fixtureMin: RetentionCancelFlowProps = { ...fixture, copy: { ...COPY, lead: undefined }, offers: [], terms: { midTerm: false } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<RetentionCancelFlowProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "active")
  const billing = mockBilling(qq, { requireConfirmation: true }) // 확인 단계 뒤 confirmed 를 싣지 않은 블록은 갤러리에서 승인 대기로 끝난다(P3-7 AXC)
  return { subscription: billing.subscription, plans: billing.plans, cancel: billing.cancel, applyRetentionOffer: billing.applyRetentionOffer, resume: billing.resume, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: RetentionCancelFlowProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: "Cancel subscription",
    lead: "Canceling takes three steps (example).",
    steps: ["How to cancel", "Other options", "Canceled"],
    reason: {
      legend: "Pick one reason for canceling",
      marker: "(Optional)",
      hint: "You can cancel without picking one.",
      options: {
        too_expensive: "It's too expensive",
        not_using: "I don't use it often",
        missing_feature: "It's missing features I need",
        switching: "I'm switching to another service",
        temporary: "I want to take a break",
        other: "Other",
      },
    },
    when: {
      legend: "When should it end?",
      periodEnd: {
        label: "Cancel at the end of the billing period",
        body: "You can use the service until {date}, and you won't be charged after that.",
      },
      now: {
        label: "Cancel right now",
        body: "It ends today. You'll get a refund for the remaining period under the terms.",
      },
      only: "You can use the service until {date}, when the billing period ends, and you won't be charged after that.",
    },
    next: "Continue canceling",
    keep: "Keep my plan",
    offer: {
      title: "Instead of canceling, you could",
      pause: {
        title: "Pause for {months} months",
        body: "Pause for {months} months with no charges, then restart automatically. What you've made stays as it is.",
        accept: "Pause for {months} months",
      },
      downgrade: {
        title: "Switch to {plan}",
        body: "Pay just {amount} ({vat}) from your next payment.",
        accept: "Switch to {plan}",
      },
      discount: {
        title: "{percent}% off for {months} months",
        body: "For {months} months, pay {after} ({vat}) a month instead of {before}.",
        accept: "Take the discount and keep using",
      },
    },
    confirm: {
      title: "Cancel your subscription?",
      body: "You can use the service until {date}, and you won't be charged after that.",
      keep: "Keep my plan",
    },
    cancel: "Cancel subscription",
    pending: "Processing",
    done: {
      title: "Canceled",
      periodEnd: "You can use the service until {date}. You won't be charged after that.",
      now: "Canceled on {date}. We'll refund the remaining period under the terms.",
      again: "If you change your mind, you can restart any time under Billing.",
      noMoreCharges: "There's no next payment. You won't be charged again.",
      otherChannels: {
        title: "If you paid somewhere else",
        body: "If you paid through an app store, a carrier or a payment agent, you also need to cancel there. Deleting the app doesn't cancel the subscription (example).",
      },
      back: {
        label: "Back to Billing",
        href: "#billing",
      },
    },
    scheduled: {
      title: "Cancellation is already scheduled",
      body: "You can use the service until {date}, and you won't be charged after that. If you've changed your mind, you can keep using it.",
      keep: "Keep my plan",
      pending: "Undoing",
      done: "Cancellation undone. You can keep using the service, and billing continues on your next billing date.",
    },
    offerDone: {
      title: "You didn't cancel",
      pause: "Paused until {date}. You won't be charged meanwhile.",
      downgrade: "You'll move to the {plan} plan from your next billing date.",
      discount: "You'll be charged the discounted price from your next payment.",
    },
    vatIncluded: "VAT included",
    vatExcluded: "VAT not included",
    none: {
      title: "No subscription to cancel",
      body: "You're on the free plan. Nothing is being charged (example).",
    },
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
    loading: "Loading subscription details",
    error: "We couldn't load subscription details",
    retry: "Reload",
  },
}
