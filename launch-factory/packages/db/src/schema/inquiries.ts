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

/** 신청 처리 상태(계획 3c Task 5 — 내 신청 내역). 접수 → 처리 중 → 완료 */
export const INQUIRY_STATUSES = ["received", "in_progress", "done"] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

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
    /** 처리 상태. 새 문의는 received — 바꾸는 일은 관리자·소유자만(admin_actions 에 한 줄) */
    status: text("status").$type<InquiryStatus>().notNull().default("received"),
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
    index("inquiries_user_idx").on(t.userId, t.createdAt),
    check("inquiries_kind_check", sql`${t.kind} in ('general', 'consultation', 'quote', 'complaint', 'dispute')`),
    check("inquiries_status_check", sql`${t.status} in ('received', 'in_progress', 'done')`),
  ],
)

/**
 * 문의 답변(계획 3d 관리 화면). 직원(소유자·관리자)이 문의에 단 답 — 한 문의에 여러 번 달 수 있고 문의의 글타래가 된다.
 * 문의가 파기되면(expires_at) 답변도 같이 지워진다(on delete cascade) — 보유 기간은 문의 것을 따른다. mailed_at: 보낸 사람에게 메일이 나갔으면 그 시각(연락처가 전화이거나 메일이 실패하면 null).
 * 쓴 사람(admin_user_id)은 탈퇴하면 연결만 끊는다.
 */
export const inquiryReplies = pgTable(
  "inquiry_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    adminUserId: text("admin_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", tz).notNull(),
    mailedAt: timestamp("mailed_at", tz),
  },
  (t) => [index("inquiry_replies_inquiry_idx").on(t.inquiryId, t.createdAt)],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 0010_explicit_rls)

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
