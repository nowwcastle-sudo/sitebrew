// 후기·상품 문의(계획 3c Task 1). 대상(subject)은 제품이 정하는 문자열 둘(subjectType·subjectId)이라 이 표는 상품 표를 모른다.
// - 후기(review)는 별점이 있고 한 사람이 한 대상에 한 번만 쓴다(부분 유일 색인). 질문(question)은 로그인 없이도 쓸 수 있고 별점이 없다.
// - 작성자 이름은 저장하기 전에 가려서(@launch-factory/reviews mask) 넣는다. 원래 이름·연락처는 저장하지 않는다.
// - 숨김은 지우지 않는다(hidden + 사유). 판매자가 후기를 지울 수 없다 — 지우는 함수가 없다.
// - 탈퇴하면 user_id 만 끊고(set null) 서비스가 작성자 이름을 「탈퇴한 사용자」로 바꾼다. 글 자체는 공개 콘텐츠라 남는다.
// 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다 — Task 4 D26 규칙).
import { sql } from "drizzle-orm"
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const

export const REVIEW_KINDS = ["review", "question"] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]
export const REVIEW_STATUSES = ["published", "pending", "hidden"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<ReviewKind>().notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** 가린 이름(예: 김**, Dana K.) */
    authorName: text("author_name").notNull(),
    /** 1~5, 후기에만 */
    rating: integer("rating"),
    title: text("title"),
    body: text("body").notNull(),
    locale: text("locale").notNull(),
    status: text("status").$type<ReviewStatus>().notNull(),
    /** 실제로 산 사람의 후기인가. 구매 기록과 잇는 일(3a)이 채운다 */
    verified: boolean("verified").notNull().default(false),
    answerBody: text("answer_body"),
    answeredAt: timestamp("answered_at", tz),
    /** 답변한 관리자·소유자 user id(공개하지 않는다) */
    answeredBy: text("answered_by"),
    hiddenReason: text("hidden_reason"),
    createdAt: timestamp("created_at", tz).notNull(),
    updatedAt: timestamp("updated_at", tz).notNull(),
  },
  (t) => [
    index("reviews_subject_idx").on(t.subjectType, t.subjectId, t.status, t.createdAt),
    index("reviews_user_idx").on(t.userId),
    uniqueIndex("reviews_one_per_user_subject_idx").on(t.userId, t.subjectType, t.subjectId).where(sql`${t.kind} = 'review' and ${t.userId} is not null`),
    check("reviews_kind_ck", sql`${t.kind} in ('review', 'question')`),
    check("reviews_status_ck", sql`${t.status} in ('published', 'pending', 'hidden')`),
    check("reviews_rating_ck", sql`(${t.kind} = 'review' and ${t.rating} between 1 and 5) or (${t.kind} = 'question' and ${t.rating} is null)`),
  ],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 0010_explicit_rls)
