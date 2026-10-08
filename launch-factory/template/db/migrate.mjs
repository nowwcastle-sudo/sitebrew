// launch-factory: 마이그레이션 적용. 사용법: DATABASE_URL=<직접 연결(5432)> node db/migrate.mjs
// 이 폴더의 migrations/ 를 순서대로 적용한다. 이미 적용한 파일은 건너뛴다(drizzle 기록 표).
import { fileURLToPath } from "node:url"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
if (new URL(url).port === "6543") {
  console.error("Use the direct connection (port 5432) for migrations, not the transaction pooler (6543).")
  process.exit(1)
}

const client = postgres(url, { max: 1 })
try {
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) })
  console.log("migrations applied")
} finally {
  await client.end()
}
