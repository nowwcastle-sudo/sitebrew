import type { LedgerDatabase, SqlConnection, createTestTossLedger } from "./ledger.ts"

/** 호출자는 같은 트랜잭션에서 사용자 행을 먼저 FOR UPDATE 해야 한다. 외부 API 호출은 없다. */
export async function blockTossForDeletion(tx: SqlConnection, userId: string): Promise<void> {
  await tx.query("UPDATE toss_registration_sessions SET status=CASE WHEN status='issuing' THEN 'cancel_requested' ELSE 'canceled' END WHERE user_id=$1 AND status IN ('pending','issuing')", [userId])
  await tx.query("UPDATE toss_ledger_subscriptions s SET status=CASE WHEN EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight') THEN 'cancel_requested' ELSE 'canceled' END, next_due_at=CASE WHEN EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight') THEN s.next_due_at ELSE NULL END WHERE s.user_id=$1 AND s.status IN ('enabled','cancel_requested')", [userId])
}

/** 미확정 발급·승인·삭제는 그대로 보류한다. 제공자 호출 시 DB 잠금은 잡지 않는다. */
export type TossDeletionPreparation = "ready" | "registration_unresolved" | "charge_unresolved" | "billing_key_delete_unresolved" | "storage_unavailable"
export async function prepareTossDeletion(db: LedgerDatabase, ledger: ReturnType<typeof createTestTossLedger>, userId: string): Promise<TossDeletionPreparation> {
  try {
    const issuing = await db.query("SELECT id FROM toss_registration_sessions WHERE user_id=$1 AND status IN ('issuing','cancel_requested') LIMIT 1", [userId])
    if (issuing.rows.length) return "registration_unresolved"
    const subs = await db.query<{ id: string }>("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1 ORDER BY id", [userId])
    for (const sub of subs.rows) {
      await ledger.cancel(sub.id)
      const pending = await db.query<{ billing_month: string }>("SELECT billing_month FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight'", [sub.id])
      for (const row of pending.rows) if (await ledger.reconcileMonth(sub.id, row.billing_month) !== "paid") return "charge_unresolved"
      if (await ledger.cancel(sub.id) !== "canceled") return "charge_unresolved"
      const credential = (await db.query<{ encrypted_billing_key: string | null }>("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1 AND user_id=$2", [sub.id, userId])).rows[0]
      if (!credential) return "storage_unavailable"
      if (credential.encrypted_billing_key && await ledger.deleteCredential(sub.id) !== "deleted") return "billing_key_delete_unresolved"
    }
    return "ready"
  } catch { return "storage_unavailable" }
}

/** 개인정보·고객키·빌링키 없이 계약과 확인된 결제의 보존 항목을 만든다. */
export async function collectTossRetention(tx: SqlConnection, userId: string, now: Date) {
  const subs = await tx.query<{ id: string; plan_id: string; amount: number; status: string }>("SELECT s.id,s.plan_id,s.amount,s.status FROM toss_ledger_subscriptions s WHERE s.user_id=$1 AND EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='paid' AND c.amount=s.amount)", [userId])
  const payments = await tx.query<{ order_id: string; amount: number; paid_at: Date }>("SELECT c.order_id,c.amount,c.paid_at FROM toss_ledger_charges c JOIN toss_ledger_subscriptions s ON s.id=c.subscription_id WHERE s.user_id=$1 AND c.status='paid'", [userId])
  return [
    ...subs.rows.map((row) => ({ kind: "contract" as const, provider: "toss", providerRef: row.id, occurredAt: now, record: { type: "subscription", planId: row.plan_id, amount: row.amount, statusAtDeletion: row.status } })),
    ...payments.rows.map((row) => ({ kind: "payment" as const, provider: "toss", providerRef: row.order_id, occurredAt: new Date(row.paid_at), record: { type: "payment", amount: row.amount, currency: "KRW" } })),
  ]
}

/** 제공자 삭제 확인과 보존 수집 뒤 같은 DB 트랜잭션에서만 개인 원장을 제거한다. */
export async function purgeTossData(tx: SqlConnection, userId: string): Promise<void> {
  const unsafe = await tx.query("SELECT 1 FROM toss_registration_sessions WHERE user_id=$1 AND status IN ('issuing','cancel_requested') UNION ALL SELECT 1 FROM toss_ledger_subscriptions s WHERE s.user_id=$1 AND (s.status<>'canceled' OR s.encrypted_billing_key IS NOT NULL OR EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight')) LIMIT 1", [userId])
  if (unsafe.rows.length) throw new Error("Toss cleanup unresolved")
  await tx.query("DELETE FROM toss_ledger_charges WHERE subscription_id IN (SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1)", [userId])
  await tx.query("DELETE FROM toss_ledger_subscriptions WHERE user_id=$1", [userId])
  await tx.query("DELETE FROM toss_registration_sessions WHERE user_id=$1", [userId])
  await tx.query("DELETE FROM toss_registration_identities WHERE user_id=$1", [userId])
}
