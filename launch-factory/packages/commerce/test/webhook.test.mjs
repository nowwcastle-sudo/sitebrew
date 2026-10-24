// 웹훅 처리 — 서명(400) · 쓰지 않는 이벤트(200) · 중복 id 는 한 번만 · 결제 안 끝남(503, 기록 되돌림) · 던지면 기록을 되돌린다.
// 시험이 스스로 만든 whsec_ 비밀로 직접 서명한다(실제 값 아님).
import { test, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { placeOrder } from "../src/checkout.ts"
import { withDefaults } from "../src/deps.ts"
import { handleWebhook } from "../src/webhook.ts"
import { ADDRESS, makeDeps, newDb, putCart } from "./helpers.mjs"

const SECRET = `whsec_${randomBytes(32).toString("base64")}`
const nowSec = () => Math.floor(Date.now() / 1000)

function sign(body, { secret = SECRET, id = `msg_${randomUUID()}`, ts = nowSec() } = {}) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64")
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")
  return new Headers({ "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": `v1,${sig}` })
}
const event = (type, paymentId) => JSON.stringify({ type, timestamp: new Date().toISOString(), data: { storeId: "s", paymentId } })

let d
before(async () => {
  d = await newDb()
})
beforeEach(async () => {
  await d.execute(sql`truncate table order_items, orders, cart_items, stock_levels, webhook_events cascade`)
})
after(async () => {
  await d?.$client.close()
})

async function pending() {
  const made = makeDeps(d)
  await putCart(d, "buyer", [["mug", 1]])
  const placed = await placeOrder(withDefaults(made.deps), { userId: "buyer", address: ADDRESS })
  assert.equal(placed.ok, true)
  return { ...made, order: placed.value.order, payment: placed.value.payment }
}
const send = (deps, body, headers = sign(body)) => handleWebhook(deps, { secret: SECRET, rawBody: body, headers })
const statusOf = async (id) => (await d.execute(sql`select status from orders where id = ${id}`)).rows[0]?.status
const events = async () => (await d.execute(sql`select event_id from webhook_events`)).rows

test("결제 완료 이벤트 → 주문이 paid, 메일 한 통, 200 confirmed", async () => {
  const { deps, gateway, mailer, order, payment } = await pending()
  gateway.markPaid(payment.paymentId)
  const reply = await send(deps, event("Transaction.Paid", payment.paymentId))
  assert.deepEqual(reply, { status: 200, body: { received: true, result: "confirmed" } })
  assert.equal(await statusOf(order.id), "paid")
  assert.equal(mailer.sent.length, 1)
})

test("같은 webhook-id 를 두 번 보내면 한 번만 처리한다(둘째는 duplicate)", async () => {
  const { deps, gateway, mailer, order, payment } = await pending()
  gateway.markPaid(payment.paymentId)
  const body = event("Transaction.Paid", payment.paymentId)
  const headers = sign(body, { id: "msg_same" })
  assert.equal((await send(deps, body, headers)).body.result, "confirmed")
  assert.deepEqual(await send(deps, body, headers), { status: 200, body: { received: true, result: "duplicate" } })
  assert.equal(mailer.sent.length, 1)
  assert.equal(await statusOf(order.id), "paid")
  assert.equal((await events()).length, 1)
})

test("다른 webhook-id 로 같은 결제가 다시 오면 이미 확정으로 답한다(메일 한 통)", async () => {
  const { deps, gateway, mailer, payment } = await pending()
  gateway.markPaid(payment.paymentId)
  const body = event("Transaction.Paid", payment.paymentId)
  await send(deps, body)
  const again = await send(deps, body)
  assert.deepEqual(again.body, { received: true, result: "already_confirmed" })
  assert.equal(mailer.sent.length, 1)
})

test("서명이 틀리면 400 이고 기록도 주문 변화도 없다", async () => {
  const { deps, gateway, order, payment } = await pending()
  gateway.markPaid(payment.paymentId)
  const body = event("Transaction.Paid", payment.paymentId)
  const other = `whsec_${randomBytes(32).toString("base64")}`
  assert.deepEqual(await send(deps, body, sign(body, { secret: other })), { status: 400, body: { error: "signature_mismatch" } })
  assert.equal((await send(deps, body, new Headers())).status, 400)
  assert.equal((await send(deps, body.replace(payment.paymentId, "x"), sign(body))).status, 400)
  assert.equal(await statusOf(order.id), "pending_payment")
  assert.equal((await events()).length, 0)
})

