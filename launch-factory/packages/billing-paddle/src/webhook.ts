// Paddle 웹훅 처리기(Review Focus 1, 대장 D20). 순서:
//   1. 서명 검증 — SDK paddle.webhooks.unmarshal(원문 본문, 비밀, Paddle-Signature). 틀리면 401 이고 DB 를 건드리지 않는다.
//      방식은 Paddle 공식 스타터(PaddleHQ/paddle-nextjs-starter-kit src/app/api/webhook/route.ts, Apache-2.0)를 따랐다 — THIRD_PARTY_NOTICES #1.
//   2. 한 트랜잭션: 이벤트 id 기록(중복이면 끝) → 공급자 재조회(웹훅 본문을 믿지 않는다) → 순서 시각이 저장값보다 새로울 때만 반영.
//      처리 중 무엇이든 실패하면 트랜잭션이 이벤트 기록까지 되돌려 500 을 준다 — Paddle 재전송(샌드박스 15분 3회, 실결제 3일 60회)이 다시 처리한다.
//   3. 커밋 뒤 메일(멱등 키). 영수증·해지 메일은 Paddle 이 보내므로 기본으로 끈다(D93) — 가격 변경 동의 요청만 늘 보낸다. 결제 실패 안내(F11)는 past_due 로 들어갈 때 한 통(sendPaymentFailedEmails 로 끈다).
// 중복 제거·재조회·순서 처리는 공식 스타터에 없는 우리 것이다. Paddle 은 적어도 한 번 전달하고 순서를 보장하지 않는다
// (https://developer.paddle.com/webhooks/about/how-webhooks-work.md 「Delivery guarantees」). 5초 안에 2xx 를 줘야 한다(https://developer.paddle.com/webhooks/about/respond-to-webhooks.md).
import { createHash } from "node:crypto"
import { recordWebhookEvent, type Database } from "@launch-factory/db"
import type { EventEntity } from "@paddle/paddle-node-sdk"
import { customDataOf, CD, orderingKey, PROVIDER } from "./map.ts"
import { planIdForPrice, planById } from "./plans.ts"
import { applyPaddleSubscription, paymentIssueOf, recipientOf, sendNotices, type Notice, type Recipient, type SyncDeps } from "./sync.ts"

export interface WebhookDeps extends SyncDeps {
  /** 알림 설정의 엔드포인트 비밀(PADDLE_WEBHOOK_SECRET — 운영자 할 일 O3) */
  webhookSecret: string
}

/** 구독 상태를 다시 읽을 이벤트. 거래 이벤트는 data.subscription_id 로 그 구독을 다시 읽는다 */
export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.activated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
  "subscription.imported",
  "transaction.completed",
  "transaction.payment_failed",
  "transaction.past_due",
])

export type WebhookOutcome =
  | { kind: "duplicate"; eventId: string }
  | { kind: "ignored"; eventId: string; eventType: string }
  | { kind: "unlinked"; eventId: string; subscriptionId: string }
  | { kind: "processed"; eventId: string; subscriptionId: string; applied: boolean; emails: number }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function subscriptionIdOf(event: EventEntity): string | null {
  const data = event.data as { id?: unknown; subscriptionId?: unknown }
  if (event.eventType.startsWith("subscription.")) return typeof data.id === "string" ? data.id : null
  if (event.eventType.startsWith("transaction.")) return typeof data.subscriptionId === "string" ? data.subscriptionId : null
  return null
}

type SupportedCurrency = "KRW" | "USD" | "EUR" | "JPY"
const CURRENCIES = new Set<string>(["KRW", "USD", "EUR", "JPY"])

/** transaction.completed → 주문 확인 메일(대장 D36). 본문은 서명이 확인된 이벤트다. 금액은 세금 포함 총액(grand_total, 최소 단위) */
function orderNotice(event: EventEntity, deps: SyncDeps, who: Recipient | null): Notice | null {
  if (event.eventType !== "transaction.completed" || !who) return null
  const t = event.data as {
    id: string
    subscriptionId: string | null
    currencyCode: string
    billedAt: string | null
    items?: { price?: { id?: string } | null }[]
    details?: { totals?: { grandTotal?: string } | null } | null
  }
  const total = Number(t.details?.totals?.grandTotal)
  const priceId = t.items?.[0]?.price?.id
  const planId = priceId ? planIdForPrice(deps.plans, priceId) : null
  if (!t.subscriptionId || !Number.isInteger(total) || !CURRENCIES.has(t.currencyCode) || !planId) return null
  return {
    kind: "orderConfirmation",
    ...who,
    subId: t.subscriptionId,
    key: `order:${t.id}`,
    orderId: t.id,
    planName: planById(deps.plans, planId)?.name ?? planId,
    amount: { amount: total, currency: t.currencyCode as SupportedCurrency, vatIncluded: true },
    orderedAt: t.billedAt ?? event.occurredAt,
  }
}

