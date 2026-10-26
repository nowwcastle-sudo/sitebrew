// 예약 저장·수용량·파기(계획 3b, 설계서 9.5). 슬롯 계산·검사·알림은 @launch-factory/booking 이 한다.
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { BOOKING_HOLDING_STATUSES, bookings, type BookingDepositStatus } from "./schema.ts"

export type NewBooking = Omit<typeof bookings.$inferInsert, "id">
export type BookingRow = typeof bookings.$inferSelect
export type BookingChanges = Partial<Omit<BookingRow, "id" | "reference">>

const HOLDING = [...BOOKING_HOLDING_STATUSES]

export type BookResult = { ok: true; row: BookingRow } | { ok: false; error: "slot_taken" }

/**
 * 수용량 안에서만 예약을 저장한다. 한 트랜잭션에서 서비스별 advisory lock 을 잡고(같은 서비스의 동시 예약은 줄을 선다)
 * 겹치는 자리 차지 예약 수를 센 뒤 넣는다 — 동시에 N+1건이 와도 capacity 건만 성공한다. 겹침 = 시작 < 남의 끝 이고 끝 > 남의 시작.
 */
export async function bookByCapacity(d: Database, o: { capacity: number; row: NewBooking }): Promise<BookResult> {
  return d.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`booking:${o.row.service}`}, 0))`)
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.service, o.row.service), inArray(bookings.status, HOLDING), lt(bookings.startsAt, o.row.endsAt), gt(bookings.endsAt, o.row.startsAt)))) as [{ n: number }]
    if (n >= o.capacity) return { ok: false, error: "slot_taken" }
    const [saved] = await tx.insert(bookings).values(o.row).returning()
    return { ok: true, row: saved as BookingRow }
  })
}

/** [from, to) 에 걸치는 자리 차지 예약(슬롯 계산용 — 시작·끝만 쓴다) */
export async function holdingBetween(d: Database, service: string, from: Date, to: Date): Promise<Pick<BookingRow, "startsAt" | "endsAt">[]> {
  return d
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(and(eq(bookings.service, service), inArray(bookings.status, HOLDING), lt(bookings.startsAt, to), gt(bookings.endsAt, from)))
}

export async function getBookingByReference(d: Database, reference: string): Promise<BookingRow | undefined> {
  const [row] = await d.select().from(bookings).where(eq(bookings.reference, reference))
  return row
}

/** 결제 번호(deposit_ref)로 예약을 찾는다 — 결제 확정(반환 쪽·웹훅)이 쓴다. 결제 번호는 유일하다 */
export async function getBookingByDepositRef(d: Database, ref: string): Promise<BookingRow | undefined> {
  const [row] = await d.select().from(bookings).where(eq(bookings.depositRef, ref))
  return row
}

export async function updateBooking(d: Database, id: string, set: BookingChanges): Promise<BookingRow | undefined> {
  const [row] = await d.update(bookings).set(set).where(eq(bookings.id, id)).returning()
  return row
}

/**
 * 상태가 `from` 중 하나일 때만 바꾼다 — 확정과 취소가 동시에 와도 취소된 예약이 되살아나 수용량을 넘기지 않는다.
 * 바꿨으면 새 행, 상태가 이미 달라졌으면 undefined(부르는 쪽이 다시 읽어 판단한다).
 */
export async function transitionBooking(d: Database, id: string, from: readonly BookingRow["status"][], set: BookingChanges): Promise<BookingRow | undefined> {
  const [row] = await d.update(bookings).set(set).where(and(eq(bookings.id, id), inArray(bookings.status, [...from]))).returning()
  return row
}

export interface DepositGuard {
  /** 예약 상태가 이 중 하나일 때만 */
  status?: readonly BookingRow["status"][]
  /** 예약금 상태가 이 중 하나일 때만(필수) */
  deposit: readonly BookingDepositStatus[]
  /** 마지막 변경이 이 시각 이전일 때만(멈춘 환불을 이어받을 때) */
  updatedBefore?: Date
}

/**
 * 예약금 상태 전이의 조건부 UPDATE. 조건이 맞을 때만 바꾸고 새 행을, 이미 달라졌으면 undefined 를 돌려준다 —
 * 결제 확정·환불·만료가 동시에 와도 한 번만 일어나야 하는 일(확정 메일·환불·자리 풀기)은 이 UPDATE 를 이긴 쪽만 한다.
 */
export async function moveDeposit(d: Database, id: string, guard: DepositGuard, set: BookingChanges): Promise<BookingRow | undefined> {
  const where = and(
    eq(bookings.id, id),
    inArray(bookings.depositStatus, [...guard.deposit]),
    ...(guard.status ? [inArray(bookings.status, [...guard.status])] : []),
    ...(guard.updatedBefore ? [lt(bookings.updatedAt, guard.updatedBefore)] : []),
  )
  const [row] = await d.update(bookings).set(set).where(where).returning()
  return row
}

/** 결제 대기 기한이 지난 예약(오래된 것부터). service 를 주면 그 서비스만 — 접수·가능 시간 조회 때 자리를 바로 풀 때 쓴다 */
export async function listExpiredDepositHolds(d: Database, now: Date, o: { service?: string; limit?: number } = {}): Promise<BookingRow[]> {
  return d
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "requested"), eq(bookings.depositStatus, "pending"), lte(bookings.depositDueAt, now), ...(o.service ? [eq(bookings.service, o.service)] : [])))
    .orderBy(asc(bookings.depositDueAt))
    .limit(o.limit ?? 50)
}

/**
 * 알림을 보낼 때가 된 확정 예약: 시작이 (now, until] 안이고 아직 알림을 보내지 않은 것. `until` = now + 알림 시점.
 * 같은 예약을 두 번 보내지 않게 부르는 쪽이 `claimReminder` 로 차지한 뒤 보낸다.
 */
export async function listDueReminders(d: Database, now: Date, until: Date): Promise<BookingRow[]> {
  return d.select().from(bookings).where(and(eq(bookings.status, "confirmed"), isNull(bookings.reminderSentAt), gt(bookings.startsAt, now), lt(bookings.startsAt, until)))
}

/** 알림 보냄 표시를 먼저 차지한다. 차지했으면 true — 동시에 두 번 불러도 한쪽만 true */
export async function claimReminder(d: Database, id: string, at: Date): Promise<boolean> {
  const rows = await d.update(bookings).set({ reminderSentAt: at, updatedAt: at }).where(and(eq(bookings.id, id), isNull(bookings.reminderSentAt))).returning({ id: bookings.id })
  return rows.length > 0
}

/** 보유 기간이 지난 예약을 지운다(개인정보 보호법 제21조①, Cron). 지운 수를 돌려준다 */
export async function purgeExpiredBookings(d: Database, now: Date): Promise<number> {
  const rows = await d.delete(bookings).where(lt(bookings.expiresAt, now)).returning({ id: bookings.id })
  return rows.length
}

/** LIKE 의 특수 글자(% _ \)를 글자 그대로 찾도록 막는다 */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * 직원용 예약 목록(계획 3d L2b). 상태로 거르고 접수 번호 일부로 찾는다(대소문자 무시). 시작이 늦은 것부터, 같으면 번호 순.
 * `search` 를 주면 접수 번호(느슨하게 다듬은 `reference` 가 있으면 그 글자로) 외에 연락처·이름 일부도 찾는다 — 표는 연락처를 가려서 보이므로 이메일·전화로 찾으려면 서버가 맞춰야 한다.
 * `total` 은 거른 전체 건수 — 페이지 넘기기는 limit·offset. 개인정보를 가리는 일은 부르는 쪽 몫이다.
 */
export async function listBookings(d: Database, o: { status?: BookingRow["status"]; reference?: string; search?: string; limit: number; offset?: number }): Promise<{ rows: BookingRow[]; total: number }> {
  const byReference = (v: string) => ilike(bookings.reference, `%${likeEscape(v)}%`)
  const text = (v: string) => `%${likeEscape(v)}%`
  const found = o.search ? or(byReference(o.reference ?? o.search), ilike(bookings.contact, text(o.search)), ilike(bookings.name, text(o.search))) : o.reference ? byReference(o.reference) : undefined
  const where = and(...(o.status ? [eq(bookings.status, o.status)] : []), ...(found ? [found] : []))
  const [{ total } = { total: 0 }] = await d.select({ total: count() }).from(bookings).where(where)
  const rows = await d.select().from(bookings).where(where).orderBy(desc(bookings.startsAt), desc(bookings.reference)).limit(o.limit).offset(o.offset ?? 0)
  return { rows, total }
}
