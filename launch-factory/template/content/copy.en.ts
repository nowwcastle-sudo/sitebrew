// 영어 예시 문구 — 제품이 콘텐츠로 바꾼다
import type { AccountBillingManageCopy } from "@/components/blocks/account/billing-manage"
import type { AuthNewPasswordCopy } from "@/components/blocks/auth/new-password"
import type { AuthPasswordResetCopy } from "@/components/blocks/auth/password-reset"
import type { AuthSignInCopy } from "@/components/blocks/auth/sign-in"
import type { AuthSignUpConsentsCopy } from "@/components/blocks/auth/sign-up-consents"
import type { ConsentBottomBannerCopy } from "@/components/blocks/consent/bottom-banner"
import type { PaywallUpgradeModalCopy } from "@/components/blocks/paywall/upgrade-modal"
import type { RetentionCancelFlowCopy } from "@/components/blocks/retention/cancel-flow"
import type { PricingThreeTierCardsCopy } from "@/components/blocks/pricing/three-tier-cards"
import type { SubmitNotices } from "@/components/blocks/_shared/submit-guard"
import type { PlanOfferCopy } from "@/components/blocks/_shared/plan-offer"

export const PRODUCT_NAME = "Example App"
/** 이 문구 판의 언어. 가입할 때 사용자 언어(user.locale)로 함께 보내 확인 메일 같은 서버 문구가 화면 언어와 같게 한다(LFFIX F6) */
export const COPY_LOCALE = "en"

// Shared by every form and billing action ({seconds} is filled with the remaining seconds).
/** 사람이 마지막에 확인하고 누르는 컨트롤 곁의 한 줄(web-factory APPROVAL_HINT en 권장값 — R18, 60자 이하). 모든 승인 행동 블록의 copy.humanHint 가 이 글이다 */
export const HUMAN_HINT = "You'll confirm this yourself"

export const submitNotices: SubmitNotices = {
  rateLimited: "You can try again in {seconds}s",
  timeout: {
    title: "This is taking longer than expected",
    body: "The server has not answered yet. What you entered is still here, so please try again.",
    retry: "Try again",
  },
  unsupported: { title: "This can't be changed here", link: "Go to where you manage it" },
  // 승인 대기(code confirmation_required): 실패가 아니라 「사람이 이어서 할 일」 — 무엇을 하려 했나 → 어디까지 → 왜 → 다음 행동 하나 → 사람에게 넘기는 길(web-factory R21 권장 문구)
  approval: {
    title: "Please confirm this yourself",
    attempted: "We received your change request.",
    progress: "Nothing has changed yet.",
    reason: "This change needs a person to review it and press the button.",
    next: "Press the confirm button on the screen yourself.",
    route: { label: "Contact support", href: "/contact" },
  },
}

const inApp = {
  title: "Sign-in and payment may not work in this view",
  guide: "This page is open in an in-app browser. Open the menu (top right) and choose \"Open in browser\".",
  open: "Open in default browser",
  copy: { copy: "Copy link", copied: "Link copied", manual: "Copying is blocked. Please copy the link from the address bar." },
}

const emailErrors = {
  emailRequired: "Enter your email address.",
  emailFormat: "That email address doesn't look right. Example: name@example.com",
  passwordRequired: "Enter your password.",
}

export const signInCopy: AuthSignInCopy = {
  title: `Sign in to ${PRODUCT_NAME}`,
  lead: "Use the method you signed up with to pick up where you left off.",
  inApp,
  social: { kakao: "Continue with Kakao", naver: "Continue with Naver", google: "Continue with Google" },
  divider: "or sign in with email",
  email: { label: "Email", marker: "(required)", placeholder: "name@example.com" },
  password: { label: "Password", marker: "(required)", show: "Show password", capsLock: "Caps Lock is on" },
  errors: emailErrors,
  forgot: { label: "Forgot your password?", href: "/forgot-password" },
  submit: "Sign in",
  pending: "Signing in",
  alert: { field: "Some fields need your attention", server: "We couldn't sign you in. What you entered is still here." },
  notices: submitNotices,
  methods: {
    loading: "Loading sign-in options",
    error: "We couldn't load the quick sign-in buttons. You can still sign in with email.",
    retry: "Reload",
  },
  signUp: { text: "New here?", label: "Create an account", href: "/sign-up" },
  // B01: 이 글은 사실만 말한다 — 이 화면은 저절로 옮겨 가지 않는다(돌아갈 곳 `?next=` 이 있을 때만 조립하는 쪽이 이동시키고, 그때는 이 글을 거의 못 본다)
  done: { title: "You're signed in", body: "Your account is ready. Pick up where you left off.", label: "Go to your account", href: "/account/billing" },
  twoFactor: { title: "A verification code is required", body: "Enter the 6-digit code from your authenticator app to finish signing in.", label: "Enter your code", href: "/sign-in" },
  emailSent: { title: "We sent you a sign-in link", body: "Open the link in your inbox to sign in. It works for 10 minutes." },
  rememberMe: { label: "Keep me signed in" },
  lastUsed: { badge: "Last used", password: "You signed in with email last time" },
}

