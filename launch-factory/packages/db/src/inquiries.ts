// 문의 저장·파기(v0 Task 15, 대장 D97). 검사·알림은 @launch-factory/inquiry 가 한다.
import { eq, lt } from "drizzle-orm"
import type { Database } from "./client.ts"
import { adminActions, inquiries, type InquiryKind } from "./schema.ts"

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
