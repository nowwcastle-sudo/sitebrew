// launch-factory: 결제 Cron(Vercel Cron, 1시간 주기 권장). 기간 끝 예약 변경·동의 기한이 지난 가격 변경 정리.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/billing", "schedule": "0 * * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { billing } from "@/lib/launch/billing"
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await (await billing()).runScheduledChanges())
}
