// 이 시험 서버의 예약 도메인 계정만 이메일 확인 상태로 만든다. 실제 인증 세션은 Better Auth가 발급한다.
if (process.env.NODE_ENV === "development" && process.env.LF_MODE === "mock" && process.env.LF_TOSS_TEST === "1" && process.env.TOSS_E2E_PROOF_PATH) {
  const { PGlite } = await import("@electric-sql/pglite")
  const { access, writeFile } = await import("node:fs/promises")
  let intercepted = 0
  let blocked = 0
  if (process.env.TOSS_E2E_SANDBOX === "1") {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const target = new URL(url)
      if (target.hostname === "tosspayments.com" || target.hostname.endsWith(".tosspayments.com")) {
        intercepted++
        if (url === "https://api.tosspayments.com/v1/billing/fake_sandbox_billing_key" && init?.method === "DELETE") return new Response(null, { status: 200 })
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body))
          if (url === "https://api.tosspayments.com/v1/billing/authorizations/issue") return Response.json({ mId: "e2e-mid", customerKey: body.customerKey, billingKey: "fake_sandbox_billing_key", card: {} })
          if (url === "https://api.tosspayments.com/v1/billing/fake_sandbox_billing_key") return Response.json({ mId: "e2e-mid", orderId: body.orderId, totalAmount: body.amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `sandbox_${body.orderId}` })
        }
        blocked++
        return new Response(null, { status: 403 })
      }
      return originalFetch(input, init)
    }
  }
  const stores = new Set()
  for (const name of ["query", "exec"]) {
    const original = PGlite.prototype[name]
    PGlite.prototype[name] = function (...args) { stores.add(this); return original.apply(this, args) }
  }
  let busy = false
  let renewalPrepared = false
  let pendingPrepared = false
  const timer = setInterval(async () => {
    if (busy) return
    busy = true
    try {
      for (const store of stores) {
        await store.query('UPDATE "user" SET email_verified=true WHERE email IN ($1,$2) AND email_verified=false', ["toss-a@example.test", "toss-b@example.test"])
        if (process.env.TOSS_E2E_BILLING === "1" && process.env.TOSS_E2E_RENEW_MARKER && !renewalPrepared) {
          let requested = false
          try { await access(process.env.TOSS_E2E_RENEW_MARKER); requested = true } catch { /* 화면에서 요청하기 전 */ }
          if (requested) {
            await store.transaction(async (tx) => {
              await tx.query("UPDATE toss_ledger_charges SET billing_month=to_char(now() AT TIME ZONE 'UTC' - interval '1 month','YYYY-MM') WHERE status='paid' AND subscription_id IN (SELECT id FROM toss_ledger_subscriptions WHERE user_id IN (SELECT id FROM \"user\" WHERE email='toss-a@example.test'))")
              await tx.query("UPDATE toss_ledger_subscriptions SET billing_anchor=now()-interval '1 month',period_start=now()-interval '1 month',period_end=now()-interval '1 second',next_due_at=now()-interval '1 second' WHERE user_id IN (SELECT id FROM \"user\" WHERE email='toss-a@example.test')")
            })
            renewalPrepared = true
          }
        }
        if (process.env.TOSS_E2E_PENDING === "1" && process.env.TOSS_E2E_RENEW_MARKER && !pendingPrepared) {
          let requested = false
          try { await access(process.env.TOSS_E2E_RENEW_MARKER); requested = true } catch { /* 시험에서 요청하기 전 */ }
          if (requested) {
            await store.query("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status) SELECT 'toss_fake_pending_order',id,to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),amount,'in_flight' FROM toss_ledger_subscriptions WHERE user_id IN (SELECT id FROM \"user\" WHERE email='toss-a@example.test')")
            pendingPrepared = true
          }
        }
        if (process.env.TOSS_E2E_PROOF_PATH) {
          const { rows } = await store.query("SELECT (SELECT count(*)::int FROM toss_ledger_subscriptions WHERE status='enabled') AS registered, (SELECT count(*)::int FROM toss_ledger_charges WHERE status='paid') AS paid")
          let deletion = {}
          if (process.env.TOSS_E2E_DELETE === "1") {
            await store.query("UPDATE account_deletions SET grace_until=now()-interval '1 second' WHERE status='pending' AND user_id IN (SELECT id FROM \"user\" WHERE email='toss-a@example.test')")
            const extra = await store.query("SELECT (SELECT count(*)::int FROM account_deletions WHERE status='pending') AS pending_deletions, (SELECT count(*)::int FROM account_deletions WHERE status='purged') AS purged_deletions, (SELECT count(*)::int FROM retained_transactions WHERE provider='toss') AS toss_retained, (SELECT count(*)::int FROM \"user\" WHERE email='toss-a@example.test') AS owner_exists")
            deletion = extra.rows[0]
          }
          await writeFile(process.env.TOSS_E2E_PROOF_PATH, JSON.stringify({ ...rows[0], intercepted, blocked, ...deletion, ...(process.env.TOSS_E2E_BILLING === "1" ? { renewalPrepared } : {}), ...(process.env.TOSS_E2E_PENDING === "1" ? { pendingPrepared } : {}) }))
        }
      }
    } catch { /* 마이그레이션 전에는 다음 검사에서 다시 본다. */ }
    finally { busy = false }
  }, 500)
  timer.unref()
}
