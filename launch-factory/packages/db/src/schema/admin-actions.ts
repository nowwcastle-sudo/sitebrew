// 관리자 행동 기록(대리 로그인 시작·종료, 정지·해제 등). Task 16이 쓴다. 대상 사용자가 파기돼도 남도록 외래키가 없다.
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

const tz = { withTimezone: true } as const

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id"),
    adminUserId: text("admin_user_id").notNull(),
    /** 예: impersonate_start·impersonate_stop·ban·unban. 목록은 Task 16이 정한다. */
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    ipAddress: text("ip_address"),
    reason: text("reason"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", tz).defaultNow().notNull(),
  },
  (t) => [index("admin_actions_admin_idx").on(t.adminUserId), index("admin_actions_target_idx").on(t.targetUserId)],
)
