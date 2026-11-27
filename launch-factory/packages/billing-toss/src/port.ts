// 시험 전용 BillingPort. 사용자와 상품 범위는 서버 조립자가 고른다.
import type { ActionResult, BillingPort, Plan, Subscription } from "@launch-factory/contract"
import { messages } from "@launch-factory/i18n"
import { lockBillingUser, type LedgerDatabase, type SqlConnection, type createTestTossLedger } from "./ledger.ts"

type HoldReason = "legacy_paid" | "overdue" | "credential_unavailable"
type TestDetail = { phase: "none" | "registering" | "registered_unpaid" | "payment_pending" | "cancel_pending" | "active" | "canceled" | "expired"; registered: boolean; paymentPending: boolean; cancelPending: boolean; scheduleHoldReason: HoldReason | null; paymentDeclined: boolean; retryAt: string | null; retryLimitReached: boolean; canChargeInitial: boolean; canCancelPeriod: boolean; amount?: number; subscription: Subscription }
type Row = { id: string; plan_id: string; amount: number; status: string; cancel_at: Date | string | null; period_end: Date | string | null; current: boolean; paid: boolean; pending: boolean; canceled_due: boolean; schedule_hold_reason: HoldReason | null; retry_count: number; retry_at: Date | string | null; retry_ready: boolean }
const copy = messages("ko").tossTest
const failure = (code: string, formError: string, retryable = false) => ({ ok: false as const, code, formError, retryable })
const unavailable = () => failure("provider_unavailable", copy.unavailable, true)
const unsupported = async () => failure("provider_unsupported", copy.unsupported)
const safeId = (value: string) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value)

