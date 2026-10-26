// 웹 푸시 구독 저장(계획 3b). 검사·전송은 @launch-factory/push 가 한다.
import { and, eq, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { pushSubscriptions } from "./schema.ts"

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
export type NewPushSubscription = Pick<typeof pushSubscriptions.$inferInsert, "endpoint" | "p256dh" | "auth" | "expirationTime" | "userId" | "createdAt">

/** 같은 기기(endpoint)면 키·만료·소유자를 갈아 끼우고 실패 횟수를 0으로 돌린다 */
export async function upsertPushSubscription(d: Database, row: NewPushSubscription): Promise<PushSubscriptionRow> {
  const [saved] = await d
    .insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: row.p256dh, auth: row.auth, expirationTime: row.expirationTime ?? null, userId: row.userId, failureCount: 0 },
    })
    .returning()
  return saved as PushSubscriptionRow
}

/** 내 기기만 지운다(남의 endpoint 를 알아도 지울 수 없다). 지웠으면 true */
export async function deletePushSubscription(d: Database, userId: string, endpoint: string): Promise<boolean> {
  const rows = await d.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))).returning({ id: pushSubscriptions.id })
  return rows.length > 0
}

/** 푸시 서비스가 폐기했다고 알린 기기를 지운다(소유자 확인 없이 endpoint 로) */
export async function deletePushSubscriptionById(d: Database, id: string): Promise<void> {
  await d.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
}

export async function listPushSubscriptions(d: Database, userId: string): Promise<PushSubscriptionRow[]> {
  return d.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
}

export async function markPushSuccess(d: Database, id: string, at: Date): Promise<void> {
  await d.update(pushSubscriptions).set({ lastSuccessAt: at, failureCount: 0 }).where(eq(pushSubscriptions.id, id))
}

/** 실패 횟수를 하나 올리고 올린 뒤 값을 돌려준다 */
export async function bumpPushFailure(d: Database, id: string): Promise<number> {
  const [row] = await d.update(pushSubscriptions).set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` }).where(eq(pushSubscriptions.id, id)).returning({ n: pushSubscriptions.failureCount })
  return row?.n ?? 0
}
