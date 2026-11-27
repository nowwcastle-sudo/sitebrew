import { test, before, after } from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import { db, retainedTransactions, user } from "@launch-factory/db"
import { DEFAULT_COLLECTORS, NO_ANALYTICS_ERASER, exportMyData, requestAccountDeletion, runPurge } from "@launch-factory/account-lifecycle"
import { createTestRegistration, createTestTossClient, createTestTossLedger, prepareTossDeletion } from "../src/index.ts"
import { tossTestDatabase } from "../../../template/lib/launch/toss-test-db.ts"
import { blockTossDeletion, exportTossData, tossCollector, tossPurger } from "../../../template/lib/launch/toss-account.ts"

const secret = Buffer.alloc(32, 7), subjectKey = "test-subject-".padEnd(36, "0")
const noBilling = () => ({ subscription: async () => ({ ok: true, data: { status: "none", planId: null } }), cancel: async () => ({ ok: true, data: { status: "canceled", planId: null } }) })
const payment = (body) => ({ mId: "fake-mid", orderId: body.orderId, totalAmount: body.amount, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: `fake_${body.orderId}` })
let d, adapter
before(async () => { d = await db.local(); adapter = tossTestDatabase(d) })
after(async () => d.$client.close())

async function make(id, transport) {
  await d.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
  const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: transport })
  const registration = createTestRegistration({ db: adapter, client, encryptionKey: secret, origin: "https://example.test", plans: [{ id: "monthly", productId: "fake-product", orderName: "월 구독", amount: 4900 }] })
  const started = await registration.start({ userId: id, planId: "monthly" })
  const callback = new URL(started.successUrl); callback.searchParams.set("customerKey", started.customerKey); callback.searchParams.set("authKey", `fake_${id}`)
  assert.equal(await registration.complete({ userId: id, requestUrl: callback.toString() }), "registered")
  const sub = (await adapter.query("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1", [id])).rows[0].id
  return { registration, ledger: createTestTossLedger({ db: adapter, encryptionKey: secret, client }), sub }
}

const deletion = (id) => requestAccountDeletion({ db: d, billingFor: noBilling, graceDays: 0, onDeletionRequested: blockTossDeletion }, id)
const purge = (ledger, now) => runPurge({ db: d, billingFor: noBilling, subjectKey, analytics: NO_ANALYTICS_ERASER, collectors: [...DEFAULT_COLLECTORS, tossCollector], purgers: [tossPurger], preparePurge: (id) => prepareTossDeletion(adapter, ledger, id), ...(now ? { now: () => now } : {}) })

test("등록·초회 승인 뒤 실제 탈퇴와 파기 경로는 빌링키 삭제 후 거래를 분리 보존한다", async () => {
  let charges = 0, deletes = 0
  const transport = async (url, init) => {
    if (init.method === "DELETE") { deletes++; return new Response(null, { status: 200 }) }
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} })
    charges++; return Response.json(payment(body))
  }
  const { registration, ledger, sub } = await make("account_paid", transport)
  assert.equal(await ledger.chargeInitial(sub, "account_paid"), "paid")
  assert.equal((await deletion("account_paid")).ok, true)
  assert.equal((await registration.start({ userId: "account_paid", planId: "monthly" })).status, "unavailable")
  assert.equal(await ledger.chargeMonth(sub, "2099-01"), "not_claimed")
  const report = await purge(ledger)
  assert.equal(report.purged, 1); assert.deepEqual(report.failures, [])
  assert.equal(charges, 1); assert.equal(deletes, 1)
  assert.equal((await d.select().from(user).where(eq(user.id, "account_paid"))).length, 0)
  const retained = await d.select().from(retainedTransactions).where(eq(retainedTransactions.provider, "toss"))
  assert.equal(retained.filter((row) => row.kind === "contract").length, 1)
  assert.equal(retained.filter((row) => row.kind === "payment").length, 1)
  assert.ok(!JSON.stringify(retained).includes("account_paid")); assert.ok(!JSON.stringify(retained).includes("fake_billing_key"))
  assert.equal((await adapter.query("SELECT id FROM toss_ledger_subscriptions WHERE id=$1", [sub])).rows.length, 0)
})