/**
 * 서명 검증 + 이벤트 변환(SDK unmarshal). 비밀을 바꾸는 동안 Paddle 은 h1 을 여럿 보낸다 — 문서는 모두 비교하라고 하지만
 * SDK 3.10.0 은 마지막 h1 하나만 본다(WebhooksValidator.extractHeader). 그래서 h1 마다 헤더를 나눠 하나라도 맞으면 받는다.
 * https://developer.paddle.com/webhooks/signature-verification 「Multiple h1 values」
 */
async function verified(deps: WebhookDeps, raw: string, header: string): Promise<EventEntity | null> {
  const parts = header.split(";").map((p) => p.trim())
  const ts = parts.find((p) => p.startsWith("ts="))
  const h1s = parts.filter((p) => p.startsWith("h1="))
  if (!ts || h1s.length === 0 || h1s.length > 5) return null
  for (const h1 of h1s) {
    try {
      return await deps.paddle.webhooks.unmarshal(raw, deps.webhookSecret, `${ts};${h1}`)
    } catch {
      // 다음 h1
    }
  }
  return null
}

/** Next 경로 처리기에서 그대로 쓴다: `export const POST = (req: Request) => handlePaddleWebhook(req, deps)` */
export async function handlePaddleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  const signature = req.headers.get("paddle-signature")
  const raw = await req.text() // 원문 그대로 — 공백 하나라도 바뀌면 서명이 맞지 않는다
  if (!signature || !raw) return json(401, { error: "invalid_signature" })
  if (!deps.webhookSecret) {
    deps.log?.("[billing-paddle] PADDLE_WEBHOOK_SECRET is missing (owner action O3)")
    return json(500, { error: "webhook_secret_missing" })
  }
  const event = await verified(deps, raw, signature)
  if (!event) return json(401, { error: "invalid_signature" })

  const subId = subscriptionIdOf(event)
  let outcome: WebhookOutcome
  let notices: Notice[]
  try {
    const r = await deps.db.transaction(async (tx) => {
      const { duplicate } = await recordWebhookEvent(tx as unknown as Database, {
        provider: PROVIDER,
        eventId: event.eventId,
        occurredAt: new Date(event.occurredAt),
        payloadHash: createHash("sha256").update(raw).digest("hex"),
      })
      if (duplicate) return { outcome: { kind: "duplicate", eventId: event.eventId } as WebhookOutcome, notices: [] as Notice[] }
      if (!subId || !SUBSCRIPTION_EVENTS.has(event.eventType)) {
        return { outcome: { kind: "ignored", eventId: event.eventId, eventType: event.eventType } as WebhookOutcome, notices: [] as Notice[] }
      }
      // 재조회: 웹훅 본문이 아니라 공급자의 지금 상태를 저장한다
      const entity = await deps.paddle.subscriptions.get(subId)
      const issue = await paymentIssueOf(deps.paddle, entity)
      const applied = await applyPaddleSubscription(tx, deps, entity, orderingKey(event.occurredAt, entity.updatedAt), issue, new Date(event.occurredAt))
      if (applied.unlinked) return { outcome: { kind: "unlinked", eventId: event.eventId, subscriptionId: subId } as WebhookOutcome, notices: [] as Notice[] }
      const found: Notice[] = [...applied.notices]
      // 주문 확인(영수증)은 Paddle 이 보낸다 — 기본은 보내지 않는다(대장 D93, MailConfig.sendBillingEmails)
      if (deps.mail?.sendBillingEmails === true && event.eventType === "transaction.completed") {
        const cd = customDataOf(entity)
        const userId = typeof cd[CD.userId] === "string" ? (cd[CD.userId] as string) : null
        const who = userId ? await recipientOf(tx, userId) : null
        const order = orderNotice(event, deps, who)
        if (order) found.push(order)
      }
      return {
        outcome: { kind: "processed", eventId: event.eventId, subscriptionId: subId, applied: applied.applied, emails: found.length } as WebhookOutcome,
        notices: found,
      }
    })
    outcome = r.outcome
    notices = r.notices
  } catch (e) {
    // 트랜잭션이 이벤트 기록까지 되돌렸다 → 500 → Paddle 이 다시 보낸다. 메시지에 본문·비밀을 싣지 않는다.
    deps.log?.(`[billing-paddle] webhook ${event.eventType} ${event.eventId} failed: ${e instanceof Error ? e.name : "error"}`)
    return json(500, { error: "processing_failed", eventId: event.eventId })
  }
  await sendNotices(deps, notices)
  return json(200, outcome)
}

