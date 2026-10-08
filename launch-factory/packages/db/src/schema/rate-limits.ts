// 요청 제한 계수(Task 15). 키는 IP + 경로 + 사용자를 합친 문자열이다. 창(window)이 지나면 count를 다시 센다.
// Better Auth 자체 제한 표(rateLimit, storage "database")는 Task 4가 생성기로 따로 더한다.
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
})
