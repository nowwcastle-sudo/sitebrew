// 후기·상품 문의 저장·조회(계획 3c Task 1). 검사·마스킹·점수 계산은 @launch-factory/reviews 가 하고, 여기는 표를 읽고 쓰기만 한다.
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { adminActions, reviews, type ReviewKind, type ReviewStatus } from "./schema.ts"

export type NewReview = Omit<typeof reviews.$inferInsert, "id" | "verified" | "answerBody" | "answeredAt" | "answeredBy" | "hiddenReason">
export type ReviewRow = typeof reviews.$inferSelect

export type ReviewSort = "latest" | "rating-desc" | "rating-asc"
export interface Subject {
  subjectType: string
  subjectId: string
}

export async function insertReview(d: Database, row: NewReview): Promise<ReviewRow> {
  const [saved] = await d.insert(reviews).values(row).returning()
  return saved as ReviewRow
}

/** 한 사람이 같은 대상에 쓴 후기(있으면). 상태와 상관없다 — 숨긴 후기가 있어도 다시 쓰지 못한다 */
export async function findUserReview(d: Database, userId: string, s: Subject): Promise<ReviewRow | undefined> {
  const [row] = await d
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.kind, "review"), eq(reviews.subjectType, s.subjectType), eq(reviews.subjectId, s.subjectId)))
    .limit(1)
  return row
}

export async function getReview(d: Database, id: string): Promise<ReviewRow | undefined> {
  const [row] = await d.select().from(reviews).where(eq(reviews.id, id)).limit(1)
  return row
}

const ORDER: Record<ReviewSort, ReturnType<typeof desc>[]> = {
  latest: [desc(reviews.createdAt), desc(reviews.id)],
  "rating-desc": [desc(reviews.rating), desc(reviews.createdAt), desc(reviews.id)],
  "rating-asc": [asc(reviews.rating), desc(reviews.createdAt), desc(reviews.id)],
}

export interface ListQuery extends Subject {
  kind: ReviewKind
  status?: ReviewStatus
  sort: ReviewSort
  rating?: number
  limit: number
  offset: number
}

/** 대상 하나의 글 목록(기본: 게시된 것만) + 조건에 맞는 전체 수 */
export async function listReviews(d: Database, q: ListQuery): Promise<{ rows: ReviewRow[]; total: number }> {
  const where = and(
    eq(reviews.subjectType, q.subjectType),
    eq(reviews.subjectId, q.subjectId),
    eq(reviews.kind, q.kind),
    eq(reviews.status, q.status ?? "published"),
    q.rating !== undefined ? eq(reviews.rating, q.rating) : undefined,
  )
  const rows = await d.select().from(reviews).where(where).orderBy(...ORDER[q.sort]).limit(q.limit).offset(q.offset)
  const [c] = await d.select({ n: sql<number>`count(*)::int` }).from(reviews).where(where)
  return { rows, total: c?.n ?? 0 }
}

