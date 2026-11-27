import { test } from "node:test"
import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import { db } from "@launch-factory/db"
import { ownTossTestSession, tossTestConfig } from "../lib/toss-test-config.ts"
import { hasTossCallbackSecret } from "../lib/toss-secret-filter.ts"
import { sentryInitOptions } from "../lib/observability.ts"
import { tossTestDatabase } from "../lib/launch/toss-test-db.ts"
import { canonicalTossCallback } from "../lib/toss-test-url.ts"
import { tossTestStatus } from "../lib/toss-test-status.ts"

const valid = { NODE_ENV: "development", LF_MODE: "mock", LF_TOSS_TEST: "1", LF_TOSS_TEST_FAKE: "1", TOSS_TEST_CLIENT_KEY: "test_ck_fake", TOSS_TEST_SECRET_KEY: "test_sk_fake", TOSS_TEST_ENCRYPTION_KEY: "11".repeat(32), NEXT_PUBLIC_APP_URL: "https://localhost:4443" }
test("시험 설정은 명시적인 개발 mock과 가짜 키만 허용한다", () => {
  assert.ok(tossTestConfig(valid))
  for (const change of [{ NODE_ENV: "production" }, { LF_MODE: "live" }, { LF_TOSS_TEST: "0" }, { LF_TOSS_TEST_FAKE: "0" }, { TOSS_TEST_CLIENT_KEY: "live_ck_key" }, { TOSS_TEST_SECRET_KEY: "live_sk_key" }, { TOSS_TEST_ENCRYPTION_KEY: "" }, { NEXT_PUBLIC_APP_URL: "http://localhost:4443" }]) assert.equal(tossTestConfig({ ...valid, ...change }), null)
  const sandbox = { ...valid, LF_TOSS_TEST_FAKE: "0", TOSS_TEST_CLIENT_KEY: "test_ck_sandbox", TOSS_TEST_SECRET_KEY: "test_sk_sandbox", TOSS_TEST_MERCHANT_ID: "sandbox-mid" }
  assert.equal(tossTestConfig(sandbox), null)
  assert.equal(tossTestConfig({ ...sandbox, TOSS_TEST_DB_DIRECTORY: "relative" }), null)
  assert.equal(tossTestConfig({ ...sandbox, TOSS_TEST_DB_DIRECTORY: tmpdir() })?.fake, false)
})
test("서버 인증이 없거나 대리 세션이면 등록에 쓸 수 없다", () => {
  assert.equal(ownTossTestSession({ ok: false }), null)
  assert.equal(ownTossTestSession({ ok: true, data: null }), null)
  assert.equal(ownTossTestSession({ ok: true, data: { userId: "u", impersonatedBy: "admin" } }), null)
  assert.deepEqual(ownTossTestSession({ ok: true, data: { userId: "u" } }), { userId: "u" })
})
test("토스 콜백 쿼리는 이벤트·breadcrumb에서 버리고 보통 오류는 유지한다", () => {
  const options = sentryInitOptions("https://public@example.test/1", { NODE_ENV: "production" })
  const url = "https://site.example.test/api/toss/registration/complete?authKey=fake&state=fake"
  assert.equal(options.beforeSend({ request: { url, query_string: "authKey=fake&state=fake" } }), null)
  assert.equal(options.beforeBreadcrumb({ category: "fetch", data: { url } }), null)
  assert.equal(options.beforeSend({ extra: { customerKey: "fake" } }), null)
  assert.equal(options.beforeSend({ request: { query_string: "state=fake" } }), null)
  assert.equal(options.beforeSend({ request: { query_string: { state: "fake" } } }), null)
  assert.ok(options.beforeSend({ message: "ordinary error" }))
  assert.equal(hasTossCallbackSecret({ request: { url: "/api/toss/registration/fail?state=fake" } }), true)
})
test("콜백 주소 복원은 외부 Host·HTTPS와 경로를 모두 확인한다", () => {
  const path = "/api/toss/registration/complete"
  const origin = "https://site.example.test"
  const headers = { host: "site.example.test", "x-forwarded-host": "site.example.test", "x-forwarded-proto": "https" }
  const req = (h) => new Request(`https://localhost${path}?state=fake`, { headers: h })
  assert.equal(new URL(canonicalTossCallback(req(headers), origin, path).url).origin, origin)
  for (const change of [{ host: "evil.example.test" }, { "x-forwarded-host": "evil.example.test" }, { "x-forwarded-proto": "http" }]) assert.equal(canonicalTossCallback(req({ ...headers, ...change }), origin, path), null)
})
test("Drizzle 어댑터는 바인딩과 트랜잭션을 실제 마이그레이션 DB에 적용한다", async () => {
  const d = await db.local()
  try {
    const adapter = tossTestDatabase(d)
    const result = await adapter.transaction(async (tx) => {
      const isolation = await tx.query("SHOW transaction_isolation")
      await tx.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', ["toss-test-user", "Example", "example@example.test"])
      return isolation.rows[0]
    })
    assert.equal(result.transaction_isolation, "read committed")
    const rows = await adapter.query('SELECT id FROM "user" WHERE id=$1', ["toss-test-user"])
    assert.equal(rows.rows[0].id, "toss-test-user")
    await adapter.query("INSERT INTO toss_ledger_subscriptions (id,user_id,product_id,customer_key,plan_id,order_name,amount,status) VALUES ('old','toss-test-user','product','customer','plan','example',4900,'canceled'), ('new','toss-test-user','product','customer','plan','example',4900,'enabled')")
    await adapter.query("INSERT INTO toss_ledger_charges (order_id,subscription_id,billing_month,amount,status,payment_key,paid_at) VALUES ('old-order','old','2026-10',4900,'paid','payment',now())")
    assert.deepEqual(await tossTestStatus(adapter, "toss-test-user", "product"), { registered: true, paid: false, pending: false })
    await assert.rejects(() => adapter.transaction(async (tx) => { await tx.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', ["rollback-user", "Example", "rollback@example.test"]); throw new Error("rollback") }))
    assert.equal((await adapter.query('SELECT id FROM "user" WHERE id=$1', ["rollback-user"])).rows.length, 0)
  } finally { await d.$client.close() }
})
