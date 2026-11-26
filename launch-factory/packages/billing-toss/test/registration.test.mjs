import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { createTestTossClient, createTestRegistration, handleTestRegistrationCallback, createTestTossLedger, createTestRegistrationEndpoints } from "../src/index.ts"
import { openTestBillingAuth } from "../src/sdk.ts"

const migration = await readFile(new URL("../../db/migrations/0020_toss_registration.sql", import.meta.url), "utf8")
const migration2 = await readFile(new URL("../../db/migrations/0021_toss_registration_identity.sql", import.meta.url), "utf8")
const migration3 = await readFile(new URL("../../db/migrations/0022_toss_schedule.sql", import.meta.url), "utf8")
const migration4 = await readFile(new URL("../../db/migrations/0023_toss_cancel_at.sql", import.meta.url), "utf8")
const adapter = (pg) => ({ query: (sql, params) => pg.query(sql, params), transaction: (run) => pg.transaction((tx) => run({ query: (sql, params) => tx.query(sql, params) })) })
const plans = [{ id: "monthly", productId: "product", orderName: "월 구독", amount: 4900 }, { id: "another", productId: "another", orderName: "다른 구독", amount: 9900 }]
const key = Buffer.alloc(32, 4)
const origin = "https://site.example.test"
const response = (x, status = 200) => new Response(JSON.stringify(x), { status })
let pg
before(async () => { pg = new PGlite(); await pg.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE account_deletions (user_id text, status text)'); await pg.exec(migration); await pg.exec(migration2); await pg.exec(migration3); await pg.exec(migration4); for (const id of ["happy", "race", "lost", "expire", "auth", "other", "cancel"]) await pg.query('INSERT INTO "user" VALUES ($1)', [id]) })
after(async () => { await pg.close() })
function setup(fetch, extra = {}) {
  const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "test-mid", fetch })
  return { client, registration: createTestRegistration({ db: adapter(pg), encryptionKey: key, client, origin, plans, ...extra }) }
}
function callback(start, authKey = "fake_auth") {
  const url = new URL(start.successUrl)
  url.searchParams.set("authKey", authKey)
  url.searchParams.set("customerKey", start.customerKey)
  return url.toString()
}
const issuance = async (_url, init) => { const body = JSON.parse(init.body); return response({ mId: "test-mid", customerKey: body.customerKey, billingKey: "billing-key", card: {} }) }

test("브라우저 fake SDK 등록부터 인증 콜백과 암호화 원장까지, 유료 활성화 없음", async () => {
  const { registration } = setup(issuance)
  const start = await registration.start({ userId: "happy", planId: "monthly" })
  assert.equal(start.status, "ready")
  let request
  await openTestBillingAuth({ ...start, clientKey: "test_ck_fake", origin, sdk: (clientKey) => ({ payment: ({ customerKey }) => ({ requestBillingAuth: async (x) => { request = { clientKey, customerKey, ...x } } }) }) })
  assert.equal(request.method, "CARD")
  assert.equal(request.windowTarget, "self")
  assert.equal(request.customerKey, start.customerKey)
  const url = new URL(callback(start))
  url.searchParams.set("amount", "1")
  url.searchParams.set("planId", "another")
  url.searchParams.set("userId", "other")
  const res = await handleTestRegistrationCallback(new Request(url), "happy", registration)
  assert.equal(res.status, 303)
  assert.equal(res.headers.get("location"), `${origin}/account/billing?registration=registered`)
  assert.equal(res.headers.get("referrer-policy"), "no-referrer")
  assert.ok(!res.headers.get("location").includes("fake_auth"))
  const rows = await pg.query("SELECT id,user_id,product_id,plan_id,amount,status,encrypted_billing_key FROM toss_ledger_subscriptions WHERE user_id=$1", ["happy"])
  assert.equal(rows.rows.length, 1)
  assert.deepEqual([rows.rows[0].user_id, rows.rows[0].product_id, rows.rows[0].plan_id, rows.rows[0].amount, rows.rows[0].status], ["happy", "product", "monthly", 4900, "enabled"])
  assert.ok(!rows.rows[0].encrypted_billing_key.includes("billing-key"))
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM toss_ledger_charges WHERE subscription_id=$1", [rows.rows[0].id])).rows[0].n, 0)
  assert.equal(await registration.complete({ userId: "happy", requestUrl: url.toString() }), "invalid")
  assert.equal((await registration.start({ userId: "happy", planId: "monthly" })).status, "unavailable")
  await assert.rejects(() => pg.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,plan_id,order_name,amount,status) VALUES ('different_id','happy','product','random_customer_key_example_123','monthly','x',4900,'enabled')"), (error) => error.code === "23505")
})

