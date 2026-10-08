// drizzle-kit 설정. `npm run db:generate -w @launch-factory/db`로 migrations/를 만든다(연결이 필요 없다).
// `db:migrate`는 DATABASE_URL로 적용한다. 운영 적용은 풀러(6543)가 아니라 직접 연결(5432)로 한다.
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./migrations",
  strict: true,
  ...(url ? { dbCredentials: { url } } : {}),
})
