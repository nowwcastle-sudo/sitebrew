#!/usr/bin/env node
// npm run db:status — 이 PC 에서 DATABASE_URL 이 있을 때만 쓴다(CI 는 오프라인 점검만 한다). 읽기 전용: SELECT 한 번을 READ ONLY 트랜잭션 안에서 한다. 아무것도 쓰지 않는다.
//   DATABASE_URL=<직접 연결 5432 또는 풀러> node scripts/db-status.mjs [--dir packages/db/migrations]
// DB 의 drizzle.__drizzle_migrations 기록(개수·when·SQL 해시)을 journal 과 맞춰 본다.
//   종료 0 = 일치 · 1 = 어긋남(대기·앞섬·다름) · 2 = 사용 오류(DATABASE_URL 없음·연결 실패). 주소·비밀번호는 출력하지 않는다.
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkMigrationsDir, compareApplied } from "./ci/migrations.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

export async function readApplied(url) {
  const { default: postgres } = await import("postgres")
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} })
  try {
    return await sql.begin("read only", async (tx) => {
      const [{ ok }] = await tx`select to_regclass('drizzle.__drizzle_migrations') is not null as ok`
      if (!ok) return []
      return await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at, id`
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function main() {
  const i = process.argv.indexOf("--dir")
  const dir = resolve(ROOT, i === -1 ? "packages/db/migrations" : process.argv[i + 1])
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL 이 없다 — 로컬에서 DB 에 닿을 때만 쓴다(읽기 전용). CI 의 오프라인 일치 점검은 `npm test` 안의 migrations.test.mjs 다.")
    return 2
  }
  const offline = checkMigrationsDir(dir)
  if (offline.length) {
    console.error(`journal·SQL 파일이 서로 어긋난다 — DB 비교 전에 고친다:\n${offline.join("\n")}`)
    return 1
  }
  let rows
  try {
    rows = await readApplied(url)
  } catch (e) {
    console.error(`DB 를 읽지 못했다: ${e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "<url>") : "알 수 없는 오류"}`)
    return 2
  }
  const r = compareApplied(dir, rows)
  console.log(`db:status — 적용 ${r.applied} · journal ${r.journal} → ${r.status}`)
  for (const l of r.lines) console.log(`  ${l}`)
  return r.status === "in-sync" ? 0 : 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exitCode = await main()
