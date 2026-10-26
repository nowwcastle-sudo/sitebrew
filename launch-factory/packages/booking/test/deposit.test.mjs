// 예약금(계획 3d L3) — 결제 대기 → 결제 확정 → 취소 환불, 만료, 중복 확정, 위조 금액, 환불 실패. PGlite + 가짜 결제 훅(fakeDeposit).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { bookings, db, hitRateLimit } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { t } from "@launch-factory/i18n"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { BOOKING_RATE_RULES, createBookingService, fakeDeposit, refundFor, parseBookingConfig } from "../src/index.ts"
import { sampleConfig } from "./fixtures.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const store = () => ({ hit: (k, w, n) => hitRateLimit(d, k, w, n) })
const clock = (iso) => {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
let ipSeq = 0
const freshIp = () => `198.51.100.${(++ipSeq % 250) + 1}`
let contactSeq = 0
const freshEmail = () => `payer${++contactSeq}@example.com`
const OWNER = { email: "owner@shop.test" }
const MIN = 60_000

const DAYS = []
for (let i = 0; DAYS.length < 60; i++) {
  const at = new Date(Date.UTC(2026, 10, 2 + i))
  if (at.getUTCDay() >= 1 && at.getUTCDay() <= 5 && at.toISOString().slice(0, 10) !== "2026-12-25") DAYS.push(at.toISOString().slice(0, 10))
}
let dayIdx = 0
const freshStart = (hhmm = "10:00") => `${DAYS[dayIdx++]}T${hhmm}:00+09:00`

/** cut 은 예약금 10000원(수용 2), color 는 예약금 없음(수용 1), tight 는 예약금 20000원(수용 1) */
const depositConfig = (patch = {}) =>
  sampleConfig({
    horizonDays: 200,
    services: [
      { id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 2, partyMax: 3, deposit: 10_000 },
      { id: "color", name: { ko: "염색", en: "Color" }, durationMin: 120, capacity: 1, partyMax: 1 },
      { id: "tight", name: { ko: "집중 케어", en: "Treatment" }, durationMin: 60, capacity: 1, partyMax: 1, deposit: 20_000 },
    ],
    ...patch,
  })

function setup({ config = {}, now = clock("2026-11-01T00:00:00.000Z"), deposit = fakeDeposit(), ...rest } = {}) {
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const requests = []
  const mailer = { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) }
  const errors = []
  const notices = []
  const svc = createBookingService({
    db: d,
    mailer,
    limiter: createRateLimiter({ store: store(), now: now.now, rules: BOOKING_RATE_RULES }),
    turnstile: createTurnstile({ mode: "mock" }),
    config: depositConfig(config),
    owner: OWNER,
    productName: "Salon",
    manageUrl: "https://salon.test/booking",
    now: now.now,
    onError: (e) => (errors.push(e.message)),
    notify: async (e) => void notices.push(e.kind),
    ...(deposit ? { deposit } : {}),
    ...rest,
  })
  const sent = (template) => requests.filter((r) => r.template === template)
  return { svc, now, deposit, requests, sent, errors, notices }
}
const form = (extra = {}) => ({ service: "cut", startsAt: freshStart(), contact: freshEmail(), name: "Jamie", ...extra })
const rowOf = async (reference) => (await d.select().from(bookings).where(eq(bookings.reference, reference)))[0]

/** 접수 → 결제 끝(공급자 쪽) → 반환 쪽 확정까지. 확정된 예약 번호·연락처를 돌려준다 */
async function bookAndPay(s, extra = {}) {
  const input = form(extra)
  const r = await s.svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true, JSON.stringify(r))
  const row = await rowOf(r.data.id)
  s.deposit.markPaid(row.depositRef)
  const c = await s.svc.confirmDeposit({ paymentId: row.depositRef }, { ip: freshIp() })
  assert.equal(c.ok, true, JSON.stringify(c))
  return { input, id: r.data.id, ref: row.depositRef }
}

