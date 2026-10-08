// 템플릿 입력 견본(ko·en 공통 값). 날짜는 고정값이라 스냅숏이 흔들리지 않는다.
export const APP = "https://sampleco.test"

// 광고성 법정 표시 견본. 값은 모두 가짜다(실제 사업자 정보는 제품 설정 LF_BUSINESS_* 에서 온다).
export const ADVERTISING = {
  senderName: "Example Co.",
  senderEmail: "hello@example.test",
  senderPhone: "+82 10-0000-0000",
  senderAddress: "1 Example-ro, Seoul 00000, KR",
  unsubscribeUrl: `${APP}/api/marketing/unsubscribe?t=test-unsubscribe-token`,
}

export function inputs(locale) {
  const base = { locale, productName: "SampleCo", recipientName: locale === "ko" ? "지민" : "Jamie" }
  const currency = locale === "ko" ? "KRW" : "USD"
  const price = (krw, usdCents) => ({ amount: locale === "ko" ? krw : usdCents, currency, vatIncluded: locale === "ko" })
  return {
    welcome: { ...base, appUrl: `${APP}/app` },
    orderConfirmation: {
      ...base,
      orderId: "ord_01JH2X",
      planName: "Pro",
      amount: price(9900, 900),
      orderedAt: "2026-09-30T03:00:00.000Z",
      manageUrl: `${APP}/billing`,
    },
    priceChange: {
      ...base,
      planName: "Pro",
      change: {
        from: price(9900, 900),
        to: price(12900, 1200),
        effectiveAt: "2026-11-15T00:00:00.000Z",
        consentBy: "2026-11-01T14:59:00.000Z",
        kind: "price_increase",
      },
      acceptUrl: `${APP}/billing/price-change/accept`,
      declineUrl: `${APP}/billing/cancel`,
    },
    marketingConsentNotice: { ...base, senderName: "SampleCo Inc.", changes: [{ channel: "email", granted: true }, { channel: "sms", granted: false }], changedAt: "2026-10-01T01:30:00.000Z" },
    paymentFailed: { ...base, retryAt: "2026-10-05T03:00:00.000Z", accessUntil: "2026-10-08T03:00:00.000Z", updateUrl: `${APP}/account/billing` },
    cancellation: { ...base, accessUntil: "2026-10-31T15:00:00.000Z", resubscribeUrl: `${APP}/pricing` },
    inquiryNotice: {
      locale,
      productName: "SampleCo",
      reference: "Q-7K3M9P2A",
      form: "contact",
      name: locale === "ko" ? "지민" : "Jamie",
      contact: "jamie@example.com",
      message: "Hello\nDo you offer team plans?",
      receivedAt: "2026-09-30T03:00:00.000Z",
      deleteOn: "2026-10-30T03:00:00.000Z",
      adminUrl: `${APP}/admin/inquiries`,
    },
    inquiryReceipt: { locale, productName: "SampleCo", reference: "Q-7K3M9P2A" },
    verifyEmail: { ...base, verifyUrl: `${APP}/api/auth/verify-email?token=test-token`, linkValidMinutes: 60, notMeUrl: `${APP}/api/auth/not-me?t=test-not-me` },
    emailChangeConfirm: { ...base, newEmail: "new-address@example.test", approveUrl: `${APP}/api/auth/verify-email?token=test-approve`, linkValidMinutes: 60 },
    emailChanged: { ...base, newEmail: "new-address@example.test", securityUrl: `${APP}/forgot-password` },
    passwordReset: { ...base, resetUrl: `${APP}/api/auth/reset-password/test-token?callbackURL=%2Freset-password`, linkValidMinutes: 60 },
    passwordChanged: { ...base, changedAt: "2026-09-30T03:00:00.000Z", securityUrl: `${APP}/forgot-password` },
    accountDeletionRequested: { ...base, graceUntil: "2026-10-07T03:00:00.000Z", signInUrl: `${APP}/sign-in` },
    newDeviceSignIn: { ...base, device: "Chrome on Windows", signedInAt: "2026-10-01T01:30:00.000Z", location: "Seoul, KR", securityUrl: `${APP}/forgot-password` },
    marketingReconfirm: {
      ...base,
      senderName: "SampleCo Inc.",
      consentAt: "2024-09-30T03:00:00.000Z",
      keepUrl: `${APP}/api/marketing/keep?t=test-keep-token`,
      unsubscribeUrl: `${APP}/api/marketing/unsubscribe?t=test-unsubscribe-token`,
      linkValidMinutes: 60 * 24 * 60,
    },
    marketingAnnouncement: {
      ...base,
      subject: "Team plans are here",
      heading: "Team plans are here",
      paragraphs: ["You can now share one workspace across your whole team.", "Pay once for every seat."],
      cta: { label: "See team plans", url: `${APP}/pricing` },
      advertising: ADVERTISING,
    },
  }
}
