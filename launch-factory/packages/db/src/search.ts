// 검색 색인 저장·조회(계획 3c Task 2). 낱말 정리·점수 설명·조각 만들기는 @launch-factory/search 가 한다 — 여기는 SQL 뿐이다.
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm"
import type { Database } from "./client.ts"
import { searchDocuments } from "./schema.ts"

export type SearchDocumentRow = typeof searchDocuments.$inferSelect
export type NewSearchDocument = Omit<typeof searchDocuments.$inferInsert, "id">

/** 한 번에 넣는 문서 수(바인딩 매개변수 상한 안에서 나눈다) */
const INSERT_CHUNK = 200

const upsertRows = (d: Pick<Database, "insert">, rows: NewSearchDocument[]) =>
  d
    .insert(searchDocuments)
    .values(rows)
    .onConflictDoUpdate({
      target: [searchDocuments.kind, searchDocuments.ref],
      set: {
        locale: sql`excluded.locale`,
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        url: sql`excluded.url`,
        updatedAt: sql`excluded.updated_at`,
      },
    })

/** (kind, ref) 가 같으면 덮어쓴다. 같은 (kind, ref) 가 한 번에 둘 이상이면 뒤의 것이 이긴다 */
export async function upsertSearchDocuments(d: Database, rows: NewSearchDocument[]): Promise<number> {
  const unique = [...new Map(rows.map((r) => [`${r.kind}\u0000${r.ref}`, r])).values()]
  return d.transaction(async (tx) => {
    for (let i = 0; i < unique.length; i += INSERT_CHUNK) await upsertRows(tx, unique.slice(i, i + INSERT_CHUNK))
    return unique.length
  })
}

export async function deleteSearchDocument(d: Database, kind: string, ref: string): Promise<boolean> {
  const rows = await d.delete(searchDocuments).where(and(eq(searchDocuments.kind, kind), eq(searchDocuments.ref, ref))).returning({ id: searchDocuments.id })
  return rows.length > 0
}

/** 한 트랜잭션에서 그 종류 문서를 모두 새 목록으로 바꾼다 — 도중에 실패하면 옛 문서가 그대로 남는다 */
export async function replaceSearchKind(d: Database, kind: string, rows: NewSearchDocument[]): Promise<number> {
  const unique = [...new Map(rows.map((r) => [r.ref, { ...r, kind }])).values()]
  return d.transaction(async (tx) => {
    await tx.delete(searchDocuments).where(eq(searchDocuments.kind, kind))
    for (let i = 0; i < unique.length; i += INSERT_CHUNK) await upsertRows(tx, unique.slice(i, i + INSERT_CHUNK))
    return unique.length
  })
}

export async function countSearchDocuments(d: Database): Promise<number> {
  const [row] = await d.select({ n: count() }).from(searchDocuments)
  return row?.n ?? 0
}

export interface SearchQuerySpec {
  /** LIKE 패턴(이미 `%`·`_`·`\` 를 이스케이프하고 앞뒤에 `%` 를 붙인 것). 모두 맞아야 한다(AND) */
  patterns: readonly string[]
  kinds?: readonly string[]
  locale?: string
  limit: number
  offset: number
}

/**
 * 모든 패턴이 제목 또는 본문에 있는 문서(ILIKE). 점수 = 낱말마다 제목 일치 3 + 본문 일치 1, 동점은 최신(그다음 id 로 순서를 고정한다).
 * 패턴은 매개변수로 묶여 SQL 에 글자로 섞이지 않는다.
 */
export async function querySearchDocuments(d: Database, q: SearchQuerySpec): Promise<{ rows: SearchDocumentRow[]; total: number }> {
  const terms = q.patterns.map((p) => ({ inTitle: ilike(searchDocuments.title, p), inBody: ilike(searchDocuments.body, p) }))
  const filters: SQL[] = terms.map((t) => or(t.inTitle, t.inBody) as SQL)
  if (q.kinds?.length) filters.push(inArray(searchDocuments.kind, [...q.kinds]))
  if (q.locale) filters.push(eq(searchDocuments.locale, q.locale))
  const where = and(...filters)
  const score = sql<number>`(${sql.join(
    terms.map((t) => sql`(case when ${t.inTitle} then 3 else 0 end) + (case when ${t.inBody} then 1 else 0 end)`),
    sql` + `,
  )})`
  const [totalRow] = await d.select({ n: count() }).from(searchDocuments).where(where)
  const rows = await d.select().from(searchDocuments).where(where).orderBy(desc(score), desc(searchDocuments.updatedAt), searchDocuments.id).limit(q.limit).offset(q.offset)
  return { rows, total: totalRow?.n ?? 0 }
}
