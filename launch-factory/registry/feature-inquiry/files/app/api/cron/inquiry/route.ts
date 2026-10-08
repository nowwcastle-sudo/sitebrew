// launch-factory: 문의 파기 Cron(하루 한 번 권장). 보유 기간이 지난 문의를 지운다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/inquiry", "schedule": "0 4 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { inquiry } from "@/lib/launch/inquiry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json({ purged: await (await inquiry()).purgeExpired() })
}