export const signUpCopy: AuthSignUpConsentsCopy = {
  humanHint: HUMAN_HINT,
  title: `Create your ${PRODUCT_NAME} account`,
  // C08: 메일과 비밀번호를 모두 잃은 계정은 사람이 되찾아 주지 않는다(대표 위임 결정 2026-10-08) — 가입 때 한 줄로 알린다
  lead: "An email and a password are all you need to start. You can add your name later. If you lose access to this email, we can’t recover the account.",
  steps: ["Account", "Agreements", "Done"],
  inApp,
  social: { kakao: "Sign up with Kakao", naver: "Sign up with Naver", google: "Sign up with Google" },
  divider: "or sign up with email",
  email: { label: "Email", marker: "(required)", placeholder: "name@example.com" },
  password: { label: "Password", marker: "(required)", hint: "Use at least 8 characters.", show: "Show password", capsLock: "Caps Lock is on" },
  errors: {
    ...emailErrors,
    passwordShort: "That password is too short. Use at least 8 characters.",
    passwordWeak: "That password is too easy to guess. Choose one that isn’t common.",
    termsRequired: "You need to accept the Terms of Service to sign up.",
    privacyRequired: "You need to accept the Privacy Policy to sign up.",
  },
  next: "Next: review agreements",
  back: "Back",
  consentsTitle: "Review and accept the agreements",
  // K09: 필수 동의를 이름 있는 묶음으로 — 선택 묶음(marketing.legend)과 구조가 갈린다. 필수 칸은 미리 켜 두지 않는다
  required: { legend: "Needed to create your account" },
  viaSocial: "You're signing up with {provider}. Please accept the agreements.",
  providers: { kakao: "Kakao", naver: "Naver", google: "Google" },
  terms: { label: "I accept the Terms of Service", marker: "(required)", href: "/terms", view: "View terms" },
  privacy: { label: "I accept the Privacy Policy", marker: "(required)", href: "/privacy", view: "View policy" },
  ageOver14: {
    label: "I am 14 years old or older",
    marker: "(required)",
    help: "People under 14 can't create an account here.",
    required: "Confirm that you are 14 or older.",
  },
  marketing: {
    legend: "Get product news and offers",
    marker: "(optional)",
    hint: "You can sign up without this, and turn it off any time in settings.",
    // A05: 이 제품이 실제로 보내는 채널만 묻는다. 지금은 이메일뿐이다(문자·카카오톡·앱 알림은 보내는 기능이 없다 — 켜게 되면 여기 문구를 더하고 동의를 새로 받는다)
    channels: { email: "Email" },
  },
  submit: "Sign up",
  pending: "Creating your account",
  alert: { field: "Some fields need your attention", server: "We couldn't create your account. What you entered is still here." },
  notices: submitNotices,
  methods: {
    loading: "Loading sign-up options",
    error: "We couldn't load the quick sign-up buttons. You can still sign up with email.",
    retry: "Reload",
  },
  done: { title: "You're all set", body: "Your account is ready. Pick a plan to get started.", label: "See plans", href: "/pricing" },
  emailSent: { title: "Check your email", body: "Open the link in the email we sent to finish signing up." },
  signIn: { text: "Already have an account?", label: "Sign in", href: "/sign-in" },
  // A04: 약관·정책 링크는 새 탭에서 열어 가입 단계·입력값이 남는다 — 링크 이름에 그 사실을 붙인다
  newTab: "Opens in a new tab",
  // A02: 이미 있는 이메일(어댑터가 code "email_exists" 로 거절)이면 막다른 오류 대신 갈 곳 둘
  exists: {
    title: "That email already has an account",
    body: "Sign in instead. If you don't remember your password, you can reset it.",
    signIn: { label: "Sign in", href: "/sign-in" },
    reset: { label: "Reset your password", href: "/forgot-password" },
  },
}

