// 템플릿 이름 → HTML·평문. 입력 검사는 렌더 전에 끝난다(틀리면 EmailRenderError, 아무것도 만들지 않는다).
import { render } from "react-email"
import { welcome, type WelcomeInput } from "./templates/welcome.ts"
import { orderConfirmation, type OrderConfirmationInput } from "./templates/order-confirmation.ts"
import { shopOrderConfirmation, type ShopOrderConfirmationInput } from "./templates/shop-order-confirmation.ts"
import { priceChange, type PriceChangeInput } from "./templates/price-change.ts"
import { cancellation, type CancellationInput } from "./templates/cancellation.ts"
import { paymentFailed, type PaymentFailedInput } from "./templates/payment-failed.ts"
import { inquiryNotice, type InquiryNoticeInput } from "./templates/inquiry-notice.ts"
import { inquiryReceipt, type InquiryReceiptInput } from "./templates/inquiry-receipt.ts"
import { inquiryReply, type InquiryReplyInput } from "./templates/inquiry-reply.ts"
import { bookingConfirmation, type BookingConfirmationInput } from "./templates/booking-confirmation.ts"
import { bookingCancellation, type BookingCancellationInput } from "./templates/booking-cancellation.ts"
import { bookingNotice, type BookingNoticeInput } from "./templates/booking-notice.ts"
import { accountDeletionRequested, emailChangeConfirm, emailChanged, passwordChanged, passwordReset, verifyEmail } from "./templates/account.ts"
import type { AccountDeletionRequestedInput, EmailChangeConfirmInput, EmailChangedInput, PasswordChangedInput, PasswordResetInput, VerifyEmailInput } from "./templates/account.ts"
import { marketingConsentNotice, type MarketingConsentNoticeInput } from "./templates/marketing-consent-notice.ts"
import { marketingReconfirm, type MarketingReconfirmInput } from "./templates/marketing-reconfirm.ts"
import { marketingAnnouncement, type MarketingAnnouncementInput } from "./templates/marketing-announcement.ts"
import { newsletterConfirm, type NewsletterConfirmInput } from "./templates/newsletter-confirm.ts"
import { newsletterWelcome, type NewsletterWelcomeInput } from "./templates/newsletter-welcome.ts"
import { newDeviceSignIn, type NewDeviceSignInInput } from "./templates/new-device-sign-in.ts"
import type { BuiltEmail } from "./templates/layout.ts"
import { adSubject, checkAdvertising } from "./advertising.ts"
import { EmailRenderError } from "./format.ts"
import { kindOf } from "./kinds.ts"

export interface TemplateInputs {
  welcome: WelcomeInput
  orderConfirmation: OrderConfirmationInput
  shopOrderConfirmation: ShopOrderConfirmationInput
  priceChange: PriceChangeInput
  cancellation: CancellationInput
  paymentFailed: PaymentFailedInput
  inquiryNotice: InquiryNoticeInput
  inquiryReceipt: InquiryReceiptInput
  inquiryReply: InquiryReplyInput
  bookingConfirmation: BookingConfirmationInput
  bookingCancellation: BookingCancellationInput
  bookingNotice: BookingNoticeInput
  verifyEmail: VerifyEmailInput
  emailChangeConfirm: EmailChangeConfirmInput
  emailChanged: EmailChangedInput
  passwordReset: PasswordResetInput
  passwordChanged: PasswordChangedInput
  accountDeletionRequested: AccountDeletionRequestedInput
  marketingConsentNotice: MarketingConsentNoticeInput
  newDeviceSignIn: NewDeviceSignInInput
  marketingReconfirm: MarketingReconfirmInput
  marketingAnnouncement: MarketingAnnouncementInput
  newsletterConfirm: NewsletterConfirmInput
  newsletterWelcome: NewsletterWelcomeInput
}
export type TemplateName = keyof TemplateInputs

const BUILDERS: { [N in TemplateName]: (input: TemplateInputs[N]) => BuiltEmail } = {
  welcome,
  orderConfirmation,
  shopOrderConfirmation,
  priceChange,
  cancellation,
  paymentFailed,
  inquiryNotice,
  inquiryReceipt,
  inquiryReply,
  bookingConfirmation,
  bookingCancellation,
  bookingNotice,
  verifyEmail,
  emailChangeConfirm,
  emailChanged,
  passwordReset,
  passwordChanged,
  accountDeletionRequested,
  marketingConsentNotice,
  newDeviceSignIn,
  marketingReconfirm,
  marketingAnnouncement,
  newsletterConfirm,
  newsletterWelcome,
}
export const TEMPLATE_NAMES = Object.keys(BUILDERS) as TemplateName[]

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * 종류별 규칙(kinds.ts, G07·G03):
 * - 거래·법정 안내: 입력에 `promo` 칸이 있거나 출력에 광고 블록 표지(data-lf-promo)가 있으면 던진다 — 광고 문구를 섞지 않는다.
 * - 광고성: 법정 표시 입력(advertising)이 없거나 모자라면 렌더 전에 던지고, 제목 앞에 「(광고)」를 붙이며, 출력에 바닥글 표지(data-lf-ad-footer)와 수신거부 주소가 없으면 던진다.
 */
export async function renderEmail<N extends TemplateName>(name: N, input: TemplateInputs[N]): Promise<RenderedEmail> {
  const build = BUILDERS[name] as ((input: TemplateInputs[N]) => BuiltEmail) | undefined
  if (!build) throw new Error(`unknown email template: ${String(name)}`)
  const kind = kindOf(name)
  const raw = input as unknown as Record<string, unknown>
  if (kind === "transactional" && raw.promo) throw new EmailRenderError(name, ["promo blocks are not allowed in transactional mail (kind: transactional)"])
  if (kind === "marketing") {
    const problems: string[] = []
    checkAdvertising(raw.advertising as Parameters<typeof checkAdvertising>[0], problems)
    if (problems.length) throw new EmailRenderError(name, problems)
  }
  const built = build(input)
  const subject = kind === "marketing" ? adSubject(built.subject) : built.subject
  const [html, text] = await Promise.all([render(built.element), render(built.element, { plainText: true })])
  if (kind === "transactional" && html.includes("data-lf-promo")) throw new EmailRenderError(name, ["transactional mail output contains a promo block"])
  if (kind === "marketing") {
    const url = (raw.advertising as { unsubscribeUrl: string }).unsubscribeUrl
    if (!html.includes("data-lf-ad-footer") || !html.includes(escapeAttr(url)) || !text.includes(url)) throw new EmailRenderError(name, ["marketing mail output lacks the advertising footer or the unsubscribe link"])
  }
  return { subject, html, text }
}

const escapeAttr = (v: string): string => v.replace(/&/g, "&amp;")