export function createTestTossBilling(options: { db: LedgerDatabase; ledger: ReturnType<typeof createTestTossLedger>; productId: string; plan: Plan; origin: string }) {
  const origin = new URL(options.origin)
  const p = options.plan
  if (!safeId(options.productId) || !safeId(p.id) || typeof p.name !== "string" || !p.name.trim() || p.interval !== "month" || (p.trialDays ?? 0) !== 0 || !Array.isArray(p.features) || p.features.some((f) => typeof f !== "string") || p.price.currency !== "KRW" || typeof p.price.vatIncluded !== "boolean" || !Number.isSafeInteger(p.price.amount) || p.price.amount < 1 || p.price.amount > 2147483647 || origin.protocol !== "https:" || origin.origin !== options.origin || origin.username || origin.password) throw new Error("Invalid test billing configuration")
  const plan: Plan = { ...p, price: { ...p.price }, features: [...p.features] }
  const { db, ledger, productId } = options
  function port(userId: string): BillingPort & { detail(): Promise<ActionResult<TestDetail>>; reconcile(): Promise<ActionResult<TestDetail>> } {
    async function allowed(): Promise<boolean> {
      if (!safeId(userId)) return false
      return (await db.query("SELECT id FROM \"user\" u WHERE u.id=$1 AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id=u.id AND d.status IN ('pending','purging'))", [userId])).rows.length === 1
    }
    async function current(connection: SqlConnection): Promise<Row | undefined> {
      return (await connection.query<Row>("SELECT s.id,s.plan_id,s.amount,s.status,s.cancel_at,s.period_end,s.schedule_hold_reason,s.retry_count,s.retry_at,(s.retry_at IS NULL OR s.retry_at<=now()) AS retry_ready,(s.period_start<=now() AND s.period_end>now()) AS current,(s.cancel_at<=now()) AS canceled_due,EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='paid' AND c.amount=s.amount) AS paid,EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight') AS pending FROM toss_ledger_subscriptions s WHERE s.user_id=$1 AND s.product_id=$2 ORDER BY (s.status IN ('enabled','cancel_requested')) DESC,s.created_at DESC,s.id DESC LIMIT 1", [userId, productId])).rows[0]
    }
    async function detail(): Promise<ActionResult<TestDetail>> {
      try {
        return await db.transaction(async (tx) => {
          if (!(await lockBillingUser(tx, userId))) return failure("sign_in_required", copy.signIn)
          const row = await current(tx)
          const registering = (await tx.query("SELECT 1 FROM toss_registration_sessions WHERE user_id=$1 AND product_id=$2 AND (status IN ('issuing','cancel_requested') OR (status='pending' AND expires_at>now())) LIMIT 1", [userId, productId])).rows.length > 0
          if (registering || !row) return { ok: true, data: { phase: registering ? "registering" : "none", registered: false, paymentPending: false, cancelPending: false, scheduleHoldReason: null, paymentDeclined: false, retryAt: null, retryLimitReached: false, canChargeInitial: false, canCancelPeriod: false, subscription: { planId: null, status: "none" } } }
          const cancelPending = row.pending && (row.status === "cancel_requested" || (row.status === "enabled" && row.cancel_at !== null))
          // 확정되지 않은 갱신에 기간 끝 해지를 요청한 경우 해지 완료로 단정하지 않는다.
          const canceled = row.status !== "enabled" || (row.canceled_due && !cancelPending)
          const active = !canceled && row.paid && row.current && row.plan_id === plan.id
          const expired = !canceled && row.paid && !row.current
          const subscription: Subscription = active ? { planId: row.plan_id, status: "active", currentPeriodEnd: new Date(row.period_end as Date).toISOString(), ...(row.cancel_at ? { cancelAt: new Date(row.cancel_at).toISOString() } : {}) } : canceled ? { planId: row.plan_id, status: "canceled" } : expired ? { planId: row.plan_id, status: "expired" } : { planId: null, status: "none" }
          const phase = cancelPending ? "cancel_pending" : row.pending ? "payment_pending" : active ? "active" : canceled ? "canceled" : expired ? "expired" : "registered_unpaid"
          const paymentDeclined = !row.pending && row.retry_count > 0
          const canChargeInitial = phase === "registered_unpaid" && !row.schedule_hold_reason && row.retry_count < 3 && row.retry_ready
          const canCancelPeriod = row.status === "enabled" && row.paid && row.period_end !== null && row.cancel_at === null
          return { ok: true as const, data: { phase, registered: row.status === "enabled" && !row.canceled_due, paymentPending: row.pending, cancelPending, scheduleHoldReason: row.schedule_hold_reason, paymentDeclined, retryAt: paymentDeclined && row.status === "enabled" && !row.cancel_at && !row.schedule_hold_reason && row.retry_at ? new Date(row.retry_at).toISOString() : null, retryLimitReached: paymentDeclined && row.retry_count >= 3, canChargeInitial, canCancelPeriod, amount: row.amount, subscription } }
        })
      } catch { return unavailable() }
    }
    async function subscription(): Promise<ActionResult<Subscription>> {
      const result = await detail()
      return result.ok ? { ok: true, data: result.data.subscription } : result
    }
    async function reconcile(): Promise<ActionResult<TestDetail>> {
      try {
        const selected = await db.transaction(async (tx) => {
          if (!(await lockBillingUser(tx, userId))) return "unauthorized" as const
          const row = await current(tx)
          if (!row?.pending) return null
          const charge = (await tx.query<{ billing_month: string }>("SELECT billing_month FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight'", [row.id])).rows[0]
          return charge ? { id: row.id, month: charge.billing_month } : null
        })
        if (selected === "unauthorized") return failure("sign_in_required", copy.signIn)
        if (!selected) return failure("invalid_state", copy.noPendingOrder)
        await ledger.reconcileMonth(selected.id, selected.month)
        return detail()
      } catch { return unavailable() }
    }
    const result: BillingPort & { detail: typeof detail; reconcile: typeof reconcile } = {
      async plans() { try { if (!(await allowed())) return failure("sign_in_required", copy.signIn); return { ok: true, data: [{ ...plan, price: { ...plan.price }, features: [...plan.features] }] } } catch { return unavailable() } },
      async checkout(input) {
        try {
          return await db.transaction(async (tx) => {
            if (!(await lockBillingUser(tx, userId))) return failure("sign_in_required", copy.signIn)
            if (!input || input.planId !== plan.id) return failure("invalid_input", copy.checkPlan)
            if (input.trial) return failure("trial_unavailable", copy.noTrial)
            const row = await current(tx)
            if ((await tx.query("SELECT 1 FROM toss_registration_sessions WHERE user_id=$1 AND product_id=$2 AND (status IN ('issuing','cancel_requested') OR (status='pending' AND expires_at>now())) LIMIT 1", [userId, productId])).rows.length) return failure("invalid_state", copy.checkRegistration)
            if (row && (row.pending || (row.status === "enabled" && !row.canceled_due))) return failure("invalid_state", copy.alreadyRegistered)
            return { ok: true as const, data: { redirectUrl: new URL("/account/billing/toss-test", origin).toString() } }
          })
        } catch { return unavailable() }
      },
      subscription, detail, reconcile,
      async cancel(input) {
        if (!input || input.confirmed !== true) return failure("confirmation_required", copy.confirmCancellation)
        if (input.when !== "now" && input.when !== "period_end") return failure("invalid_input", copy.checkCancellationTime)
        try {
          const changed = await db.transaction(async (tx) => {
            if (!(await lockBillingUser(tx, userId))) return false
            const row = (await tx.query<{ id: string; status: string; period_end: Date | string | null; paid: boolean; pending: boolean }>("SELECT s.id,s.status,s.period_end,EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='paid' AND c.amount=s.amount) AS paid,EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight') AS pending FROM toss_ledger_subscriptions s WHERE s.user_id=$1 AND s.product_id=$2 AND s.status IN ('enabled','cancel_requested') ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE", [userId, productId])).rows[0]
            if (!row) return false
            if (input.when === "period_end" && row.status === "enabled" && row.paid && row.period_end) {
              await tx.query("UPDATE toss_ledger_subscriptions SET cancel_at=period_end,next_due_at=CASE WHEN $2 THEN next_due_at ELSE NULL END WHERE id=$1", [row.id, row.pending])
            } else {
              await tx.query("UPDATE toss_ledger_subscriptions SET status=$2,cancel_at=NULL,next_due_at=CASE WHEN $3 THEN next_due_at ELSE NULL END WHERE id=$1", [row.id, row.pending ? "cancel_requested" : "canceled", row.pending])
            }
            return true
          })
          return changed ? subscription() : failure("invalid_state", copy.nothingToCancel)
        } catch { return unavailable() }
      },
      changePlan: unsupported, pause: unsupported, resume: unsupported, updatePaymentMethod: unsupported, portal: unsupported, acceptPriceChange: unsupported, applyRetentionOffer: unsupported,
    }
    return result
  }
  return { port }
}
