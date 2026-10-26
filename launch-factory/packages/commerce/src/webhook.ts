// 결제 웹훅 처리 — 서명 확인 → 이벤트 id 중복 제거 → 결제 확정(confirmPayment, 리디렉션 반환과 같은 함수).
// 본문을 믿지 않는다: 이벤트는 「어느 건을 다시 조회할지」만 알리고, 이행은 게이트웨이 재조회가 정한다.
// HTTP 를 모른다 — 답할 상태 코드와 본문만 돌려주므로 라우트는 얇고, 이 함수는 라우트 없이 시험된다.
//   400  서명·헤더·본문이 틀렸다(받지 않았다 — 기록 없음)
//   200  처리했거나(확정·이미 확정·다른 처리 불필요) 중복이라 건너뛰었거나 쓰지 않는 이벤트
//   503  공급자가 아직 결제 완료로 보지 않는다 — 기록을 되돌리고 다시 보내게 한다(PortOne 은 2xx 가 아니면 재전송한다)
// 처리 중 던지면(DB 오류 등) 이벤트 기록을 되돌린 뒤 그대로 던진다 — 라우트가 500 으로 답하고 공급자가 다시 보내면 처리된다.
import { createHash } from "node:crypto"
import { recordWebhookEvent, webhookEvents } from "@launch-factory/db"
import { verifyWebhook, WebhookRejected } from "@launch-factory/payments-kr"
import { and, eq } from "drizzle-orm"
import { confirmPayment } from "./checkout.ts"
import { withDefaults, type CommerceDeps } from "./deps.ts"

export const WEBHOOK_PROVIDER = "portone"

/** 결제 완료 이벤트 — 이것만 주문을 움직인다. 실패·취소 이벤트는 받아 두기만 한다(결제 대기 주문은 만료 Cron 이 정리한다) */
const PAID_EVENT = "Transaction.Paid"

export interface WebhookInput {
  /** PORTONE_WEBHOOK_SECRET */
  secret: string
  /** 파싱 전 원문 본문 */
  rawBody: string
  headers: Headers
  /**
   * 이 상점의 주문이 아닌 결제 번호가 오면(주문 없음) 마지막으로 물어보는 곳 — 같은 결제 중개를 쓰는 다른 기능(예약금 등)의 결제를 같은 웹훅 주소로 받게 한다.
   * 상점은 그 기능을 모른다: 조립하는 쪽이 함수를 넘기고, 답만 읽는다. not_mine 이면 예전 그대로(받은 것으로 치고 not_applicable).
   * 던지면 이벤트 기록을 되돌리고 그대로 던진다(공급자가 다시 보낸다).
   */
  unclaimed?: (paymentId: string) => Promise<"confirmed" | "already_confirmed" | "pending" | "not_applicable" | "not_mine">
}

export type WebhookReply =
  | { status: 200; body: { received: true; result: "confirmed" | "already_confirmed" | "duplicate" | "ignored" | "not_applicable"; code?: string } }
  | { status: 400; body: { error: string } }
  | { status: 503; body: { error: "payment_pending" } }

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")

/** webhook-timestamp(초) → 발생 시각. 없거나 이상하면 지금 */
function occurredAt(headers: Headers, now: Date): Date {
  const seconds = Number(headers.get("webhook-timestamp"))
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : now
}

export async function handleWebhook(deps: CommerceDeps, input: WebhookInput): Promise<WebhookReply> {
  const ctx = withDefaults(deps)
  let event
  try {
    event = await verifyWebhook({ secret: input.secret, rawBody: input.rawBody, headers: input.headers })
  } catch (e) {
    if (e instanceof WebhookRejected) return { status: 400, body: { error: e.reason } }
    throw e
  }

  // 쓰지 않는 이벤트(빌링키 등)는 기록하지 않고 200 — 서명은 맞았다
  if (event.ignored) return { status: 200, body: { received: true, result: "ignored" } }

  const recorded = await recordWebhookEvent(ctx.db, {
    provider: WEBHOOK_PROVIDER,
    eventId: event.eventId,
    occurredAt: occurredAt(input.headers, ctx.now()),
    payloadHash: sha256(input.rawBody),
  })
  if (recorded.duplicate) return { status: 200, body: { received: true, result: "duplicate" } }
  if (event.type !== PAID_EVENT) return { status: 200, body: { received: true, result: "not_applicable" } }

  const forget = () => ctx.db.delete(webhookEvents).where(and(eq(webhookEvents.provider, WEBHOOK_PROVIDER), eq(webhookEvents.eventId, event.eventId)))
  try {
    const confirmed = await confirmPayment(ctx, { paymentId: event.paymentId })
    if (confirmed.ok) return { status: 200, body: { received: true, result: confirmed.value.changed ? "confirmed" : "already_confirmed" } }
    if (confirmed.code === "payment_pending") {
      await forget()
      return { status: 503, body: { error: "payment_pending" } }
    }
    if (confirmed.code === "not_found" && input.unclaimed) {
      const claim = await input.unclaimed(event.paymentId)
      if (claim === "pending") {
        await forget()
        return { status: 503, body: { error: "payment_pending" } }
      }
      if (claim === "confirmed" || claim === "already_confirmed") return { status: 200, body: { received: true, result: claim } }
      if (claim === "not_applicable") return { status: 200, body: { received: true, result: "not_applicable" } }
    }
    // 끝난 실패(없는 결제·실패·금액 불일치·취소된 주문의 늦은 결제) — 다시 보내도 같다. 받은 것으로 친다
    return { status: 200, body: { received: true, result: "not_applicable", code: confirmed.code } }
  } catch (e) {
    await forget().catch(() => undefined)
    throw e
  }
}
