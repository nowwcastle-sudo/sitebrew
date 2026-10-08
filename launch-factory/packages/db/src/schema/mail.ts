// 메일 보조 표(LFMAIL).
// - mail_ledger: 「한 번만 보내는 메일」의 기록. 한 행 = 한 사용자에게 한 종류 메일을 보냈다는 사실(환영 메일 G05 · 마케팅 수신 2년 재확인 A16).
//   기본 키(user_id, key)가 멱등 장치다 — 먼저 행을 넣은 쪽만 보낸다(ON CONFLICT DO NOTHING). ref_at 은 그 메일이 가리킨 기준 시각(재확인이면 동의한 날)이다.
// - marketing_notice_outbox: 마케팅 수신 처리 결과 통지 메일(정보통신망법 제50조제7항 · 시행령 제62조의2, 14일 안)이 실패했을 때 남기는 발신함(D210). 한 행 = 보내지 못한 통지 한 통.
//   저장하는 것은 이미 다른 표에 있는 사실(사용자 id·채널·동의 여부·의사 표시 시각)과 재시도 상태(횟수·다음 시각·마지막 오류 코드)뿐이다 — 메일 주소·이름·본문은 두지 않는다(보낼 때 사용자 표에서 읽는다).
//   status: pending(다시 보낼 것) · sent · exhausted(시도 횟수를 다 써서 멈춤 — 사람이 봐야 한다) · skipped(보낼 주소가 없다). 사용자를 지우면 같이 지워진다.
// - known_devices: 로그인한 적 있는 기기(C06 새 기기 알림). 브라우저·운영체제 조합의 해시만 둔다(원문 user-agent·IP 는 저장하지 않는다). 사용자를 지우면 같이 지워진다.
import { sql } from "drizzle-orm"
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"
import type { MarketingChannel } from "./consents.ts"

const tz = { withTimezone: true } as const

export const mailLedger = pgTable(
  "mail_ledger",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 메일 종류 이름(예: "welcome", "marketing_reconfirm") */
    key: text("key").notNull(),
    /** 그 메일이 가리킨 기준 시각(재확인이면 동의한 날). 없는 종류는 null */
    refAt: timestamp("ref_at", tz),
    sentAt: timestamp("sent_at", tz).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
)

export const NOTICE_STATUSES = ["pending", "sent", "exhausted", "skipped"] as const
export type NoticeStatus = (typeof NOTICE_STATUSES)[number]

/** 통지가 어디서 나왔나(운영 확인용 이름표) */
export const NOTICE_SOURCES = ["sign_up", "settings", "unsubscribe_link"] as const
export type NoticeSource = (typeof NOTICE_SOURCES)[number]

export interface NoticeChange {
  channel: MarketingChannel
  granted: boolean
}

export const marketingNoticeOutbox = pgTable(
  "marketing_notice_outbox",
  {
    /** 메일의 멱등 키(`notice:<id>`)가 된다 */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 이번에 바뀐(또는 다시 표시한) 채널과 동의 여부 */
    changes: jsonb("changes").$type<NoticeChange[]>().notNull(),
    /** 의사를 표시한 때(통지 메일에 날짜로 실린다 — 재시도한 때가 아니다) */
    changedAt: timestamp("changed_at", tz).notNull(),
    source: text("source").$type<NoticeSource>().notNull(),
    status: text("status").$type<NoticeStatus>().notNull().default("pending"),
    /** 지금까지 보내 본 횟수(처음 한 번 포함) */
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", tz).notNull(),
    /** 마지막 실패의 짧은 코드(예: validation_error). 오류 글은 두지 않는다 */
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", tz).notNull(),
    /** sent·exhausted·skipped 로 닫은 때 */
    settledAt: timestamp("settled_at", tz),
  },
  (t) => [
    check("marketing_notice_outbox_status_ck", sql.raw(`status in (${NOTICE_STATUSES.map((v) => `'${v}'`).join(", ")})`)),
    check("marketing_notice_outbox_source_ck", sql.raw(`source in (${NOTICE_SOURCES.map((v) => `'${v}'`).join(", ")})`)),
    check("marketing_notice_outbox_attempts_ck", sql`${t.attempts} >= 0`),
    index("marketing_notice_outbox_due_idx").on(t.status, t.nextAttemptAt),
    index("marketing_notice_outbox_user_idx").on(t.userId),
  ],
)

export const knownDevices = pgTable(
  "known_devices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** sha256(사용자 id + 브라우저 종류 + 운영체제)의 앞 32자(hex). 원문이 아니다 */
    fingerprint: text("fingerprint").notNull(),
    /** 사람이 읽는 이름(예: "Chrome on Windows") — 알림 메일에 싣는다 */
    label: text("label").notNull(),
    firstSeenAt: timestamp("first_seen_at", tz).notNull(),
    lastSeenAt: timestamp("last_seen_at", tz).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.fingerprint] }), index("known_devices_user_idx").on(t.userId)],
)
