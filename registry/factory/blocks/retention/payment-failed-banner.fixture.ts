import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { RetentionPaymentFailedBannerCopy, RetentionPaymentFailedBannerProps } from "./payment-failed-banner"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 결제 실패 띠.
// 갤러리 포트: ?sub=past_due(기본 — 카드 거절, 10월 4일 재시도) · ?sub=active 로 바꾸면(복구) 띠가 사라진다 · &submit=(updatePaymentMethod 결과).
const COPY: RetentionPaymentFailedBannerCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "이번 달 결제가 되지 않았어요",
  reasons: {
    card_declined: "카드사에서 결제를 거절했어요.",
    expired_card: "등록한 카드의 유효기간이 지났어요.",
    insufficient_funds: "카드 한도나 잔액이 모자라요.",
    unknown: "결제 중에 문제가 생겼어요.",
  },
  retry: "{date}에 다시 결제해요.",
  access: "그때까지 모든 기능을 그대로 쓸 수 있어요.",
  accessUntil: "{date}까지 모든 기능을 그대로 쓸 수 있어요.",
  recovered: "결제가 다시 이루어졌어요. 이제 걱정 없이 쓰셔도 돼요.",
  action: "결제 수단 바꾸기",
  pending: "여는 중",
  alert: { field: "확인이 필요해요", server: "결제 수단 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
}
const GRACE_ENDS_AT = "2026-10-10T15:00:00.000Z"
const PAST_DUE = { planId: "pro", status: "past_due" as const, currentPeriodEnd: "2026-10-31T15:00:00.000Z", graceEndsAt: GRACE_ENDS_AT, paymentIssue: { reason: "card_declined" as const, retryAt: "2026-10-03T15:00:00.000Z" } }

export const fixture: RetentionPaymentFailedBannerProps = {
  copy: COPY,
  subscription: async () => ({ ok: true, data: PAST_DUE }),
  updatePaymentMethod: async () => ({ ok: true, data: { redirectUrl: "#payment-method" } }),
}

export const fixtureMax: RetentionPaymentFailedBannerProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "이번 달 결제가 되지 않았어요 — 카드를 바꾸면 바로 다시 결제해요(예시)",
    reasons: { ...COPY.reasons, card_declined: "카드사에서 결제를 거절했어요. 해외 결제 차단·분실 신고 여부를 카드사에 확인해 보시거나 다른 카드로 바꿔 주세요." },
    access: "그때까지 일정·보고서·팀 공유를 포함한 모든 기능을 그대로 쓸 수 있어요.",
  },
}

export const fixtureMin: RetentionPaymentFailedBannerProps = { ...fixture, subscription: async () => ({ ok: true, data: { ...PAST_DUE, paymentIssue: { reason: "unknown" as const } } }) }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<RetentionPaymentFailedBannerProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "past_due")
  const billing = mockBilling(qq, g.fx === "min" ? { subscription: { paymentIssue: { reason: "unknown" } } } : { subscription: { graceEndsAt: GRACE_ENDS_AT } })
  // 결제 수단 화면으로 보내는 대신 갤러리에서는 보낸 주소를 window.__wfRedirects 에 쌓는다(갤러리를 떠나지 않는다 — blocks:states 가 「보냈다」를 그것으로 본다, 대장 A143)
  const onRedirect = (url: string) => {
    const w = window as unknown as { __wfRedirects?: string[] }
    ;(w.__wfRedirects ??= []).push(url)
  }
  return { subscription: billing.subscription, updatePaymentMethod: billing.updatePaymentMethod, onRedirect, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: RetentionPaymentFailedBannerProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: "This month's payment didn't go through",
    reasons: {
      card_declined: "Your card issuer declined the payment.",
      expired_card: "The card on file has expired.",
      insufficient_funds: "Your card limit or balance is too low.",
      unknown: "Something went wrong during payment.",
    },
    retry: "We'll try to charge you again on {date}.",
    access: "You can keep using every feature until then.",
    accessUntil: "You can keep using every feature until {date}.",
    recovered: "Your payment went through. You're all set.",
    action: "Update payment method",
    pending: "Opening",
    alert: {
      field: "Please check this",
      server: "We couldn't open the payment method page. Please try again in a moment.",
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
