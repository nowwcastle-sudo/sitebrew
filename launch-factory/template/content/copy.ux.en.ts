// 영어 예시 문구 2부 — 문의 화면·가격 변경 동의·오류 화면·머리말(metadata). 제품이 콘텐츠로 바꾼다.
// copy.en.ts 와 나눈 까닭: 그쪽은 가입·결제 블록 문구 한 벌이고, 이 파일은 블록 밖 제품 화면의 글이다. 제품 이름은 같은 한 곳(PRODUCT_NAME)에서 온다.
import type { ConfirmationVerifyEmailCopy } from "@/components/blocks/confirmation/verify-email"
import type { RetentionPaymentFailedBannerCopy } from "@/components/blocks/retention/payment-failed-banner"
import type { RetentionRenewalConsentCopy } from "@/components/blocks/retention/renewal-consent"
import { HUMAN_HINT, PRODUCT_NAME, submitNotices } from "@/content/copy.en"

/** 가격 변경 동의(F04) — /account/billing/price-change · /account/billing/cancel 이 같은 블록을 보인다 */
export const renewalConsentCopy: RetentionRenewalConsentCopy = {
  humanHint: HUMAN_HINT,
  title: { price_increase: "Your price is changing", trial_to_paid: "Your free trial is ending" },
  lead: {
    price_increase: "The price of your plan changes on {date}. Review it here and choose what you want to do.",
    trial_to_paid: "Your free trial ends on {date}. To keep your plan, accept the price below.",
  },
  caption: "Your price now and after the change",
  cols: { item: "What changes", before: "Now", after: "After the change" },
  rows: { price: "Price", billing: "Billed", from: "Takes effect" },
  consentBy: "Please answer by {date}.",
  ifNot: "If you don't answer, you won't be charged the new price. Your plan stops on {date} instead. No answer is not consent.",
  accept: "Accept the new price",
  cancel: "Decline and cancel",
  pending: "Working on it",
  later: "Decide later",
  accepted: "Thank you. Your new price of {amount} starts on {date}.",
  canceled: "Your subscription is set to end on {date}. You won't be charged again.",
  // F04(전자상거래법 §13⑥): 결제 방법과 해지 방법을 단추 위에서 말한다 — 동의하면 무엇이 어떻게 청구되고 어떻게 그만두는지
  paymentMethod: "The new price is charged automatically to the payment method already on your account.",
  howToCancel: "To stop, choose Decline and cancel here, or cancel any time under Account > Billing. You keep your plan until the end of the period you paid for.",
  // 메일 링크가 곧장 닿는 쪽(standalone): 읽는 중·읽기 실패·동의할 것이 없을 때의 안내
  empty: { title: "There's no price change waiting for your answer", body: "You may have already answered, or the change was withdrawn. You can check your plan in Billing.", label: "Go to Billing", href: "/account/billing" },
  loading: "Loading your plan",
  error: "We couldn't load your plan. Your plan is not affected.",
  retry: "Reload",
  vatIncluded: "tax included",
  vatExcluded: "excluding tax",
  per: "per month",
  alert: { field: "Something needs your attention", server: "We couldn't record your answer. Please try again in a moment." },
  notices: submitNotices,
}

/**
 * 결제 실패 띠(F02) — 결제 관리·결제 화면 위에 놓는다. role="alert"(비차단): 언제 다시 결제하는지·접근이 언제 멈추는지·카드 변경 단추 하나.
 * 우리가 보내는 결제 실패 메일(F11, `LF_PAYMENT_FAILED_EMAIL`)과 같은 사실을 말한다 — 메일을 못 본 사람도 화면에서 같은 안내를 받는다.
 */
export const paymentFailedCopy: RetentionPaymentFailedBannerCopy = {
  humanHint: HUMAN_HINT,
  title: "Your last payment didn't go through",
  reasons: {
    card_declined: "Your card was declined.",
    expired_card: "The card on file has expired.",
    insufficient_funds: "The card has insufficient funds or its limit was reached.",
    unknown: "Something went wrong while charging your payment method.",
  },
  retry: "We'll try again on {date}.",
  access: "You can keep using everything until then.",
  accessUntil: "You can keep using everything until {date}.",
  recovered: "Your payment went through. Everything is back to normal.",
  action: "Update payment method",
  pending: "Opening",
  alert: { field: "Something needs your attention", server: "We couldn't open the payment method page. Please try again in a moment." },
  notices: submitNotices,
}

