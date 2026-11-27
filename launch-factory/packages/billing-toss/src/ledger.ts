// 서버 전용 시험 원장. 각 트랜잭션은 DB 작업만 수행하며 결제사 호출 전 종료된다.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto"
import { testMerchant, TossCardDeclined, type createTestTossClient, type TossPayment } from "./test-client.ts"

export interface SqlConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}
export interface LedgerDatabase extends SqlConnection {
  transaction<T>(run: (tx: SqlConnection) => Promise<T>): Promise<T>
}
/** 잠금 순서: 사용자 → 등록 식별자/세션 또는 구독 → 청구. READ COMMITTED 트랜잭션 안에서만 호출한다. */
export async function lockBillingUser(tx: SqlConnection, userId: string): Promise<boolean> {
  if (!(await tx.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId])).rows.length) return false
  return !(await tx.query("SELECT 1 FROM account_deletions WHERE user_id=$1 AND status IN ('pending','purging') LIMIT 1", [userId])).rows.length
}
export interface NewTestSubscription {
  id: string
  userId: string
  customerKey: string
  billingKey: string
  planId: string
  productId?: string
  orderName: string
  amount: number
}
type SubscriptionRow = { user_id: string; status: string; cancel_at: Date | null; customer_key: string; encrypted_billing_key: string | null; order_name: string; amount: number }
type ChargeRow = { order_id: string; amount: number; status: string }
type Claim = { orderId: string; amount: number; customerKey: string; billingKey: string; orderName: string }
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const customerPattern = /^[A-Za-z0-9_=.@-]{22,50}$/
const safeId = (s: string) => typeof s === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(s)
const safeKey = (s: string) => typeof s === "string" && s.length > 0 && s.length <= 200 && s !== "." && s !== ".." && !Array.from(s).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)

/** UTC 기준 최초 승인 일자를 유지하고 대상 월에 그 날짜가 없으면 그 달 마지막 날을 쓴다. */
export function nextMonthlyBoundary(anchor: Date, current: Date): Date {
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(current.getTime())) throw new Error("Invalid billing date")
  const year = current.getUTCFullYear(), month = current.getUTCMonth() + 1
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), endOfMonth), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()))
}

