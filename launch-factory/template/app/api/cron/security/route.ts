// launch-factory: 보안 표 정리 Cron(하루 한 번 권장). 지난 요청 제한 창(하루 넘음)과 보존 기간(24시간)이 지난 멱등 키를 지운다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/security", "schedule": "30 4 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { purgeIdempotencyKeys, purgeRateLimits } from "@launch-factory/db"
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { database } from "@/lib/launch/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  const db = await database()
  const now = new Date()
  return Response.json({ rateLimits: await purgeRateLimits(db, new Date(now.getTime() - DAY_MS)), idempotencyKeys: await purgeIdempotencyKeys(db, now) })
}