// ── 설정 ────────────────────────────────────────────────────────────────────────

test("설정: 예약금은 0 이상 상한 이하의 정수, 규칙은 범위 안 — 틀리면 던진다", () => {
  assert.doesNotThrow(() => parseBookingConfig(depositConfig({ depositPolicy: { holdMinutes: 30, fullRefundBeforeMinutes: 1440, laterRefundPercent: 50 } })))
  const bad = (services, depositPolicy) => () => parseBookingConfig(sampleConfig({ services, ...(depositPolicy ? { depositPolicy } : {}) }))
  const svc = (deposit) => [{ id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 1, partyMax: 1, deposit }]
  assert.throws(bad(svc(-1)), /deposit/)
  assert.throws(bad(svc(1.5)), /deposit/)
  assert.throws(bad(svc(10_000_001)), /deposit must be at most/)
  assert.doesNotThrow(bad(svc(0)))
  assert.throws(bad(svc(1000), { holdMinutes: 1 }), /holdMinutes/)
  assert.throws(bad(svc(1000), { laterRefundPercent: 100 }), /laterRefundPercent/)
  assert.throws(bad(svc(1000), { surprise: 1 }), /surprise|unrecognized/i)
})

test("환불 계산: 전액 기한까지 전부 · 그 뒤 비율(원 미만 버림) · 기본은 취소 마감까지 전액 · 그 뒤 0", () => {
  const config = parseBookingConfig(depositConfig())
  const start = new Date("2026-11-10T01:00:00Z")
  const edge = new Date(start.getTime() - 120 * MIN)
  assert.deepEqual({ ...refundFor(config, start, 10_000, edge), fullBefore: undefined }, { amount: 10_000, full: true, fullBefore: undefined })
  const late = refundFor(config, start, 10_000, new Date(edge.getTime() + 1))
  assert.equal(late.amount, 0)
  assert.equal(late.full, false)
  const half = parseBookingConfig(depositConfig({ depositPolicy: { fullRefundBeforeMinutes: 1440, laterRefundPercent: 33 } }))
  assert.equal(refundFor(half, start, 10_001, new Date(start.getTime() - 60 * MIN)).amount, 3_300)
})

// ── 예약금 없는 접수는 그대로 ────────────────────────────────────────────────────

