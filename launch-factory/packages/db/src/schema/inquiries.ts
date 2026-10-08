// 문의(v0 Task 15, 대장 D97 — 운영자 판정 2026-09-30 02:46 「v0로 앞당김」)와 폼 제출 멱등 키(D105).
// - inquiries: 문의 한 건. 개인정보는 최소만 — 이름(선택)·연락처(이메일 또는 전화)·문의 내용. IP·브라우저 정보는 저장하지 않는다.
//   보유 기간이 지나면(expires_at) purgeExpiredInquiries 가 지운다(개인정보 보호법 제21조① — 불필요해지면 지체 없이 파기).
//   기본 30일(D97). kind 가 complaint·dispute 인 문의는 소비자 불만·분쟁 처리 기록이라 전자상거래법 시행령 제6조①4에 따라 3년(D134).
//   kind 가 바뀌면 expires_at 도 접수일(created_at) 기준으로 다시 계산한다 — 바꾼 내역은 admin_actions 에 한 줄씩 남는다.
// - idempotency_keys: 폼을 열 때 만든 키 → 첫 성공 결과. 같은 키로 다시 보내면 24시간 동안 같은 결과를 돌려준다(Stripe 방식).
//   result 가 null 이면 처리 중이다. 실패한 제출은 남기지 않는다(고친 뒤 같은 키로 다시 보낼 수 있게).
// 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다 — Task 4 D26 규칙).
import { sql } from "drizzle-orm"
import { check, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const

/** 문의 종류(D134 — 운영자 판정 2026-09-30 03:35). complaint·dispute 는 소비자 불만·분쟁 처리 기록이라 3년, 나머지는 30일 */
export const INQUIRY_KINDS = ["general", "consultation", "quote", "complaint", "dispute"] as const
export type InquiryKind = (typeof INQUIRY_KINDS)[number]

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 사람에게 보이는 접수 번호(예: Q-7K3M9P2A) */
    reference: text("reference").notNull().unique(),
    /** 어느 폼에서 왔는지(블록 id 등, 개인정보 아님) */
    form: text("form").notNull(),
    name: text("name"),
    contact: text("contact").notNull(),
    contactKind: text("contact_kind").$type<"email" | "phone">().notNull(),
    message: text("message").notNull(),
    kind: text("kind").$type<InquiryKind>().notNull().default("general"),
    locale: text("locale").notNull(),
    /** 로그인한 채 보냈으면 그 사용자. 탈퇴하면 연결만 끊는다(문의 자체는 보유 기간까지) */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", tz).notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    ownerNotifiedAt: timestamp("owner_notified_at", tz),
    receiptSentAt: timestamp("receipt_sent_at", tz),
  },
  (t) => [
    index("inquiries_expires_at_idx").on(t.expiresAt),
    check("inquiries_kind_check", sql`${t.kind} in ('general', 'consultation', 'quote', 'complaint', 'dispute')`),
  ],
)

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    /** 어느 제출인지(예: "inquiry", "checkout") — 같은 키라도 범위가 다르면 다른 요청이다 */
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    result: jsonb("result"),
    createdAt: timestamp("created_at", tz).notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] }), index("idempotency_keys_created_at_idx").on(t.createdAt)],
)
