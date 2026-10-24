// @launch-factory/db — 예약 수용량·푸시 구독·알림 기록(계획 3b). PGlite 메모리 DB 하나를 파일 전체가 같이 쓴다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import * as lf from "../src/index.ts"

const { db, bookByCapacity, holdingBetween, getBookingByReference, updateBooking, listDueReminders, claimReminder, purgeExpiredBookings } = lf
const { upsertPushSubscription, deletePushSubscription, listPushSubscriptions, bumpPushFailure, markPushSuccess } = lf
const { claimNotification, settleNotification, purgeExpiredNotifications } = lf

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  await d.execute(sql`insert into "user" (id, name, email) values ('u1', 'A', 'a@example.com'), ('u2', 'B', 'b@example.com')`)
})
after(async () => {
  await d?.$client.close()
})

const T0 = new Date("2026-11-02T01:00:00Z") // 월 10:00 KST
const at = (min) => new Date(T0.getTime() + min * 60_000)
let seq = 0
const draft = (o = {}) => ({
  reference: `B-TEST${String(++seq).padStart(4, "0")}`,
  service: "cut",
  startsAt: at(0),
  endsAt: at(60),
  partySize: 1,
  contact: "guest@example.com",
  contactKind: "email",
  status: "confirmed",
  locale: "ko",
  createdAt: at(-1000),
  updatedAt: at(-1000),
  expiresAt: at(60 * 24 * 365),
  ...o,
})

test("수용량: 동시에 5건이 와도 capacity(2)건만 성공한다", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => bookByCapacity(d, { capacity: 2, row: draft({ service: "race" }) })))
  assert.equal(results.filter((r) => r.ok).length, 2)
  assert.deepEqual([...new Set(results.filter((r) => !r.ok).map((r) => r.error))], ["slot_taken"])
})

test("겹침: 맞닿는 구간은 겹치지 않고, 걸치는 구간은 센다", async () => {
  const svc = "overlap"
  assert.ok((await bookByCapacity(d, { capacity: 1, row: draft({ service: svc, startsAt: at(0), endsAt: at(60) }) })).ok)
  const adjacent = await bookByCapacity(d, { capacity: 1, row: draft({ service: svc, startsAt: at(60), endsAt: at(120) }) })
  assert.ok(adjacent.ok, "끝과 시작이 맞닿으면 겹치지 않는다")
  const straddle = await bookByCapacity(d, { capacity: 1, row: draft({ service: svc, startsAt: at(30), endsAt: at(90) }) })
  assert.deepEqual(straddle, { ok: false, error: "slot_taken" })
})

test("취소된 예약은 자리를 비운다 · 다른 서비스는 서로 막지 않는다", async () => {
  const first = await bookByCapacity(d, { capacity: 1, row: draft({ service: "cancel-svc" }) })
  assert.ok(first.ok)
  assert.equal((await bookByCapacity(d, { capacity: 1, row: draft({ service: "cancel-svc" }) })).ok, false)
  assert.ok((await bookByCapacity(d, { capacity: 1, row: draft({ service: "other-svc" }) })).ok)
  await updateBooking(d, first.row.id, { status: "cancelled", cancelledAt: at(1), cancelledBy: "booker", updatedAt: at(1) })
  assert.ok((await bookByCapacity(d, { capacity: 1, row: draft({ service: "cancel-svc" }) })).ok)
})

test("holdingBetween 은 범위에 걸치는 자리 차지 예약만 돌려준다", async () => {
  const rows = await holdingBetween(d, "overlap", at(0), at(60))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].startsAt.getTime(), at(0).getTime())
})

test("접수 번호는 유일하다 · 조회", async () => {
  const row = draft({ service: "ref-svc" })
  assert.ok((await bookByCapacity(d, { capacity: 5, row })).ok)
  await assert.rejects(bookByCapacity(d, { capacity: 5, row }))
  assert.equal((await getBookingByReference(d, row.reference))?.service, "ref-svc")
  assert.equal(await getBookingByReference(d, "B-NOPE"), undefined)
})

test("알림 대상: 확정 + 미발송 + 시간 안만, 차지는 한쪽만 성공한다", async () => {
  const svc = "remind"
  const due = await bookByCapacity(d, { capacity: 9, row: draft({ service: svc, startsAt: at(60 * 20), endsAt: at(60 * 21) }) })
  await bookByCapacity(d, { capacity: 9, row: draft({ service: svc, startsAt: at(60 * 20), endsAt: at(60 * 21), status: "requested" }) })
  await bookByCapacity(d, { capacity: 9, row: draft({ service: svc, startsAt: at(60 * 60), endsAt: at(60 * 61) }) })
  const list = (await listDueReminders(d, at(0), at(60 * 24))).filter((r) => r.service === svc)
  assert.deepEqual(list.map((r) => r.id), [due.row.id])
  const claims = await Promise.all([claimReminder(d, due.row.id, at(1)), claimReminder(d, due.row.id, at(1))])
  assert.deepEqual(claims.sort(), [false, true])
  assert.equal((await listDueReminders(d, at(0), at(60 * 24))).filter((r) => r.service === svc).length, 0)
})

