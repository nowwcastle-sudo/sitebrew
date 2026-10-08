import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { MOCK_PLANS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AccountBillingManageCopy, AccountBillingManageProps } from "./billing-manage"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 결제 관리. 요금제는 목의 예시 요금제(원화, VAT 포함).
// 갤러리 포트: ?sub=active(기본)|trialing|past_due|paused|canceled|expired|none|pending-price-change · &state=(subscription·plans 읽기)
// · &submit=(changePlan·updatePaymentMethod·resume·portal 결과). ?sub=cancel-scheduled 는 이 예시가 active 구독에 해지 예약(period_end)을 미리 걸어 만든 장면이다(어댑터 목의 상태는 아니다).
const GRACE_ENDS_AT = "2026-10-10T15:00:00.000Z"
export const BILLING_COMMON = {
  per: { perMonth: "월", perYear: "년", once: "한 번" },
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
}
const COPY: AccountBillingManageCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "결제 관리",
  lead: "요금제·다음 결제일·결제 수단을 여기서 바꿔요(예시).",
  labels: { plan: "지금 요금제", nextDate: "다음 결제일", amount: "결제 금액", method: "결제 수단", retry: "다시 결제를 시도하는 날" },
  status: { none: "구독 없음", trialing: "무료 체험 중", active: "이용 중", past_due: "결제 실패", paused: "일시정지", canceled: "해지 예약", expired: "기간 끝남" },
  notes: {
    trialing: "무료 체험은 {date}까지예요. 체험이 끝나기 전에 결제 여부를 다시 여쭤볼게요.",
    pastDue: "지난 결제가 되지 않았어요. {date}에 다시 결제해요. {until}까지 모든 기능을 그대로 쓸 수 있어요.",
    paused: "{date}까지 쉬는 중이에요. 쉬는 동안에는 결제되지 않아요.",
    cancelAt: "해지를 예약했어요. {date}까지 쓸 수 있고, 그 뒤 결제되지 않아요.",
    expired: "이용 기간이 끝났어요. 요금제를 고르면 다시 쓸 수 있어요.",
    scheduled: "{date}부터 {plan} 요금제로 바뀌어요.",
  },
  // 해지·만료 뒤 「다시 시작」(F03) — 결제 화면 링크(요금제 id 가 실린다). 예시 주소는 갤러리를 떠나지 않게 해시다
  restart: { title: "다시 시작하기", body: "이용이 끝났어요. 한 번 누르면 결제 화면으로 가요. 첫 결제일과 금액은 결제 전에 한 번 더 보여 드려요(예시).", label: "{plan} 다시 시작", href: "#upgrade-{plan}", choose: "{plan} 시작하기" },
  none: { title: "구독 중인 요금제가 없어요", body: "무료로 쓰는 중이에요. 요금제를 고르면 더 많은 프로젝트를 만들 수 있어요(예시).", label: "요금제 보기", href: "#pricing" },
  ...BILLING_COMMON,
  updateMethod: { label: "결제 수단 바꾸기", pending: "여는 중", body: "등록한 카드로 매달 결제돼요. 결제 수단 화면은 결제 대행사(예시) 창에서 열려요." },
  cancel: { label: "구독 해지하기", href: "#cancel-flow", note: "해지해도 {date}까지는 쓸 수 있어요." },
  change: {
    title: "요금제 바꾸기",
    caption: "요금제별 요금(부가세 포함)과 포함 기능",
    cols: { plan: "요금제", price: "요금", billing: "결제 주기", features: "포함 기능", action: "바꾸기" },
    current: "지금 쓰는 중",
    scheduled: "바뀔 예정",
    choose: "{plan} 요금제로 바꾸기",
    question: "{plan} 요금제로 바꿀까요?",
    body: "{date} 결제부터 {amount}({vat})이 청구되고 {plan} 요금제로 바뀌어요. 그 전까지는 지금 요금제를 그대로 써요.",
    cancel: "취소",
    confirm: "{plan} 요금제로 바꾸기",
    pending: "바꾸는 중",
    done: "바꿨어요",
  },
  alert: { field: "확인이 필요해요", server: "처리하지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  revive: {
    cancelScheduled: { label: "해지 취소하고 계속 쓰기", pending: "되돌리는 중", done: "해지를 취소했어요. 계속 쓸 수 있고 다음 결제일에 이어서 결제돼요." },
    paused: { label: "지금 다시 시작", pending: "다시 시작하는 중", done: "다시 시작했어요. 오늘부터 모든 기능을 쓸 수 있어요." },
    errorTitle: "되돌리지 못했어요 — 잠시 뒤 다시 눌러 주세요",
  },
  invoices: { label: "청구서·영수증 보기", pending: "여는 중", hint: "결제 대행사(예시)의 새 창에서 열려요. 카드 정보는 여기에 저장되지 않아요.", errorTitle: "청구서 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "구독 정보를 불러오는 중이에요",
  error: "구독 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountBillingManageProps = {
  copy: COPY,
  subscription: async () => ({ ok: true, data: { planId: "pro", status: "active", currentPeriodEnd: "2026-10-31T15:00:00.000Z" } }),
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  changePlan: async ({ planId }) => ({ ok: true, data: { planId: "pro", status: "active", currentPeriodEnd: "2026-10-31T15:00:00.000Z", scheduledPlanId: planId } }),
  updatePaymentMethod: async () => ({ ok: true, data: { redirectUrl: "#payment-method" } }),
  resume: async () => ({ ok: true, data: { planId: "pro", status: "active", currentPeriodEnd: "2026-10-31T15:00:00.000Z" } }),
  portal: async () => ({ ok: true, data: { redirectUrl: "#billing-portal" } }),
}

