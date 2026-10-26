// 뉴스레터 구독 명단 저장(Task 4, plan-3c). 검사·메일·링크는 @launch-factory/newsletter 가 한다 — 여기는 상태 전이만 한 문장·한 트랜잭션으로 지킨다.
import { and, asc, count, desc, eq, gt, ilike, isNotNull, lt, type SQL } from "drizzle-orm"
import type { Database } from "./client.ts"
import { newsletterSubscribers, type NewsletterStatus } from "./schema.ts"

export type SubscriberRow = typeof newsletterSubscribers.$inferSelect

export interface SubscriptionRequest {
  email: string
  locale: string
  source: string
  consentVersion: string
  /** 신청한(동의한) 시각 */
  at: Date
  /** 확인하지 않은 신청을 지우는 시각 */
  pendingExpiresAt: Date
  /** 확인 메일을 다시 보내도 되는 가장 이른 시각(직전 발송 + 쿨다운). 이보다 이르면 renewed 가 아니라 throttled */
  resendAfter: Date
}

export type SubscriptionOutcome =
  | { kind: "created" | "renewed"; row: SubscriberRow }
  /** 이미 구독 중 — 아무것도 바꾸지 않았다 */
  | { kind: "already" }
  /** 대기 중인데 확인 메일을 보낸 지 얼마 안 됐다 — 아무것도 바꾸지 않았다 */
  | { kind: "throttled" }

/**
 * 구독을 신청한다. 읽기·판단·쓰기가 한 트랜잭션이다(같은 주소로 동시에 와도 행은 하나).
 *  - 없으면 만든다(created). 대기 중이고 쿨다운이 지났거나 확인 메일이 간 적 없으면 기한만 늘려 다시 보내게 한다(renewed).
 *  - 구독 중이면 already, 대기 중이고 쿨다운 안이면 throttled — 둘 다 행을 바꾸지 않는다.
 *  - 수신거부한 사람이 다시 신청하면 새 신청으로 본다: 대기로 돌아가고 동의 시각·판을 새로 쓰며 확인·철회 시각을 비운다(옛 확인 링크는 신청 시각이 달라 열리지 않는다).
 */
export async function requestSubscription(d: Database, r: SubscriptionRequest): Promise<SubscriptionOutcome> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, r.email)).for("update")
    if (!row) {
      const [saved] = await tx
        .insert(newsletterSubscribers)
        .values({ email: r.email, status: "pending", locale: r.locale, source: r.source, consentVersion: r.consentVersion, consentAt: r.at, createdAt: r.at, expiresAt: r.pendingExpiresAt })
        .onConflictDoNothing()
        .returning()
      // 동시에 다른 요청이 먼저 만들었다 — 그 행이 이 신청을 대신한다(메일은 그쪽이 보낸다)
      return saved ? { kind: "created", row: saved } : { kind: "throttled" }
    }
    if (row.status === "subscribed") return { kind: "already" }
    if (row.status === "pending") {
      if (row.confirmSentAt && row.confirmSentAt.getTime() > r.resendAfter.getTime()) return { kind: "throttled" }
      const [saved] = await tx.update(newsletterSubscribers).set({ expiresAt: r.pendingExpiresAt }).where(eq(newsletterSubscribers.id, row.id)).returning()
      return { kind: "renewed", row: saved as SubscriberRow }
    }
    const [saved] = await tx
      .update(newsletterSubscribers)
      .set({ status: "pending", locale: r.locale, source: r.source, consentVersion: r.consentVersion, consentAt: r.at, confirmSentAt: null, confirmedAt: null, unsubscribedAt: null, expiresAt: r.pendingExpiresAt })
      .where(eq(newsletterSubscribers.id, row.id))
      .returning()
    return { kind: "renewed", row: saved as SubscriberRow }
  })
}

/** 확인 메일을 보낸 시각을 남긴다(쿨다운의 기준) */
export async function markNewsletterConfirmSent(d: Database, id: string, at: Date): Promise<void> {
  await d.update(newsletterSubscribers).set({ confirmSentAt: at }).where(eq(newsletterSubscribers.id, id))
}

export async function findSubscriberById(d: Database, id: string): Promise<SubscriberRow | undefined> {
  const [row] = await d.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, id))
  return row
}

export type ConfirmOutcome = { kind: "confirmed"; row: SubscriberRow } | { kind: "already"; row: SubscriberRow } | { kind: "withdrawn" } | { kind: "stale" }