test("모르는 type(빌링키 등)은 서명이 맞으면 200 ignored, 기록하지 않는다", async () => {
  const { deps, order } = await pending()
  const body = JSON.stringify({ type: "BillingKey.Issued", data: { billingKey: "k" } })
  assert.deepEqual(await send(deps, body), { status: 200, body: { received: true, result: "ignored" } })
  assert.equal(await statusOf(order.id), "pending_payment")
  assert.equal((await events()).length, 0)
})

test("결제 실패·취소 이벤트는 받아 두기만 한다(주문은 그대로, 200)", async () => {
  const { deps, gateway, order, payment } = await pending()
  gateway.markFailed(payment.paymentId)
  assert.deepEqual(await send(deps, event("Transaction.Failed", payment.paymentId)), { status: 200, body: { received: true, result: "not_applicable" } })
  assert.equal(await statusOf(order.id), "pending_payment")
  assert.equal((await events()).length, 1)
})

test("결제 완료 이벤트인데 공급자가 아직 결제 전이면 503 이고 기록을 되돌려 재전송이 처리된다", async () => {
  const { deps, gateway, order, payment } = await pending()
  const body = event("Transaction.Paid", payment.paymentId)
  const headers = sign(body, { id: "msg_retry" })
  assert.deepEqual(await send(deps, body, headers), { status: 503, body: { error: "payment_pending" } })
  assert.equal((await events()).length, 0)
  gateway.markPaid(payment.paymentId)
  assert.equal((await send(deps, body, headers)).body.result, "confirmed")
  assert.equal(await statusOf(order.id), "paid")
})

test("없는 결제 건은 200 not_applicable(code not_found) — 다시 보내도 같다", async () => {
  const { deps } = await pending()
  const reply = await send(deps, event("Transaction.Paid", "unknown-payment"))
  assert.deepEqual(reply, { status: 200, body: { received: true, result: "not_applicable", code: "not_found" } })
})

test("주문이 없는 결제 번호는 unclaimed 에 물어본다 — 확정·이미 확정은 200, 대기는 503(기록 되돌림), 내 것이 아니면 예전 그대로", async () => {
  const { deps } = await pending()
  const ask = (answer) => {
    const seen = []
    return { seen, unclaimed: async (id) => (seen.push(id), answer) }
  }
  const run = async (answer, id = `msg_${randomUUID()}`) => {
    const a = ask(answer)
    const body = event("Transaction.Paid", "booking-payment")
    const reply = await handleWebhook(deps, { secret: SECRET, rawBody: body, headers: sign(body, { id }), unclaimed: a.unclaimed })
    return { reply, seen: a.seen }
  }
  const confirmed = await run("confirmed")
  assert.deepEqual(confirmed.reply, { status: 200, body: { received: true, result: "confirmed" } })
  assert.deepEqual(confirmed.seen, ["booking-payment"])
  assert.equal((await run("already_confirmed")).reply.body.result, "already_confirmed")
  assert.equal((await run("not_applicable")).reply.body.result, "not_applicable")
  const before = (await events()).length
  assert.deepEqual((await run("pending")).reply, { status: 503, body: { error: "payment_pending" } })
  assert.equal((await events()).length, before, "대기면 기록을 되돌려 재전송이 처리된다")
  assert.deepEqual((await run("not_mine")).reply, { status: 200, body: { received: true, result: "not_applicable", code: "not_found" } })
})

test("확정 중 던지면 기록을 되돌리고 그대로 던진다(공급자가 다시 보내면 처리된다)", async () => {
  const { deps, gateway, order, payment } = await pending()
  gateway.markPaid(payment.paymentId)
  const body = event("Transaction.Paid", payment.paymentId)
  const headers = sign(body, { id: "msg_boom" })
  const verify = gateway.verify
  gateway.verify = async () => {
    throw new Error("gateway down")
  }
  await assert.rejects(() => send(deps, body, headers), /gateway down/)
  assert.equal((await events()).length, 0)
  gateway.verify = verify
  assert.equal((await send(deps, body, headers)).body.result, "confirmed")
  assert.equal(await statusOf(order.id), "paid")
})

test("비밀 형식이 틀리면 거절이 아니라 설정 오류로 던진다", async () => {
  const { deps } = await pending()
  const body = event("Transaction.Paid", "p")
  await assert.rejects(() => handleWebhook(deps, { secret: "not-a-secret", rawBody: body, headers: sign(body) }))
})
