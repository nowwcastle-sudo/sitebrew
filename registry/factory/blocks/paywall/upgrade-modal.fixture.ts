import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { MOCK_NOW, MOCK_PLANS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { PlanOfferCopy } from "../_shared/plan-offer"
import type { PaywallUpgradeModalCopy, PaywallUpgradeModalProps } from "./upgrade-modal"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」에서 잠긴 「보고서 내보내기」를 누른 자리.
// 요금제는 목의 예시 요금제(원화 VAT 포함 — 프로 29,000원/월 · 14일 체험). 「지금」은 목의 고정 시각이라 첫 결제일이 흔들리지 않는다.
// 갤러리 포트: &state=(plans 읽기 — 대화상자를 열어야 보인다) · &submit=(checkout 결과).
export const OFFER_COPY: PlanOfferCopy = {
  humanHint: APPROVAL_HINT.ko,
  perMonth: "월",
  perYear: "년",
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  equivalentMonth: "하루 약 {amount}꼴이에요",
  equivalentYear: "한 달 약 {amount}꼴이에요",
  trial: "처음 {days}일은 무료예요",
  firstCharge: "체험이 끝나는 {date}에 {amount}({vat})이 처음 결제돼요",
  chargeNow: "오늘 {amount}({vat})이 결제돼요",
  autoRenewMonth: "그 뒤 매달 같은 날 자동으로 갱신·결제돼요",
  autoRenewYear: "그 뒤 매년 같은 날 자동으로 갱신·결제돼요",
  howToCancel: "계정 > 결제 관리에서 언제든 해지할 수 있어요. 체험 중에 해지하면 결제되지 않아요",
  termsLabel: "이용약관",
  termsHref: "#terms",
  privacyLabel: "개인정보 처리방침",
  privacyHref: "#privacy",
  ctaTrial: "{days}일 무료 체험 시작하기",
  ctaPay: "{amount} 결제하고 시작하기",
  decline: "나중에 할게요",
  pendingLabel: "결제 화면을 여는 중",
  // 청약철회 제한 고지(전자상거래법 제17조 — 예시 문구. 실제 문구는 서비스 성격에 맞춰 법률 검토를 거친다)
  // 2026-10-01 A71 법률 점검(현행 제17조②5·③·⑥, 시행령 제21조의2): 철회가 안 되는 범위는 「제공이 시작된 부분」이고, 제공 전 부분(가분적)과 광고·계약과 다르게 제공된 경우(③)는 철회할 수 있다
  // 시험 사용(체험·미리보기)은 실제로 제공하는 방법만 적는다 — 디지털콘텐츠는 제한 사실의 표시와 시험 사용 제공을 둘 다 해야 제한이 선다(⑥ 단서)
  withdrawal: {
    notice: "서비스·디지털콘텐츠는 이용을 시작한 부분에 대해서는 청약철회를 할 수 없어요. 다만 아직 제공되지 않은 부분이나 광고·계약과 다르게 제공된 경우에는 철회할 수 있어요(예시).",
    trial: "결제하기 전에 써 보고 정할 수 있도록 체험과 미리보기를 드려요(예시).",
    consentLabel: "이용을 시작한 부분은 청약철회를 할 수 없다는 안내를 확인했어요",
    consentRequired: "청약철회 제한 안내를 확인하고 체크해 주세요.",
  },
}

// 업그레이드 대화상자의 제안 문구(P3-6 E04): 전환 고지에 결제 수단을 밝히고, 체험 시작 버튼 글에 체험이 끝난 뒤 금액을 함께 적는다(전자상거래법 §13⑥).
// 다른 paywall 변형의 예시(OFFER_COPY)는 그대로 둔다.
const UPGRADE_OFFER_COPY: PlanOfferCopy = {
  ...OFFER_COPY,
  firstCharge: "체험이 끝나는 {date}에 {amount}({vat})이 처음 결제돼요. 결제는 결제 화면에서 입력한 결제 수단으로 이루어져요",
  ctaTrialThen: "{days}일 무료 체험 시작 · 이후 {amount}/{per}",
}

const COPY: PaywallUpgradeModalCopy = {
  title: "보고서 내보내기는 프로 요금제에서 써요",
  body: "만든 보고서를 PDF·엑셀로 내려받아 팀에 바로 공유할 수 있어요(예시).",
  open: "{plan} 요금제 살펴보기",
  dialog: { title: "{plan} 요금제로 올려요", description: "지금 요금제와 무엇이 다른지 먼저 확인해 보세요." },
  compare: {
    caption: "지금 요금제와 프로 요금제 비교",
    feature: "기능",
    current: "지금(베이직)",
    currentFree: "지금(무료 요금제)",
    target: "{plan}",
    rows: [
      { label: "프로젝트", current: "3개", target: "20개" },
      { label: "보고서 내보내기", current: "안 돼요", target: "PDF·엑셀" },
      { label: "지원", current: "메일", target: "우선 지원" },
    ],
  },
  offer: UPGRADE_OFFER_COPY,
  trialChoice: { label: "무료 체험으로 시작할래요", hint: "끄면 체험 없이 오늘 바로 결제돼요." },
  inApp: {
    title: "이 화면에서는 결제가 막힐 수 있어요",
    guide: "지금은 앱 안 브라우저로 열려 있어요. 오른쪽 위 ⋯ 메뉴에서 「다른 브라우저로 열기」를 눌러 주세요.",
    open: "기본 브라우저로 열기",
    copy: { copy: "주소 복사", copied: "주소를 복사했어요", manual: "복사가 막혔어요. 주소창의 주소를 직접 복사해 주세요" },
  },
  alert: { field: "확인이 필요해요", server: "결제 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "요금제를 불러오는 중이에요",
  error: "요금제를 불러오지 못했어요",
  retry: "다시 불러오기",
  done: { title: "체험을 시작했어요", body: "{plan} 기능을 지금부터 쓸 수 있어요(예시)." },
}

export const fixture: PaywallUpgradeModalProps = {
  copy: COPY,
  now: MOCK_NOW,
  trigger: "report-export",
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  checkout: async () => ({ ok: true, data: { redirectUrl: "#checkout" } }),
}

export const fixtureMax: PaywallUpgradeModalProps = {
  ...fixture,
  currentPlanId: null,
  copy: {
    ...COPY,
    title: "보고서 내보내기·정기 발송은 프로 요금제에서 써요 — 팀 공유가 한 번에 끝나요(예시)",
    body: "만든 보고서를 PDF·엑셀로 내려받거나, 매주 월요일 아침 팀 메일로 자동 발송할 수 있어요. 지금 요금제에서는 화면으로만 볼 수 있어요(예시).",
    compare: {
      ...COPY.compare,
      rows: [...COPY.compare.rows, { label: "정기 발송", current: "안 돼요", target: "매주·매달 자동 발송" }, { label: "보관 기간", current: "3개월", target: "무제한" }, { label: "보고서 내보내기 형식", current: "포함되지 않아요", target: "PDF와 스프레드시트 파일로 내보내요" }], // 마지막 줄: 칸 글이 줄바꿈 없이 길어 표 최소 폭이 390px 보다 넓다(REL11 — launch-factory LFADB 발견, 대화상자가 화면보다 넓어졌다)
    },
  },
}

export const fixtureMin: PaywallUpgradeModalProps = { ...fixture, copy: { ...COPY, dialog: { title: COPY.dialog.title }, compare: { ...COPY.compare, rows: [] } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<PaywallUpgradeModalProps> => {
  const billing = mockBilling(q, { requireWithdrawalConsent: true })
  return { plans: billing.plans, checkout: billing.checkout, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: PaywallUpgradeModalProps = {
  ...fixture,
  copy: {
    title: "Report export is on the Pro plan",
    body: "Download your reports as PDF or Excel and share them with your team right away (example).",
    open: "See the {plan} plan",
    dialog: {
      title: "Upgrade to {plan}",
      description: "See how it differs from your current plan first.",
    },
    compare: {
      caption: "Current plan compared with Pro",
      feature: "Feature",
      current: "Now (Basic)",
      currentFree: "Now (Free plan)",
      target: "{plan}",
      rows: [
        {
          label: "Projects",
          current: "3",
          target: "20",
        },
        {
          label: "Report export",
          current: "Not included",
          target: "PDF and Excel",
        },
        {
          label: "Support",
          current: "Email",
          target: "Priority support",
        },
      ],
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
      firstCharge: "Your first payment of {amount} ({vat}) is charged on {date}, when the trial ends, using the payment method you enter at checkout",
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
      ctaTrialThen: "Start {days}-day free trial · then {amount}/{per}",
    },
    trialChoice: {
      label: "Start with a free trial",
      hint: "If you turn this off, you're charged today with no trial.",
    },
    inApp: {
      title: "Checkout may not work in this view",
      guide: "You're in an in-app browser. Open the ⋯ menu at the top right and choose “Open in another browser”.",
      open: "Open in your default browser",
      copy: {
        copy: "Copy address",
        copied: "Address copied",
        manual: "Copying was blocked. Please copy the address from the address bar.",
      },
    },
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
    loading: "Loading plans",
    error: "We couldn't load plans",
    retry: "Reload",
    done: {
      title: "Your trial has started",
      body: "You can use {plan} features from now on (example).",
    },
  },
}