test("예약금 없는 서비스: 훅이 있어도 부르지 않고, 결과·행·메일이 예전과 같다(receipt 에 deposit 칸 없음)", async () => {
  const s = setup()
  const input = form({ service: "color" })
  const r = await s.svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true)
  assert.deepEqual(Object.keys(r.data).sort(), ["id", "message", "startsAt", "status"])
  assert.equal(r.data.status, "confirmed")
  assert.equal(r.data.message, t("ko", "booking.confirmed", { reference: r.data.id }))
  assert.equal(s.deposit.holds.length, 0)
  const row = await rowOf(r.data.id)
  assert.equal(row.depositStatus, "none")
  assert.equal(row.depositAmount, null)
  assert.equal(row.depositDueAt, null)
  assert.equal(row.expiresAt.toISOString(), new Date(new Date(input.startsAt).getTime() + 365 * 86_400_000).toISOString())
  assert.equal(s.sent("bookingNotice").length, 1)
  assert.equal(s.sent("bookingNotice")[0].input.depositPaid, undefined)
  assert.equal(s.sent("bookingConfirmation")[0].input.deposit, undefined)
  assert.equal(s.sent("bookingConfirmation")[0].idempotencyKey, `booking-confirmation:${row.id}:confirmed`)
  assert.deepEqual(s.notices, ["confirmed"])
  const view = await s.svc.lookup({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(view.data.deposit, undefined)
  // 취소도 환불 없이 예전 그대로
  const c = await s.svc.cancel({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.data.message, t("ko", "booking.cancelled"))
  assert.equal(c.data.deposit, undefined)
  assert.equal(s.deposit.refunds.length, 0)
  // 훅이 아예 없는 제품도 예약금 없는 서비스는 받는다
  const bare = setup({ deposit: null })
  assert.equal((await bare.svc.submit(form({ service: "color" }), { ip: freshIp() })).ok, true)
})

test("예약금 서비스인데 결제 훅이 없으면 받지 않는다(provider_unavailable) — 행도 남기지 않는다", async () => {
  const s = setup({ deposit: null })
  const input = form()
  const r = await s.svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, false)
  assert.equal(r.code, "provider_unavailable")
  assert.equal(r.formError, t("ko", "booking.depositRequired"))
  assert.equal((await d.select().from(bookings).where(eq(bookings.contact, input.contact))).length, 0)
})

// ── 한 바퀴 ─────────────────────────────────────────────────────────────────────

test("한 바퀴: 접수(결제 대기) → 결제 → 확정 → 취소 → 전액 환불", async () => {
  const s = setup()
  const input = form()
  const r = await s.svc.submit(input, { ip: freshIp(), locale: "ko" })
  assert.equal(r.ok, true, JSON.stringify(r))
  // 접수 결과: 결제 대기 — 금액·기한·결제 세션은 서버가 정했다
  assert.equal(r.data.status, "requested")
  assert.equal(r.data.deposit.amount, 10_000)
  assert.equal(r.data.deposit.currency, "KRW")
  assert.equal(r.data.deposit.payBy, new Date(clockAt("2026-11-01T00:00:00.000Z") + 30 * MIN).toISOString())
  assert.equal(r.data.deposit.session.total.amount, 10_000)
  assert.equal(r.data.deposit.session.orderName, "커트 예약금")
  const row = await rowOf(r.data.id)
  assert.equal(row.status, "requested")
  assert.equal(row.depositStatus, "pending")
  assert.equal(row.depositAmount, 10_000)
  assert.equal(row.depositCurrency, "KRW")
  assert.equal(row.depositRef, r.data.deposit.session.paymentId)
  assert.equal(row.depositDueAt.toISOString(), r.data.deposit.payBy)
  assert.equal(row.expiresAt.getUTCFullYear(), new Date(input.startsAt).getUTCFullYear() + 5, "예약금이 걸린 건은 계약·결제 기록 5년")
  // 결제 대기 안내 메일 한 통, 대표 알림·알림톡은 아직 없다
  assert.equal(s.sent("bookingNotice").length, 0)
  assert.deepEqual(s.notices, [])
  const [pendingMail] = s.sent("bookingConfirmation")
  assert.equal(pendingMail.input.deposit.state, "pending")
  assert.equal(pendingMail.input.deposit.amount.amount, 10_000)
  assert.ok(pendingMail.input.deposit.refund.fullBefore)
  assert.equal(pendingMail.idempotencyKey, `booking-confirmation:${row.id}:deposit-pending`)
  // 결제 전에는 예약이 확정되지 않는다
  assert.equal((await s.svc.confirm(r.data.id, { userId: "u", isOwner: true })).code, "payment_pending")
  const waiting = await s.svc.confirmDeposit({ paymentId: row.depositRef }, { ip: freshIp() })
  assert.equal(waiting.code, "payment_pending")
  assert.equal(waiting.retryable, true)
  assert.equal((await rowOf(r.data.id)).depositStatus, "pending")

  // 결제가 끝났다(공급자 쪽) → 반환 쪽 확정
  s.deposit.markPaid(row.depositRef)
  const paid = await s.svc.confirmDeposit({ paymentId: row.depositRef }, { ip: freshIp() })
  assert.equal(paid.ok, true, JSON.stringify(paid))
  assert.equal(paid.data.changed, true)
  assert.equal(paid.data.status, "confirmed")
  assert.equal(paid.data.depositStatus, "paid")
  const confirmed = await rowOf(r.data.id)
  assert.equal(confirmed.status, "confirmed")
  assert.ok(confirmed.depositPaidAt && confirmed.ownerNotifiedAt)
  assert.equal(s.sent("bookingNotice").length, 1)
  assert.equal(s.sent("bookingNotice")[0].input.depositPaid.amount, 10_000)
  const mails = s.sent("bookingConfirmation")
  assert.equal(mails.length, 2)
  assert.equal(mails[1].input.status, "confirmed")
  assert.equal(mails[1].input.deposit.state, "paid")
  assert.deepEqual(s.notices, ["confirmed"])
  const view = await s.svc.lookup({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(view.data.deposit.status, "paid")
  assert.equal(view.data.deposit.amount, 10_000)
  assert.equal(view.data.deposit.laterRefundPercent, 0)

  // 취소 마감 전 취소 → 전액 환불
  const c = await s.svc.cancel({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.ok, true, JSON.stringify(c))
  assert.equal(c.data.message, t("ko", "booking.cancelledRefunded"))
  assert.deepEqual(c.data.deposit, { status: "refunded", refundedAmount: 10_000 })
  assert.equal(s.deposit.refunds.length, 1)
  assert.equal(s.deposit.refunds[0].input.amount, 10_000)
  assert.equal(s.deposit.refunds[0].input.full, true)
  const cancelled = await rowOf(r.data.id)
  assert.equal(cancelled.status, "cancelled")
  assert.equal(cancelled.depositStatus, "refunded")
  assert.equal(cancelled.depositRefundedAmount, 10_000)
  const [cm] = s.sent("bookingCancellation")
  assert.equal(cm.input.deposit.outcome, "refunded")
  assert.equal(cm.input.deposit.refunded.amount, 10_000)
  // 다시 취소해도 환불은 한 번
  assert.equal((await s.svc.cancel({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })).ok, true)
  assert.equal(s.deposit.refunds.length, 1)
})
const clockAt = (iso) => Date.parse(iso)

test("결제 대기 예약도 자리를 차지한다(수용량에 센다) · 대기가 풀리면 다시 비는다", async () => {
  const s = setup()
  const start = freshStart("11:00")
  assert.equal((await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })).ok, true)
  const second = await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })
  assert.equal(second.code, "slot_taken")
})