test("SDK는 강제 변환 가능한 배열과 객체를 거절한다", async () => {
  const state = "a".repeat(43)
  const base = { clientKey: "test_ck_fake", customerKey: "01234567-89ab-4def-8123-456789abcdef", origin, successUrl: `${origin}/api/toss/registration/complete?state=${state}`, failUrl: `${origin}/api/toss/registration/fail?state=${state}`, sdk: () => { throw new Error("SDK must not be called") } }
  for (const field of ["clientKey", "customerKey", "origin", "successUrl", "failUrl"]) {
    await assert.rejects(() => openTestBillingAuth({ ...base, [field]: [base[field]] }), /Invalid test SDK configuration/)
  }
})

test("서로 다른 탭·중복 콜백과 발급 중 해지는 한 번만 발급하고 취소 상태로 저장한다", async () => {
  let enter, release, calls = 0
  const started = new Promise((resolve) => { enter = resolve })
  const { registration } = setup(async (url, init) => { calls++; enter(); await new Promise((resolve) => { release = resolve }); return issuance(url, init) })
  const [a, b] = await Promise.all([registration.start({ userId: "race", planId: "monthly" }), registration.start({ userId: "race", planId: "monthly" })])
  assert.deepEqual([a.status, b.status].sort(), ["ready", "unavailable"])
  const start = a.status === "ready" ? a : b
  const state = new URL(start.successUrl).searchParams.get("state")
  const first = registration.complete({ userId: "race", requestUrl: callback(start, "race_auth") })
  await started
  assert.equal(await registration.complete({ userId: "race", requestUrl: callback(start, "race_auth") }), "invalid")
  assert.equal(await registration.cancel({ userId: "race", state }), "cancel_requested")
  release()
  assert.equal(await first, "canceled")
  assert.equal(calls, 1)
  assert.equal((await pg.query("SELECT status FROM toss_ledger_subscriptions WHERE user_id=$1", ["race"])).rows[0].status, "canceled")
})

test("발급 응답 유실은 issuing 상태를 유지하며 새 세션·재발급을 막는다", async () => {
  let calls = 0
  const { registration } = setup(async () => { calls++; throw new Error("lost") })
  const start = await registration.start({ userId: "lost", planId: "monthly" })
  assert.equal(await registration.complete({ userId: "lost", requestUrl: callback(start, "lost_auth") }), "unresolved")
  const state = new URL(start.successUrl).searchParams.get("state")
  assert.equal(await registration.status({ userId: "lost", state }), "issuing")
  assert.equal((await registration.start({ userId: "lost", planId: "monthly" })).status, "unavailable")
  assert.equal(await registration.complete({ userId: "lost", requestUrl: callback(start, "lost_auth") }), "invalid")
  assert.equal(calls, 1)
})

