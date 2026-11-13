// 웹 푸시 구독 저장(계획 3b). 검사·전송은 @launch-factory/push 가 한다.
import { and, eq, isNotNull, lte, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { pushSubscriptions } from "./schema.ts"

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
export type NewPushSubscription = Pick<typeof pushSubscriptions.$inferInsert, "endpoint" | "p256dh" | "auth" | "expirationTime" | "userId" | "createdAt">

/** 사용자 한 명이 가질 수 있는 구독(기기) 수의 기본 상한. 여러 기기(폰·노트북·태블릿·브라우저 여럿)를 쓰는 정상 사용자를 막지 않는 값 */
export const DEFAULT_MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10

export type PushSubscriptionQuotaResult = { ok: true; row: PushSubscriptionRow } | { ok: false; error: "quota_exceeded"; limit: number }

/**
 * 사용자별 상한 안에서만 구독을 저장한다(CWE-770). 한 트랜잭션에서 사용자별 advisory lock 을 잡고(같은 사용자의 동시 등록은 줄을 선다)
 * 세고 넣는다 — 서로 다른 endpoint 를 동시에 N+1개 보내도 상한 개만 성공한다.
 *   - 이미 그 사용자 것인 endpoint 를 다시 등록하는 것(기기 키 갱신)은 개수를 늘리지 않으므로 상한에 닿아 있어도 된다.
 *   - 남이 쓰던 endpoint 를 가져오는 것(소유자 이전)은 이 사용자의 구독이 하나 느는 것이라 센다.
 *   - 상한에 닿으면 먼저 이 사용자의 만료된(expirationTime 이 지난) 구독만 지우고 다시 센다 — 쓰는 기기를 몰래 지우지 않는다. 그래도 가득 차면 quota_exceeded.
 */
export async function upsertPushSubscriptionWithinQuota(d: Database, row: NewPushSubscription, o: { max?: number; now?: Date } = {}): Promise<PushSubscriptionQuotaResult> {
  const limit = o.max ?? DEFAULT_MAX_PUSH_SUBSCRIPTIONS_PER_USER
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("push subscription limit must be a positive integer")
  const nowMs = (o.now ?? new Date()).getTime()
  return d.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`push-subscriptions:${row.userId}`}, 0))`)
    const [current] = await tx.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, row.endpoint))
    if (current?.userId !== row.userId) {
      const owned = async (): Promise<number> => {
        const [r] = (await tx.select({ n: sql<number>`count(*)::int` }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, row.userId))) as [{ n: number }]
        return r.n
      }
      if ((await owned()) >= limit) {
        await tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, row.userId), isNotNull(pushSubscriptions.expirationTime), lte(pushSubscriptions.expirationTime, nowMs)))
        if ((await owned()) >= limit) return { ok: false as const, error: "quota_exceeded" as const, limit }
      }
    }
    return { ok: true as const, row: await upsertPushSubscription(tx as unknown as Database, row) }
  })
}

/** 같은 기기(endpoint)면 키·만료·소유자를 갈아 끼우고 실패 횟수를 0으로 돌린다. **사용자별 상한은 보지 않는다** — 사용자가 부르는 길은 upsertPushSubscriptionWithinQuota 를 쓴다 */
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
