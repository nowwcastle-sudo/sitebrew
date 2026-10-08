// 받은 웹훅 이벤트. (provider, event_id)가 기본키라 같은 이벤트는 두 번 들어가지 않는다(Global Constraints·Review Focus 1).
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

const tz = { withTimezone: true } as const

export const webhookEvents = pgTable(
  "webhook_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    /** 공급자가 적은 발생 시각. 순서 판단은 이 값으로 한다(받은 순서가 아니다). */
    occurredAt: timestamp("occurred_at", tz).notNull(),
    receivedAt: timestamp("received_at", tz).defaultNow().notNull(),
    processedAt: timestamp("processed_at", tz),
    /** 원문 본문의 sha256. 본문(개인정보가 있을 수 있다)은 저장하지 않는다. */
    payloadHash: text("payload_hash").notNull(),
  },
  (t) => [primaryKey({ name: "webhook_events_pk", columns: [t.provider, t.eventId] })],
)
