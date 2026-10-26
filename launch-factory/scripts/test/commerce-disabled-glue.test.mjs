// 상점 꺼짐(계획 3a B6): live 에서 PortOne 값이 하나라도 없으면 사이트는 켜지고 상점만 꺼진다 — LFENV(문의 창구)와 같은 규칙.
// 진짜 payments.ts·commerce.ts·액션·웹훅·Cron 파일을 그대로 불러, 모든 상점 입구가 「받은 척 하지 않고」 거절하는지 본다.
//   액션: code provider_unavailable · retryable false(로그인한 사람에게) · 웹훅: 404 · Cron: 인증 뒤 skipped · DB 에는 아무것도 쓰지 않는다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, orders, user as userTable } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  enabled: ["hasPart"],
  env: ["env", "required"],
  mailer: ["mailer"],
  security: ["guardAction"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const NAMES = ["NEXT_PUBLIC_PORTONE_STORE_ID", "NEXT_PUBLIC_PORTONE_CHANNEL_KEY", "PORTONE_API_SECRET", "PORTONE_WEBHOOK_SECRET"]
const at = new Date("2026-10-22T00:00:00.000Z")
const CRON = "cron-secret-for-this-test"
let d
let session = { userId: "u1", impersonatedBy: null }
let mailsSent = 0
let guardCalls = 0

before(async () => {
  for (const n of NAMES) delete process.env[n]
  process.env.CRON_SECRET = CRON
  d = await db.local()
  await d.insert(userTable).values({ id: "u1", name: "u1", email: "u1@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  stubs.config = { PRODUCT_NAME: "예시 상점", DEFAULT_LOCALE: "ko", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "live" }), required: (n) => `x-${n}` }
  stubs.mailer = { mailer: () => ({ mode: "mock", send: async () => ((mailsSent += 1), { ok: true, mode: "mock" }) }) }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers() }
  stubs.security = { guardAction: async () => ((guardCalls += 1), null) }
  stubs.enabled = { hasPart: () => true }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: { provider_unavailable: "unavailable", forbidden: "forbidden", action_failed: "failed" } }
})
after(async () => {
  await d?.$client.close()
})

test("live 에서 PortOne 값이 없으면 commerceEnabled() 가 false 이고, 웹훅 비밀도 없다(이름만 알리고 던지지 않는다)", async () => {
  const lib = await importRegistryFile("feature-commerce/files/lib/launch/commerce.ts")
  const payments = await importRegistryFile("feature-payments-kr/files/lib/launch/payments.ts")
  assert.equal(lib.commerceEnabled(), false)
  assert.equal(payments.paymentsEnabled(), false)
  assert.equal(lib.webhookSecret(), undefined)
  const cfg = payments.payments()
  assert.deepEqual(cfg.missing, NAMES)
  assert.ok(!JSON.stringify(cfg).includes("secret"), "사유에는 이름만 있다")
  await assert.rejects(() => lib.commerceDeps(), /PORTONE_API_SECRET/)
})

test("셋만 있어도 꺼져 있다 — 네 값이 모두 있어야 켜진다(켜진 척 하지 않는다)", async () => {
  // payments.ts 는 처음 부를 때 한 번 정한다 — 같은 규칙을 resolvePayments 로 직접 본다
  const { resolvePayments } = await import("@launch-factory/payments-kr")
  const three = { LF_MODE: "live", NEXT_PUBLIC_PORTONE_STORE_ID: "store-x", NEXT_PUBLIC_PORTONE_CHANNEL_KEY: "channel-x", PORTONE_API_SECRET: "secret-x" }
  const off = resolvePayments(three)
  assert.equal(off.enabled, false)
  assert.deepEqual(off.missing, ["PORTONE_WEBHOOK_SECRET"])
})

test("모든 상점 액션: provider_unavailable · retryable false, 요청 제한에도 DB 에도 닿지 않는다", async () => {
  const shop = await importRegistryFile("feature-commerce/files/app/actions/commerce.ts")
  const calls = [
    () => shop.catalog(),
    () => shop.cart(),
    () => shop.setCartLine({ productId: "example-mug", quantity: 1 }),
    () => shop.placeOrder({ address: { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시" }, confirmed: true }),
    () => shop.confirmPayment({ orderId: "x", paymentId: "y" }),
    () => shop.orders(),
    () => shop.order({ orderId: "x" }),
    () => shop.cancelOrder({ orderId: "x", confirmed: true }),
    () => shop.payWithMock({ orderId: "x" }),
  ]
  for (const call of calls) {
    const r = await call()
    assert.equal(r.ok, false)
    assert.equal(r.code, "provider_unavailable")
    assert.equal(r.retryable, false)
    assert.ok(r.formError)
  }
  assert.equal(guardCalls, 0, "꺼진 상점은 요청 제한까지 가지 않는다")
  assert.equal((await d.select().from(orders)).length, 0)
  // 로그아웃은 여전히 로그인 요구가 먼저다
  session = null
  assert.equal((await shop.cart()).code, "sign_in_required")
  session = { userId: "u1", impersonatedBy: null }
})

test("관리 화면의 주문·재고 구획도 꺼져 있다(관리자 벽을 지난 뒤 provider_unavailable) — 보이지도 쓰이지도 않는다", async () => {
  await d.execute(`update "user" set role = 'admin', two_factor_enabled = true where id = 'u1'`)
  const consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  for (const name of ["orders", "stock"]) consoleMod.ADMIN_SECTIONS.push((await importRegistryFile(`feature-commerce/files/lib/launch/admin-sections/${name}.ts`)).default) // 등록부는 제품이 채우므로 시험이 밀어 넣는다
  const admin = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
  const calls = [
    admin.adminTable({ section: "orders" }),
    admin.adminRecord({ section: "orders", id: "00000000-0000-4000-8000-000000000000" }),
    admin.adminAct({ section: "orders", id: "00000000-0000-4000-8000-000000000000", action: "mark-preparing" }),
    admin.adminAct({ section: "orders", id: "00000000-0000-4000-8000-000000000000", action: "cancel", confirmed: true }),
    admin.adminTable({ section: "stock" }),
    admin.adminAct({ section: "stock", id: "example-mug", action: "save", fields: { quantity: "1" } }),
  ]
  for (const r of await Promise.all(calls)) {
    assert.equal(r.ok, false)
    assert.equal(r.code, "provider_unavailable")
  }
  const sections = await admin.adminSections()
  assert.deepEqual(sections.ok ? sections.data.filter((s) => s.id === "orders" || s.id === "stock") : "fail", [], "꺼진 상점의 구획은 사이드바에도 없다")
  assert.equal((await d.select().from(orders)).length, 0)
  await d.execute(`update "user" set role = null, two_factor_enabled = false where id = 'u1'`)
})

test("웹훅 경로는 404 — 본문을 읽지도 쓰지도 않는다", async () => {
  const route = await importRegistryFile("feature-commerce/files/app/api/webhooks/portone/route.ts")
  const res = await route.POST(new Request("https://shop.example.test/api/webhooks/portone", { method: "POST", body: JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "p" } }) }))
  assert.equal(res.status, 404)
  assert.deepEqual(await res.json(), { error: "not_found" })
})

test("Cron: 인증 없이는 401, 인증이 있으면 skipped(상점이 꺼져 있다) — 오류가 아니다", async () => {
  const route = await importRegistryFile("feature-commerce/files/app/api/cron/commerce/route.ts")
  const url = "https://shop.example.test/api/cron/commerce"
  assert.equal((await route.GET(new Request(url))).status, 401)
  assert.equal((await route.GET(new Request(url, { headers: { authorization: "Bearer wrong" } }))).status, 401)
  const res = await route.GET(new Request(url, { headers: { authorization: `Bearer ${CRON}` } }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { skipped: "commerce_disabled" })
  assert.equal(mailsSent, 0)
})
