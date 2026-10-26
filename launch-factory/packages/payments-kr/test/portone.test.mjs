// portoneGateway — 주입한 가짜 클라이언트로 prepare/verify/cancel 사상을 본다. 진짜 네트워크는 부르지 않는다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { Payment } from "@portone/server-sdk"
import { InvalidAmountError, portoneGateway, UnsupportedCurrencyError } from "../src/index.ts"
import { fakePortOne, payment } from "./fake-portone.mjs"

const won = (amount) => ({ amount, currency: "KRW", vatIncluded: true })
const setup = () => {
  const f = fakePortOne()
  const gateway = portoneGateway({ client: f.client, storeId: "store-test", channelKey: "channel-test" })
  return { ...f, gateway }
}

test("prepare: 브라우저 결제창에 필요한 공개 값만 client 에 싣는다", async () => {
  const { gateway } = setup()
  const s = await gateway.prepare({ orderId: "o1", orderName: "머그컵", total: won(39000) })
  assert.equal(s.provider, "portone")
  assert.match(s.paymentId, /^payment-[0-9a-f-]{36}$/)
  assert.deepEqual(s.client, { storeId: "store-test", channelKey: "channel-test", orderId: "o1" })
  assert.deepEqual(s.total, won(39000))
  assert.equal(s.orderName, "머그컵")
})

test("prepare: 원화가 아니거나 금액이 정수가 아니면 던진다", async () => {
  const { gateway } = setup()
  await assert.rejects(() => gateway.prepare({ orderId: "o", orderName: "x", total: { amount: 5, currency: "EUR", vatIncluded: true } }), UnsupportedCurrencyError)
  await assert.rejects(() => gateway.prepare({ orderId: "o", orderName: "x", total: won(1.5) }), InvalidAmountError)
  await assert.rejects(() => gateway.prepare({ orderId: "o", orderName: "x", total: won(0) }), InvalidAmountError)
})

test("verify: PAID 는 서버가 본 금액 그대로 돌려준다(금액 대조는 호출 쪽 몫 — 다르면 failed 로 바꾸지 않는다)", async () => {
  const { gateway, payments, calls } = setup()
  payments.set("p1", payment("PAID", 39000))
  assert.deepEqual(await gateway.verify("p1"), { status: "paid", total: won(39000) })
  payments.set("p2", payment("PAID", 100))
  assert.deepEqual(await gateway.verify("p2"), { status: "paid", total: won(100) })
  assert.deepEqual(calls.get, [{ paymentId: "p1" }, { paymentId: "p2" }])
})

test("verify: 상태 사상 표 — 모르는 값은 pending", async () => {
  const { gateway, payments } = setup()
  const table = {
    READY: "pending",
    PAY_PENDING: "pending",
    VIRTUAL_ACCOUNT_ISSUED: "pending",
    PAID: "paid",
    FAILED: "failed",
    CANCELLED: "canceled",
    PARTIAL_CANCELLED: "canceled",
    SOMETHING_NEW: "pending",
  }
  for (const [portone, ours] of Object.entries(table)) {
    payments.set(portone, payment(portone, 1000))
    assert.equal((await gateway.verify(portone)).status, ours, portone)
  }
})

test("verify: SDK 가 알아보지 못한 응답(Unrecognized 기호)은 pending 이고 금액이 없다", async () => {
  const { gateway, payments } = setup()
  payments.set("u", { status: Symbol("unrecognized") })
  assert.deepEqual(await gateway.verify("u"), { status: "pending" })
})

test("verify: PAYMENT_NOT_FOUND 는 던지지 않고 not_found", async () => {
  const { gateway } = setup()
  assert.deepEqual(await gateway.verify("missing"), { status: "not_found" })
})

test("verify: 그 밖의 SDK 오류와 네트워크 오류는 그대로 던진다(웹훅 처리기가 500 으로 재전송을 받는다)", async () => {
  const { gateway, failWith } = setup()
  failWith.get = new Payment.GetPaymentError({ type: "UNAUTHORIZED" })
  await assert.rejects(() => gateway.verify("p"), Payment.GetPaymentError)
  failWith.get = new TypeError("fetch failed")
  await assert.rejects(() => gateway.verify("p"), /fetch failed/)
})

test("verify: 원화가 아닌 결제 건이 오면 던진다", async () => {
  const { gateway, payments } = setup()
  payments.set("usd", payment("PAID", 1000, "USD"))
  await assert.rejects(() => gateway.verify("usd"), UnsupportedCurrencyError)
})

test("cancel: 전액 취소를 요청한다(amount 를 싣지 않는다)", async () => {
  const { gateway, calls } = setup()
  assert.deepEqual(await gateway.cancel({ paymentId: "p1", reason: "고객 요청" }), { ok: true })
  assert.deepEqual(calls.cancel, [{ paymentId: "p1", reason: "고객 요청" }])
})

test("cancel: SDK 오류 코드를 우리 코드로 사상한다", async () => {
  const { gateway, failWith } = setup()
  const table = {
    PAYMENT_NOT_FOUND: "payment_not_found",
    PAYMENT_NOT_PAID: "payment_not_paid",
    PAYMENT_ALREADY_CANCELLED: "already_canceled",
    CANCEL_AMOUNT_EXCEEDS_CANCELLABLE_AMOUNT: "amount_exceeds_cancellable",
    FORBIDDEN: "forbidden",
    UNAUTHORIZED: "unauthorized",
    INVALID_REQUEST: "invalid_request",
    PG_PROVIDER: "provider_error",
    SOMETHING_NEW: "cancel_failed",
  }
  for (const [type, code] of Object.entries(table)) {
    failWith.cancel = new Payment.CancelPaymentError({ type })
    assert.deepEqual(await gateway.cancel({ paymentId: "p", reason: "r" }), { ok: false, code }, type)
  }
})

test("cancel: 네트워크 같은 SDK 밖 오류는 던지지 않고 provider_unreachable", async () => {
  const { gateway, failWith } = setup()
  failWith.cancel = new TypeError("fetch failed")
  assert.deepEqual(await gateway.cancel({ paymentId: "p", reason: "r" }), { ok: false, code: "provider_unreachable" })
})

test("cancel: 일부 환불은 amount 를 싣고, 잘못된 금액은 공급자를 부르지 않는다", async () => {
  const { gateway, calls } = setup()
  assert.deepEqual(await gateway.cancel({ paymentId: "p1", reason: "예약 취소", amount: 7000 }), { ok: true })
  assert.deepEqual(calls.cancel, [{ paymentId: "p1", reason: "예약 취소", amount: 7000 }])
  for (const amount of [0, -1, 1.5, Number.NaN]) assert.deepEqual(await gateway.cancel({ paymentId: "p1", reason: "x", amount }), { ok: false, code: "invalid_request" })
  assert.equal(calls.cancel.length, 1)
})
