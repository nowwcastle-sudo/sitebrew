// launch-factory: DB 연결. mock 은 메모리 PGlite(키 없이 켜진다), live 는 DATABASE_URL(Supabase 풀러 6543 — prepared statement 끔은 패키지가 한다).
// mock 의 마이그레이션은 이 앱에 설치된 db/migrations 를 쓴다(번들 안에서는 패키지 폴더를 찾을 수 없다).
import { join } from "node:path"
import { db, type Database } from "@launch-factory/db"
import { env, required } from "@/lib/launch/env"

let cached: Promise<Database> | undefined

/**
 * mock 의 메모리 DB 는 프로세스 하나에 하나다. 서버 번들은 쪽·서버 액션·경로 처리기(app/api)로 갈라져 같은 모듈이 번들마다 따로 불리므로(Next/Turbopack),
 * 모듈 변수에만 두면 번들 수만큼 DB 가 생겨 경로 처리기(웹훅·크론·/api/auth)와 쪽이 서로 다른 데이터를 보았다(관리 화면 시험 실측: 경로로 만든 세션이 쪽에서 안 보였다).
 * 그래서 globalThis 에 둔다. live 는 연결 문자열이 같은 DB 를 가리키므로 모듈 변수로 충분하다.
 */
const mockStore = globalThis as { __lfMockDb?: Promise<Database> }

export function database(): Promise<Database> {
  if (env().LF_MODE === "mock") return (mockStore.__lfMockDb ??= db.local({ migrationsFolder: join(process.cwd(), "db", "migrations") }))
  return (cached ??= Promise.resolve(db(required("DATABASE_URL"))))
}
