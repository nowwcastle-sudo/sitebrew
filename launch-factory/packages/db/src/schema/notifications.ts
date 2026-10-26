// 알림톡·문자 발송 기록(계획 3b, 설계서 9.5 — `notify-kr` 부품). 한 행 = 보내려던 메시지 한 건의 결과.
// - idempotency_key 가 유일해서 같은 알림을 두 번 보내지 않는다(먼저 행을 차지한 쪽만 보낸다).
// - 전화번호 전체와 본문은 저장하지 않는다. to_last4 = 받는 사람 끝 4자리(문의 대응용)뿐이다.
// - status: sent(공급자가 접수) · failed(공급자 오류) · skipped(보내지 않기로 함 — reason 에 이유: no_consent·night·…).
// - 보유 기간(expires_at)이 지나면 `purgeExpiredNotifications` 가 지운다(기본 1년).
import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`)

export const NOTIFICATION_CHANNELS = ["alimtalk", "sms", "lms"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]
export const NOTIFICATION_PURPOSES = ["transactional", "marketing"] as const
export type NotificationPurpose = (typeof NOTIFICATION_PURPOSES)[number]
export const NOTIFICATION_STATUSES = ["sent", "failed", "skipped"] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    channel: text("channel").$type<NotificationChannel>(),
    purpose: text("purpose").$type<NotificationPurpose>().notNull(),
    template: text("template").notNull(),
    toLast4: text("to_last4").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").$type<NotificationStatus>().notNull(),
    reason: text("reason"),
    providerRef: text("provider_ref"),
    createdAt: timestamp("created_at", tz).notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
  },
  (t) => [
    index("notifications_expires_at_idx").on(t.expiresAt),
    index("notifications_user_idx").on(t.userId),
    check("notifications_channel_ck", sql`${t.channel} is null or ${t.channel} in ('alimtalk', 'sms', 'lms')`),
    check("notifications_purpose_ck", inList("purpose", NOTIFICATION_PURPOSES)),
    check("notifications_status_ck", inList("status", NOTIFICATION_STATUSES)),
  ],
)
