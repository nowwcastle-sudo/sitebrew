// launch-factory: 뉴스레터 파기 Cron(하루 한 번 권장). 확인하지 않은 신청(14일)과 수신거부 기록(1년)을 지운다. 구독 중인 사람은 지우지 않는다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/newsletter", "schedule": "30 4 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { newsletter } from "@/lib/launch/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json({ purged: await (await newsletter()).purgeExpired() })
}