export const pricingCopy: PricingThreeTierCardsCopy = {
  title: "Pricing",
  lead: "Start with what you need and change plans any time.",
  plans: [
    { name: "Starter", monthlyPrice: 9, currency: "USD", features: ["1 project", "1 team member", "CSV import and export"] },
    { name: "Pro", monthlyPrice: 29, currency: "USD", features: ["20 projects", "5 team members", "PDF and spreadsheet reports", "Priority support"] },
    { name: "Team", monthlyPrice: 79, currency: "USD", features: ["Unlimited projects", "25 team members", "Roles and permissions", "Dedicated onboarding"] },
  ],
  recommended: "Pro",
  recommendedLabel: "Recommended",
  perMonth: "/mo",
  contactLabel: "Contact us",
  planCtas: [
    { label: "Get Starter", href: "/sign-up" },
    { label: "Get Pro", href: "/sign-up" },
    { label: "Get Team", href: "/sign-up" },
  ],
  cta: { label: "Get started", href: "/sign-up" },
  // E01: 로그인한 사람이 지금 쓰는 요금제 카드는 눌러서 갈 곳이 없다 — 표지 글
  currentLabel: "Your current plan",
  // E07: 통화는 USD 하나(운영자 결정 2026-10-07) — 카드사가 현지 통화로 바꿀 수 있다는 말을 가격 곁에 둔다. 다중 통화는 하지 않는다
  footnote: "Prices are in USD per month. Your card issuer may convert them to your local currency. Cancel any time from your account.",
  vat: { included: "Tax included", excluded: "Excluding tax" },
}

const offerCopy: PlanOfferCopy = {
  humanHint: HUMAN_HINT,
  perMonth: "month",
  perYear: "year",
  vatIncluded: "tax included",
  vatExcluded: "excluding tax",
  equivalentMonth: "About {amount} per day",
  equivalentYear: "About {amount} per month",
  trial: "Your first {days} days are free",
  // E04: 첫 결제일·금액에 결제 수단까지 — 전환 고지(전자상거래법 §13⑥)가 한 문장에 모인다
  // E07: 동의 줄(체크 칸 바로 곁)에 청구 통화와 카드사 환전 가능성을 함께 적는다 — 제품이 USD 가 아닌 통화로 팔면 이 두 줄과 요금표·업그레이드 안내의 「USD」를 함께 바꾼다
  firstCharge: "You'll first be charged {amount} ({vat}) on {date}, when the trial ends, using the payment method you add at checkout. Charges are in USD; your card issuer may convert them to your local currency",
  chargeNow: "You'll be charged {amount} ({vat}) today. Charges are in USD; your card issuer may convert them to your local currency",
  autoRenewMonth: "After that it renews and is charged automatically every month on the same day",
  autoRenewYear: "After that it renews and is charged automatically every year on the same day",
  howToCancel: "Cancel any time under Account > Billing. If you cancel during a trial, you won't be charged",
  termsLabel: "Terms of Service",
  termsHref: "/terms",
  privacyLabel: "Privacy Policy",
  privacyHref: "/privacy",
  ctaTrial: "Start your {days}-day free trial",
  // E04: 체험을 시작하는 단추를 누르는 것이 전환 동의라, 단추 글에도 체험 뒤 금액이 보인다
  ctaTrialThen: "Start your {days}-day free trial, then {amount}/{per}",
  ctaPay: "Pay {amount} and start",
  decline: "Maybe later",
  pendingLabel: "Opening checkout",
  withdrawal: {
    notice: "Your right of withdrawal ends once delivery of the digital content starts.",
    trial: "Where a plan offers a trial, you can try it before that point.",
    consentLabel: "I understand that my right of withdrawal ends once delivery of the digital content starts",
    consentRequired: "Tick the box to confirm you've read the withdrawal notice.",
  },
}

