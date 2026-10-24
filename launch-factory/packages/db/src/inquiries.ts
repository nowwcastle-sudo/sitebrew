// 문의 저장·파기(v0 Task 15, 대장 D97). 검사·알림은 @launch-factory/inquiry 가 한다.
import { and, asc, count, desc, eq, ilike, lt, or, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { adminActions, inquiries, inquiryReplies, type InquiryKind, type InquiryStatus } from "./schema.ts"

export type NewInquiry = Omit<typeof inquiries.$inferInsert, "id" | "ownerNotifiedAt" | "receiptSentAt">
export type InquiryRow = typeof inquiries.$inferSelect

export async function insertInquiry(d: Database, row: NewInquiry): Promise<InquiryRow> {
  const [saved] = await d.insert(inquiries).values(row).returning()
  return saved as InquiryRow
}

export async function markInquiry(d: Database, id: string, set: { ownerNotifiedAt?: Date; receiptSentAt?: Date }): Promise<void> {
  await d.update(inquiries).set(set).where(eq(inquiries.id, id))
}

/** 보유 기간이 지난 문의를 지운다(개인정보 보호법 제21조①, Cron). 지운 수를 돌려준다 */
export async function purgeExpiredInquiries(d: Database, now: Date): Promise<number> {
  const rows = await d.delete(inquiries).where(lt(inquiries.expiresAt, now)).returning({ id: inquiries.id })
  return rows.length
}

export type KindPlan = { ok: true; expiresAt: Date } | { ok: false; error: string }
export type KindChange =
  | { ok: true; changed: boolean; kind: InquiryKind; expiresAt: Date }
  | { ok: false; error: string }

/**
 * 문의 종류를 바꾸고 보유 기간(expires_at)을 다시 정한다(D134). 읽기·판단·수정·admin_actions 기록이 한 트랜잭션이다.
 * `plan` 은 잠근 행(`for update`)을 보고 허용 여부와 새 만료 시각을 정한다 — 동시에 두 관리자가 바꿔도 판단이 같은 행 값 위에서 이뤄진다.
 * 종류가 그대로면 아무것도 쓰지 않는다(기록도 없다). 기록에는 연락처·내용을 싣지 않는다.
 */
export async function changeInquiryKind(
  d: Database,
  o: { reference: string; to: InquiryKind; plan: (row: InquiryRow) => KindPlan; adminUserId: string; reason?: string; at?: Date },
): Promise<KindChange> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(inquiries).where(eq(inquiries.reference, o.reference)).for("update")
    if (!row) return { ok: false, error: "not_found" }
    const plan = o.plan(row)
    if (!plan.ok) return plan
    if (row.kind === o.to) return { ok: true, changed: false, kind: row.kind, expiresAt: row.expiresAt }
    await tx.update(inquiries).set({ kind: o.to, expiresAt: plan.expiresAt }).where(eq(inquiries.id, row.id))
    await tx.insert(adminActions).values({
      adminUserId: o.adminUserId,
      action: "inquiry_kind_change",
      targetUserId: row.userId,
      reason: o.reason ?? null,
      meta: { inquiryId: row.id, reference: row.reference, from: row.kind, to: o.to, expiresFrom: row.expiresAt.toISOString(), expiresTo: plan.expiresAt.toISOString() },
      ...(o.at ? { occurredAt: o.at } : {}),
    })
    return { ok: true, changed: true, kind: o.to, expiresAt: plan.expiresAt }
  })
}

/** 내 신청 내역 한 줄 — 내용은 앞부분만(`preview`), 연락처는 서비스가 가리도록 그대로 준다. 이름·전체 내용·사용자 id 는 읽지 않는다 */
export type MyInquiryRow = Pick<InquiryRow, "reference" | "kind" | "status" | "contact" | "contactKind" | "createdAt"> & { preview: string }

/** 이 사용자의 문의를 최신 순으로. 내용은 DB 에서 앞 200자만 읽는다(전체 내용이 서버 메모리에도 올라오지 않게) */
export async function listInquiriesByUser(d: Database, userId: string, o: { limit: number; offset: number }): Promise<{ rows: MyInquiryRow[]; total: number }> {
  const own = eq(inquiries.userId, userId)
  const [{ total } = { total: 0 }] = await d.select({ total: count() }).from(inquiries).where(own)
  const rows = await d
    .select({ reference: inquiries.reference, kind: inquiries.kind, status: inquiries.status, contact: inquiries.contact, contactKind: inquiries.contactKind, createdAt: inquiries.createdAt, preview: sql<string>`left(${inquiries.message}, 200)` })
    .from(inquiries)
    .where(own)
    .orderBy(desc(inquiries.createdAt), desc(inquiries.reference))
    .limit(o.limit)
    .offset(o.offset)
  return { rows, total }
}

export type StatusChange = { ok: true; changed: boolean; status: InquiryStatus } | { ok: false; error: string }

/**
 * 문의 처리 상태를 바꾼다. 누가 바꿀 수 있는지는 부르는 쪽(inquiry 서비스)이 이미 판정했다. 읽기·판단·수정·admin_actions 기록이 한 트랜잭션이다. 상태가 그대로면 아무것도 쓰지 않는다.
 * 기록에는 연락처·내용을 싣지 않는다. `allowed` 는 부르는 쪽이 정한 권한 판정(서비스가 행위자를 본다).
 */
