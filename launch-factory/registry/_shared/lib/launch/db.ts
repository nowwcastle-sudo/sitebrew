// launch-factory: DB 연결. mock 은 메모리 PGlite(키 없이 켜진다), live 는 DATABASE_URL(Supabase 풀러 6543 — prepared statement 끔은 패키지가 한다).
// mock 의 마이그레이션은 이 앱에 설치된 db/migrations 를 쓴다(번들 안에서는 패키지 폴더를 찾을 수 없다).
import { join } from "node:path"
import { db, type Database } from "@launch-factory/db"
import { env, required } from "@/lib/launch/env"

let cached: Promise<Database> | undefined

export function database(): Promise<Database> {
  return (cached ??= env().LF_MODE === "mock" ? db.local({ migrationsFolder: join(process.cwd(), "db", "migrations") }) : Promise.resolve(db(required("DATABASE_URL"))))
}
