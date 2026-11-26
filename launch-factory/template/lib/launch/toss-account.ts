// 토스가 꺼져 있어도 기존 원장은 삭제 확인 전까지 계정 파기를 막는다.
import { blockTossForDeletion, collectTossRetention, prepareTossDeletion, purgeTossData } from "@launch-factory/billing-toss"
import type { Database } from "@launch-factory/db"
import type { Purger, PurgePreparation, RetentionCollector } from "@launch-factory/account-lifecycle"
import { tossTestConnection, tossTestDatabase } from "./toss-test-db.ts"

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]
export const blockTossDeletion = async (tx: Tx, userId: string) => {
  try { await blockTossForDeletion(tossTestConnection(tx), userId) }
  catch { throw new Error("Toss deletion storage failure") }
}
/** 본인 요금제·금액·상태·기간만 선택한다. 결제 식별자와 암호문은 읽지 않는다. */
export async function exportTossData(db: Database, userId: string) {
  const rows = await tossTestDatabase(db).query<{ plan_id: string; amount: number; status: string; created_at: Date; period_start: Date | null; period_end: Date | null; cancel_at: Date | null; next_due_at: Date | null }>("SELECT plan_id,amount,status,created_at,period_start,period_end,cancel_at,next_due_at FROM toss_ledger_subscriptions WHERE user_id=$1 ORDER BY created_at,id", [userId])
  const iso = (date: Date | null) => date ? new Date(date).toISOString() : null
  return rows.rows.map((row) => ({ provider: "toss" as const, planId: row.plan_id, amount: row.amount, currency: "KRW" as const, status: row.status, createdAt: iso(row.created_at), currentPeriodStart: iso(row.period_start), currentPeriodEnd: iso(row.period_end), cancelAt: iso(row.cancel_at), nextDueAt: iso(row.next_due_at) }))
}
export const tossCollector: RetentionCollector = (tx, ctx) => collectTossRetention(tossTestConnection(tx), ctx.userId, ctx.now)
export const tossPurger: Purger = (tx, ctx) => purgeTossData(tossTestConnection(tx), ctx.userId)

export async function prepareTossPurge(db: Database, userId: string): Promise<PurgePreparation> {
  try {
    const adapter = tossTestDatabase(db)
    if ((await adapter.query("SELECT 1 FROM toss_registration_sessions WHERE user_id=$1 AND status IN ('issuing','cancel_requested') LIMIT 1", [userId])).rows.length) return "registration_unresolved"
    const unsafe = await adapter.query<{ product_id: string }>("SELECT DISTINCT s.product_id FROM toss_ledger_subscriptions s WHERE s.user_id=$1 AND (s.status<>'canceled' OR s.encrypted_billing_key IS NOT NULL OR EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight'))", [userId])
    if (!unsafe.rows.length) return "ready"
    const { tossTestService } = await import("./toss-test.ts")
    const service = await tossTestService()
    if (!service || unsafe.rows.some((row) => row.product_id !== service.productId)) return "provider_unavailable"
    return prepareTossDeletion(adapter, service.ledger, userId)
  } catch { return "storage_unavailable" }
}