test("사용자·고객·상태·오리진·만료를 검증하고 틀리면 공급자를 부르지 않는다", async () => {
  let calls = 0, clock = new Date("2026-11-26T00:00:00Z")
  const { registration } = setup(async (url, init) => { calls++; return issuance(url, init) }, { now: () => clock, ttlMs: 1000 })
  const start = await registration.start({ userId: "expire", planId: "monthly" })
  const original = new URL(callback(start, "expire_auth"))
  assert.equal(await registration.complete({ userId: "other", requestUrl: original.toString() }), "invalid")
  const foreign = new URL(original); foreign.host = "bad.example.test"
  assert.equal(await registration.complete({ userId: "expire", requestUrl: foreign.toString() }), "invalid")
  const wrong = new URL(original); wrong.searchParams.set("customerKey", "00000000-0000-0000-0000-000000000000")
  assert.equal(await registration.complete({ userId: "expire", requestUrl: wrong.toString() }), "invalid")
  const dup = new URL(original); dup.searchParams.append("state", "duplicate")
  assert.equal(await registration.complete({ userId: "expire", requestUrl: dup.toString() }), "invalid")
  clock = new Date(clock.getTime() + 1000)
  assert.equal(await registration.complete({ userId: "expire", requestUrl: original.toString() }), "invalid")
  assert.equal(calls, 0)
  assert.equal((await registration.start({ userId: "expire", planId: "monthly" })).status, "ready")
})

test("다른 세션에서 이미 사용한 authKey는 재발급하지 않는다", async () => {
  let calls = 0
  const { registration } = setup(async (url, init) => { calls++; return issuance(url, init) })
  const a = await registration.start({ userId: "auth", planId: "monthly" })
  const b = await registration.start({ userId: "auth", planId: "another" })
  assert.equal(await registration.complete({ userId: "auth", requestUrl: callback(a, "same_auth") }), "registered")
  assert.equal(await registration.complete({ userId: "auth", requestUrl: callback(b, "same_auth") }), "unresolved")
  assert.equal(calls, 1)
})

test("발급 전 취소와 다른 오리진 SDK 요청을 차단한다", async () => {
  let calls = 0
  const { registration, client } = setup(async () => { calls++; return response({}) })
  const start = await registration.start({ userId: "cancel", planId: "monthly" })
  const state = new URL(start.successUrl).searchParams.get("state")
  assert.equal(await registration.cancel({ userId: "cancel", state }), "canceled")
  assert.equal(await registration.complete({ userId: "cancel", requestUrl: callback(start, "cancel_auth") }), "invalid")
  await assert.rejects(() => openTestBillingAuth({ ...start, clientKey: "test_ck_fake", origin, successUrl: "https://evil.example.test/api/toss/registration/complete?state=x", sdk: () => { throw new Error("called") } }))
  const ledger = createTestTossLedger({ db: adapter(pg), encryptionKey: key, client })
  assert.equal(await ledger.cancel("missing"), "not_found")
  assert.equal(calls, 0)
})

test("앱 입구는 서버 세션과 같은 오리진을 검사하고 대리 사용자와 비로그인을 막는다", async () => {
  const { registration } = setup(issuance)
  const request = new Request(`${origin}/start`, { method: "POST", headers: { Origin: origin } })
  let session = null
  const endpoints = createTestRegistrationEndpoints({ registration, origin, session: async () => session })
  assert.equal((await endpoints.begin(request, "monthly")).status, "unauthorized")
  session = { userId: "other", impersonatedBy: "admin" }
  assert.equal((await endpoints.begin(request, "monthly")).status, "unauthorized")
  session = { userId: "other" }
  assert.equal((await endpoints.begin(new Request(`${origin}/start`, { method: "POST", headers: { Origin: "https://evil.example.test" } }), "monthly")).status, "invalid")
  const start = await endpoints.begin(request, "monthly")
  assert.equal(start.status, "ready")
  session = null
  assert.equal((await endpoints.complete(new Request(callback(start, "other_auth")))).status, 401)
  session = { userId: "other" }
  assert.equal((await endpoints.complete(new Request(callback(start, "other_auth")))).status, 303)
})
