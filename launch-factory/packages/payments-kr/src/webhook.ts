// PortOne V2 웹훅 서명 확인(Standard Webhooks). 본문은 파싱 전 원문(`await req.text()`)이어야 한다.
// 서명이 틀리면 null 이 아니라 WebhookRejected 를 던진다 — 호출 쪽(라우트)이 400 으로 답한다.
// 본문을 믿지 않는다: 여기서 돌려주는 paymentId 는 「어느 건을 다시 조회할지」일 뿐이고, 이행은 게이트웨이 재조회가 정한다.
import { Webhook } from "@portone/server-sdk"
import { PaymentsConfigError } from "./gateway.ts"

export type WebhookRejectReason = "missing_headers" | "signature_mismatch" | "timestamp_too_old" | "timestamp_too_new" | "malformed_payload"

export class WebhookRejected extends Error {
  readonly reason: WebhookRejectReason
  constructor(reason: WebhookRejectReason) {
    super(`웹훅을 받지 않았어요: ${reason}`)
    this.name = "WebhookRejected"
    this.reason = reason
  }
}

export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>

export interface VerifyWebhookInput {
  /** PORTONE_WEBHOOK_SECRET(whsec_…) */
  secret: string
  /** 파싱 전 원문 본문 */
  rawBody: string
  headers: WebhookHeaders
}

/** 서명이 맞고 결제 건을 가리키는 이벤트 */
export interface PaymentWebhookEvent {
  ignored: false
  /** webhook-id 헤더 — 중복 제거 키로 쓴다 */
  eventId: string
  /** 예: Transaction.Paid / Transaction.Failed / Transaction.Cancelled / Transaction.PartialCancelled */
  type: string
  paymentId: string
}
/** 서명은 맞지만 우리가 쓰지 않는 이벤트(빌링키 등 · 모르는 type) — 200 으로 답하고 무시한다 */
export interface IgnoredWebhookEvent {
  ignored: true
  eventId: string
  type: string
}

const REASON: Record<string, WebhookRejectReason> = {
  MISSING_REQUIRED_HEADERS: "missing_headers",
  NO_MATCHING_SIGNATURE: "signature_mismatch",
  INVALID_SIGNATURE: "signature_mismatch",
  TIMESTAMP_TOO_OLD: "timestamp_too_old",
  TIMESTAMP_TOO_NEW: "timestamp_too_new",
}

const plain = (headers: WebhookHeaders): Record<string, string | string[] | undefined> =>
  headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers

export async function verifyWebhook({ secret, rawBody, headers }: VerifyWebhookInput): Promise<PaymentWebhookEvent | IgnoredWebhookEvent> {
  const h = plain(headers)
  let payload: unknown
  try {
    payload = await Webhook.verify(secret, rawBody, h)
  } catch (e) {
    if (e instanceof Webhook.WebhookVerificationError) throw new WebhookRejected(REASON[e.reason] ?? "signature_mismatch")
    // 서명은 맞는데 본문이 JSON 이 아니다
    if (e instanceof SyntaxError) throw new WebhookRejected("malformed_payload")
    // 비밀이 비었거나 base64 가 아니다 — 요청 탓이 아니라 설정 탓이라 거절이 아니라 오류로 올린다(SDK 메시지에는 값이 섞일 수 있어 싣지 않는다)
    if (e instanceof Webhook.InvalidInputError) throw new PaymentsConfigError("PORTONE_WEBHOOK_SECRET 형식이 올바르지 않아요 (whsec_… 비밀을 확인하세요)")
    throw e
  }

  const eventId = firstHeader(h, "webhook-id") ?? ""
  const body = payload as { type?: unknown; data?: { paymentId?: unknown } } | null
  const type = typeof body?.type === "string" ? body.type : ""
  if (!type.startsWith("Transaction.")) return { ignored: true, eventId, type }
  const paymentId = body?.data?.paymentId
  if (typeof paymentId !== "string" || paymentId === "") throw new WebhookRejected("malformed_payload")
  return { ignored: false, eventId, type, paymentId }
}

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== name) continue
    return Array.isArray(v) ? v[0] : v
  }
  return undefined
}