test("보유 기간이 지난 예약만 지운다", async () => {
  await bookByCapacity(d, { capacity: 9, row: draft({ service: "purge-svc", expiresAt: at(10) }) })
  await bookByCapacity(d, { capacity: 9, row: draft({ service: "purge-svc", expiresAt: at(60 * 24 * 365) }) })
  assert.equal(await purgeExpiredBookings(d, at(20)), 1)
  assert.equal((await holdingBetween(d, "purge-svc", at(-10), at(120))).length, 1)
})

test("표 제약: 모르는 상태·끝이 시작보다 빠른 예약·0명은 거절된다", async () => {
  for (const bad of [{ status: "weird" }, { startsAt: at(60), endsAt: at(0) }, { partySize: 0 }]) {
    await assert.rejects(d.insert(lf.bookings).values(draft({ service: "bad", ...bad })))
  }
})

const sub = (n, extra = {}) => ({ endpoint: `https://push.example.test/${n}`, p256dh: "p".repeat(20), auth: "a".repeat(10), expirationTime: null, userId: "u1", createdAt: at(0), ...extra })

test("푸시: 같은 endpoint 는 하나뿐이고 소유자가 옮겨 간다", async () => {
  const first = await upsertPushSubscription(d, sub("x1"))
  await markPushSuccess(d, first.id, at(1))
  await bumpPushFailure(d, first.id)
  const moved = await upsertPushSubscription(d, sub("x1", { userId: "u2", p256dh: "q".repeat(20) }))
  assert.equal(moved.id, first.id)
  assert.equal(moved.userId, "u2")
  assert.equal(moved.failureCount, 0, "다시 구독하면 실패 횟수가 0으로 돌아온다")
  assert.equal((await listPushSubscriptions(d, "u1")).filter((r) => r.endpoint.endsWith("/x1")).length, 0)
})

test("푸시: 남의 구독은 지울 수 없다 · 실패 횟수가 오른다", async () => {
  const s = await upsertPushSubscription(d, sub("x2"))
  assert.equal(await deletePushSubscription(d, "u2", s.endpoint), false)
  assert.equal(await bumpPushFailure(d, s.id), 1)
  assert.equal(await bumpPushFailure(d, s.id), 2)
  assert.equal(await deletePushSubscription(d, "u1", s.endpoint), true)
})

test("푸시: 사용자를 지우면 구독도 지워진다", async () => {
  await d.execute(sql`insert into "user" (id, name, email) values ('u3', 'C', 'c@example.com')`)
  await upsertPushSubscription(d, sub("x3", { userId: "u3" }))
  await d.execute(sql`delete from "user" where id = 'u3'`)
  assert.equal((await listPushSubscriptions(d, "u3")).length, 0)
})

const note = (key, extra = {}) => ({ idempotencyKey: key, channel: null, purpose: "transactional", template: "bookingConfirmed", toLast4: "5678", userId: null, status: "failed", reason: "pending", createdAt: at(0), expiresAt: at(60 * 24 * 365), ...extra })

test("알림 기록: 멱등 키를 먼저 차지한 쪽만 보낸다", async () => {
  const [a, b] = await Promise.all([claimNotification(d, note("k1")), claimNotification(d, note("k1"))])
  assert.equal([a, b].filter(Boolean).length, 1)
  const row = a ?? b
  await settleNotification(d, row.id, { status: "sent", channel: "alimtalk", providerRef: "G1", reason: null })
  const [saved] = (await d.execute(sql`select status, channel from notifications where id = ${row.id}`)).rows
  assert.deepEqual({ ...saved }, { status: "sent", channel: "alimtalk" })
})

test("알림 기록: 보유 기간이 지난 것만 지운다", async () => {
  await claimNotification(d, note("old", { expiresAt: at(5) }))
  assert.equal(await purgeExpiredNotifications(d, at(10)), 1)
})

test("transitionBooking: 상태가 맞을 때만 바뀐다 — 취소된 예약은 확정으로 되살아나지 않는다", async () => {
  const made = await bookByCapacity(d, { capacity: 5, row: draft({ service: "transition", status: "requested" }) })
  assert.ok(made.ok)
  const cancelled = await lf.transitionBooking(d, made.row.id, ["requested", "confirmed"], { status: "cancelled", cancelledAt: at(1), cancelledBy: "booker", updatedAt: at(1) })
  assert.equal(cancelled?.status, "cancelled")
  assert.equal(await lf.transitionBooking(d, made.row.id, ["requested"], { status: "confirmed", updatedAt: at(2) }), undefined)
  assert.equal((await getBookingByReference(d, made.row.reference))?.status, "cancelled")
})

// ── 예약금(계획 3d L3) ─────────────────────────────────────────────────────────────
const { getBookingByDepositRef, moveDeposit, listExpiredDepositHolds } = lf