/** 32-byte 원본 키는 서버 비밀 저장소에서 주입한다. 키 자체·평문은 저장하거나 기록하지 않는다. */
export function sealBillingKey(key: Buffer, merchantId: string, subscriptionId: string, value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(Buffer.from(JSON.stringify(["test", merchantId, subscriptionId]), "utf8"))
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".")
}
function unseal(key: Buffer, merchantId: string, subscriptionId: string, value: string): string {
  try {
    const [version, iv, tag, bytes, extra] = value.split(".")
    if (version !== "v1" || !iv || !tag || !bytes || extra !== undefined) throw new Error()
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
    decipher.setAAD(Buffer.from(JSON.stringify(["test", merchantId, subscriptionId]), "utf8"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8")
    if (!safeKey(plaintext)) throw new Error()
    return plaintext
  } catch { throw new Error("Toss credential unavailable") }
}

/** 반환값에는 고객 키·빌링키가 없다. DB 예외 메시지에 SQL 매개변수가 포함될 수 있어 바깥으로 전파하지 않는다. */
export function createTestTossLedger(options: { db: LedgerDatabase; encryptionKey: Buffer; client: ReturnType<typeof createTestTossClient> }) {
  const merchant = testMerchant(options.client)
  if (!Buffer.isBuffer(options.encryptionKey) || options.encryptionKey.length !== 32 || !merchant) throw new Error("Invalid test ledger configuration")
  const merchantId: string = merchant
  const key = Buffer.from(options.encryptionKey)
  const { db, client } = options
  const storage = async <T>(run: () => Promise<T>): Promise<T> => {
    try { return await run() } catch { throw new Error("Toss ledger storage failure") }
  }

  async function createSubscription(input: NewTestSubscription): Promise<void> {
    if (!safeId(input.id) || !safeId(input.userId) || !safeId(input.planId) || !safeId(input.productId ?? input.planId) || !customerPattern.test(input.customerKey) || !safeKey(input.billingKey) ||
      typeof input.orderName !== "string" || !input.orderName.trim() || input.orderName.length > 100 || !safeKey(input.orderName) || !Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > 2147483647) throw new Error("Invalid subscription")
    const ciphertext = sealBillingKey(key, merchantId, input.id, input.billingKey)
    await storage(() => db.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,encrypted_billing_key,plan_id,order_name,amount,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enabled')", [input.id, input.userId, input.productId ?? input.planId, input.customerKey, ciphertext, input.planId, input.orderName, input.amount]))
  }

  // 구독 행을 잠깐 잠가 해지와 월별 최초 예약을 직렬화한다. 실패·시간 초과 후 이 행을 자동 삭제하거나 재승인하지 않는다.
  async function claim(subscriptionId: string, month: string | null, initialUserId?: string): Promise<Claim | null> {
    return storage(() => db.transaction(async (tx) => {
      const owner = (await tx.query<{ user_id: string }>("SELECT user_id FROM toss_ledger_subscriptions WHERE id=$1", [subscriptionId])).rows[0]
      if (!owner || !(await lockBillingUser(tx, owner.user_id))) return null
      const sub = (await tx.query<SubscriptionRow>("SELECT user_id,status,cancel_at,customer_key,encrypted_billing_key,order_name,amount FROM toss_ledger_subscriptions WHERE id=$1 FOR UPDATE", [subscriptionId])).rows[0]
      if (!sub || sub.user_id !== owner.user_id || sub.status !== "enabled" || sub.cancel_at || !sub.encrypted_billing_key) return null
      if (initialUserId) {
        if (sub.user_id !== initialUserId) return null
        // 사람의 재확인과 24시간 간격을 요구한다. 불명 또는 성공 이력이 있으면 재승인하지 않는다.
        const previous = await tx.query("SELECT 1 FROM toss_ledger_charges WHERE subscription_id=$1 AND status<>'declined' LIMIT 1", [subscriptionId])
        const retry = await tx.query("SELECT 1 FROM toss_ledger_subscriptions WHERE id=$1 AND retry_count<3 AND (retry_at IS NULL OR retry_at<=now())", [subscriptionId])
        if (previous.rows.length || !retry.rows.length) return null
        const clock = await tx.query<{ month: string }>("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AS month")
        month = clock.rows[0]?.month ?? null
        if (!month || !monthPattern.test(month)) throw new Error("Invalid database clock")
      }
      const outstanding = await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight' LIMIT 1", [subscriptionId])
      if (outstanding.rows.length) return null
      if ((await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND billing_month=$2 AND ($3::boolean=false OR status<>'declined') LIMIT 1", [subscriptionId, month, Boolean(initialUserId)])).rows.length) return null
      const billingKey = unseal(key, merchantId, subscriptionId, sub.encrypted_billing_key)
      const orderId = `toss_${randomUUID()}`
      const inserted = await tx.query<ChargeRow>("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status) VALUES ($1,$2,$3,$4,'in_flight') ON CONFLICT DO NOTHING RETURNING order_id,amount,status", [orderId, subscriptionId, month, sub.amount])
      if (!inserted.rows[0]) return null
      return { orderId, amount: sub.amount, customerKey: sub.customer_key, billingKey, orderName: sub.order_name }
    }))
  }
  async function settle(subscriptionId: string, expected: { orderId: string; amount: number }, payment: TossPayment): Promise<boolean> {
    if (payment.orderId !== expected.orderId || payment.amount !== expected.amount || !safeKey(payment.paymentKey)) return false
    return storage(() => db.transaction(async (tx) => {
      const sub = (await tx.query<{ status: string; billing_anchor: Date | null; next_due_at: Date | null; cancel_at: Date | null }>("SELECT status,billing_anchor,next_due_at,cancel_at FROM toss_ledger_subscriptions WHERE id=$1 FOR UPDATE", [subscriptionId])).rows[0]
      const paid = await tx.query<{ order_id: string; billing_month: string; paid_at: Date }>("UPDATE toss_ledger_charges SET status='paid',payment_key=$1,paid_at=now() WHERE subscription_id=$2 AND order_id=$3 AND amount=$4 AND status='in_flight' RETURNING order_id,billing_month,paid_at", [payment.paymentKey, subscriptionId, expected.orderId, expected.amount])
      if (paid.rows.length && sub) {
        const row = paid.rows[0]
        const previous = await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND status='paid' AND order_id<>$2 LIMIT 1", [subscriptionId, row.order_id])
        const anchor = sub.billing_anchor ? new Date(sub.billing_anchor) : previous.rows.length ? null : new Date(row.paid_at)
        const start = sub.next_due_at ? new Date(sub.next_due_at) : anchor
        const dueMonth = start && `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
        if (anchor && start && (!sub.next_due_at || row.billing_month === dueMonth)) {
          const end = nextMonthlyBoundary(anchor, start)
          await tx.query("UPDATE toss_ledger_subscriptions SET billing_anchor=$2::timestamptz,period_start=$3::timestamptz,period_end=$4::timestamptz,next_due_at=$5::timestamptz,cancel_at=$6::timestamptz,retry_count=0,retry_at=NULL WHERE id=$1", [subscriptionId, anchor.toISOString(), start.toISOString(), end.toISOString(), sub.status === "enabled" && !sub.cancel_at ? end.toISOString() : null, sub.status === "enabled" && sub.cancel_at ? end.toISOString() : null])
        }
        await tx.query("UPDATE toss_ledger_subscriptions SET status='canceled',next_due_at=NULL WHERE id=$1 AND status='cancel_requested'", [subscriptionId])
      }
      return paid.rows.length === 1
    }))
  }
  async function chargeMonth(subscriptionId: string, month: string): Promise<"paid" | "unresolved" | "not_claimed"> {
    if (!safeId(subscriptionId) || !monthPattern.test(month)) throw new Error("Invalid charge identity")
    const current = await claim(subscriptionId, month)
    if (!current) return "not_claimed"
    try {
      const result = await client.charge({ billingKey: current.billingKey, customerKey: current.customerKey, orderId: current.orderId, orderName: current.orderName, amount: current.amount })
      return await settle(subscriptionId, current, result) ? "paid" : "unresolved"
    } catch { return "unresolved" }
  }
  // 초회 결제는 사용자의 명시적 확인이 필요하며, 확정 거절만 제한된 재시도를 허용한다.
  async function chargeInitial(subscriptionId: string, userId: string): Promise<"paid" | "declined" | "unresolved" | "not_claimed"> {
    if (!safeId(subscriptionId) || !safeId(userId)) throw new Error("Invalid charge identity")
    const current = await claim(subscriptionId, null, userId)
    if (!current) return "not_claimed"
    try {
      const result = await client.charge({ billingKey: current.billingKey, customerKey: current.customerKey, orderId: current.orderId, orderName: current.orderName, amount: current.amount })
      return await settle(subscriptionId, current, result) ? "paid" : "unresolved"
    } catch (error) {
      if (error instanceof TossCardDeclined) {
        try { return await decline(subscriptionId, current.orderId) ? "declined" : "unresolved" } catch { return "unresolved" }
      }
      return "unresolved"
    }
  }
  async function reconcileMonth(subscriptionId: string, month: string): Promise<"paid" | "unresolved" | "not_found"> {
    if (!safeId(subscriptionId) || !monthPattern.test(month)) throw new Error("Invalid charge identity")
    const row = await storage(async () => (await db.query<ChargeRow>("SELECT order_id,amount,status FROM toss_ledger_charges WHERE subscription_id=$1 AND billing_month=$2 AND status IN ('in_flight','paid')", [subscriptionId, month])).rows[0])
    if (!row) return "not_found"
    if (row.status === "paid") return "paid"
    try {
      const payment = await client.lookup({ orderId: row.order_id, amount: row.amount })
      if (await settle(subscriptionId, { orderId: row.order_id, amount: row.amount }, payment)) return "paid"
      const latest = await db.query<ChargeRow>("SELECT order_id,amount,status FROM toss_ledger_charges WHERE subscription_id=$1 AND billing_month=$2 AND status IN ('in_flight','paid')", [subscriptionId, month])
      return latest.rows[0]?.status === "paid" && latest.rows[0]?.order_id === row.order_id && latest.rows[0]?.amount === row.amount ? "paid" : "unresolved"
    } catch { return "unresolved" }
  }
  // 특정 due에 대해 짧게 잠근 다음 주문을 기록한다. 결제사 호출은 트랜잭션 밖에서 한다.
  async function claimDue(subscriptionId: string, productId: string): Promise<Claim | null> {
    return storage(() => db.transaction(async (tx) => {
      const owner = (await tx.query<{ user_id: string }>("SELECT user_id FROM toss_ledger_subscriptions WHERE id=$1 AND product_id=$2", [subscriptionId, productId])).rows[0]
      if (!owner || !(await lockBillingUser(tx, owner.user_id))) return null
      const sub = (await tx.query<SubscriptionRow & { billing_month: string }>("SELECT s.user_id,s.status,s.cancel_at,s.customer_key,s.encrypted_billing_key,s.order_name,s.amount,to_char(s.next_due_at AT TIME ZONE 'UTC','YYYY-MM') AS billing_month FROM toss_ledger_subscriptions s WHERE s.id=$1 AND s.product_id=$2 AND s.status='enabled' AND s.cancel_at IS NULL AND s.billing_anchor IS NOT NULL AND s.period_start IS NOT NULL AND s.period_end>s.period_start AND s.next_due_at=s.period_end AND s.next_due_at<=now() AND s.schedule_hold_reason IS NULL AND s.retry_count<3 AND (s.retry_at IS NULL OR s.retry_at<=now()) AND EXISTS (SELECT 1 FROM toss_ledger_charges p WHERE p.subscription_id=s.id AND p.status='paid') AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id=s.user_id AND d.status IN ('pending','purging')) FOR UPDATE", [subscriptionId, productId])).rows[0]
      if (!sub || sub.user_id !== owner.user_id || !monthPattern.test(sub.billing_month)) return null
      if (!sub.encrypted_billing_key) {
        await tx.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason='credential_unavailable' WHERE id=$1", [subscriptionId])
        return null
      }
      // 행 잠금을 기다리는 동안 접수된 탈퇴도 새 READ COMMITTED 문장으로 다시 검사한다.
      if ((await tx.query("SELECT 1 FROM account_deletions WHERE user_id=$1 AND status IN ('pending','purging') LIMIT 1", [sub.user_id])).rows.length) return null
      if ((await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight' LIMIT 1", [subscriptionId])).rows.length) return null
      // 장기 중단의 지난 기간과 손상된 키는 자동 청구하지 않고 원인을 보존한다.
      const overdue = await tx.query("SELECT 1 FROM toss_ledger_subscriptions WHERE id=$1 AND next_due_at<=now()-interval '28 days'", [subscriptionId])
      if (overdue.rows.length) {
        await tx.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason='overdue' WHERE id=$1", [subscriptionId])
        return null
      }
      let billingKey: string
      try { billingKey = unseal(key, merchantId, subscriptionId, sub.encrypted_billing_key) }
      catch {
        await tx.query("UPDATE toss_ledger_subscriptions SET schedule_hold_reason='credential_unavailable' WHERE id=$1", [subscriptionId])
        return null
      }
      const orderId = `toss_${randomUUID()}`
      const inserted = await tx.query("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status) VALUES ($1,$2,$3,$4,'in_flight') ON CONFLICT DO NOTHING RETURNING order_id", [orderId, subscriptionId, sub.billing_month, sub.amount])
      return inserted.rows.length ? { orderId, amount: sub.amount, customerKey: sub.customer_key, billingKey, orderName: sub.order_name } : null
    }))
  }
  async function decline(subscriptionId: string, orderId: string): Promise<boolean> {
    return storage(() => db.transaction(async (tx) => {
      const sub = (await tx.query<{ status: string }>("SELECT status FROM toss_ledger_subscriptions WHERE id=$1 FOR UPDATE", [subscriptionId])).rows[0]
      const result = await tx.query("UPDATE toss_ledger_charges SET status='declined' WHERE order_id=$1 AND subscription_id=$2 AND status='in_flight' RETURNING order_id", [orderId, subscriptionId])
      if (!result.rows.length || !sub) return false
      if (sub.status === "cancel_requested") await tx.query("UPDATE toss_ledger_subscriptions SET status='canceled',next_due_at=NULL,retry_at=NULL WHERE id=$1", [subscriptionId])
      else await tx.query("UPDATE toss_ledger_subscriptions SET retry_count=retry_count+1,retry_at=CASE WHEN retry_count+1<3 THEN now()+interval '24 hours' ELSE NULL END WHERE id=$1", [subscriptionId])
      return true
    }))
  }
  /** 한 번에 최대 100건. 미확정 주문은 재조회만 하고 새 승인은 due와 DB 선점이 필요하다. */
  async function runDueBatch(productId: string, limit = 20): Promise<{ examined: number; paid: number; declined: number; unresolved: number }> {
    if (!safeId(productId) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid batch scope")
    const report = { examined: 0, paid: 0, declined: 0, unresolved: 0 }
    // 전체 건수와 추가 요청의 시작 시각을 제한한다. 한 요청은 최대 70초까지 걸릴 수 있다.
    const deadline = Date.now() + 20_000
    const pendingBudget = limit === 1 ? 0 : Math.floor(limit / 2)
    const pending = await storage(() => db.query<{ order_id: string; subscription_id: string; billing_month: string }>("SELECT c.order_id,c.subscription_id,c.billing_month FROM toss_ledger_charges c JOIN toss_ledger_subscriptions s ON s.id=c.subscription_id WHERE c.status='in_flight' AND c.next_reconcile_at<=now() AND s.product_id=$1 ORDER BY c.next_reconcile_at,c.created_at,c.order_id LIMIT $2", [productId, pendingBudget || 1]))
    const candidates = await storage(() => db.query<{ id: string }>("SELECT s.id FROM toss_ledger_subscriptions s WHERE s.product_id=$1 AND s.status='enabled' AND s.cancel_at IS NULL AND s.billing_anchor IS NOT NULL AND s.period_start IS NOT NULL AND s.period_end>s.period_start AND s.next_due_at=s.period_end AND s.next_due_at<=now() AND s.schedule_hold_reason IS NULL AND s.retry_count<3 AND (s.retry_at IS NULL OR s.retry_at<=now()) AND EXISTS (SELECT 1 FROM toss_ledger_charges p WHERE p.subscription_id=s.id AND p.status='paid') AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id=s.user_id AND d.status IN ('pending','purging')) AND NOT EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight') ORDER BY s.next_due_at,s.id LIMIT $2", [productId, limit]))
    const reconcile = async (row: { order_id: string; subscription_id: string; billing_month: string }) => {
      const reserved = await storage(() => db.query("UPDATE toss_ledger_charges SET next_reconcile_at=now()+interval '5 minutes' WHERE order_id=$1 AND status='in_flight' AND next_reconcile_at<=now() RETURNING order_id", [row.order_id]))
      if (!reserved.rows.length) return
      report.examined++
      const result = await reconcileMonth(row.subscription_id, row.billing_month)
      if (result === "paid") report.paid++; else report.unresolved++
    }
    // 공급자 조회가 지연되어도 도래 건이 매번 밀리지 않도록 새 도래 건을 먼저 처리한다.
    for (const row of candidates.rows) {
      if (report.examined >= limit - pendingBudget || Date.now() >= deadline) break
      report.examined++
      const current = await claimDue(row.id, productId)
      if (!current) continue
      try {
        const payment = await client.charge({ billingKey: current.billingKey, customerKey: current.customerKey, orderId: current.orderId, orderName: current.orderName, amount: current.amount })
        if (await settle(row.id, current, payment)) report.paid++; else report.unresolved++
      } catch (error) {
        if (error instanceof TossCardDeclined) {
          try { if (await decline(row.id, current.orderId)) report.declined++; else report.unresolved++ } catch { report.unresolved++ }
        } else report.unresolved++
      }
    }
    // 도래 요청이 오래 걸려도 예약된 재조회 한 건은 처리한다(공급자 요청 최대 두 번의 대기 시간).
    const beforePending = report.examined
    for (const row of pending.rows) {
      if (report.examined >= limit || (Date.now() >= deadline && (pendingBudget === 0 || report.examined > beforePending))) break
      await reconcile(row)
    }
    return report
  }
  async function cancel(subscriptionId: string): Promise<"canceled" | "cancel_requested" | "not_found"> {
    if (!safeId(subscriptionId)) throw new Error("Invalid subscription")
    return storage(() => db.transaction(async (tx) => {
      const sub = (await tx.query<{ status: string }>("SELECT status FROM toss_ledger_subscriptions WHERE id=$1 FOR UPDATE", [subscriptionId])).rows[0]
      if (!sub) return "not_found"
      if (sub.status === "canceled") return "canceled"
      const outstanding = await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight' LIMIT 1", [subscriptionId])
      if (outstanding.rows.length) {
        await tx.query("UPDATE toss_ledger_subscriptions SET status='cancel_requested' WHERE id=$1", [subscriptionId])
        return "cancel_requested"
      }
      await tx.query("UPDATE toss_ledger_subscriptions SET status='canceled',next_due_at=NULL WHERE id=$1", [subscriptionId])
      return "canceled"
    }))
  }
  // 해지 후 공급자 삭제의 200 응답을 먼저 확인한다. 응답 유실 시에는 암호문을 보존한다.
  async function deleteCredential(subscriptionId: string): Promise<"deleted" | "unresolved" | "not_available"> {
    if (!safeId(subscriptionId)) throw new Error("Invalid subscription")
    const row = await storage(async () => (await db.query<{ encrypted_billing_key: string | null }>("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1 AND status='canceled'", [subscriptionId])).rows[0])
    if (!row?.encrypted_billing_key) return "not_available"
    try {
      await client.deleteBillingKey(unseal(key, merchantId, subscriptionId, row.encrypted_billing_key))
      const deleted = await storage(async () => (await db.query("UPDATE toss_ledger_subscriptions SET encrypted_billing_key=NULL WHERE id=$1 AND status='canceled' AND encrypted_billing_key=$2 RETURNING id", [subscriptionId, row.encrypted_billing_key])).rows.length === 1)
      return deleted ? "deleted" : "unresolved"
    } catch { return "unresolved" }
  }
  return { createSubscription, chargeMonth, chargeInitial, reconcileMonth, runDueBatch, cancel, deleteCredential }
}