export const upgradeCopy: PaywallUpgradeModalCopy = {
  title: "Report export is part of the Pro plan",
  body: "Download your reports as PDF or spreadsheet and share them with your team.",
  open: "See the {plan} plan",
  dialog: { title: "Upgrade to {plan}", description: "Compare it with your current plan first. Prices are in USD, and your card issuer may convert them to your local currency." },
  compare: {
    caption: "Your current plan compared with Pro",
    feature: "Feature",
    current: "Current (Starter)",
    // E04: 무료로 쓰는 사람의 표 머리 — 「Current (Starter)」처럼 유료 요금제 이름으로 부르지 않는다
    currentFree: "Free plan",
    target: "{plan}",
    rows: [
      { label: "Projects", current: "1", target: "20" },
      // 보통 길이의 글로 되돌렸다(v0.0.11 — 넘치는 표는 대화상자가 아니라 표만 가로로 민다. LFADB 때는 이 칸을 「Reports | No | PDF, Excel」로 줄여 피했다)
      { label: "Report export", current: "Not included", target: "PDF and spreadsheet" },
      { label: "Support", current: "Email", target: "Priority" },
    ],
  },
  inApp: { ...inApp, title: "Payment may be blocked in this view" },
  offer: offerCopy,
  trialChoice: { label: "Start with a free trial", hint: "Turn this off to pay today with no trial." },
  alert: { field: "Something needs your attention", server: "We couldn't open checkout. Please try again in a moment." },
  notices: submitNotices,
  loading: "Loading plans",
  error: "We couldn't load the plans",
  retry: "Reload",
  done: { title: "Your trial has started", body: "You can use {plan} features right now." },
}

export const billingCopy: AccountBillingManageCopy = {
  humanHint: HUMAN_HINT,
  title: "Billing",
  lead: "Change your plan, see your next payment date and manage your payment method here.",
  // F02: 결제가 실패한 구독의 날짜 칸은 「Next payment」가 아니라 다시 결제를 시도하는 날이다
  labels: { plan: "Current plan", nextDate: "Next payment", amount: "Amount", method: "Payment method", retry: "Next attempt" },
  status: {
    none: "No subscription",
    trialing: "Free trial",
    active: "Active",
    past_due: "Payment failed",
    paused: "Paused",
    canceled: "Cancellation scheduled",
    expired: "Ended",
  },
  notes: {
    // F01: 사실만 — 체험 종료 안내 메일은 판매 대행자(Paddle)가 법이 요구하는 지역에만 보낸다(체험 7일 초과일 때, 한국은 목록에 없음). 약속하지 않는다 — 날짜는 이 화면이 항상 보여 준다(K01 법률 검토 M1, 2026-10-04)
    trialing: "Your free trial runs until {date}. Our payment provider may email you a reminder before it ends.",
    pastDue: "Your last payment didn't go through. We'll try again on {date}. You can keep using everything until {until}.",
    paused: "Your subscription is paused until {date}. You won't be charged while it's paused.",
    cancelAt: "Cancellation is scheduled. You can use the plan until {date}, and you won't be charged after that.",
    expired: "Your plan has ended. Choose a plan to use it again.",
    scheduled: "Your plan changes to {plan} on {date}.",
  },
  // E02: 결제 관리에서 결제 화면으로 바로 간다(요금표를 거치지 않는다)
  none: { title: "You don't have a paid plan", body: "You're on the free tier. Choose a plan to unlock more projects.", label: "Choose a plan", href: "/upgrade" },
  // F03: 해지·만료 뒤 한 번에 결제 화면으로 — 고지·동의는 그 화면이 받는다
  restart: {
    title: "Start again",
    body: "Your plan has ended. One click opens checkout, and you'll see the first charge date and amount before you pay.",
    label: "Restart {plan}",
    href: "/upgrade?plan={plan}",
    choose: "Start {plan}",
  },
  per: { perMonth: "month", perYear: "year", once: "once" },
  vatIncluded: "tax included",
  vatExcluded: "excluding tax",
  updateMethod: { label: "Update payment method", pending: "Opening", body: "Your saved card is charged every month. The payment method page opens in our payment provider's window." },
  cancel: { label: "Cancel subscription", href: "/account/cancel", note: "If you cancel, you can still use the plan until {date}." },
  change: {
    title: "Change plan",
    caption: "Plans with monthly price and included features",
    cols: { plan: "Plan", price: "Price", billing: "Billing", features: "Included", action: "Change" },
    current: "Current plan",
    scheduled: "Scheduled",
    choose: "Switch to {plan}",
    question: "Switch to the {plan} plan?",
    body: "From your payment on {date} you'll be charged {amount} ({vat}) and move to {plan}. Until then you keep your current plan.",
    cancel: "Cancel",
    confirm: "Switch to {plan}",
    pending: "Switching",
    done: "Plan changed",
  },
  alert: { field: "Something needs your attention", server: "We couldn't complete that. Please try again in a moment." },
  revive: {
    cancelScheduled: { label: "Keep my plan", pending: "Restoring", done: "Cancellation undone. You keep your plan and the next payment goes ahead as usual." },
    paused: { label: "Resume now", pending: "Resuming", done: "Your plan is active again. Everything is available from today." },
    errorTitle: "We couldn't restore it. Please try again in a moment.",
  },
  invoices: {
    label: "View invoices and receipts",
    pending: "Opening",
    hint: "Opens in a new window with our payment provider. Your card details are not stored here.",
    errorTitle: "We couldn't open the invoices page. Please try again in a moment.",
  },
  notices: submitNotices,
  loading: "Loading your subscription",
  error: "We couldn't load your subscription",
  retry: "Reload",
}

