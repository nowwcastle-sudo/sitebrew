import { test } from "node:test"
import assert from "node:assert/strict"
import { createTestTossClient, TossApiError, TossResponseError } from "../src/index.ts"

const customerKey = "01234567-89ab-4def-8123-456789abcdef"
const orderId = "order-test-123456"
const goodPayment = { mId: "test-mid", orderId, totalAmount: 4900, currency: "KRW", status: "DONE", type: "BILLING", card: {}, paymentKey: "payment-test" }
const response = (value, status = 200) => new Response(value === undefined ? null : JSON.stringify(value), { status })
function setup(reply) {
  const calls = []
  const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "test-mid", fetch: async (url, init) => { calls.push({ url, init }); return reply(url, init) } })
  return { client, calls }
}
const input = { billingKey: "billing/key", customerKey, orderId, orderName: "예시 구독", amount: 4900 }

test("테스트 키만 허용하고 transport 주입을 요구한다", () => {
  for (const secretKey of ["", "live_sk_abc", "test_gsk_abc"]) assert.throws(() => createTestTossClient({ secretKey, merchantId: "test-mid", fetch }))
  assert.throws(() => createTestTossClient({ secretKey: "test_sk_fake", merchantId: "test-mid" }))
})
test("빌링키 발급은 고객과 상점과 카드 응답을 대조한다", async () => {
  const { client, calls } = setup(() => response({ mId: "test-mid", customerKey, billingKey: "b-key", card: {} }))
  assert.deepEqual(await client.issue({ authKey: "auth", customerKey }), { billingKey: "b-key", customerKey })
  assert.equal(calls[0].url, "https://api.tosspayments.com/v1/billing/authorizations/issue")
  assert.equal(calls[0].init.redirect, "error")
  assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from("test_sk_fake:").toString("base64")}`)
  for (const bad of [{ mId: "other", customerKey, billingKey: "b", card: {} }, { mId: "test-mid", customerKey: "other", billingKey: "b", card: {} }, { mId: "test-mid", customerKey, billingKey: "b" }]) {
    await assert.rejects(() => setup(() => response(bad)).client.issue({ authKey: "auth", customerKey }), TossResponseError)
  }
})
test("결제 승인과 재조회는 상점·주문·금액·통화·타입·카드·성공 상태를 모두 검증한다", async () => {
  const { client, calls } = setup(() => response(goodPayment))
  assert.deepEqual(await client.charge(input), { paymentKey: "payment-test", orderId, amount: 4900 })
  assert.deepEqual(await client.lookup({ orderId, amount: 4900 }), { paymentKey: "payment-test", orderId, amount: 4900 })
  assert.equal(calls[0].url, "https://api.tosspayments.com/v1/billing/billing%2Fkey")
  assert.equal(calls[1].url, `https://api.tosspayments.com/v1/payments/orders/${orderId}`)
  for (const change of [{ mId: "other" }, { orderId: "other-order" }, { totalAmount: 1 }, { currency: "USD" }, { status: "WAITING_FOR_DEPOSIT" }, { type: "NORMAL" }, { card: null }, { paymentKey: "" }]) {
    const bad = setup(() => response({ ...goodPayment, ...change })).client
    await assert.rejects(() => bad.charge(input), TossResponseError)
    await assert.rejects(() => bad.lookup({ orderId, amount: 4900 }), TossResponseError)
  }
})
test("오류·응답 유실은 성공이나 새 승인으로 바꾸지 않는다", async () => {
  const { client, calls } = setup(() => { throw new Error("secret in transport error") })
  await assert.rejects(() => client.charge(input), (err) => err instanceof TossApiError && err.status === 0 && !err.message.includes("secret"))
  assert.equal(calls.length, 1)
  await assert.rejects(() => setup(() => response({ message: "secret" }, 500)).client.lookup({ orderId, amount: 4900 }), (err) => err instanceof TossApiError && err.status === 500 && !err.message.includes("secret"))
  await assert.rejects(() => setup(() => response(goodPayment, 201)).client.charge(input), TossApiError)
})
test("잘못된 입력은 요청하지 않으며 키 삭제는 공급자 응답을 확인한다", async () => {
  const { client, calls } = setup(() => response(undefined))
  for (const change of [{ billingKey: ".." }, { customerKey: "short" }, { amount: 0 }, { amount: 1.5 }, { orderId: "bad/../x" }]) await assert.rejects(() => client.charge({ ...input, ...change }))
  assert.equal(calls.length, 0)
  await client.deleteBillingKey("billing-key")
  assert.equal(calls[0].init.method, "DELETE")
  await assert.rejects(() => setup(() => response({}, 403)).client.deleteBillingKey("billing-key"), TossApiError)
})
