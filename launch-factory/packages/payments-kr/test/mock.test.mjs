// mockGateway — 키 없는 미리보기용 게이트웨이. 메모리만 쓰고, 결제는 markPaid 로 일으킨다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { InvalidAmountError, mockGateway, UnsupportedCurrencyError } from "../src/index.ts"

const won = (amount) => ({ amount, currency: "KRW", vatIncluded: true })
const input = (amount = 39000) => ({ orderId: "order-1", orderName: "머그컵 외 1건", total: won(amount) })

test("prepare: 모의 세션을 돌려주고 verify 는 아직 pending", async () => {
  const g = mockGateway()
  const s = await g.prepare(input())
  assert.equal(s.provider, "mock")
  assert.match(s.paymentId, /^mock-[0-9a-f-]{36}$/)
  assert.equal(s.orderName, "머그컵 외 1건")
  assert.deepEqual(s.total, won(39000))
  assert.deepEqual(s.client, { orderId: "order-1" })
  assert.deepEqual(await g.verify(s.paymentId), { status: "pending", total: won(39000) })
})

test("prepare 마다 다른 paymentId", async () => {
  const g = mockGateway()
  const [a, b] = await Promise.all([g.prepare(input()), g.prepare(input())])
  assert.notEqual(a.paymentId, b.paymentId)
})

test("markPaid → verify 가 paid + 준비한 금액 그대로", async () => {
  const g = mockGateway()
  const s = await g.prepare(input(12000))
  g.markPaid(s.paymentId)
  assert.deepEqual(await g.verify(s.paymentId), { status: "paid", total: won(12000) })
})

test("모르는 paymentId: verify 는 not_found, markPaid/markFailed 는 던진다", async () => {
  const g = mockGateway()
  assert.deepEqual(await g.verify("mock-nope"), { status: "not_found" })
  assert.throws(() => g.markPaid("mock-nope"), /mock-nope/)
  assert.throws(() => g.markFailed("mock-nope"), /mock-nope/)
})

test("markFailed → failed", async () => {
  const g = mockGateway()
  const s = await g.prepare(input())
  g.markFailed(s.paymentId)
  assert.equal((await g.verify(s.paymentId)).status, "failed")
})

test("cancel: 결제 전은 payment_not_paid, 결제 뒤는 ok 후 canceled, 또 하면 already_canceled, 없는 건 payment_not_found", async () => {
  const g = mockGateway()
  const s = await g.prepare(input())
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "변심" }), { ok: false, code: "payment_not_paid" })
  g.markPaid(s.paymentId)
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "변심" }), { ok: true })
  assert.equal((await g.verify(s.paymentId)).status, "canceled")
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "변심" }), { ok: false, code: "already_canceled" })
  assert.deepEqual(await g.cancel({ paymentId: "mock-nope", reason: "x" }), { ok: false, code: "payment_not_found" })
})

test("원화가 아니면 던진다", async () => {
  const g = mockGateway()
  await assert.rejects(() => g.prepare({ ...input(), total: { amount: 10, currency: "USD", vatIncluded: true } }), UnsupportedCurrencyError)
})

test("금액은 1 이상의 정수여야 한다", async () => {
  const g = mockGateway()
  for (const bad of [0, -1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(() => g.prepare(input(bad)), InvalidAmountError, String(bad))
  }
})

test("cancel: 일부 환불은 낸 금액 안에서만, 다 돌려주면 canceled (예약금 환불)", async () => {
  const g = mockGateway()
  const s = await g.prepare(input())
  const total = s.total.amount
  g.markPaid(s.paymentId)
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "부분", amount: 0 }), { ok: false, code: "invalid_request" })
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "부분", amount: total + 1 }), { ok: false, code: "amount_exceeds_cancellable" })
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "부분", amount: 1 }), { ok: true })
  assert.equal((await g.verify(s.paymentId)).status, "paid", "일부만 돌려주면 아직 결제 건이다")
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "부분", amount: total }), { ok: false, code: "amount_exceeds_cancellable" })
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "나머지", amount: total - 1 }), { ok: true })
  assert.equal((await g.verify(s.paymentId)).status, "canceled")
  assert.deepEqual(await g.cancel({ paymentId: s.paymentId, reason: "또", amount: 1 }), { ok: false, code: "already_canceled" })
})