export const consentCopy: ConsentBottomBannerCopy = {
  title: "Can we collect usage data?",
  body: "Knowing which pages people use helps us improve the site. You can decline and still use everything.",
  policy: { label: "Privacy Policy", href: "/privacy" },
  settings: { label: "Choose by category", href: "/privacy" },
  decline: "Reject all",
  accept: "Accept all",
  saved: "Your cookie settings are saved.",
}

export const passwordResetCopy: AuthPasswordResetCopy = {
  title: "Reset your password",
  lead: "Enter the email you signed up with and we'll send you a reset link.",
  steps: [
    { title: "Get the email", body: "Enter your email below and we'll send the link." },
    { title: "Open the link", body: "The link works once and only for a limited time." },
    { title: "Choose a new password", body: "After you set it, you're signed out of your other devices." },
  ],
  email: { label: "Email", marker: "(required)", placeholder: "name@example.com" },
  errors: { emailRequired: emailErrors.emailRequired, emailFormat: emailErrors.emailFormat },
  submit: "Send the reset link",
  pending: "Sending",
  alert: { field: "Check your email address", server: "We couldn't send the link. Please try again in a moment." },
  notices: submitNotices,
  sent: { title: "Check your inbox", body: "If that email has an account, a reset link is on its way. Check your spam folder too." },
  resend: "Didn't get it? Send again",
  resent: "We sent the link once more. The earlier link no longer works.",
  back: { label: "Back to sign in", href: "/sign-in" },
}

/** 해지 흐름(단계 3 ≤ 가입 3). 약관에 중도해지가 없으면 일반 해지(기간 끝)만 보인다 — 제품이 약관을 바꾸면 terms.midTerm 도 함께 */
export const cancelFlowCopy: RetentionCancelFlowCopy = {
  humanHint: HUMAN_HINT,
  title: "Cancel your subscription",
  lead: "Cancelling takes just a couple of short steps.",
  steps: ["How to cancel", "Another option", "Done"],
  reason: {
    legend: "Why are you cancelling?",
    marker: "(optional)",
    hint: "You can cancel without choosing.",
    options: { too_expensive: "It costs too much", not_using: "I don't use it enough", missing_feature: "It's missing a feature I need", switching: "I'm switching to another service", temporary: "I just need a break", other: "Something else" },
  },
  when: {
    legend: "When should it end?",
    periodEnd: { label: "At the end of this billing period", body: "You can use the plan until {date}, and you won't be charged after that." },
    now: { label: "Right now", body: "It ends today. Any refund follows the Terms of Service." },
    only: "You can use the plan until {date}, and you won't be charged after that.",
  },
  next: "Continue cancelling",
  keep: "Keep my plan",
  offer: {
    title: "You could also do this instead",
    pause: { title: "Take a {months}-month break", body: "You won't be charged during the {months}-month break. It restarts automatically afterwards and everything you made stays.", accept: "Take a {months}-month break" },
    downgrade: { title: "Switch to {plan}", body: "From your next payment you'll pay {amount} ({vat}).", accept: "Switch to {plan}" },
    discount: { title: "{percent}% off for {months} months", body: "For {months} months you'll pay {after} ({vat}) instead of {before} each month.", accept: "Take the discount and stay" },
  },
  confirm: { title: "Cancel your subscription?", body: "You can use the plan until {date}, and you won't be charged after that.", keep: "Keep my plan" },
  cancel: "Cancel subscription",
  pending: "Working on it",
  done: {
    title: "Your subscription is cancelled",
    periodEnd: "You can use the plan until {date}. You won't be charged after that.",
    now: "Your subscription ended on {date}. Any refund follows the Terms of Service.",
    again: "If you change your mind, you can restart any time from Billing.",
    // F13: 더 청구되지 않는다는 한 줄과, 다른 경로로 결제했을 때의 해지 안내
    noMoreCharges: "You won't be charged again.",
    otherChannels: {
      title: "If you paid somewhere else",
      body: "If you paid through an app store, a mobile carrier or another payment service, cancel there too. Deleting the app doesn't cancel a subscription.",
    },
    back: { label: "Back to Billing", href: "/account/billing" },
  },
  // F05: 이미 해지가 예약된 구독은 흐름 대신 상태와 [계속 쓰기] 하나
  scheduled: {
    title: "Your cancellation is already scheduled",
    body: "You can use the plan until {date}, and you won't be charged after that. Changed your mind? You can keep your plan.",
    keep: "Keep my plan",
    pending: "Restoring",
    done: "Cancellation undone. You keep your plan and the next payment goes ahead as usual.",
  },
  offerDone: { title: "Your subscription continues", pause: "Your plan is paused until {date}. You won't be charged meanwhile.", downgrade: "From your next payment date you'll be on {plan}.", discount: "Your next payments use the discounted price." },
  vatIncluded: "tax included",
  vatExcluded: "excluding tax",
  none: { title: "There's nothing to cancel", body: "You're on the free tier, so there's no plan to cancel." },
  alert: { field: "Something needs your attention", server: "We couldn't complete that. Please try again in a moment." },
  notices: submitNotices,
  loading: "Loading your subscription",
  error: "We couldn't load your subscription",
  retry: "Reload",
}