// ── 중복 확정 · 위조 금액 ───────────────────────────────────────────────────────

test("중복 확정: 반환 쪽과 웹훅이 동시에 와도 확정·메일·알림은 한 번이다", async () => {
  const s = setup()
  const r = await s.svc.submit(form(), { ip: freshIp() })
  const ref = (await rowOf(r.data.id)).depositRef
  s.deposit.markPaid(ref)
  const results = await Promise.all([s.svc.confirmDeposit({ paymentId: ref }, { ip: freshIp() }), s.svc.claimPayment(ref), s.svc.claimPayment(ref), s.svc.confirmDeposit({ paymentId: ref }, { ip: freshIp() })])
  assert.equal(results.filter((x) => x === "confirmed" || (x.ok && x.data.changed)).length, 1, JSON.stringify(results))
  assert.equal(s.sent("bookingNotice").length, 1)
  assert.equal(s.sent("bookingConfirmation").filter((m) => m.input.status === "confirmed").length, 1)
  assert.deepEqual(s.notices, ["confirmed"])
  assert.equal(await s.svc.claimPayment(ref), "already_confirmed")
  const again = await s.svc.confirmDeposit({ paymentId: ref }, { ip: freshIp() })
  assert.equal(again.data.changed, false)
  assert.equal(await s.svc.claimPayment("not-our-payment"), "not_mine")
  assert.equal((await s.svc.confirmDeposit({ paymentId: "not-our-payment" }, { ip: freshIp() })).code, "not_found")
})