test("예약금: 결제 번호로 찾고, 같은 번호는 두 예약에 쓰지 못한다(유일)", async () => {
  const a = await bookByCapacity(d, { capacity: 5, row: draft({ service: "dep-ref", status: "requested", depositStatus: "pending", depositRef: "pay-unique-1", depositAmount: 20000, depositCurrency: "KRW", depositDueAt: at(30) }) })
  assert.ok(a.ok)
  assert.equal((await getBookingByDepositRef(d, "pay-unique-1"))?.id, a.row.id)
  assert.equal(await getBookingByDepositRef(d, "pay-unknown"), undefined)
  await assert.rejects(bookByCapacity(d, { capacity: 5, row: draft({ service: "dep-ref", depositRef: "pay-unique-1" }) }))
  // 결제 번호가 없는 예약(예약금 없음)은 여럿이어도 된다
  assert.ok((await bookByCapacity(d, { capacity: 5, row: draft({ service: "dep-ref" }) })).ok)
  assert.ok((await bookByCapacity(d, { capacity: 5, row: draft({ service: "dep-ref" }) })).ok)
})

test("예약금: 상태 전이는 조건이 맞을 때 한 번만 이긴다 · 환불 금액은 낸 금액을 넘지 못한다", async () => {
  const a = await bookByCapacity(d, { capacity: 5, row: draft({ service: "dep-move", status: "requested", depositStatus: "pending", depositRef: "pay-move-1", depositAmount: 30000, depositCurrency: "KRW", depositDueAt: at(30) }) })
  assert.ok(a.ok)
  const set = { depositStatus: "paid", status: "confirmed", depositPaidAt: at(1), updatedAt: at(1) }
  const wins = await Promise.all([moveDeposit(d, a.row.id, { status: ["requested"], deposit: ["pending"] }, set), moveDeposit(d, a.row.id, { status: ["requested"], deposit: ["pending"] }, set)])
  assert.equal(wins.filter(Boolean).length, 1, "동시에 둘이 와도 한쪽만 확정한다")
  assert.equal((await getBookingByDepositRef(d, "pay-move-1"))?.depositStatus, "paid")
  // 이미 확정된 뒤에는 같은 조건이 더는 맞지 않는다
  assert.equal(await moveDeposit(d, a.row.id, { deposit: ["pending"] }, { depositStatus: "voided", updatedAt: at(2) }), undefined)
  // 멈춘 환불 이어받기: updatedBefore 보다 최근에 바뀐 refunding 은 건드리지 않는다
  await updateBooking(d, a.row.id, { depositStatus: "refunding", updatedAt: at(10) })
  assert.equal(await moveDeposit(d, a.row.id, { deposit: ["refunding"], updatedBefore: at(5) }, { updatedAt: at(11) }), undefined)
  assert.ok(await moveDeposit(d, a.row.id, { deposit: ["refunding"], updatedBefore: at(20) }, { updatedAt: at(21) }))
  await assert.rejects(updateBooking(d, a.row.id, { depositRefundedAmount: 30001 }), "낸 금액보다 많이 돌려줄 수 없다")
})

test("예약금: 결제 대기 기한이 지난 것만, 오래된 것부터, 서비스를 좁혀 센다", async () => {
  const mk = (service, ref, due, extra = {}) => bookByCapacity(d, { capacity: 5, row: draft({ service, status: "requested", depositStatus: "pending", depositRef: ref, depositAmount: 1000, depositCurrency: "KRW", depositDueAt: due, ...extra }) })
  await mk("dep-exp", "pay-exp-late", at(40))
  await mk("dep-exp", "pay-exp-old", at(10))
  await mk("dep-exp", "pay-exp-future", at(500))
  await mk("dep-exp-other", "pay-exp-other", at(5))
  await mk("dep-exp", "pay-exp-paid", at(1), { depositStatus: "paid", status: "confirmed" })
  const all = (await listExpiredDepositHolds(d, at(60))).filter((r) => r.service.startsWith("dep-exp"))
  assert.deepEqual(all.map((r) => r.depositRef), ["pay-exp-other", "pay-exp-old", "pay-exp-late"])
  assert.deepEqual((await listExpiredDepositHolds(d, at(60), { service: "dep-exp" })).map((r) => r.depositRef), ["pay-exp-old", "pay-exp-late"])
  assert.deepEqual((await listExpiredDepositHolds(d, at(60), { service: "dep-exp", limit: 1 })).map((r) => r.depositRef), ["pay-exp-old"])
})

test("예약금: 결제 대기 예약도 자리를 차지한다(수용량에 센다)", async () => {
  const first = await bookByCapacity(d, { capacity: 1, row: draft({ service: "dep-cap", status: "requested", depositStatus: "pending", depositRef: "pay-cap-1", depositAmount: 1000, depositCurrency: "KRW", depositDueAt: at(30) }) })
  assert.ok(first.ok)
  assert.deepEqual(await bookByCapacity(d, { capacity: 1, row: draft({ service: "dep-cap" }) }), { ok: false, error: "slot_taken" })
  // 닫히면(취소 + voided) 자리가 풀린다
  await moveDeposit(d, first.row.id, { status: ["requested"], deposit: ["pending"] }, { status: "cancelled", depositStatus: "voided", cancelledAt: at(31), cancelledBy: "system", updatedAt: at(31) })
  assert.ok((await bookByCapacity(d, { capacity: 1, row: draft({ service: "dep-cap" }) })).ok)
})