/** 게시된 후기의 별점별 수와 가장 늦게 바뀐 시각 — 요약(평균·분포)의 재료 */
export async function ratingCounts(d: Database, s: Subject): Promise<{ counts: { rating: number; count: number }[]; latest: Date | null }> {
  const where = and(eq(reviews.subjectType, s.subjectType), eq(reviews.subjectId, s.subjectId), eq(reviews.kind, "review"), eq(reviews.status, "published"))
  const counts = await d
    .select({ rating: sql<number>`${reviews.rating}`, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(where)
    .groupBy(reviews.rating)
  const [m] = await d.select({ latest: sql<Date | null>`max(${reviews.updatedAt})` }).from(reviews).where(where)
  return { counts, latest: m?.latest ? new Date(m.latest) : null }
}

export interface ModerationQuery {
  status?: ReviewStatus
  kind?: ReviewKind
  subjectType?: string
  subjectId?: string
  /** 제목·본문·작성자 이름에서 찾는다(대소문자 무시) */
  search?: string
  limit: number
  offset: number
}

/** LIKE 의 와일드카드를 글자 그대로 찾게 한다 */
const likeLiteral = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

/** 관리 목록: 상태와 상관없이 최근 순. 사용자 id 는 싣지 않는다 */
export async function listReviewsForModeration(d: Database, q: ModerationQuery): Promise<{ rows: Omit<ReviewRow, "userId" | "answeredBy">[]; total: number }> {
  const where = and(
    q.status ? eq(reviews.status, q.status) : undefined,
    q.kind ? eq(reviews.kind, q.kind) : undefined,
    q.subjectType ? eq(reviews.subjectType, q.subjectType) : undefined,
    q.subjectId ? eq(reviews.subjectId, q.subjectId) : undefined,
    q.search?.trim() ? or(...[reviews.title, reviews.body, reviews.authorName].map((c) => ilike(c, `%${likeLiteral((q.search as string).trim())}%`))) : undefined,
  )
  const rows = await d.select().from(reviews).where(where).orderBy(desc(reviews.createdAt), desc(reviews.id)).limit(q.limit).offset(q.offset)
  const [c] = await d.select({ n: sql<number>`count(*)::int` }).from(reviews).where(where)
  return {
    rows: rows.map((r) => {
      const rest: Partial<typeof r> = { ...r }
      delete rest.userId
      delete rest.answeredBy
      return rest as Omit<typeof r, "userId" | "answeredBy">
    }),
    total: c?.n ?? 0,
  }
}

/** 답변을 단다(다시 달면 바꾼다). 없는 글이면 undefined */
export async function setReviewAnswer(d: Database, id: string, o: { body: string; by: string; at: Date }): Promise<ReviewRow | undefined> {
  const [row] = await d.update(reviews).set({ answerBody: o.body, answeredBy: o.by, answeredAt: o.at, updatedAt: o.at }).where(eq(reviews.id, id)).returning()
  return row
}

export type ReviewStatusChange = { ok: true; changed: boolean; from: ReviewStatus; to: ReviewStatus } | { ok: false; error: "not_found" }

/**
 * 게시 상태를 바꾼다. 읽기·수정·admin_actions 기록이 한 트랜잭션이다. 같은 상태면 아무것도 쓰지 않는다(기록도 없다).
 * 숨기면 사유를 적고, 다시 게시하면 사유를 비운다. 기록에는 글 내용을 싣지 않는다.
 */
export async function changeReviewStatus(d: Database, o: { id: string; to: ReviewStatus; reason?: string; adminUserId: string; at: Date }): Promise<ReviewStatusChange> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(reviews).where(eq(reviews.id, o.id)).for("update")
    if (!row) return { ok: false, error: "not_found" }
    if (row.status === o.to) return { ok: true, changed: false, from: row.status, to: o.to }
    await tx
      .update(reviews)
      .set({ status: o.to, hiddenReason: o.to === "hidden" ? (o.reason ?? null) : null, updatedAt: o.at })
      .where(eq(reviews.id, o.id))
    await tx.insert(adminActions).values({
      adminUserId: o.adminUserId,
      action: "review_status_change",
      targetUserId: row.userId,
      reason: o.reason ?? null,
      meta: { reviewId: row.id, kind: row.kind, subjectType: row.subjectType, subjectId: row.subjectId, from: row.status, to: o.to },
      occurredAt: o.at,
    })
    return { ok: true, changed: true, from: row.status, to: o.to }
  })
}

/**
 * 탈퇴한 사용자의 글에서 사용자 연결을 끊고 작성자 이름을 바꾼다(locale 을 주면 그 언어의 글만). 바꾼 수를 돌려준다.
 * 파기 트랜잭션 안(Purger 의 tx)에서도 그대로 부를 수 있다.
 */
export async function anonymizeReviewsOf(d: Database, userId: string, o: { authorName: string; locale?: string; at: Date }): Promise<number> {
  const rows = await d
    .update(reviews)
    .set({ authorName: o.authorName, userId: null, updatedAt: o.at })
    .where(and(eq(reviews.userId, userId), o.locale ? eq(reviews.locale, o.locale) : undefined))
    .returning({ id: reviews.id })
  return rows.length
}