/** 결제 창을 마치고 돌아온 화면(/billing/return) */
export const billingReturnCopy = {
  title: "Confirming your payment",
  lead: "This usually takes a few seconds.",
  waiting: "Checking your subscription",
  // E09: 결제가 끝난 화면(done·slow)에서 영수증이 가는 곳을 알린다. 주소는 공급자 고객 기록에서 읽은 값이다(결제 창에서 바꿔 적을 수 있어 계정 이메일과 다를 수 있다) — 못 읽으면 주소를 지어내지 않는 말(unknown)
  receipt: { toEmail: "Your receipt is emailed to {email}.", unknown: "Your receipt is emailed to the address you entered at checkout." },
  done: { title: "You're all set", body: "Your plan is active. Thanks for subscribing.", label: "Go to Billing", href: "/account/billing" },
  slow: { title: "We got your payment", body: "Your plan can take a minute to show up. You can check Billing now or come back shortly.", label: "Go to Billing", href: "/account/billing" },
  missing: { title: "This page needs a payment to check", body: "Open it from the checkout, or look at Billing for your current plan.", label: "Go to Billing", href: "/account/billing" },
  error: { title: "We couldn't check your payment", body: "Your payment is not affected. Look at Billing in a moment.", label: "Go to Billing", href: "/account/billing" },
}

/**
 * 재설정 마무리 화면(/reset-password) — 메일 링크로 들어와 새 비밀번호를 정한다. web-factory `auth/new-password` 블록의 한 칸 판(`confirmField: false`, 운영자 결정 2026-10-03):
 * 「한 번 더」 칸이 없고 「비밀번호 보기」가 확인 수단이다(그래서 `newPassword.show` 가 꼭 있어야 한다 — 타입이 요구한다). 주석 없이 `satisfies` 로 두어야 `show` 가 선택이 아닌 string 으로 남는다.
 */
export const resetPasswordCopy = {
  humanHint: HUMAN_HINT,
  title: "Choose a new password",
  lead: "Pick a password you don't use anywhere else. After you save it, your other devices are signed out.",
  newPassword: { label: "New password", marker: "(required)", hint: "Use at least 8 characters.", show: "Show password", capsLock: "Caps Lock is on" },
  errors: { required: "Enter a new password.", short: "That password is too short. Use at least 8 characters.", weak: "That password is too easy to guess. Choose one that isn’t common." },
  submit: "Save new password",
  pending: "Saving",
  alert: { field: "Check your new password", server: "We couldn't save it. Please try again in a moment." },
  notices: submitNotices,
  // C07: 서버가 재설정 때 모든 기기의 로그인을 끊는다(revokeSessionsOnPasswordReset) — 도용이 걱정돼 재설정한 사람이 그걸 여기서 확인한다
  done: { title: "Your password is updated", body: "We signed you out of every device, including this one. Sign in again with your new password.", next: { label: "Go to sign in", href: "/sign-in" } },
  invalid: { title: "This link doesn't work", body: "It may have expired or been used already. Ask for a new reset link.", retry: { label: "Send me a new link", href: "/forgot-password" } },
} satisfies AuthNewPasswordCopy

