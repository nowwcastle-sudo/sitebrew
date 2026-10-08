// 마케팅 수신 처리 결과 통지 발신함(D210) 도우미. 표는 schema/mail.ts 의 marketing_notice_outbox. 보내는 순서·재시도 규칙은 @launch-factory/consent 의 notice-outbox.ts 가 정한다.
import { and, asc, eq, lte } from "drizzle-orm"
import type { Database } from "./client.ts"
import { marketingNoticeOutbox, type NoticeChange, type NoticeSource, type NoticeStatus } from "./schema.ts"

export interface OutboxNotice {
  id: string
  userId: string
  changes: NoticeChange[]
  changedAt: Date
  source: NoticeSource
  status: NoticeStatus
  attempts: number
  nextAttemptAt: Date
  lastErrorCode: string | null
}

const toNotice = (r: typeof marketingNoticeOutbox.$inferSelect): OutboxNotice => ({
  id: r.id,
  userId: r.userId,
  changes: r.changes,
  changedAt: r.changedAt,
  source: r.source,
  status: r.status,
  attempts: r.attempts,
  nextAttemptAt: r.nextAttemptAt,
  lastErrorCode: r.lastErrorCode,
})

/** 보내지 못한 통지를 발신함에 넣는다(pending). 메일 주소·본문은 받지도 두지도 않는다 */
export async function enqueueNotice(d: Database, n: { id: string; userId: string; changes: NoticeChange[]; changedAt: Date; source: NoticeSource; attempts: number; nextAttemptAt: Date; lastErrorCode: string | null; createdAt: Date }): Promise<void> {
  await d.insert(marketingNoticeOutbox).values({ ...n, status: "pending" })
}

/** 지금 다시 보낼 때가 된 것(pending 이고 다음 시각이 지났다). 오래 기다린 것부터 limit 개 */
export async function dueNotices(d: Database, now: Date, limit: number): Promise<OutboxNotice[]> {
  const rows = await d
    .select()
    .from(marketingNoticeOutbox)
    .where(and(eq(marketingNoticeOutbox.status, "pending"), lte(marketingNoticeOutbox.nextAttemptAt, now)))
    .orderBy(asc(marketingNoticeOutbox.nextAttemptAt))
    .limit(limit)
  return rows.map(toNotice)
}

/**
 * 한 통을 잡는다: 시도 횟수를 하나 올리고 다음 시각을 미리 뒤로 민다(보내다가 프로세스가 죽어도 그 시각에 다시 시도된다).
 * 내가 읽은 횟수와 지금 횟수가 같을 때만 성공한다 — Cron 이 동시에 두 개 와도 한쪽만 이 통을 얻는다. 못 얻으면 null.
 */
export async function claimNotice(d: Database, n: OutboxNotice, nextAttemptAt: Date): Promise<OutboxNotice | null> {
  const rows = await d
    .update(marketingNoticeOutbox)
    .set({ attempts: n.attempts + 1, nextAttemptAt })
    .where(and(eq(marketingNoticeOutbox.id, n.id), eq(marketingNoticeOutbox.status, "pending"), eq(marketingNoticeOutbox.attempts, n.attempts)))
    .returning()
  return rows[0] ? toNotice(rows[0]) : null
}

/** 보냈다·멈췄다·보낼 곳이 없다 중 하나로 닫는다(닫힌 행은 다시 뽑히지 않는다). pending 인 행만 닫는다 */
export async function settleNotice(d: Database, id: string, status: Exclude<NoticeStatus, "pending">, at: Date, lastErrorCode?: string | null): Promise<void> {
  await d
    .update(marketingNoticeOutbox)
    .set({ status, settledAt: at, ...(lastErrorCode !== undefined ? { lastErrorCode } : {}) })
    .where(and(eq(marketingNoticeOutbox.id, id), eq(marketingNoticeOutbox.status, "pending")))
}

/** 이번 시도의 실패 코드를 적는다(행은 pending 으로 두고 다음 시각은 잡을 때 정해졌다) */
export async function noteNoticeFailure(d: Database, id: string, lastErrorCode: string): Promise<void> {
  await d.update(marketingNoticeOutbox).set({ lastErrorCode }).where(and(eq(marketingNoticeOutbox.id, id), eq(marketingNoticeOutbox.status, "pending")))
}