test("위조 금액: 폼에 금액을 실어도 읽지 않고, 공급자가 본 금액이 다르면 확정하지 않는다(환불 + 자리 풀기)", async () => {
  const s = setup()
  const input = form({ service: "tight", deposit: "1", depositAmount: "1", amount: "1", total: "1" })
  const r = await s.svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true)
  assert.equal(r.data.deposit.amount, 20_000)
  assert.equal(s.deposit.holds[0].charge.amount, 20_000)
  const row = await rowOf(r.data.id)
  assert.equal(row.depositAmount, 20_000)
  // 결제창에서 금액을 바꿔 1원만 냈다
  s.deposit.markPaid(row.depositRef, { amount: 1 })
  const c = await s.svc.confirmDeposit({ paymentId: row.depositRef }, { ip: freshIp() })
  assert.equal(c.ok, false)
  assert.equal(c.formError, t("ko", "booking.paymentMismatch"))
  const closed = await rowOf(r.data.id)
  assert.equal(closed.status, "cancelled")
  assert.equal(closed.depositStatus, "voided")
  assert.equal(s.deposit.refunds.length, 1)
  assert.equal(s.deposit.refunds[0].input.amount, 1)
  assert.equal(s.sent("bookingNotice").length, 0, "확정되지 않았으니 대표 알림도 없다")
  // 자리가 풀렸다
  assert.equal((await s.svc.submit(form({ service: "tight", startsAt: input.startsAt }), { ip: freshIp() })).ok, true)
})

// ── 만료 ────────────────────────────────────────────────────────────────────────

test("만료: 결제 대기 시간이 지나면 Cron 이 닫고 자리를 푼다 · 청구 없음 메일 · 이미 결제된 건은 닫지 않는다", async () => {
  const s = setup()
  const start = freshStart("12:00")
  const input = form({ service: "tight", startsAt: start })
  const r = await s.svc.submit(input, { ip: freshIp() })
  assert.equal(await s.svc.expireDeposits(), 0, "기한 전에는 그대로")
  assert.equal((await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })).code, "slot_taken")
  s.now.tick(31 * MIN)
  // DB 를 시험끼리 나눠 쓰므로 앞 시험이 남긴 대기 건도 같이 닫힌다 — 개수는 1 이상, 이 예약이 닫혔는지는 행으로 본다
  assert.ok((await s.svc.expireDeposits()) >= 1)
  const closed = await rowOf(r.data.id)
  assert.equal(closed.status, "cancelled")
  assert.equal(closed.depositStatus, "voided")
  assert.equal(closed.cancelledBy, "system")
  assert.equal(s.sent("bookingCancellation")[0].input.deposit.outcome, "expired")
  assert.equal(await s.svc.expireDeposits(), 0, "다시 돌려도 한 번만")
  assert.equal((await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })).ok, true, "자리가 다시 비었다")

  // 기한이 지났어도 공급자에서 결제된 건은 닫지 않고 확정한다
  const s2 = setup()
  const r2 = await s2.svc.submit(form({ service: "tight", startsAt: freshStart("12:00") }), { ip: freshIp() })
  s2.deposit.markPaid((await rowOf(r2.data.id)).depositRef)
  s2.now.tick(45 * MIN)
  assert.equal(await s2.svc.expireDeposits(), 0)
  assert.equal((await rowOf(r2.data.id)).status, "confirmed")

  // 공급자에 닿지 못하면 닫지 않고 다음 순회에 다시 본다
  const s3 = setup({ deposit: fakeDeposit({ throwVerify: true }) })
  const r3 = await s3.svc.submit(form({ service: "tight", startsAt: freshStart("12:00") }), { ip: freshIp() })
  s3.now.tick(45 * MIN)
  assert.equal(await s3.svc.expireDeposits(), 0)
  assert.equal((await rowOf(r3.data.id)).depositStatus, "pending")
  assert.ok(s3.errors.some((e) => /kept for the next sweep/.test(e)))
})

test("만료된 자리는 새 접수가 바로 풀어서 받는다(Cron 을 기다리지 않는다) · 가능 시간 조회도 같다", async () => {
  const s = setup()
  const start = freshStart("14:00")
  const first = await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })
  const date = start.slice(0, 10)
  const before = await s.svc.slots({ service: "tight", from: date, days: 1 })
  assert.equal(before.data.days[0].slots.find((x) => x.startsAt === new Date(start).toISOString()).available, 0)
  s.now.tick(31 * MIN)
  const after = await s.svc.slots({ service: "tight", from: date, days: 1 })
  assert.equal(after.data.days[0].slots.find((x) => x.startsAt === new Date(start).toISOString()).available, 1)
  assert.equal((await rowOf(first.data.id)).depositStatus, "voided")
  assert.equal((await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })).ok, true)
})