test("발급 또는 빌링키 삭제가 불명확하면 파기를 보류하고 진단 코드를 남긴다", async () => {
  let deletes = 0
  const transport = async (url, init) => {
    if (init.method === "DELETE") { deletes++; throw new Error("lost") }
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} })
    return Response.json(payment(body))
  }
  const { ledger, sub } = await make("account_unresolved", transport)
  assert.equal((await deletion("account_unresolved")).ok, true)
  const report = await purge(ledger)
  assert.equal(report.purged, 0); assert.equal(report.failures[0].error, "billing:billing_key_delete_unresolved")
  assert.equal(deletes, 1)
  assert.equal((await d.select().from(user).where(eq(user.id, "account_unresolved"))).length, 1)
  assert.ok((await adapter.query("SELECT encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1", [sub])).rows[0].encrypted_billing_key)
  await d.execute(sql`update account_deletions set status='cancelled' where user_id='account_unresolved'`)
})

test("발급 응답 유실은 탈퇴해도 재발급·파기하지 않는다", async () => {
  const id = "account_issue_lost"
  await d.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
  let issueCalls = 0, deletes = 0
  const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "fake-mid", fetch: async (_url, init) => { if (init.method === "DELETE") deletes++; else issueCalls++; throw new Error("lost") } })
  const registration = createTestRegistration({ db: adapter, client, encryptionKey: secret, origin: "https://example.test", plans: [{ id: "monthly", productId: "fake-product", orderName: "월 구독", amount: 4900 }] })
  const started = await registration.start({ userId: id, planId: "monthly" })
  const callback = new URL(started.successUrl); callback.searchParams.set("customerKey", started.customerKey); callback.searchParams.set("authKey", "fake_issue_lost")
  assert.equal(await registration.complete({ userId: id, requestUrl: callback.toString() }), "unresolved")
  assert.equal((await deletion(id)).ok, true)
  const ledger = createTestTossLedger({ db: adapter, encryptionKey: secret, client })
  const report = await purge(ledger)
  assert.equal(report.purged, 0); assert.equal(report.failures[0].error, "billing:registration_unresolved")
  assert.equal(issueCalls, 1); assert.equal(deletes, 0)
  assert.equal((await d.select().from(user).where(eq(user.id, id))).length, 1)
  await d.execute(sql`update account_deletions set status='cancelled' where user_id='account_issue_lost'`)
})

test("청구 응답 유실 후 탈퇴는 같은 주문 재조회와 삭제 확인 뒤 파기한다", async () => {
  let order, charges = 0, lookups = 0, deletes = 0
  const transport = async (url, init) => {
    if (init.method === "DELETE") { deletes++; return new Response(null, { status: 200 }) }
    if (init.method === "GET") { lookups++; assert.equal(String(url), `https://api.tosspayments.com/v1/payments/orders/${order}`); return lookups === 1 ? new Response(null, { status: 404 }) : Response.json(payment({ orderId: order, amount: 4900 })) }
    const body = JSON.parse(init.body)
    if (String(url).endsWith("/authorizations/issue")) return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} })
    order = body.orderId; charges++; throw new Error("lost")
  }
  const { ledger, sub } = await make("account_charge_lost", transport)
  assert.equal(await ledger.chargeInitial(sub, "account_charge_lost"), "unresolved")
  assert.equal((await deletion("account_charge_lost")).ok, true)
  assert.equal((await adapter.query("SELECT status FROM toss_ledger_subscriptions WHERE id=$1", [sub])).rows[0].status, "cancel_requested")
  const waiting = await purge(ledger)
  assert.equal(waiting.purged, 0); assert.equal(waiting.failures[0].error, "billing:charge_unresolved")
  assert.equal((await d.select().from(user).where(eq(user.id, "account_charge_lost"))).length, 1)
  const report = await purge(ledger, new Date(Date.now() + 60*60*1000 + 1000))
  assert.equal(report.purged, 1); assert.deepEqual(report.failures, [])
  assert.equal(charges, 1); assert.equal(lookups, 2); assert.equal(deletes, 1)
})

test("파기 준비 확장이 결과를 누락하면 안전하게 보류한다", async () => {
  const id = "account_missing_result"
  await d.insert(user).values({ id, name: "Example", email: `${id}@example.test` })
  assert.equal((await deletion(id)).ok, true)
  const report = await runPurge({ db: d, billingFor: noBilling, subjectKey, analytics: NO_ANALYTICS_ERASER, preparePurge: async () => undefined })
  assert.equal(report.purged, 0); assert.equal(report.failures[0].error, "billing:unresolved")
  assert.equal((await d.select().from(user).where(eq(user.id, id))).length, 1)
})