/** 블록만 놓인 쪽의 h1(J04) — 쪽 제목(metadata.title)과 같은 말이다 */
export const pageTitles = {
  signIn: "Sign in",
  signUp: "Create an account",
  forgotPassword: "Reset your password",
  pricing: "Pricing",
  upgrade: "Upgrade",
  newPassword: "Choose a new password",
  billing: "Billing",
  cancel: "Cancel subscription",
  verifyEmail: "Confirm your email",
}

/** 가격 변경 쪽의 글(블록 밖) */
export const priceChangePageCopy = {
  accept: { title: "Review your new price", lead: "We emailed you about a change to your plan. Nothing changes until you press one of the two buttons below." },
  decline: { title: "Decline the new price", lead: "To stop the price change, you can cancel your plan here. Nothing changes until you press one of the two buttons below." },
  nothing: { title: "There's no price change waiting for your answer", body: "You may have already answered, or the change was withdrawn. You can check your plan in Billing.", label: "Go to Billing", href: "/account/billing" },
  failed: { title: "We couldn't load your plan", body: "Your plan is not affected. Please reload the page in a moment.", label: "Go to Billing", href: "/account/billing" },
}

/** 문의 화면(/contact) — K05·K06·K10·G01 */
export const contactCopy = {
  title: "Contact us",
  lead: "Write to us and a person reads your message. Tell us what happened and how to reach you.",
  /** {responseTime} 은 lib/launch/support.ts 의 SUPPORT.responseTime. 값이 null 이면 이 줄을 보이지 않는다 */
  response: "We usually reply within {responseTime}.",
  numberNote: "You get a request number when you send this. Keep it, and quote it if you write to us again.",
  /** 운영자 메일(INQUIRY_OWNER_EMAIL)이 없어 문의 창구가 꺼졌을 때 폼 대신 보이는 한 줄(서버 액션은 접수하지 않는다) */
  unavailable: "We're not accepting messages right now.",
  direct: { label: "Prefer email? Write to", note: "Include your request number if you already have one." },
  signedIn: "You're signed in, so we filled in your email address. You can change it.",
  name: { label: "Your name", marker: "(optional)" },
  topic: {
    label: "What is this about?",
    marker: "(optional)",
    options: [
      { value: "general", label: "A general question" },
      { value: "complaint", label: "A complaint" },
      { value: "dispute", label: "A payment dispute" },
    ],
  },
  contact: { label: "Your email or phone number", marker: "(required)", hint: "We use this only to reply to you." },
  message: { label: "Your message", marker: "(required)", hint: "Up to 5,000 characters." },
  errors: {
    contactRequired: "Enter an email address or a phone number so we can reply.",
    messageRequired: "Write your message so we know how to help.",
  },
  submit: "Send message",
  pending: "Sending",
  alert: { field: "Some fields need your attention", server: "We couldn't send your message. What you wrote is still here." },
  done: {
    title: "We received your message",
    reference: "Your request number",
    body: "Keep this number. If you write to us again about this, quote it.",
    receipt: "A confirmation email is on its way to {contact}.",
    again: "Send another message",
  },
}

/** 오류·로딩·404 화면(H01·H02) — 지원 경로와 요청 번호를 같이 보인다 */
export const errorCopy = {
  error: {
    title: "Something went wrong",
    body: "This is on our side, not yours. What you typed on other pages is not affected.",
    retry: "Try again",
    again: "If it keeps happening, contact us and quote the number below.",
  },
  fatal: {
    title: "Something went wrong",
    body: "The page could not load. This is on our side, not yours.",
    retry: "Reload the page",
    again: "If it keeps happening, contact us and quote the number below.",
  },
  notFound: {
    title: "Page not found",
    body: "The page you are looking for does not exist or has moved.",
    home: "Back to the start page",
    help: "Still stuck? Contact us",
  },
  loading: "Loading",
  contact: "Contact us",
  referenceLabel: "Error number",
}

/** 머리말 기본값(L01) — 제품이 바꾼다. 제목은 「쪽 · 제품」 꼴로 만든다 */
export const metaCopy = {
  description: `${PRODUCT_NAME} — start free, upgrade when you need more.`,
  siteName: PRODUCT_NAME,
  /** 브라우저 주소창 색·설치 앱 배경 — 제품 색으로 바꾼다 */
  themeColor: "#ffffff",
}