test("닫힌 뒤에 들어온 결제는 돌려준다(늦은 결제) · 두 번 불러도 환불은 한 번", async () => {
  const s = setup()
  const r = await s.svc.submit(form({ service: "tight" }), { ip: freshIp() })
  const ref = (await rowOf(r.data.id)).depositRef
  s.now.tick(31 * MIN)
  await s.svc.expireDeposits()
  s.deposit.markPaid(ref) // 만료 뒤에 결제가 들어왔다
  const late = await s.svc.confirmDeposit({ paymentId: ref }, { ip: freshIp() })
  assert.equal(late.ok, false)
  assert.equal(late.formError, t("ko", "booking.paymentLate"))
  assert.equal(s.deposit.refunds.length, 1)
  assert.equal(s.deposit.refunds[0].input.amount, 20_000)
  assert.equal(await s.svc.claimPayment(ref), "not_applicable")
  assert.equal(s.deposit.refunds.length, 1)
  assert.equal((await rowOf(r.data.id)).status, "cancelled")
})

test("결제 전에 직접 취소하면 닫기만 한다(환불 없음) · 취소 직전에 결제가 끝났으면 환불 길로 간다", async () => {
  const s = setup()
  const input = form()
  const r = await s.svc.submit(input, { ip: freshIp() })
  const c = await s.svc.cancel({ reference: r.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.ok, true)
  assert.equal((await rowOf(r.data.id)).depositStatus, "voided")
  assert.equal(s.deposit.refunds.length, 0)
  assert.equal(s.sent("bookingCancellation")[0].input.deposit, undefined)

  const input2 = form()
  const r2 = await s.svc.submit(input2, { ip: freshIp() })
  s.deposit.markPaid((await rowOf(r2.data.id)).depositRef) // 손님은 결제했지만 반환 쪽이 아직 확정하기 전에 취소를 눌렀다
  const c2 = await s.svc.cancel({ reference: r2.data.id, contact: input2.contact }, { ip: freshIp() })
  assert.equal(c2.ok, true, JSON.stringify(c2))
  assert.equal(c2.data.deposit.status, "refunded")
  assert.equal(s.deposit.refunds.length, 1)
})

// ── 환불 ────────────────────────────────────────────────────────────────────────

test("환불 실패: 예약은 취소로 바뀌지 않고(재시도 가능) 오류를 알린다 · 다시 시도하면 환불되고 취소된다", async () => {
  let failing = true
  const s = setup({ deposit: fakeDeposit({ failRefund: () => failing }) })
  const { input, id } = await bookAndPay(s)
  const c = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.ok, false)
  assert.equal(c.code, "deposit_failed")
  assert.equal(c.retryable, true)
  assert.equal(c.formError, t("ko", "booking.refundFailed"))
  const kept = await rowOf(id)
  assert.equal(kept.status, "confirmed", "환불이 안 됐으니 예약은 그대로다")
  assert.equal(kept.depositStatus, "paid", "다시 시도할 수 있게 결제 끝 상태로 되돌린다")
  assert.equal(kept.cancelledAt, null)
  assert.ok(s.errors.some((e) => /deposit refund failed/.test(e)))
  assert.equal(s.sent("bookingCancellation").length, 0)

  failing = false
  const again = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(again.ok, true, JSON.stringify(again))
  assert.equal((await rowOf(id)).status, "cancelled")
  assert.equal((await rowOf(id)).depositStatus, "refunded")
})

