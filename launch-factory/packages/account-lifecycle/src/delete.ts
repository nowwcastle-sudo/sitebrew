// 셀프 탈퇴 요청과 유예(v0 Task 14).
// 흐름: 구독이 살아 있으면 먼저 해지(기간 끝) → 탈퇴 요청 기록(유예 기본 7일) → 모든 세션 끊기.
// 유예 중에 다시 로그인하면 요청이 취소된다(@launch-factory/auth 의 로그인 훅이 cancelAccountDeletion 을 부른다).
// 유예가 지나면 파기 Cron(purge.ts)이 지운다.
import { and, eq, inArray } from "drizzle-orm"
import type { BillingPort, IsoDate, SubscriptionStatus } from "@launch-factory/contract"
import { accountDeletions, session, user, type Database } from "@launch-factory/db"

export const ACCOUNT_DELETION_DEFAULTS = { graceDays: 7 } as const

/** 해지해야 하는(요금이 나가거나 나갈 수 있는) 상태 */
export const LIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due", "paused"]

export interface DeletionDeps {
  db: Database
  /** 서버 쪽에서 그 사용자의 결제 포트를 만든다(요청 때는 그 사용자의 세션, Cron 때는 세션 없이 사용자 id 로) */
  billingFor(userId: string): BillingPort
  /** 유예 기간(일). 기본 7 */
  graceDays?: number
  now?: () => Date
}

export type DeletionFailure =
  | { ok: false; reason: "user_not_found" }
  /** 구독 조회·해지가 실패했다 — 탈퇴를 기록하지 않았다. 다시 시도할 수 있다 */
  | { ok: false; reason: "billing_failed"; retryable: boolean }

export type DeletionRequestResult = { ok: true; graceUntil: IsoDate; alreadyRequested: boolean } | DeletionFailure

const OPEN = ["pending", "purging"] as const

/**
 * 탈퇴를 요청한다. 이미 진행 중이면 그 요청을 그대로 돌려준다(두 번 눌러도 해지·기록이 한 번).
 * 구독 해지가 실패하면 탈퇴를 기록하지 않는다 — 요금이 계속 나가는 채로 계정만 지우지 않는다.
 */
export async function requestAccountDeletion(deps: DeletionDeps, userId: string): Promise<DeletionRequestResult> {
  const { db } = deps
  const now = (deps.now ?? (() => new Date()))()
  const graceDays = deps.graceDays ?? ACCOUNT_DELETION_DEFAULTS.graceDays
  if (!Number.isFinite(graceDays) || graceDays < 0) throw new Error("graceDays must be a non-negative number")

  const [open] = await db.select().from(accountDeletions).where(and(eq(accountDeletions.userId, userId), inArray(accountDeletions.status, OPEN)))
  if (open) return { ok: true, graceUntil: open.graceUntil.toISOString(), alreadyRequested: true }
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId))
  if (!u) return { ok: false, reason: "user_not_found" }

  // 1) 구독 먼저. 기간 끝 해지라 유예 중 마음을 바꾸면 사용자가 재개(resume)할 수 있다. 남은 기간이 유예보다 길면 파기 때 즉시 해지한다(purge.ts).
  const billing = deps.billingFor(userId)
  const sub = await billing.subscription()
  if (!sub.ok) return { ok: false, reason: "billing_failed", retryable: sub.retryable === true }
  if (LIVE_SUBSCRIPTION_STATUSES.includes(sub.data.status) && !sub.data.cancelAt) {
    const cancelled = await billing.cancel({ when: "period_end", reason: "other" })
    if (!cancelled.ok) return { ok: false, reason: "billing_failed", retryable: cancelled.retryable === true }
  }

  // 2) 요청 기록 + 모든 세션 끊기(한 트랜잭션). 다시 들어오려면 로그인해야 하고, 로그인하면 요청이 취소된다.
  const graceUntil = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000)
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(accountDeletions).values({ userId, requestedAt: now, graceUntil }).onConflictDoNothing().returning()
    await tx.delete(session).where(eq(session.userId, userId))
    return inserted
  })
  if (!row) {
    // 동시에 두 번 눌렀다 — 먼저 들어간 요청을 돌려준다
    const [again] = await db.select().from(accountDeletions).where(and(eq(accountDeletions.userId, userId), inArray(accountDeletions.status, OPEN)))
    return { ok: true, graceUntil: (again?.graceUntil ?? graceUntil).toISOString(), alreadyRequested: true }
  }
  return { ok: true, graceUntil: row.graceUntil.toISOString(), alreadyRequested: false }
}

/** 유예 중인 요청을 취소한다(로그인·직접 취소). 파기 작업이 이미 잡은(purging) 요청은 취소하지 않는다. 취소했으면 true */
export async function cancelAccountDeletion(db: Database, userId: string, at: Date = new Date()): Promise<boolean> {
  const rows = await db
    .update(accountDeletions)
    .set({ status: "cancelled", cancelledAt: at })
    .where(and(eq(accountDeletions.userId, userId), eq(accountDeletions.status, "pending")))
    .returning({ id: accountDeletions.id })
  return rows.length > 0
}

/** 진행 중인 요청(화면에 「○일에 삭제돼요 — 로그인하면 취소」를 보일 때) */
export async function pendingDeletion(db: Database, userId: string) {
  const [row] = await db.select().from(accountDeletions).where(and(eq(accountDeletions.userId, userId), inArray(accountDeletions.status, OPEN)))
  return row ? { status: row.status, requestedAt: row.requestedAt.toISOString(), graceUntil: row.graceUntil.toISOString() } : null
}
