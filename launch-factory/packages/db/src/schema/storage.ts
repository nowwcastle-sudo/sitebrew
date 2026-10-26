// 올린 파일 장부(계획 3c Task 3, @launch-factory/storage). 객체 자체는 S3 호환 저장소에 있고 이 표는 「누가 어떤 키를 언제까지 두는가」만 안다.
// - pending: 올리기 주소를 받았지만 아직 끝내지 않았다(expires_at = 만든 때 + 24시간 — 지나면 객체를 지운다). ready: 끝내기에서 실제 크기·형식을 확인했다.
//   purged: 객체를 지웠다(보유 기간·미완료 만료·정책 위반). 행은 남기되 파일 이름은 비운다.
// - 키에는 사용자 파일 이름을 넣지 않는다(`종류/연도/uuid.확장자`). file_name 은 화면에 보이는 이름(선택, 정리된 100자 이하)일 뿐 개인정보 최소만 둔다.
// - user_id: 올린 사람(로그인했을 때). 탈퇴하면 연결만 끊는다 — 지우는 일은 보유 기간 파기가 한다.
// - expires_at: 객체를 지울 시각. ready 가 되면 종류의 보유 기간(없으면 null)으로 다시 정한다. 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다).
import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const

export const STORED_FILE_STATUSES = ["pending", "ready", "purged"] as const
export type StoredFileStatus = (typeof STORED_FILE_STATUSES)[number]

export const storedFiles = pgTable(
  "stored_files",
  {
    id: uuid("id").primaryKey(),
    /** 객체 키(`종류/연도/uuid.확장자`) */
    key: text("key").notNull().unique(),
    kind: text("kind").notNull(),
    contentType: text("content_type").notNull(),
    /** 올리기 전에 알린 크기(바이트) */
    declaredBytes: integer("declared_bytes").notNull(),
    /** 끝내기에서 저장소가 알려 준 실제 크기. ready 일 때만 */
    sizeBytes: integer("size_bytes"),
    fileName: text("file_name"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").$type<StoredFileStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", tz).notNull(),
    completedAt: timestamp("completed_at", tz),
    expiresAt: timestamp("expires_at", tz),
    purgedAt: timestamp("purged_at", tz),
  },
  (t) => [index("stored_files_expires_at_idx").on(t.expiresAt), check("stored_files_status_check", sql`${t.status} in ('pending', 'ready', 'purged')`)],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 0010_explicit_rls)