test("환불 훅이 던져도 같다(예약 유지) · 훅이 없으면 환불할 수 없어 취소하지 않는다", async () => {
  const throwing = fakeDeposit()
  throwing.refund = async () => {
    throw new Error("network down")
  }
  const s = setup({ deposit: throwing })
  const { input, id } = await bookAndPay(s)
  const c = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.code, "deposit_failed")
  assert.equal((await rowOf(id)).status, "confirmed")
  assert.equal((await rowOf(id)).depositStatus, "paid")

  // 같은 DB 행을 훅 없는 서비스로 취소 시도
  const bare = setup({ deposit: null })
  const r = await bare.svc.cancelAs(id, { userId: "u", isOwner: true })
  assert.equal(r.code, "deposit_failed")
  assert.equal((await rowOf(id)).status, "confirmed")
})

test("동시에 두 번 취소해도 환불은 한 번이다", async () => {
  const s = setup()
  const { input, id } = await bookAndPay(s)
  const both = await Promise.all([s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() }), s.svc.cancelAs(id, { userId: "u", isOwner: true })])
  assert.equal(s.deposit.refunds.length, 1)
  assert.ok(both.some((x) => x.ok), JSON.stringify(both))
  assert.equal((await rowOf(id)).depositStatus, "refunded")
})

test("멈춘 환불(refunding)은 5분이 지나면 이어받는다 · 그 전에는 처리 중으로 거절한다", async () => {
  const s = setup()
  const { input, id } = await bookAndPay(s)
  await d.update(bookings).set({ depositStatus: "refunding", updatedAt: s.now.now() }).where(eq(bookings.reference, id))
  const busy = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(busy.code, "in_progress")
  assert.equal(s.deposit.refunds.length, 0)
  s.now.tick(6 * MIN)
  const taken = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(taken.ok, true, JSON.stringify(taken))
  assert.equal(s.deposit.refunds.length, 1)
})

test("환불 규정은 데이터다: 전액 기한 뒤에는 비율만큼(부분 환불) · 0% 면 환불 없이 취소(forfeited)", async () => {
  // 전액 환불은 시작 24시간 전까지, 그 뒤 고객 취소는 50% (취소 마감을 풀어 마감 뒤 취소도 받는다)
  const s = setup({ config: { cancelBeforeMinutes: 0, depositPolicy: { fullRefundBeforeMinutes: 1440, laterRefundPercent: 50 } } })
  const { input, id } = await bookAndPay(s)
  const startsAt = (await rowOf(id)).startsAt
  s.now.at = new Date(startsAt.getTime() - 3 * 60 * MIN) // 시작 3시간 전
  const partial = await s.svc.cancel({ reference: id, contact: input.contact }, { ip: freshIp() })
  assert.equal(partial.ok, true, JSON.stringify(partial))
  assert.equal(partial.data.message, t("ko", "booking.cancelledPartial"))
  assert.deepEqual(partial.data.deposit, { status: "refunded", refundedAmount: 5_000 })
  assert.equal(s.deposit.refunds[0].input.amount, 5_000)
  assert.equal(s.deposit.refunds[0].input.full, false)
  assert.equal(s.sent("bookingCancellation")[0].input.deposit.outcome, "partial")

  // 기본(0%)이면 기한 뒤 고객 취소는 환불 없이 닫는다
  const z = setup({ config: { cancelBeforeMinutes: 0, depositPolicy: { fullRefundBeforeMinutes: 60 } } })
  const paid = await bookAndPay(z)
  const zStart = (await rowOf(paid.id)).startsAt
  z.now.at = new Date(zStart.getTime() - 30 * MIN)
  const none = await z.svc.cancel({ reference: paid.id, contact: paid.input.contact }, { ip: freshIp() })
  assert.equal(none.ok, true, JSON.stringify(none))
  assert.equal(none.data.message, t("ko", "booking.cancelledForfeited"))
  assert.equal(z.deposit.refunds.length, 0)
  const row = await rowOf(paid.id)
  assert.equal(row.depositStatus, "forfeited")
  assert.equal(row.depositRefundedAmount, 0)
  assert.equal(z.sent("bookingCancellation")[0].input.deposit.outcome, "forfeited")
})

