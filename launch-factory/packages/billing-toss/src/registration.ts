// 시험 전용 서버 등록 세션. userId와 요금표는 인증된 서버에서만 제공한다.
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { lockBillingUser, sealBillingKey, type LedgerDatabase, type SqlConnection } from "./ledger.ts"
import { testMerchant, type createTestTossClient } from "./test-client.ts"

export interface TestRegistrationPlan { id: string; productId: string; orderName: string; amount: number }
type RegistrationRow = { id: string; user_id: string; product_id: string; customer_key: string; plan_id: string; order_name: string; amount: number; status: string; expires_at: Date | string }
const validId = (value: string) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value)
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const statePattern = /^[A-Za-z0-9_-]{43}$/
const customerPattern = /^[A-Za-z0-9_=.@-]{22,50}$/
async function identity(tx: SqlConnection, userId: string, productId: string) {
  await tx.query("INSERT INTO toss_registration_identities (user_id,product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, productId])
  await tx.query("SELECT user_id FROM toss_registration_identities WHERE user_id=$1 AND product_id=$2 FOR UPDATE", [userId, productId])
}

export function createTestRegistration(options: { db: LedgerDatabase; encryptionKey: Buffer; client: ReturnType<typeof createTestTossClient>; origin: string; plans: readonly TestRegistrationPlan[]; now?: () => Date; ttlMs?: number }) {
  const merchant = testMerchant(options.client)
  const root = new URL(options.origin)
  if (!merchant || !Buffer.isBuffer(options.encryptionKey) || options.encryptionKey.length !== 32 || root.protocol !== "https:" || root.origin !== options.origin || root.username || root.password) throw new Error("Invalid test registration configuration")
  const merchantId: string = merchant
  const ttl = options.ttlMs ?? 15 * 60_000
  if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > 30 * 60_000) throw new Error("Invalid registration lifetime")
  const plans = options.plans.map((p) => ({ ...p }))
  if (plans.some((p) => !validId(p.id) || !validId(p.productId) || typeof p.orderName !== "string" || !p.orderName.trim() || p.orderName.length > 100 || Array.from(p.orderName).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || !Number.isSafeInteger(p.amount) || p.amount < 1 || p.amount > 2147483647) || new Set(plans.map((p) => p.id)).size !== plans.length) throw new Error("Invalid plan catalog")
  const { db, client } = options
  const encryptionKey = Buffer.from(options.encryptionKey)
  const now = options.now ?? (() => new Date())
  const storage = async <T>(run: () => Promise<T>): Promise<T> => { try { return await run() } catch { throw new Error("Toss registration storage failure") } }

  async function start(input: { userId: string; planId: string }) {
    if (!validId(input.userId) || !validId(input.planId)) return { status: "invalid" as const }
    const plan = plans.find((p) => p.id === input.planId)
    if (!plan) return { status: "invalid" as const }
    const state = randomBytes(32).toString("base64url")
    const customerKey = randomUUID()
    const id = randomUUID()
    const current = now()
    if (!Number.isFinite(current.getTime())) throw new Error("Invalid clock")
    const expiresAt = new Date(current.getTime() + ttl)
    const inserted = await storage(() => db.transaction(async (tx) => {
      if (!(await lockBillingUser(tx, input.userId))) return false
      await identity(tx, input.userId, plan.productId)
      await tx.query("UPDATE toss_ledger_subscriptions s SET status='canceled',next_due_at=NULL WHERE s.user_id=$1 AND s.product_id=$2 AND s.status='enabled' AND s.cancel_at<=now() AND NOT EXISTS (SELECT 1 FROM toss_ledger_charges c WHERE c.subscription_id=s.id AND c.status='in_flight')", [input.userId, plan.productId])
      await tx.query("UPDATE toss_registration_sessions SET status='expired' WHERE user_id=$1 AND product_id=$2 AND status='pending' AND expires_at <= $3", [input.userId, plan.productId, current])
      const live = await tx.query("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1 AND product_id=$2 AND status IN ('enabled','cancel_requested') LIMIT 1", [input.userId, plan.productId])
      if (live.rows.length) return false
      const open = await tx.query("SELECT id FROM toss_registration_sessions WHERE user_id=$1 AND product_id=$2 AND status IN ('pending','issuing','cancel_requested') LIMIT 1", [input.userId, plan.productId])
      if (open.rows.length) return false
      await tx.query("INSERT INTO toss_registration_sessions (id,state_hash,user_id,product_id,customer_key,plan_id,order_name,amount,status,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)", [id, digest(state), input.userId, plan.productId, customerKey, plan.id, plan.orderName, plan.amount, expiresAt])
      return true
    }))
    if (!inserted) return { status: "unavailable" as const }
    const success = new URL("/api/toss/registration/complete", root)
    const failure = new URL("/api/toss/registration/fail", root)
    success.searchParams.set("state", state)
    failure.searchParams.set("state", state)
    return { status: "ready" as const, customerKey, successUrl: success.toString(), failUrl: failure.toString() }
  }

  async function complete(input: { userId: string; requestUrl: string }): Promise<"registered" | "canceled" | "unresolved" | "invalid"> {
    if (!validId(input.userId)) return "invalid"
    let url: URL
    try { url = new URL(input.requestUrl) } catch { return "invalid" }
    if (url.origin !== root.origin || url.pathname !== "/api/toss/registration/complete" || url.username || url.password || url.hash) return "invalid"
    const one = (name: string) => { const values = url.searchParams.getAll(name); return values.length === 1 ? values[0] : "" }
    const state = one("state"), customerKey = one("customerKey"), authKey = one("authKey")
    if (!statePattern.test(state) || !customerPattern.test(customerKey) || !authKey || authKey.length > 300 || /[\r\n]/.test(authKey)) return "invalid"
    let claimed: RegistrationRow | undefined
    try {
      claimed = await db.transaction(async (tx) => {
        if (!(await lockBillingUser(tx, input.userId))) return undefined
        const candidate = (await tx.query<RegistrationRow>("SELECT * FROM toss_registration_sessions WHERE state_hash=$1 AND user_id=$2", [digest(state), input.userId])).rows[0]
        if (!candidate) return undefined
        await identity(tx, candidate.user_id, candidate.product_id)
        const row = (await tx.query<RegistrationRow>("SELECT * FROM toss_registration_sessions WHERE id=$1 FOR UPDATE", [candidate.id])).rows[0]
        const claimedAt = now()
        if (!Number.isFinite(claimedAt.getTime())) return undefined
        if (!row || row.status !== "pending" || row.customer_key !== customerKey || new Date(row.expires_at).getTime() <= claimedAt.getTime()) return undefined
        const existing = await tx.query("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1 AND product_id=$2 AND status IN ('enabled','cancel_requested')", [row.user_id, row.product_id])
        if (existing.rows.length) return undefined
        await tx.query("UPDATE toss_registration_sessions SET status='issuing',auth_key_hash=$1 WHERE id=$2 AND status='pending'", [digest(authKey), row.id])
        return row
      })
    } catch { return "unresolved" }
    if (!claimed) return "invalid"
    try {
      const issued = await client.issue({ authKey, customerKey: claimed.customer_key })
      const encrypted = sealBillingKey(encryptionKey, merchantId, claimed.id, issued.billingKey)
      return await db.transaction(async (tx) => {
        const billingAllowed = await lockBillingUser(tx, claimed.user_id)
        await identity(tx, claimed.user_id, claimed.product_id)
        const row = (await tx.query<RegistrationRow>("SELECT * FROM toss_registration_sessions WHERE id=$1 FOR UPDATE", [claimed.id])).rows[0]
        if (!row || !["issuing", "cancel_requested"].includes(row.status)) return "unresolved" as const
        const canceled = row.status === "cancel_requested" || !billingAllowed
        await tx.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,encrypted_billing_key,plan_id,order_name,amount,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [row.id, row.user_id, row.product_id, row.customer_key, encrypted, row.plan_id, row.order_name, row.amount, canceled ? "canceled" : "enabled"])
        await tx.query("UPDATE toss_registration_sessions SET status=$1 WHERE id=$2", [canceled ? "canceled" : "registered", row.id])
        return canceled ? "canceled" as const : "registered" as const
      })
    } catch { return "unresolved" }
  }

  async function status(input: { userId: string; state: string }): Promise<string> {
    if (!validId(input.userId) || !statePattern.test(input.state)) return "invalid"
    const row = await storage(async () => (await db.query<{ status: string }>("SELECT status FROM toss_registration_sessions WHERE user_id=$1 AND state_hash=$2", [input.userId, digest(input.state)])).rows[0])
    return row?.status ?? "invalid"
  }
  async function cancel(input: { userId: string; state: string }): Promise<string> {
    if (!validId(input.userId) || !statePattern.test(input.state)) return "invalid"
    return storage(() => db.transaction(async (tx) => {
      await lockBillingUser(tx, input.userId)
      const candidate = (await tx.query<RegistrationRow>("SELECT * FROM toss_registration_sessions WHERE user_id=$1 AND state_hash=$2", [input.userId, digest(input.state)])).rows[0]
      if (!candidate) return "invalid"
      await identity(tx, candidate.user_id, candidate.product_id)
      const row = (await tx.query<RegistrationRow>("SELECT * FROM toss_registration_sessions WHERE id=$1 FOR UPDATE", [candidate.id])).rows[0]
      if (!row) return "invalid"
      if (row.status === "pending") { await tx.query("UPDATE toss_registration_sessions SET status='canceled' WHERE id=$1", [row.id]); return "canceled" }
      if (row.status === "issuing") { await tx.query("UPDATE toss_registration_sessions SET status='cancel_requested' WHERE id=$1", [row.id]); return "cancel_requested" }
      if (row.status === "registered") {
        const sub = (await tx.query<{ status: string }>("SELECT status FROM toss_ledger_subscriptions WHERE id=$1 FOR UPDATE", [row.id])).rows[0]
        if (!sub) return "unresolved"
        const pending = await tx.query("SELECT order_id FROM toss_ledger_charges WHERE subscription_id=$1 AND status='in_flight'", [row.id])
        await tx.query("UPDATE toss_ledger_subscriptions SET status=$1 WHERE id=$2", [pending.rows.length ? "cancel_requested" : "canceled", row.id])
        if (!pending.rows.length) await tx.query("UPDATE toss_registration_sessions SET status='canceled' WHERE id=$1", [row.id])
        return pending.rows.length ? "cancel_requested" : "canceled"
      }
      return row.status
    }))
  }
  function returnUrl(status: "registered" | "canceled" | "unresolved" | "invalid"): string {
    const url = new URL("/account/billing", root)
    url.searchParams.set("registration", status)
    return url.toString()
  }
  return { start, complete, status, cancel, returnUrl }
}
