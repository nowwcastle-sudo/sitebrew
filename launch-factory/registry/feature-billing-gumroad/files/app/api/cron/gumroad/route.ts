// launch-factory: Gumroad 재확인 Cron(하루 한 번 권장). 놓친 알림을 API 재조회로 맞춘다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/gumroad", "schedule": "0 3 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { gumroad } from "@/lib/launch/gumroad"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await (await gumroad()).reconcile())
}
