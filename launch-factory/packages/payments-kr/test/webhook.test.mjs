// verifyWebhook — Standard Webhooks 서명. 시험이 스스로 만든 whsec_ 비밀로 직접 서명한다(실제 값 아님).
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { PaymentsConfigError, verifyWebhook, WebhookRejected } from "../src/index.ts"

const SECRET = `whsec_${randomBytes(32).toString("base64")}`
const nowSec = () => Math.floor(Date.now() / 1000)

/** Standard Webhooks: HMAC-SHA256(base64 해제한 비밀, `${id}.${ts}.${본문}`) → `v1,<base64>` */
function sign(body, { secret = SECRET, id = `msg_${randomUUID()}`, ts = nowSec() } = {}) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64")
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")
  return { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": `v1,${sig}` }
}
const paid = (paymentId = "payment-1") => JSON.stringify({ type: "Transaction.Paid", timestamp: new Date().toISOString(), data: { storeId: "s", paymentId, transactionId: "t" } })

test("서명이 맞으면 paymentId·type·eventId 를 돌려준다", async () => {
  const body = paid("payment-abc")
  const headers = sign(body, { id: "msg_1" })
  assert.deepEqual(await verifyWebhook({ secret: SECRET, rawBody: body, headers }), { ignored: false, eventId: "msg_1", type: "Transaction.Paid", paymentId: "payment-abc" })
})

test("Headers 객체와 대문자 헤더 이름도 받는다", async () => {
  const body = paid()
  const h = new Headers(sign(body, { id: "msg_h" }))
  const r = await verifyWebhook({ secret: SECRET, rawBody: body, headers: h })
  assert.equal(r.ignored, false)
  const upper = Object.fromEntries(Object.entries(sign(body)).map(([k, v]) => [k.toUpperCase(), v]))
  assert.equal((await verifyWebhook({ secret: SECRET, rawBody: body, headers: upper })).ignored, false)
})

test("본문이 한 글자라도 바뀌면 거절(WebhookRejected, 사유 코드)", async () => {
  const body = paid("payment-1")
  const headers = sign(body)
  await assert.rejects(
    () => verifyWebhook({ secret: SECRET, rawBody: body.replace("payment-1", "payment-2"), headers }),
    (e) => e instanceof WebhookRejected && e.reason === "signature_mismatch",
  )
})

test("다른 비밀로 서명했으면 거절", async () => {
  const body = paid()
  const other = `whsec_${randomBytes(32).toString("base64")}`
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body, { secret: other }) }), (e) => e instanceof WebhookRejected && e.reason === "signature_mismatch")
})

test("5분 넘은 타임스탬프는 거절, 미래도 거절", async () => {
  const body = paid()
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body, { ts: nowSec() - 6 * 60 }) }), (e) => e instanceof WebhookRejected && e.reason === "timestamp_too_old")
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body, { ts: nowSec() + 6 * 60 }) }), (e) => e instanceof WebhookRejected && e.reason === "timestamp_too_new")
})

test("필수 헤더가 없으면 거절", async () => {
  const body = paid()
  const rest = sign(body)
  delete rest["webhook-signature"]
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: rest }), (e) => e instanceof WebhookRejected && e.reason === "missing_headers")
})

test("비밀이 비어 있거나 형식이 틀리면 거절이 아니라 설정 오류로 던진다", async () => {
  const body = paid()
  await assert.rejects(() => verifyWebhook({ secret: "", rawBody: body, headers: sign(body) }), (e) => e instanceof PaymentsConfigError && !e.message.includes(SECRET))
  await assert.rejects(() => verifyWebhook({ secret: "whsec_%%%", rawBody: body, headers: sign(body) }), PaymentsConfigError)
})

test("서명이 맞아도 본문이 JSON 이 아니면 거절", async () => {
  const body = "not json"
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body) }), (e) => e instanceof WebhookRejected && e.reason === "malformed_payload")
})

test("모르는 type(BillingKey.* 등)은 무시 표시로 돌려준다", async () => {
  const body = JSON.stringify({ type: "BillingKey.Issued", timestamp: new Date().toISOString(), data: { storeId: "s", billingKey: "k" } })
  assert.deepEqual(await verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body, { id: "msg_i" }) }), { ignored: true, eventId: "msg_i", type: "BillingKey.Issued" })
  const fresh = JSON.stringify({ type: "Brand.New", data: {} })
  assert.equal((await verifyWebhook({ secret: SECRET, rawBody: fresh, headers: sign(fresh) })).ignored, true)
})

test("Transaction.* 인데 paymentId 가 없으면 거절(서명은 맞아도 쓸 수 없는 본문)", async () => {
  const body = JSON.stringify({ type: "Transaction.Paid", data: { storeId: "s" } })
  await assert.rejects(() => verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body) }), (e) => e instanceof WebhookRejected && e.reason === "malformed_payload")
})

test("Transaction.Cancelled·PartialCancelled·Failed 도 paymentId 를 돌려준다(재조회는 호출 쪽)", async () => {
  for (const type of ["Transaction.Cancelled", "Transaction.PartialCancelled", "Transaction.Failed", "Transaction.Ready", "Transaction.PayPending"]) {
    const body = JSON.stringify({ type, data: { paymentId: "p9" } })
    const r = await verifyWebhook({ secret: SECRET, rawBody: body, headers: sign(body) })
    assert.deepEqual([r.ignored, r.type, r.paymentId], [false, type, "p9"])
  }
})
