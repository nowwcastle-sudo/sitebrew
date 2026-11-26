// 시험 등록 패키지의 SQL 계약을 기존 Drizzle DB에 연결한다. 값은 모두 바인딩한다.
import { sql, type SQL } from "drizzle-orm"
import type { Database } from "@launch-factory/db"
import type { LedgerDatabase, SqlConnection } from "@launch-factory/billing-toss"

function boundQuery(text: string, params: unknown[]): SQL {
  const query = sql.empty()
  let end = 0
  for (const match of text.matchAll(/\$(\d+)/g)) {
    query.append(sql.raw(text.slice(end, match.index)))
    const index = Number(match[1]) - 1
    if (index < 0 || index >= params.length) throw new Error("Invalid query binding")
    // postgres-js의 raw SQL 바인딩은 Date를 인코딩하지 않으므로 ISO 문자열로 전달한다.
    const value = params[index] instanceof Date ? params[index].toISOString() : params[index]
    query.append(sql`${value}`)
    end = (match.index ?? 0) + match[0].length
  }
  query.append(sql.raw(text.slice(end)))
  return query
}

export function tossTestConnection(db: Database): SqlConnection {
  return {
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      const result = await db.execute(boundQuery(text, params))
      const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows
      return { rows: rows as T[] }
    },
  }
}

export function tossTestDatabase(db: Database): LedgerDatabase {
  return {
    ...tossTestConnection(db),
    transaction: (run) => db.transaction((tx) => run(tossTestConnection(tx)), { isolationLevel: "read committed" }),
  }
}