test("대표 취소: 기본은 때와 상관없이 전액 환불 · ownerCancelRefundPercent 로 바꾼다 · 고객 취소 규정은 그대로", async () => {
  // 기본값 — 전액 환불 기한 뒤(시작 30분 전)에 운영자가 취소해도 전액
  const s = setup({ config: { depositPolicy: { fullRefundBeforeMinutes: 1440, laterRefundPercent: 0 } } })
  const { id } = await bookAndPay(s)
  s.now.at = new Date((await rowOf(id)).startsAt.getTime() - 30 * MIN)
  const full = await s.svc.cancelAs(id, { userId: "u", isOwner: true })
  assert.equal(full.ok, true, JSON.stringify(full))
  assert.equal(full.data.message, t("ko", "booking.cancelledRefunded"))
  assert.deepEqual(full.data.deposit, { status: "refunded", refundedAmount: 10_000 })
  assert.equal(s.deposit.refunds[0].input.amount, 10_000)
  assert.equal(s.deposit.refunds[0].input.full, true)
  assert.equal((await rowOf(id)).cancelledBy, "owner")
  assert.equal(s.sent("bookingCancellation")[0].input.deposit.outcome, "refunded")

  // 대표 취소 비율을 50 으로 — 고객 사정과 상관없이 절반만
  const h = setup({ config: { depositPolicy: { ownerCancelRefundPercent: 50 } } })
  const half = await bookAndPay(h)
  const r = await h.svc.cancelAs(half.id, { userId: "u", isOwner: true })
  assert.deepEqual(r.data.deposit, { status: "refunded", refundedAmount: 5_000 })
  assert.equal(h.deposit.refunds[0].input.full, false)

  // 0 이면 환불 없이 닫는다(forfeited)
  const z = setup({ config: { depositPolicy: { ownerCancelRefundPercent: 0 } } })
  const zero = await bookAndPay(z)
  const zr = await z.svc.cancelAs(zero.id, { userId: "u", isOwner: true })
  assert.equal(zr.data.message, t("ko", "booking.cancelledForfeited"))
  assert.equal(z.deposit.refunds.length, 0)

  // 시스템 취소도 사업자 쪽이라 같은 비율을 쓴다
  const y = setup()
  const sys = await bookAndPay(y)
  assert.deepEqual((await y.svc.cancelAs(sys.id, { system: true })).data.deposit, { status: "refunded", refundedAmount: 10_000 })

  // 범위 검사 — 101 은 거절한다
  assert.throws(() => parseBookingConfig(depositConfig({ depositPolicy: { ownerCancelRefundPercent: 101 } })), /ownerCancelRefundPercent/)
})

test("운영자 확인 방식(request): 결제가 끝나도 예약은 요청 상태이고, 운영자가 확정한다", async () => {
  const s = setup({ config: { mode: "request" } })
  const { id } = await bookAndPay(s)
  const row = await rowOf(id)
  assert.equal(row.status, "requested")
  assert.equal(row.depositStatus, "paid")
  assert.equal(s.sent("bookingNotice").length, 1)
  assert.deepEqual(s.notices, ["received"])
  const ok = await s.svc.confirm(id, { userId: "u", isOwner: true })
  assert.equal(ok.ok, true)
  assert.equal((await rowOf(id)).status, "confirmed")
})

test("결제 훅이 결제를 열지 못하면 예약은 남지 않고 자리가 풀린다 · 훅 호출은 설정 금액만 받는다", async () => {
  const s = setup({ deposit: fakeDeposit({ failHold: true }) })
  const start = freshStart("15:00")
  const r = await s.svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })
  assert.equal(r.code, "deposit_failed")
  assert.equal(r.retryable, true)
  assert.equal(s.deposit.holds[0].charge.amount, 20_000)
  assert.equal((await setup().svc.submit(form({ service: "tight", startsAt: start }), { ip: freshIp() })).ok, true)
})
