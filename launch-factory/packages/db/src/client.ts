// DB 연결. 운영은 Supabase Postgres 서울(설계 D4) — postgres-js 드라이버.
// 트랜잭션 풀러(포트 6543)는 prepared statement를 지원하지 않으므로 prepare:false로 연다.
// 로컬·테스트는 PGlite(WASM Postgres, 메모리) — docker가 필요 없다(계획 개정 2026-09-30, ixartz/SaaS-Boilerplate 방식 차용).
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema.ts"

export type Schema = typeof schema
/** postgres-js·PGlite 어느 쪽이든 받는 공통 타입. 도우미 함수는 이 타입을 받는다. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>

export const POOLER_PORT = "6543"
// new URL("…", import.meta.url) 는 번들러(webpack·Turbopack)가 자산 참조로 보고 폴더를 풀려다 빌드가 실패한다(Task 9 설치 시험에서 실측: Module not found '../migrations').
// 그래서 경로 문자열로 만든다. 번들 안에서는 이 값이 맞지 않을 수 있어 앱은 db.local({ migrationsFolder })로 자기 폴더를 준다(레지스트리 항목이 db/migrations 를 싣는다).
export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations")

export interface ConnectOptions {
  /** 풀러를 거치는지. 포트가 6543이면 이 값과 상관없이 풀러로 본다(false로 끌 수 없다 — 끄면 운영에서 깨진다). */
  pooled?: boolean
}

/** postgres-js에 넘길 옵션. 값이 URL을 담지 않으므로 로그에 찍어도 된다. */
export function connectionOptions(url: string, { pooled }: ConnectOptions = {}): { prepare: boolean } {
  let port: string
  try {
    port = new URL(url).port
  } catch {
    // URL에 비밀번호가 들어 있으므로 메시지에 URL을 넣지 않는다.
    throw new Error("DATABASE_URL 형식이 올바르지 않다(postgres://user:pass@host:port/db)")
  }
  const viaPooler = pooled === true || port === POOLER_PORT
  return { prepare: !viaPooler }
}

/** 운영·스테이징 연결. 연결은 첫 쿼리 때 열린다. */
function connect(url: string, options: ConnectOptions = {}) {
  const client = postgres(url, connectionOptions(url, options))
  return drizzlePostgres({ client, schema })
}

export interface LocalOptions {
  /** 없으면 메모리 DB. 경로를 주면 그 폴더에 남는다(dev 서버용). */
  dataDir?: string
  /** 마이그레이션 폴더. 없으면 이 패키지의 migrations/. 번들된 앱(Next)은 자기 db/migrations 를 준다 */
  migrationsFolder?: string
}

/** 로컬·테스트 DB. PGlite를 띄우고 마이그레이션을 적용해 돌려준다. 다 쓰면 `await d.$client.close()`. */
async function local({ dataDir, migrationsFolder = MIGRATIONS_DIR }: LocalOptions = {}) {
  // 운영 번들에 WASM이 실리지 않도록 여기서만 불러온다.
  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  const client = new PGlite(dataDir)
  const d = drizzle({ client, schema })
  await migrate(d, { migrationsFolder })
  return d
}

/** `db(url, { pooled })` 운영 연결, `db.local()` 로컬·테스트 연결. */
export const db = Object.assign(connect, { local })
