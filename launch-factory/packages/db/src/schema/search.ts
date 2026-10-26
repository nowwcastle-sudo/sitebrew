// 사이트 검색 색인(v0.2.0 계획 3c Task 2). 문서 한 건 = (kind, ref) 하나. 본문은 service 가 4000자로 잘라 넣는다.
// 사용자 개인정보는 담지 않는다 — 공개 쪽·상품·글의 제목·본문·주소만. 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다).
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

const tz = { withTimezone: true } as const

export const searchDocuments = pgTable(
  "search_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 문서 종류(예: page·product·post). 제품이 정한다 */
    kind: text("kind").notNull(),
    /** 종류 안에서 문서를 가리키는 값(상품 id·글 slug 등) */
    ref: text("ref").notNull(),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** 결과를 눌렀을 때 가는 곳 — 이 사이트 안 경로 또는 https 주소 */
    url: text("url").notNull(),
    updatedAt: timestamp("updated_at", tz).notNull(),
  },
  (t) => [unique("search_documents_kind_ref_unique").on(t.kind, t.ref), index("search_documents_locale_idx").on(t.locale)],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 앱은 표 소유자로 붙는다, 0010_explicit_rls)
