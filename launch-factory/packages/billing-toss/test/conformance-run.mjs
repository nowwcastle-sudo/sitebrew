import assert from "node:assert/strict"
import { db, user } from "@launch-factory/db"
import { tossTestDatabase } from "../../../template/lib/launch/toss-test-db.ts"
import { createTestTossBilling, createTestTossClient, createTestTossLedger } from "../src/index.ts"

const scenario = ["billing.state.trialing", "billing.state.past_due", "billing.state.paused", "billing.state.pending-price-change", ...["trialing", "past_due", "paused", "pending-price-change"].flatMap((s) => [`billing.cancel.${s}.period-end`, `billing.cancel.${s}.now`]), "billing.price-change.shape", "billing.price-change.accept"]
const trialPairBlocked = ["billing.cancel.parity.trial-signup", "billing.cancel.parity.paid-signup", ...["trial-on", "trial-off", "trial-default-with", "trial-default-without", "trial-unavailable"].map((s) => `billing.trial.${s}`), ...["conf-pause-1m", "conf-downgrade", "conf-discount-30-3m", "conf-discount-10-2m"].map((s) => `billing.retention.apply.${s}`), "billing.retention.unknown-offer", "billing.retention.no-subscription"]
const expectedFailures = {
  "billing.plans.trial-pair": "체험 기간이 있는 요금제와 없는 요금제",
  ...Object.fromEntries(scenario.map((id) => [id, "scenario_unsupported"])),
  ...Object.fromEntries(trialPairBlocked.map((id) => [id, "billing.plans.trial-pair"])),
}
const pins = { total: 40, expectedFailures }

export async function runTossConformance({ mod }) {
  const d = await db.local(), adapter = tossTestDatabase(d)
  let n = 0
  try {
    const make = async ({ sub }) => {
      if (["trialing", "past_due", "paused", "pending-price-change"].includes(sub)) throw new Error(`scenario_unsupported: ${sub}`)
      const id = `conformance_${++n}`, productId = `product_${id}`
      await d.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
      const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: async (_url, init) => { const body = JSON.parse(init.body); return Response.json({ mId: "fake-mid", orderId: body.orderId, totalAmount: body.amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `fake_${body.orderId}` }) } })
      const ledger = createTestTossLedger({ db: adapter, client, encryptionKey: Buffer.alloc(32, 7) })
      const plan = { id: "monthly", name: "시험", interval: "month", price: { amount: 4900, currency: "KRW", vatIncluded: true }, features: [] }
      const port = createTestTossBilling({ db: adapter, ledger, productId, plan, origin: "https://example.test" }).port(id)
      if (sub !== "none") {
        await ledger.createSubscription({ id, userId: id, productId, customerKey: "01234567-89ab-4def-8123-456789abcdef", billingKey: "fake_key", planId: "monthly", orderName: "시험", amount: 4900 })
        assert.equal(await ledger.chargeInitial(id, id), "paid")
        if (sub === "canceled") await ledger.cancel(id)
        if (sub === "expired") await adapter.query("UPDATE toss_ledger_subscriptions SET period_start=now()-interval '2 months',period_end=now()-interval '1 month' WHERE id=$1", [id])
      }
      return { ...port, cancel: (input) => port.cancel({ ...input, confirmed: true }) }
    }
    const results = await mod.billingConformance(make, { timeoutMs: 8000 })
    return { adapter: "billing-toss-test", suite: "billingConformance", results, pins }
  } finally {
    await d.$client.close()
  }
}
