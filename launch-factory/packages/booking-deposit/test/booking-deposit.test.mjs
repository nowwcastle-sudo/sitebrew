// 예약금 훅의 결제 중개 구현 — 모의 게이트웨이로 hold·verify·refund, 그리고 예약 서비스와 이어 한 바퀴(결제 → 확정 → 일부 환불).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { bookings, db, hitRateLimit } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { BOOKING_RATE_RULES, createBookingService } from "@launch-factory/booking"
import { mockGateway } from "@launch-factory/payments-kr"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { gatewayDeposit } from "../src/index.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const CONFIG = {
  timeZone: "Asia/Seoul",
  mode: "instant",
  services: [{ id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 2, partyMax: 2, deposit: 10_000 }],
  weekly: { mon: [["10:00", "18:00"]], tue: [["10:00", "18:00"]], wed: [["10:00", "18:00"]], thu: [["10:00", "18:00"]], fri: [["10:00", "18:00"]] },
  closedDates: [],
  slotStepMin: 30,
  leadMinutes: 120,
  horizonDays: 200,
  cancelBeforeMinutes: 120,
  reminderBeforeMinutes: 0,
  retainDays: 365,
  depositPolicy: { fullRefundBeforeMinutes: 1440, laterRefundPercent: 50 },
}
let seq = 0
const booking = (extra = {}) => ({ id: `row-${++seq}`, reference: `B-TEST${seq}`, depositRef: null, ...extra })

test("hold: 결제 세션은 설정 금액(원)으로 만들고, 결제 번호는 공급자 채번이다", async () => {
  const gateway = mockGateway()
  const hook = gatewayDeposit(gateway)
  const held = await hook.hold(booking(), { amount: 10_000, currency: "KRW", orderName: "커트 예약금" })
  assert.equal(held.ok, true)
  assert.equal(held.ref, held.session.paymentId)
  assert.equal(held.session.total.amount, 10_000)
  assert.equal(held.session.provider, "mock")
  assert.equal(held.session.client.orderId, "B-TEST1")
  // 1원 미만·소수는 결제 중개가 던진다(훅은 삼키지 않는다 — 서비스가 attempt 로 받아 deposit_failed 로 닫는다)
  await assert.rejects(hook.hold(booking(), { amount: 0, currency: "KRW", orderName: "x" }))
})

test("verify: 결제 전 pending · 결제 뒤 paid + 공급자가 본 금액 · 모르는 번호·번호 없음은 not_found", async () => {
  const gateway = mockGateway()
  const hook = gatewayDeposit(gateway)
  const held = await hook.hold(booking(), { amount: 10_000, currency: "KRW", orderName: "x" })
  const row = booking({ depositRef: held.ref })
  assert.deepEqual(await hook.verify(row), { status: "pending" })
  gateway.markPaid(held.ref)
  assert.deepEqual(await hook.verify(row), { status: "paid", amount: 10_000, currency: "KRW" })
  assert.deepEqual(await hook.verify(booking({ depositRef: "nope" })), { status: "not_found" })
  assert.deepEqual(await hook.verify(booking()), { status: "not_found" })
  gateway.markFailed((await hook.hold(booking(), { amount: 5_000, currency: "KRW", orderName: "y" })).ref)
})

test("refund: 전액은 금액을 싣지 않고, 일부는 금액을 싣는다 · 이미 취소된 건은 다시 돌려주지 않는다 · 결제 전 건은 실패", async () => {
  const calls = []
  const gateway = mockGateway()
  const spy = { ...gateway, cancel: (input) => (calls.push(input), gateway.cancel(input)) }
  const hook = gatewayDeposit(spy)
  const held = await hook.hold(booking(), { amount: 10_000, currency: "KRW", orderName: "x" })
  const row = booking({ depositRef: held.ref })
  assert.deepEqual(await hook.refund(row, { amount: 10_000, full: true, reason: "r" }), { ok: false, code: "payment_not_paid" })
  gateway.markPaid(held.ref)
  assert.deepEqual(await hook.refund(row, { amount: 10_000, full: true, reason: "r" }), { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].amount, undefined)
  // 같은 환불을 다시 불러도 공급자에 또 취소하지 않는다(멈춘 환불 이어받기)
  assert.deepEqual(await hook.refund(row, { amount: 10_000, full: true, reason: "r" }), { ok: true })
  assert.equal(calls.length, 1)

  const partial = await hook.hold(booking(), { amount: 10_000, currency: "KRW", orderName: "x" })
  gateway.markPaid(partial.ref)
  assert.deepEqual(await hook.refund(booking({ depositRef: partial.ref }), { amount: 5_000, full: false, reason: "r" }), { ok: true })
  assert.equal(calls.at(-1).amount, 5_000)
  assert.deepEqual(await hook.refund(booking(), { amount: 1, full: true, reason: "r" }), { ok: false, code: "payment_not_found" })
})

test("예약 서비스와 이어서: 접수 → mock 결제 → 확정 → 기한 뒤 취소는 비율만큼 환불", async () => {
  const gateway = mockGateway()
  const now = { at: new Date("2026-11-01T00:00:00.000Z") }
  const mock = createMailer({ mode: "mock", log: () => {} })
  const svc = createBookingService({
    db: d,
    mailer: mock,
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: () => now.at, rules: BOOKING_RATE_RULES }),
    turnstile: createTurnstile({ mode: "mock" }),
    config: CONFIG,
    owner: { email: "owner@shop.test" },
    productName: "Salon",
    deposit: gatewayDeposit(gateway),
    now: () => now.at,
    onError: () => {},
  })
  const r = await svc.submit({ service: "cut", startsAt: "2026-11-03T10:00:00+09:00", contact: "guest@example.com" }, { ip: "203.0.113.9" })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.data.deposit.session.provider, "mock")
  const paymentId = r.data.deposit.session.paymentId
  assert.equal((await svc.confirmDeposit({ paymentId }, { ip: "203.0.113.9" })).code, "payment_pending")
  gateway.markPaid(paymentId)
  assert.equal((await svc.confirmDeposit({ paymentId }, { ip: "203.0.113.9" })).data.status, "confirmed")
  now.at = new Date("2026-11-02T20:00:00.000Z") // 시작 5시간 전 — 전액 환불 기한(24시간 전)은 지났고 취소 마감(2시간 전)은 아직이다
  const c = await svc.cancel({ reference: r.data.id, contact: "guest@example.com" }, { ip: "203.0.113.10" })
  assert.equal(c.ok, true, JSON.stringify(c))
  assert.deepEqual(c.data.deposit, { status: "refunded", refundedAmount: 5_000 })
  const row = (await d.select().from(bookings).where(eq(bookings.reference, r.data.id)))[0]
  assert.equal(row.depositRefundedAmount, 5_000)
})
