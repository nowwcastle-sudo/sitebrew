// 예약(계획 3b, 설계서 9.5 — `booking` 부품). 한 행 = 예약 한 건.
// - 개인정보는 최소만: 이름(선택)·연락처(이메일 또는 전화)·메모. IP·브라우저 정보는 저장하지 않는다.
// - 수용량은 겹치는 예약 건수로 센다(서비스별). 초과 방지는 도우미 `bookByCapacity` 가 한 트랜잭션 + advisory lock 으로 한다.
// - 보유: expires_at 이 지나면 `purgeExpiredBookings` 가 지운다. 예약금을 받은 건은 계약·결제 기록이라 5년(시행령 제6조①2·3, retention.ts).
// - deposit_*: 예약금(계획 3d L3). 금액은 서버 설정에서 와 예약 때 이 행에 박힌다(브라우저가 보낸 금액은 읽지 않는다). deposit_ref = 결제 공급자의 결제 번호(유일).
//   "결제 대기" = status requested + deposit_status pending(자리는 deposit_due_at 까지 붙들린다). 결제 번호·금액·통화는 계약·결제 기록이라 5년 보유한다.
// 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다 — Task 4 D26 규칙).
import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`)

export const BOOKING_STATUSES = ["requested", "confirmed", "cancelled", "completed", "no_show"] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]
/** 자리를 차지하는 상태(취소·노쇼·완료는 새 예약을 막지 않는다) */
export const BOOKING_HOLDING_STATUSES = ["requested", "confirmed"] as const
/**
 * none = 예약금 없음 · pending = 결제 대기 · paid = 결제 끝 · refunding = 환불 진행 중(실패하면 paid 로 되돌린다) ·
 * refunded = 환불 끝(일부 환불 포함 — 금액은 deposit_refunded_amount) · forfeited = 환불 없이 취소(기한 뒤 환불 0%) · voided = 내지 않고 닫힘(대기 시간 만료·결제 전 취소)
 */
export const BOOKING_DEPOSIT_STATUSES = ["none", "pending", "paid", "refunding", "refunded", "forfeited", "voided"] as const
export type BookingDepositStatus = (typeof BOOKING_DEPOSIT_STATUSES)[number]
export const BOOKING_CANCELLED_BY = ["booker", "owner", "system"] as const
export type BookingCancelledBy = (typeof BOOKING_CANCELLED_BY)[number]

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 사람에게 보이는 접수 번호(예: B-7K3M9P2A) */
    reference: text("reference").notNull().unique(),
    /** 설정(BookingConfig.services)의 서비스 id */
    service: text("service").notNull(),
    startsAt: timestamp("starts_at", tz).notNull(),
    endsAt: timestamp("ends_at", tz).notNull(),
    partySize: integer("party_size").notNull().default(1),
    name: text("name"),
    contact: text("contact").notNull(),
    contactKind: text("contact_kind").$type<"email" | "phone">().notNull(),
    note: text("note"),
    status: text("status").$type<BookingStatus>().notNull(),
    depositStatus: text("deposit_status").$type<BookingDepositStatus>().notNull().default("none"),
    depositRef: text("deposit_ref"),
    /** 예약금(최소 단위 정수 — KRW 는 원). 서버 설정에서 와 접수 때 박힌다. 없거나 0 이면 예약금 없음 */
    depositAmount: integer("deposit_amount"),
    depositCurrency: text("deposit_currency"),
    /** 결제 대기 기한 — 이 시각까지 결제가 없으면 자리를 풀고 닫는다 */
    depositDueAt: timestamp("deposit_due_at", tz),
    depositPaidAt: timestamp("deposit_paid_at", tz),
    /** 돌려준 금액(일부 환불이면 deposit_amount 보다 작다) */
    depositRefundedAmount: integer("deposit_refunded_amount"),
    locale: text("locale").notNull(),
    /** 로그인한 채 예약했으면 그 사용자. 탈퇴하면 연결만 끊는다(예약 자체는 보유 기간까지) */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", tz).notNull(),
    updatedAt: timestamp("updated_at", tz).notNull(),
    cancelledAt: timestamp("cancelled_at", tz),
    cancelledBy: text("cancelled_by").$type<BookingCancelledBy>(),
    ownerNotifiedAt: timestamp("owner_notified_at", tz),
    confirmationSentAt: timestamp("confirmation_sent_at", tz),
    reminderSentAt: timestamp("reminder_sent_at", tz),
    expiresAt: timestamp("expires_at", tz).notNull(),
  },
  (t) => [
    index("bookings_service_starts_idx").on(t.service, t.startsAt),
    index("bookings_status_starts_idx").on(t.status, t.startsAt),
    index("bookings_expires_at_idx").on(t.expiresAt),
    index("bookings_user_idx").on(t.userId),
    uniqueIndex("bookings_deposit_ref_uq").on(t.depositRef),
    index("bookings_deposit_due_idx").on(t.depositStatus, t.depositDueAt),
    check("bookings_status_ck", inList("status", BOOKING_STATUSES)),
    check("bookings_deposit_status_ck", inList("deposit_status", BOOKING_DEPOSIT_STATUSES)),
    check("bookings_cancelled_by_ck", sql`${t.cancelledBy} is null or ${t.cancelledBy} in ('booker', 'owner', 'system')`),
    check("bookings_deposit_amount_ck", sql`${t.depositAmount} is null or ${t.depositAmount} >= 0`),
    check("bookings_deposit_refunded_ck", sql`${t.depositRefundedAmount} is null or (${t.depositRefundedAmount} >= 0 and ${t.depositRefundedAmount} <= coalesce(${t.depositAmount}, 0))`),
    check("bookings_party_size_ck", sql`${t.partySize} >= 1`),
    check("bookings_range_ck", sql`${t.endsAt} > ${t.startsAt}`),
  ],
)