export async function setInquiryStatus(d: Database, o: { reference: string; to: InquiryStatus; adminUserId: string; reason?: string; at?: Date }): Promise<StatusChange> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(inquiries).where(eq(inquiries.reference, o.reference)).for("update")
    if (!row) return { ok: false, error: "not_found" }
    if (row.status === o.to) return { ok: true, changed: false, status: row.status }
    await tx.update(inquiries).set({ status: o.to }).where(eq(inquiries.id, row.id))
    await tx.insert(adminActions).values({
      adminUserId: o.adminUserId,
      action: "inquiry_status_change",
      targetUserId: row.userId,
      reason: o.reason ?? null,
      meta: { inquiryId: row.id, reference: row.reference, from: row.status, to: o.to },
      ...(o.at ? { occurredAt: o.at } : {}),
    })
    return { ok: true, changed: true, status: o.to }
  })
}

// ── 직원용 읽기·답변(계획 3d 관리 화면) ─────────────────────────────────────────────────────────
// 누가 볼 수 있는지는 부르는 쪽(inquiry 서비스)이 이미 판정했다. 여기서는 표를 읽고 쓰기만 한다.

export type InquiryReplyRow = typeof inquiryReplies.$inferSelect

/** 직원 목록 한 줄 — 내용은 앞 120자만(전체 내용은 상세에서 읽는다) */
export type StaffInquiryRow = Pick<InquiryRow, "reference" | "kind" | "status" | "name" | "contact" | "contactKind" | "createdAt"> & { preview: string }

/** LIKE 의 와일드카드를 글자 그대로 찾게 한다 */
const likeLiteral = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

/** 직원 목록: 최신 순. status 로 거르고 search 는 접수 번호·이름·연락처에서 찾는다. offset 은 건너뛸 줄 수(쪽 매김) */
export async function listInquiriesForStaff(d: Database, o: { status?: InquiryStatus; search?: string; limit: number; offset?: number }): Promise<{ rows: StaffInquiryRow[]; total: number }> {
  const needle = o.search?.trim() ? `%${likeLiteral(o.search.trim())}%` : undefined
  const where = and(o.status ? eq(inquiries.status, o.status) : undefined, needle ? or(ilike(inquiries.reference, needle), ilike(inquiries.name, needle), ilike(inquiries.contact, needle)) : undefined)
  const [{ total } = { total: 0 }] = await d.select({ total: count() }).from(inquiries).where(where)
  const rows = await d
    .select({ reference: inquiries.reference, kind: inquiries.kind, status: inquiries.status, name: inquiries.name, contact: inquiries.contact, contactKind: inquiries.contactKind, createdAt: inquiries.createdAt, preview: sql<string>`left(${inquiries.message}, 120)` })
    .from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.createdAt), desc(inquiries.reference))
    .limit(o.limit)
    .offset(o.offset ?? 0)
  return { rows, total }
}

/** 문의 하나와 그 답변들(오래된 순 — 글타래). 없으면 undefined */
export async function getInquiryForStaff(d: Database, reference: string): Promise<{ inquiry: InquiryRow; replies: InquiryReplyRow[] } | undefined> {
  const [inquiry] = await d.select().from(inquiries).where(eq(inquiries.reference, reference)).limit(1)
  if (!inquiry) return undefined
  const replies = await d.select().from(inquiryReplies).where(eq(inquiryReplies.inquiryId, inquiry.id)).orderBy(asc(inquiryReplies.createdAt), asc(inquiryReplies.id))
  return { inquiry, replies }
}

/**
 * 답변을 남긴다. 읽기·저장·admin_actions 기록이 한 트랜잭션이다. 기록에는 답변 글·연락처를 싣지 않는다(문의 id·접수 번호·답변 id 만).
 * 돌려주는 inquiry 는 메일을 보낼 때 쓸 값이다.
 */
export async function addInquiryReply(
  d: Database,
  o: { reference: string; body: string; adminUserId: string; at: Date },
): Promise<{ ok: true; reply: InquiryReplyRow; inquiry: Pick<InquiryRow, "id" | "reference" | "contact" | "contactKind" | "locale"> } | { ok: false; error: "not_found" }> {
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(inquiries).where(eq(inquiries.reference, o.reference)).for("update")
    if (!row) return { ok: false, error: "not_found" }
    const [reply] = await tx.insert(inquiryReplies).values({ inquiryId: row.id, body: o.body, adminUserId: o.adminUserId, createdAt: o.at }).returning()
    await tx.insert(adminActions).values({
      adminUserId: o.adminUserId,
      action: "inquiry_reply",
      targetUserId: row.userId,
      meta: { inquiryId: row.id, reference: row.reference, replyId: (reply as InquiryReplyRow).id },
      occurredAt: o.at,
    })
    return { ok: true, reply: reply as InquiryReplyRow, inquiry: { id: row.id, reference: row.reference, contact: row.contact, contactKind: row.contactKind, locale: row.locale } }
  })
}

/** 답변 메일이 나갔다고 적는다 */
export async function markInquiryReplyMailed(d: Database, id: string, at: Date): Promise<void> {
  await d.update(inquiryReplies).set({ mailedAt: at }).where(eq(inquiryReplies.id, id))
}
