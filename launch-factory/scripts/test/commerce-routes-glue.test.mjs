// 상점 웹훅·Cron 경로(계획 3a B6) — 진짜 route.ts 와 진짜 commerce.ts 조립을 그대로 부른다. 결제 중개(payments)만 mock 게이트웨이 + 시험 웹훅 비밀로 대신한다
// (live 의 PortOne 호출은 네트워크라 시험하지 않는다 — 서명 확인(Standard Webhooks)은 진짜다).
//   웹훅: 서명 불량 400 · 모르는 type 200 · 중복 webhook-id 는 한 번만 · 결제 완료 → 주문 paid + 메일 한 통 · 결제 전이면 503(재전송 처리)
//   Cron: 인증 첫 줄(401) · 만료된 결제 대기 주문 취소 + 재고 반환 · 웹훅을 놓친 결제는 취소하지 않고 확정
import assert from "node:assert/strict"
import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { after, before, test } from "node:test"
import { eq, sql } from "drizzle-orm"
import { db, orders, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { mockGateway } from "@launch-factory/payments-kr"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  mailer: ["mailer"],
  payments: ["payments"],
})

const SECRET = `whsec_${randomBytes(32).toString("base64")}`
const CRON = "cron-secret-for-this-test"
const ADDRESS = { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1" }
const at = new Date("2026-10-22T00:00:00.000Z")
const sent = []
let d
let gateway
let lib
let webhook
let cron

const nowSec = () => Math.floor(Date.now() / 1000)
function signed(body, { id = `msg_${randomUUID()}`, secret = SECRET } = {}) {
  const ts = nowSec()
  const sig = createHmac("sha256", Buffer.from(secret.slice("whsec_".length), "base64")).update(`${id}.${ts}.${body}`).digest("base64")
  return { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": `v1,${sig}` }
}
const post = (body, headers) => webhook.POST(new Request("https://shop.example.test/api/webhooks/portone", { method: "POST", body, headers }))
const paidEvent = (paymentId) => JSON.stringify({ type: "Transaction.Paid", timestamp: new Date().toISOString(), data: { storeId: "s", paymentId } })
const statusOf = async (id) => (await d.select({ status: orders.status }).from(orders).where(eq(orders.id, id)))[0]?.status
const stockOf = async (sku) => (await d.execute(sql`select quantity from stock_levels where sku = ${sku}`)).rows[0]?.quantity

/** 장바구니 → 주문(결제 대기). 진짜 조립의 포트를 쓴다 */
async function pendingOrder(userId, productId = "example-notebook", quantity = 1) {
  const port = await lib.commerceFor(userId)
  assert.equal((await port.setCartLine({ productId, quantity })).ok, true)
  const placed = await port.placeOrder({ address: ADDRESS, confirmed: true })
  assert.equal(placed.ok, true, JSON.stringify(placed))
  return placed.data
}

before(async () => {
  process.env.CRON_SECRET = CRON
  d = await db.local()
  for (const id of ["u1", "u2"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  gateway = mockGateway()
  const mock = createMailer({ mode: "mock", log: () => {} })
  stubs.config = { PRODUCT_NAME: "예시 상점", DEFAULT_LOCALE: "ko", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "live" }), required: (n) => `x-${n}` }
  stubs.mailer = { mailer: () => ({ mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) }) }
  stubs.payments = { payments: () => ({ enabled: true, mode: "live", gateway, webhookSecret: SECRET }) }
  lib = await importRegistryFile("feature-commerce/files/lib/launch/commerce.ts")
  webhook = await importRegistryFile("feature-commerce/files/app/api/webhooks/portone/route.ts")
  cron = await importRegistryFile("feature-commerce/files/app/api/cron/commerce/route.ts")
})
after(async () => {
  await d?.$client.close()
})

test("서명이 틀리면 400 이고 주문도 이벤트 기록도 변하지 않는다(헤더 없음·다른 비밀·본문 변조)", async () => {
  const placed = await pendingOrder("u1")
  gateway.markPaid(placed.payment.paymentId)
  const body = paidEvent(placed.payment.paymentId)
  const other = `whsec_${randomBytes(32).toString("base64")}`
  for (const headers of [{}, signed(body, { secret: other }), signed(body.replace(placed.payment.paymentId, "x"))]) {
    const res = await post(body, headers)
    assert.equal(res.status, 400)
    assert.ok((await res.json()).error)
  }
  assert.equal(await statusOf(placed.order.id), "pending_payment")
  assert.equal((await d.execute(sql`select count(*)::int as n from webhook_events`)).rows[0].n, 0)
  // 이어서 같은 주문을 정상 이벤트로 확정해 다음 시험이 깨끗하게 시작한다
  assert.equal((await post(body, signed(body))).status, 200)
})

test("모르는 type(빌링키 등)은 서명이 맞으면 200 — 아무것도 바꾸지 않는다", async () => {
  const body = JSON.stringify({ type: "BillingKey.Issued", data: { billingKey: "k" } })
  const res = await post(body, signed(body))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { received: true, result: "ignored" })
})

