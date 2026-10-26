// @launch-factory/newsletter — 뉴스레터 구독 명단(Task 4, plan-3c). 이중 동의·서명 수신거부(RFC 8058 POST 포함)·내보내기용 목록·파기.
// 모듈: validate(입력 검사, 순수) · tokens(서명 링크, 순수) · mails(메일 요청, 순수) · service(조립, 의존 주입) · http(Request → Response).
export { CONFIRM_RESEND_COOLDOWN_MS, createNewsletterService, NEWSLETTER_RETENTION } from "./service.ts"
export type { ConfirmResult, NewsletterService, NewsletterServiceOptions, SubmitContext, SubscribeReceipt, SubscriberAdminQuery, SubscriberAdminView, SubscriberListItem, UnsubscribeResult, WithdrawResult } from "./service.ts"
export { createNewsletterHandlers, toResponse } from "./http.ts"
export type { NewsletterHandlers, NewsletterHandlersOptions } from "./http.ts"
export { CONFIRM_VALID_DAYS, NEWSLETTER_LINK_PATHS, newsletterLinks, unsubscribeUrl } from "./tokens.ts"
export { DEFAULT_SOURCE, LIMITS, NEWSLETTER_CONSENT_VERSION, normalizeEmail, parseSubscribe, readFields } from "./validate.ts"
export type { ParsedSubscribe, SubscribeInput } from "./validate.ts"
export type { MailIdentity } from "./mails.ts"