/**
 * 가입·로그인에 성공해 도착한 화면의 한 번짜리 안내(UXOK — components/product/welcome-notice.tsx). 주소의 `?welcome=` 표지가 어느 것을 보일지 정한다.
 * signup = 소셜(구글 등) 가입이 끝나 돌아옴 · signin = 소셜 로그인이 끝나 돌아옴 · verified = 확인 메일의 링크를 누름. 가입 화면의 완료 글(signUpCopy.done)을 그대로 쓴다.
 */
export const welcomeCopy = {
  signup: { ...signUpCopy.done, label: signUpCopy.done.label ?? "See plans", href: signUpCopy.done.href ?? "/pricing" },
  signin: { title: "You're signed in", body: "Welcome back.", label: "Go to your account", href: "/account/billing" },
  verified: { title: "You're all set", body: "Your email address is confirmed and your account is ready. Pick a plan to get started.", label: "See plans", href: "/pricing" },
  // A08: 확인 링크를 로그인 안 된 기기·브라우저에서 열었을 때 — 다음 행동은 로그인이고, 로그인하면 계정으로 돌아온다(`?next=`)
  verifiedSignedOut: { title: "You're all set", body: "Your email address is confirmed. Sign in to open your account.", label: "Sign in", href: "/sign-in?next=%2Faccount%2Fbilling" },
  // B03: 로그아웃을 마친 도착 화면 — 됐다는 사실과, 다시 들어올 길 하나
  signedout: { title: "You're signed out", body: "You've been signed out on this device.", label: "Sign in again", href: "/sign-in" },
  // 확인 링크가 틀리거나 만료됐을 때(Better Auth 가 같은 주소에 error= 를 붙인다) — 성공처럼 보이지 않게 따로 말한다. 어느 문구인지는 lib/welcome.ts 의 welcomeView 가 정한다(A10·A09):
  //   로그인했고 확인 안 됨 → expired(만료)·failed(그 밖)와 「새 확인 메일 받기」 단추 · 이미 확인됨 → alreadyVerified · 로그아웃 → failedSignedOut(로그인이 먼저)
  expired: { title: "That confirmation link has expired", body: "Confirmation links work for 1 hour. Send yourself a new one — it takes a minute.", label: "See where we sent it", href: "/verify-email" },
  failed: { title: "That confirmation link didn't work", body: "The link may be cut off, or a newer one replaced it. Send yourself a new one.", label: "See where we sent it", href: "/verify-email" },
  failedSignedOut: { title: "That confirmation link didn't work", body: "It may have expired or been used already. Your account still works. Sign in and we'll help you get a new link.", label: "Sign in", href: "/sign-in?next=%2Fverify-email" },
  alreadyVerified: { title: "Your email address is already confirmed", body: "This link was used before, so there is nothing more to do. Your account is ready.", label: "Go to your account", href: "/account/billing" },
}

/** 이메일 가입 직후, 가입 화면 완료 글 아래의 확인 메일 안내(UXOK — components/product/verify-email-note.tsx). {email} 은 방금 적은 주소 */
export const verifyEmailCopy = {
  title: "We sent a confirmation email",
  body: "Open the link in the email we sent to {email} to confirm your address.",
  resend: "Send it again",
  pending: "Sending",
  sent: "Sent again. Check your inbox and spam folder.",
  failed: "We couldn't send it just now. Please try again in a minute.",
  // A14: 주소를 잘못 쳤다면 고치는 길. 확인 안 된 주소는 현재 비밀번호만 있으면 새 주소 확인만 거쳐 바뀐다(D71)
  wrongAddress: { text: "Wrong address?", label: "Fix it", href: "/account#credentials-email-form" },
  // A18: 국내 포털 메일(lib/verify-email.ts 의 isKoreanPortalMail)은 새 보낸이를 스팸함에 넣거나 늦게 배달하는 일이 잦다
  koreanPortal: "Naver, Daum, Kakao and Nate mail can be slow, and they often put new senders in the spam folder. Check spam first and give it a few minutes.",
}