test("카드 등록만 또는 초회 미확정은 계약과 지급을 보존하지 않는다", async () => {
  for (const id of ["registered_only", "first_unknown"]) {
    const transport = async (url, init) => {
      if (init.method === "DELETE") return new Response(null, { status: 200 })
      const body = JSON.parse(init.body)
      if (String(url).endsWith("/authorizations/issue")) return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} })
      throw new Error("lost")
    }
    const { ledger, sub } = await make(id, transport)
    if (id === "first_unknown") assert.equal(await ledger.chargeInitial(sub, id), "unresolved")
    assert.deepEqual(await d.transaction((tx) => tossCollector(tx, { userId: id, now: new Date() })), [])
    if (id === "registered_only") {
      assert.equal((await deletion(id)).ok, true)
      assert.equal((await purge(ledger)).purged, 1)
      assert.equal((await d.select().from(retainedTransactions).where(eq(retainedTransactions.providerRef, sub))).length, 0)
    }
  }
})

test("본인 내보내기는 토스 요금제와 금액·상태·기간만 싣고 다른 사람과 키를 제외한다", async () => {
  const transport = async (_url, init) => { const body = JSON.parse(init.body); return Response.json({ mId: "fake-mid", customerKey: body.customerKey, billingKey: "secret-billing-test", card: {} }) }
  const own = await make("toss_export_owner", transport)
  await make("toss_export_other", transport)
  const sensitive = (await adapter.query("SELECT customer_key,encrypted_billing_key FROM toss_ledger_subscriptions WHERE id=$1", [own.sub])).rows[0]
  const data = await exportMyData(d, "toss_export_owner", new Date(), exportTossData)
  assert.equal(data.additionalSubscriptions.length, 1)
  assert.equal(data.additionalSubscriptions[0].planId, "monthly")
  assert.equal(data.additionalSubscriptions[0].amount, 4900)
  assert.equal(data.additionalSubscriptions[0].status, "enabled")
  assert.ok(data.additionalSubscriptions[0].createdAt)
  assert.ok(!JSON.stringify(data.additionalSubscriptions).includes("secret-billing-test"))
  assert.ok(!JSON.stringify(data.additionalSubscriptions).includes("customerKey"))
  assert.ok(!JSON.stringify(data).includes(sensitive.customer_key))
  assert.ok(!JSON.stringify(data).includes(sensitive.encrypted_billing_key))
  assert.ok(!JSON.stringify(data.additionalSubscriptions).includes(own.sub))
  const none = await exportMyData(d, "missing_user", new Date(), exportTossData)
  assert.equal(none, null)
})


test("0024에서 0025로 올려도 탈퇴 유예와 토스 계약·거래 원장은 보존된다", async () => {
  const pg = new PGlite()
  try {
    const meta = JSON.parse(await readFile(new URL("../../db/migrations/meta/_journal.json", import.meta.url), "utf8"))
    for (const entry of meta.entries.filter((x) => x.idx <= 24)) {
      await pg.exec(await readFile(new URL(`../../db/migrations/${entry.tag}.sql`, import.meta.url), "utf8"))
    }
    await pg.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', ["upgrade_owner","Example","upgrade@example.test"])
    await pg.query("INSERT INTO account_deletions (user_id,status,grace_until,last_error) VALUES ($1,'purging',$2,'billing:charge_unresolved')", ["upgrade_owner", "2026-11-01T00:00:00Z"])
    await pg.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,plan_id,order_name,amount,status) VALUES ('upgrade_sub','upgrade_owner','product','customer','monthly','test',4900,'canceled')")
    await pg.query("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status,payment_key,paid_at) VALUES ('upgrade_order','upgrade_sub','2026-11',4900,'paid','fake_payment',now())")
    await pg.exec(await readFile(new URL("../../db/migrations/0025_account_purge_retry.sql", import.meta.url), "utf8"))
    const row = (await pg.query("SELECT status,grace_until,last_error,purge_retry_at FROM account_deletions WHERE user_id='upgrade_owner'")).rows[0]
    assert.equal(row.status,"purging"); assert.equal(row.last_error,"billing:charge_unresolved"); assert.equal(row.purge_retry_at,null)
    assert.equal(row.grace_until.toISOString(),"2026-11-01T00:00:00.000Z")
    assert.equal((await pg.query("SELECT amount,status FROM toss_ledger_charges WHERE order_id='upgrade_order'")).rows[0].amount,4900)
    assert.equal((await pg.query("SELECT status FROM toss_ledger_subscriptions WHERE id='upgrade_sub'")).rows[0].status,"canceled")
  } finally { await pg.close() }
})
