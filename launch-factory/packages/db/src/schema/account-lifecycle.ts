// 탈퇴 요청(유예 → 파기)과 거래기록 분리 보존. 흐름은 Task 14가 만든다. 여기는 표만 있다.
import { sql } from "drizzle-orm"
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { RETAINED_TRANSACTION_KINDS } from "../retention.ts"

const tz = { withTimezone: true } as const
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`)

/**
 * pending(유예 중 — 로그인하면 cancelled) → purging(파기 작업이 잡았다 — 로그인해도 취소되지 않는다) → purged(DB 파기 끝).
 * purged 뒤 계측 삭제(analytics_erased_at)가 끝나면 completed_at 을 적고 user_id 를 비운다(Task 14).
 */
export const ACCOUNT_DELETION_STATUSES = ["pending", "purging", "cancelled", "purged"] as const
export type AccountDeletionStatus = (typeof ACCOUNT_DELETION_STATUSES)[number]

export const accountDeletions = pgTable(
  "account_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** user 행이 지워진 뒤에도 계측 삭제를 다시 시도하려고 남긴다(외래키 없음). 모든 단계가 끝나면 null 로 비운다. */
    userId: text("user_id"),
    orgId: text("org_id"),
    status: text("status").$type<AccountDeletionStatus>().notNull().default("pending"),
    requestedAt: timestamp("requested_at", tz).defaultNow().notNull(),
    graceUntil: timestamp("grace_until", tz).notNull(),
    cancelledAt: timestamp("cancelled_at", tz),
    purgedAt: timestamp("purged_at", tz),
    /** 보존 거래기록의 가명 참조(키 있는 해시). 파기 때 적는다 — 파기 처리 사실을 요청 시 확인하는 데 쓴다. */
    subjectRef: text("subject_ref"),
    analyticsErasedAt: timestamp("analytics_erased_at", tz),
    completedAt: timestamp("completed_at", tz),
    /** 마지막 실패 이유(오류 이름·짧은 코드만 — 개인정보를 넣지 않는다). 다음 Cron 이 다시 시도한다. */
    lastError: text("last_error"),
  },
  (t) => [
    check("account_deletions_status_ck", inList("status", ACCOUNT_DELETION_STATUSES)),
    // 한 사용자에게 진행 중인 탈퇴 요청은 하나뿐이다.
    uniqueIndex("account_deletions_open_uq").on(t.userId).where(sql`status in ('pending', 'purging')`),
    index("account_deletions_grace_idx").on(t.graceUntil),
  ],
)

/**
 * 전자상거래법 제6조·시행령 제6조가 보존을 요구하는 거래기록. 시행령 제6조제2항제3호에 따라 다른 기록과 따로 둔다.
 * 이름·이메일·주소 칸이 없다. subject_ref는 가명 참조(예: 이메일의 키 있는 해시)로, 소비자가 열람을 요청하면 찾을 수 있게 한다(Task 14).
 */
export const retainedTransactions = pgTable(
  "retained_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id"),
    subjectRef: text("subject_ref").notNull(),
    kind: text("kind").$type<(typeof RETAINED_TRANSACTION_KINDS)[number]>().notNull(),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref").notNull(),
    occurredAt: timestamp("occurred_at", tz).notNull(),
    /** 이 시각이 지나면 지운다(retention.ts retainUntil). */
    retainUntil: timestamp("retain_until", tz).notNull(),
    /** 개인 식별 칸을 뺀 거래 내용(금액·통화·요금제·청약철회 여부 등) */
    record: jsonb("record").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (t) => [
    check("retained_transactions_kind_ck", inList("kind", RETAINED_TRANSACTION_KINDS)),
    // 옮기는 Cron이 두 번 돌아도 한 번만 들어간다.
    uniqueIndex("retained_transactions_ref_uq").on(t.provider, t.providerRef, t.kind),
    index("retained_transactions_retain_idx").on(t.retainUntil),
  ],
)