/**
 * 메일 속 서명 링크가 닿는 화면(/email — app/(product)/email/page.tsx). 로그인 없이 열린다(수신거부는 로그인을 요구하면 안 된다).
 * confirm: 되돌릴 수 없거나 사람의 뜻이 필요한 일(계속 받기 · 가입하지 않은 계정 지우기)은 메일 보안 프로그램이 링크를 미리 열어도 실행되지 않게 확인 단추(POST)를 거친다.
 * result: 처리 결과. 수신거부는 링크를 여는 즉시 처리되고(메일의 수신거부 단추 = 바로 철회), 이미 처리돼 있어도 같은 글이다.
 */
export const emailChoiceCopy = {
  confirm: {
    keep: {
      title: "Keep getting marketing emails?",
      body: `You agreed to receive marketing emails from ${PRODUCT_NAME}. Confirm to keep them coming for another two years. You can unsubscribe from any of them.`,
      button: "Yes, keep them",
    },
    "not-me": {
      title: "Delete the account made with your email?",
      body: `Someone signed up for ${PRODUCT_NAME} with your email address. If that wasn't you, delete the account. This can't be undone.`,
      button: "Delete that account",
    },
  },
  result: {
    unsubscribed: {
      title: "You're unsubscribed",
      body: "We won't send you marketing emails anymore. You'll get a short confirmation email. Receipts and security notices will still reach you.",
    },
    kept: { title: "Thanks for confirming", body: "We'll keep sending you marketing emails. You can unsubscribe from any of them." },
    withdrawn: { title: "You had already unsubscribed", body: "Nothing changed. We won't send you marketing emails." },
    removed: { title: "The account was deleted", body: "We deleted the account that was created with your email address." },
    left: { title: "We left that account as it is", body: "It was already confirmed, so we didn't delete it." },
    invalid: { title: "This link doesn't work", body: "It may have been cut off, or it's out of date. Use the link in the latest email we sent you." },
  },
  home: "Go to the home page",
}

/**
 * 가입 폼의 봇 확인 상태 글(A07 — components/product/turnstile-status.tsx). 확인은 눈에 안 띄게 끝나고(interaction-only), 끝나기 전에는 제출이 서버로 나가지 않는다.
 * 보이는 확인 단계가 없으므로 「확인을 마쳐 달라」고 쓰지 않는다 — 기다리거나 다시 시도하라고 말한다.
 */
export const botCheckCopy = {
  checking: "Checking that you're human…",
  waiting: "Still checking that you're human. We'll send this as soon as that's done.",
  failed: "We couldn't run the human check. Reload the page and try again.",
  notReady: "We couldn't confirm you're human yet. Wait a moment, then try again.",
}

/**
 * 로그인이 필요한 쪽(/account/*·/upgrade·/billing/return)에 로그아웃·만료 상태로 왔을 때(B04 — components/product/sign-in-required.tsx).
 * 읽기 오류나 「Reload」로 보이지 않게, 로그인 링크와 돌아올 곳(`?next=`)을 준다. payment = 결제 직후 세션이 끊긴 사람이 「결제가 실패했나」로 오해하지 않게.
 */
export const signInRequiredCopy = {
  default: { title: "Sign in to continue", body: "This page is for signed-in accounts. After you sign in, we'll bring you back here.", label: "Sign in", alt: { text: "New here?", label: "Create an account", href: "/sign-up" } },
  payment: { title: "Sign in to see your payment", body: "You're signed out, so we can't show the payment yet. Your payment is not affected. Sign in to the account you paid with to see its status.", label: "Sign in", alt: { text: "New here?", label: "Create an account", href: "/sign-up" } },
}

/** 로그인한 채 /sign-in·/sign-up·/forgot-password 를 열었을 때(B02 — components/product/already-signed-in.tsx). {email} 은 지금 로그인한 주소 */
export const alreadySignedInCopy = {
  title: "You're already signed in",
  body: "You're signed in as {email}, so there's nothing to fill in here.",
  bodyNoEmail: "You're signed in, so there's nothing to fill in here.",
  label: "Go to your account",
  href: "/account/billing",
}