/**
 * 확인 링크 처리. 링크가 실은 신청 시각(consentAt)이 행의 것과 같을 때만 구독으로 바꾼다(수신거부 뒤 다시 신청한 사람의 옛 링크를 막는다).
 * 이미 구독 중이면 already(두 번째 클릭), 수신거부한 사람이면 withdrawn, 행이 없거나 신청 시각이 다르면 stale.
 */
export async function confirmSubscriber(d: Database, o: { id: string; consentAt: Date; at: Date }): Promise<ConfirmOutcome> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, o.id)).for("update")
    if (!row) return { kind: "stale" }
    if (row.status === "unsubscribed") return { kind: "withdrawn" }
    if (row.consentAt.getTime() !== o.consentAt.getTime()) return { kind: "stale" }
    if (row.status === "subscribed") return { kind: "already", row }
    const [saved] = await tx.update(newsletterSubscribers).set({ status: "subscribed", confirmedAt: o.at, expiresAt: null }).where(eq(newsletterSubscribers.id, row.id)).returning()
    return { kind: "confirmed", row: saved as SubscriberRow }
  })
}

export type UnsubscribeOutcome = { kind: "unsubscribed"; row: SubscriberRow } | { kind: "already"; row: SubscriberRow } | { kind: "missing" }

/** 수신거부. 대기·구독 어느 쪽이든 철회로 바꾸고 기록 보유 기간(expiresAt)을 둔다. 이미 철회면 already(아무것도 안 바뀐다) */
export async function unsubscribeSubscriber(d: Database, o: { id: string; at: Date; expiresAt: Date }): Promise<UnsubscribeOutcome> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, o.id)).for("update")
    if (!row) return { kind: "missing" }
    if (row.status === "unsubscribed") return { kind: "already", row }
    const [saved] = await tx.update(newsletterSubscribers).set({ status: "unsubscribed", unsubscribedAt: o.at, expiresAt: o.expiresAt }).where(eq(newsletterSubscribers.id, row.id)).returning()
    return { kind: "unsubscribed", row: saved as SubscriberRow }
  })
}

/** 구독 중인 사람을 id 순으로 한 쪽 읽는다(내보내기용 — 커서는 마지막 id). 한 건 더 읽어 다음 쪽이 있는지 안다 */
export async function listSubscribedPage(d: Database, o: { after?: string; limit: number }): Promise<{ rows: SubscriberRow[]; next: string | null }> {
  const where = o.after ? and(eq(newsletterSubscribers.status, "subscribed"), gt(newsletterSubscribers.id, o.after)) : eq(newsletterSubscribers.status, "subscribed")
  const rows = await d.select().from(newsletterSubscribers).where(where).orderBy(asc(newsletterSubscribers.id)).limit(o.limit + 1)
  const page = rows.slice(0, o.limit)
  return { rows: page, next: rows.length > o.limit ? (page.at(-1)?.id ?? null) : null }
}

/** 기한이 지난 대기 신청·수신거부 기록을 지운다(Cron). 구독 중인 사람(expires_at 없음)은 지우지 않는다. 지운 수를 돌려준다 */
export async function purgeExpiredSubscribers(d: Database, now: Date): Promise<number> {
  const rows = await d
    .delete(newsletterSubscribers)
    .where(and(isNotNull(newsletterSubscribers.expiresAt), lt(newsletterSubscribers.expiresAt, now)))
    .returning({ id: newsletterSubscribers.id })
  return rows.length
}

/** 직원용 목록 질의: 상태·이메일 일부(대소문자 무시, % _ 는 글자 그대로)로 거르고 최근 신청 순으로 limit 줄(offset 줄은 건너뛴다 — 쪽 매김). total 은 거른 전체 건수 */
export async function listSubscribersForAdmin(d: Database, o: { status?: NewsletterStatus; search?: string; limit: number; offset?: number }): Promise<{ rows: SubscriberRow[]; total: number }> {
  const parts: SQL[] = []
  if (o.status) parts.push(eq(newsletterSubscribers.status, o.status))
  const search = o.search?.trim()
  if (search) parts.push(ilike(newsletterSubscribers.email, `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`))
  const where = parts.length ? and(...parts) : undefined
  const [{ n }] = await d.select({ n: count() }).from(newsletterSubscribers).where(where)
  const rows = await d.select().from(newsletterSubscribers).where(where).orderBy(desc(newsletterSubscribers.createdAt), desc(newsletterSubscribers.id)).limit(o.limit).offset(o.offset ?? 0)
  return { rows, total: n }
}
