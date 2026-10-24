// 웹 푸시 구독(계획 3b, 설계서 9.5 — `push` 부품). 한 행 = 브라우저 기기 하나의 PushSubscription.
// - endpoint 는 푸시 서비스가 정한 기기별 주소라 유일하다. 같은 기기를 다른 사용자가 등록하면 소유자를 옮긴다(upsert).
// - 사용자를 지우면 구독도 지운다(cascade) — 알릴 사람이 없다.
// - failure_count: 연속 실패 횟수. 404/410 은 바로 지우고, 그 밖의 실패는 이 값이 한도를 넘으면 지운다(@launch-factory/push).
import { index, integer, bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: bigint("expiration_time", { mode: "number" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", tz).notNull(),
    lastSuccessAt: timestamp("last_success_at", tz),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
)
