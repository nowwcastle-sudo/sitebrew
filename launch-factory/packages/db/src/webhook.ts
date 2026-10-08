// 웹훅 중복 제거와 순서 보호(Review Focus 1). Task 5의 처리기는 한 트랜잭션 안에서
//   recordWebhookEvent → (duplicate면 끝) → 공급자 재조회 → applySubscriptionState
// 순서로 부른다. 처리 중 실패하면 트랜잭션이 이벤트 기록까지 되돌리므로, 공급자가 다시 보내면 처리된다.
// 같은 이벤트가 동시에 오면 두 번째 삽입은 고유키에서 첫 트랜잭션이 끝나길 기다렸다가 중복으로 끝난다.
import { sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { subscriptions, webhookEvents } from "./schema.ts"

export interface WebhookEventInput {
  provider: string
  eventId: string
  occurredAt: Date
  payloadHash: string
}

/** 이벤트를 기록한다. 이미 있으면 아무것도 쓰지 않고 duplicate: true. */
export async function recordWebhookEvent(d: Database, e: WebhookEventInput): Promise<{ duplicate: boolean }> {
  const rows = await d
    .insert(webhookEvents)
    .values({ ...e, processedAt: new Date() })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ eventId: webhookEvents.eventId })
  return { duplicate: rows.length === 0 }
}

export type SubscriptionState = typeof subscriptions.$inferInsert & { updatedFromEventAt: Date }

// 이벤트가 바꾸는 칸. 값은 공급자 재조회로 얻은 「전체 상태」여야 한다 — 빠진 칸은 null로 덮인다.
const MUTABLE = [
  "orgId",
  "userId",
  "status",
  "planId",
  "scheduledPlanId",
  "pendingPriceChange",
  "currentPeriodEnd",
  "trialEnd",
  "cancelAt",
  "pausedUntil",
  "paymentIssue",
  "updatedFromEventAt",
] as const satisfies readonly (keyof typeof subscriptions.$inferInsert)[]

/**
 * 구독 상태를 저장한다. 행이 없으면 만들고, 있으면 들어온 occurred_at이 저장된 값보다 「엄격히」 새로울 때만 덮는다.
 * 한 문장(INSERT … ON CONFLICT … DO UPDATE … WHERE)이라 비교와 쓰기 사이에 끼어들 틈이 없다.
 * 같은 시각이면 반영하지 않는다(같은 이벤트의 재전송은 이미 중복 제거로 걸러진다).
 */
export async function applySubscriptionState(d: Database, state: SubscriptionState): Promise<{ applied: boolean }> {
  const set = Object.fromEntries(MUTABLE.map((k) => [k, sql.raw(`excluded."${subscriptions[k].name}"`)]))
  // past_due 시작 시각(D57): past_due 가 아니면 null. 이미 past_due 였으면 처음 시각을 지킨다. 새로 들어가면 이 상태의 시각.
  // 호출자가 pastDueSince 를 주지 않으면 순서 시각(updatedFromEventAt)을 쓴다.
  const pastDue = state.status === "past_due"
  const values = { ...state, pastDueSince: pastDue ? (state.pastDueSince ?? state.updatedFromEventAt) : null }
  const rows = await d
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.providerSubId],
      set: {
        ...set,
        pastDueSince: sql`case when excluded.status <> 'past_due' then null when ${subscriptions.status} = 'past_due' then coalesce(${subscriptions.pastDueSince}, excluded.past_due_since) else excluded.past_due_since end`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${subscriptions.updatedFromEventAt} < excluded.updated_from_event_at`,
    })
    .returning({ id: subscriptions.id })
  return { applied: rows.length === 1 }
}