export const fixtureMax: AccountBillingManageProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "결제 관리 — 요금제·다음 결제일·결제 수단·해지(예시)",
    lead: "요금제·다음 결제일·결제 수단을 여기서 바꿔요. 팀 요금제는 관리자만 바꿀 수 있고, 바꾼 내용은 관리자 이메일로도 알려 드려요. 영수증은 결제일마다 메일로 보내요(예시).",
  },
}

export const fixtureMin: AccountBillingManageProps = { ...fixture, copy: { ...COPY, lead: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountBillingManageProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "active")
  const scheduled = qq.get("sub") === "cancel-scheduled"
  if (scheduled) qq.set("sub", "active")
  // 결제 실패 장면에는 접근이 멈추는 날(graceEndsAt)을 더한다(목의 past_due 에는 없다 — 선택 칸)
  const billing = mockBilling(qq, { requireConfirmation: true, plans: g.fx === "min" ? MOCK_PLANS.slice(0, 2) : MOCK_PLANS, ...(qq.get("sub") === "past_due" ? { subscription: { graceEndsAt: GRACE_ENDS_AT } } : {}) })
  const primed = scheduled ? billing.cancel({ when: "period_end" }) : null
  const subscription = primed ? async () => (await primed, billing.subscription()) : billing.subscription
  return { subscription, plans: billing.plans, changePlan: billing.changePlan, updatePaymentMethod: billing.updatePaymentMethod, resume: billing.resume, portal: billing.portal, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: AccountBillingManageProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: "Billing",
    lead: "Change your plan, next billing date and payment method here (example).",
    labels: {
      plan: "Current plan",
      nextDate: "Next billing date",
      amount: "Amount",
      method: "Payment method",
      retry: "Next retry date",
    },
    status: {
      none: "No subscription",
      trialing: "Free trial",
      active: "Active",
      past_due: "Payment failed",
      paused: "Paused",
      canceled: "Cancellation scheduled",
      expired: "Expired",
    },
    notes: {
      trialing: "Your free trial runs until {date}. We'll check with you before it ends.",
      pastDue: "Your last payment didn't go through. We'll try again on {date}. You can keep using every feature until {until}.",
      paused: "Paused until {date}. You won't be charged while paused.",
      cancelAt: "Cancellation is scheduled. You can use the service until {date}, and you won't be charged after that.",
      expired: "Your plan has expired. Choose a plan to start using the service again.",
      scheduled: "From {date}, you'll be on the {plan} plan.",
    },
    restart: {
      title: "Restart",
      body: "Your plan has ended. One click takes you to checkout, and we'll show the first billing date and amount once more before you pay (example).",
      label: "Restart {plan}",
      href: "#upgrade-{plan}",
      choose: "Start {plan}",
    },
    none: {
      title: "You don't have a paid plan",
      body: "You're on the free plan. Choose a plan to create more projects (example).",
      label: "View plans",
      href: "#pricing",
    },
    per: {
      perMonth: "month",
      perYear: "year",
      once: "once",
    },
    vatIncluded: "VAT included",
    vatExcluded: "VAT not included",
    updateMethod: {
      label: "Update payment method",
      pending: "Opening",
      body: "You're billed monthly on your saved card. The payment method page opens in the payment provider's (example) window.",
    },
    cancel: {
      label: "Cancel subscription",
      href: "#cancel-flow",
      note: "You can still use the service until {date} after canceling.",
    },
    change: {
      title: "Change plan",
      caption: "Price per plan (VAT included) and included features",
      cols: {
        plan: "Pricing",
        price: "Price",
        billing: "Billing cycle",
        features: "Included features",
        action: "Change",
      },
      current: "Current plan",
      scheduled: "Scheduled",
      choose: "Switch to {plan}",
      question: "Switch to {plan}?",
      body: "From the {date} payment, you'll be charged {amount} ({vat}) and move to the {plan} plan. Until then, you stay on your current plan.",
      cancel: "Cancel",
      confirm: "Switch to {plan}",
      pending: "Switching",
      done: "Switched",
    },
    alert: {
      field: "Please check this",
      server: "We couldn't process that. Please try again in a moment.",
    },
    revive: {
      cancelScheduled: {
        label: "Undo cancellation and keep using",
        pending: "Undoing",
        done: "Cancellation undone. You can keep using the service, and billing continues on your next billing date.",
      },
      paused: {
        label: "Restart now",
        pending: "Restarting",
        done: "You're back. Every feature is available from today.",
      },
      errorTitle: "We couldn't undo that. Please try again in a moment.",
    },
    invoices: {
      label: "View invoices and receipts",
      pending: "Opening",
      hint: "Opens in a new window at the payment provider (example). Your card details aren't stored here.",
      errorTitle: "We couldn't open the invoices. Please try again in a moment.",
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