/**
 * 이메일 확인 마무리(P1AB B2). 확인 안 된 이메일은 결제를 막지 않는다(운영자 결정 2026-10-07) — 대신 ① 위 배너(verifyBannerCopy) ② 결제 직전 받는 주소(checkoutEmailCopy)
 * ③ 확인 쪽(/verify-email — 블록 confirmation/verify-email, verifyEmailPageCopy). 「주소 고치기」는 계정 화면의 이메일 변경 폼이다 — 확인 안 된 주소는 현재 비밀번호만 있으면 새 주소 확인만 거쳐 바뀐다(D71).
 */
const FIX_EMAIL_HREF = "/account#credentials-email-form"
const SIGN_IN_FOR_VERIFY = "/sign-in?next=%2Fverify-email"

/** 로그인한 확인 안 된 사람에게 모든 쪽 위에 붙는 배너 — 다시 보내기와 주소 고치기가 한 곳에 있다(A10·A11·A14) */
export const verifyBannerCopy = {
  label: "Email confirmation",
  title: "Confirm your email address",
  body: "We sent a link to {email}. Open it to finish setting up your account.",
  resend: { label: "Send it again", pending: "Sending", sent: "Sent. Check your inbox and spam folder.", failed: "We couldn't send it just now. Please try again in a minute." },
  wrongAddress: { text: "Wrong address?", label: "Fix it", href: FIX_EMAIL_HREF },
  help: { label: "Need help?", href: "/verify-email" },
}

/** 결제 화면(/upgrade) 위: 영수증·청구 메일이 갈 주소(A11). 확인 안 됐으면 그 사실과 확인·고치기 길 */
export const checkoutEmailCopy = {
  line: "Receipts and billing emails go to {email}.",
  unverified: "That address isn't confirmed yet. If it has a typo, your receipt would go to someone else.",
  confirm: { label: "Confirm it", href: "/verify-email" },
  fix: { label: "Fix the address", href: FIX_EMAIL_HREF },
  // 결제 창(대화상자)은 기본으로 열려 쪽 위 안내를 덮는다 — 같은 주소를 창의 설명에도 싣는다. 창 안 설명은 글뿐이라 링크 대신 「창을 닫고 고치라」고 말한다
  inDialog: "Close this window to confirm or fix the address first.",
}

/**
 * F10 EU 판매 스위치(LF_EU_SALES, 기본 열림 · off 로 닫음) 문구 — 요금표 안내 한 줄 · 결제 국가 고르기 단계 · EU 결제 국가 안내 · 서버 거절 문구.
 * 대행사가 EU 청약철회 의무를 누가 지는지 답하기 전까지 EU 결제 국가에는 팔지 않는다(대표 위임 결정 2026-10-08, docs/qa/ux-audit/apply-b4.md).
 */
export const euSalesCopy = {
  pricingNote: "We don't sell to billing addresses in the European Union yet. Other countries can subscribe as usual.",
  unavailable: {
    title: "We can't take orders from the European Union yet",
    body: "You appear to be in {country}, which is in the European Union, where we don't sell yet. Nothing was charged.",
    back: "Back to pricing",
  },
}

/** /verify-email — 블록 confirmation/verify-email 의 문구. 확인 전(보낸 주소·두 걸음·스팸함·다시 보내기·주소 고치기) · 확인 후 · 로그아웃(로그인이 먼저) */
export const verifyEmailPageCopy: ConfirmationVerifyEmailCopy = {
  title: "Check your email",
  body: "We sent a confirmation link to {email}. Open it to finish setting up your account.",
  steps: [`Open the email called “Confirm your email for ${PRODUCT_NAME}” in your inbox.`, "Choose “Confirm email address” in that email."],
  spam: "No email yet? Check your spam or junk folder and give it a few minutes. The link works for 1 hour.",
  resend: { label: "Send the email again", pending: "Sending", wait: "You can send it again in {seconds} seconds.", sent: "Sent again. Check your inbox and spam folder.", errorTitle: "We couldn't send the email" },
  wrongAddress: { text: "Wrong address?", label: "Fix your email address", href: FIX_EMAIL_HREF },
  verified: { title: "Your email address is confirmed", body: "There is nothing more to do. Your account is ready.", label: "Go to your account", href: "/account/billing" },
  notices: submitNotices,
  empty: { title: "Sign in to confirm your email", body: "Open the confirmation link in the browser where you signed up, or sign in and we'll help you send a new one.", label: "Sign in", href: SIGN_IN_FOR_VERIFY },
  loading: "Loading your email status",
  error: "We couldn't load your email status",
  retry: "Try again",
}
