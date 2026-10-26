// @launch-factory/payments-kr — 한국 결제 중개 어댑터(공개 면은 이 파일 하나).
// PaymentGateway { prepare, verify, cancel } + 구현 둘(portoneGateway · mockGateway) + 웹훅 서명 확인(verifyWebhook) + 환경 선택(resolvePayments).
// DB·주문을 모른다. 서버 전용이다(블록은 포트 메서드만 받는다).
export { assertChargeable, InvalidAmountError, KRW, PaymentsConfigError, UnsupportedCurrencyError, won } from "./gateway.ts"
export type { CancelInput, CancelResult, PaymentGateway, PaymentSession, PrepareInput, VerifyResult, VerifyStatus } from "./gateway.ts"
export { mockGateway } from "./mock.ts"
export type { MockGateway, MockGatewayOptions } from "./mock.ts"
export { portoneGateway } from "./portone.ts"
export type { PortOneClientLike, PortOneGatewayConfig } from "./portone.ts"
export { verifyWebhook, WebhookRejected } from "./webhook.ts"
export type { IgnoredWebhookEvent, PaymentWebhookEvent, VerifyWebhookInput, WebhookHeaders, WebhookRejectReason } from "./webhook.ts"
export { PORTONE_ENV, resolvePayments } from "./config.ts"
export type { PaymentsConfig, PaymentsEnv, ResolveOptions } from "./config.ts"