test("결제 완료 이벤트 → 주문 paid · 메일 한 통 · 같은 webhook-id 를 다시 보내도 한 번만", async () => {
  sent.length = 0
  const placed = await pendingOrder("u2")
  gateway.markPaid(placed.payment.paymentId)
  const body = paidEvent(placed.payment.paymentId)
  const headers = signed(body, { id: "msg_once" })
  const first = await post(body, headers)
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), { received: true, result: "confirmed" })
  assert.equal(await statusOf(placed.order.id), "paid")
  assert.equal(sent.length, 1)
  const again = await post(body, headers)
  assert.equal(again.status, 200)
  assert.deepEqual(await again.json(), { received: true, result: "duplicate" })
  assert.equal(sent.length, 1, "중복 이벤트가 메일을 또 보내지 않는다")
})

test("공급자가 아직 결제 전으로 보면 503 — 기록이 남지 않아 같은 id 의 재전송이 처리된다", async () => {
  const placed = await pendingOrder("u1")
  const body = paidEvent(placed.payment.paymentId)
  const headers = signed(body, { id: "msg_retry" })
  assert.equal((await post(body, headers)).status, 503)
  assert.equal(await statusOf(placed.order.id), "pending_payment")
  gateway.markPaid(placed.payment.paymentId)
  assert.equal((await post(body, headers)).status, 200)
  assert.equal(await statusOf(placed.order.id), "paid")
})

test("Cron: 인증이 첫 줄이다 — 없거나 틀리면 401 이고 아무것도 정리하지 않는다", async () => {
  const placed = await pendingOrder("u2", "example-notebook", 2)
  await d.execute(sql`update orders set expires_at = now() - interval '1 minute' where id = ${placed.order.id}`)
  const url = "https://shop.example.test/api/cron/commerce"
  assert.equal((await cron.GET(new Request(url))).status, 401)
  assert.equal((await cron.GET(new Request(url, { headers: { authorization: "Bearer nope" } }))).status, 401)
  assert.equal(await statusOf(placed.order.id), "pending_payment")
  // 다음 시험이 이 주문의 수량·취소 수를 세지 않도록 직접 정리한다
  const port = await lib.commerceFor("u2")
  assert.equal((await port.cancelOrder({ orderId: placed.order.id, confirmed: true })).ok, true)
})

test("Cron: 만료된 결제 대기 주문은 취소하고 재고를 돌려준다 — 웹훅을 놓쳐 결제됐던 주문은 취소하지 않고 확정한다", async () => {
  const url = "https://shop.example.test/api/cron/commerce"
  const auth = { headers: { authorization: `Bearer ${CRON}` } }
  const abandoned = await pendingOrder("u1", "example-notebook", 3)
  const missed = await pendingOrder("u2", "example-notebook", 1)
  gateway.markPaid(missed.payment.paymentId) // 결제는 됐는데 웹훅이 오지 않았다
  const stockBefore = await stockOf("example-notebook")
  sent.length = 0
  await d.execute(sql`update orders set expires_at = now() - interval '1 minute' where id in (${abandoned.order.id}, ${missed.order.id})`)

  const res = await cron.GET(new Request(url, auth))
  assert.equal(res.status, 200)
  const report = await res.json()
  assert.equal(report.canceled, 1)
  assert.equal(report.confirmed, 1)
  assert.equal(await statusOf(abandoned.order.id), "canceled")
  assert.equal(await statusOf(missed.order.id), "paid")
  assert.equal(await stockOf("example-notebook"), stockBefore + 3, "취소된 주문의 수량만 돌아온다")
  assert.equal(sent.length, 1, "확정된 주문의 확인 메일")
  // 두 번째 실행은 할 일이 없다
  assert.deepEqual(await (await cron.GET(new Request(url, auth))).json(), { canceled: 0, confirmed: 0, skipped: 0 })
})
