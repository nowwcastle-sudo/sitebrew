// launch-factory: 올린 파일 파기 Cron(하루 한 번 권장). 끝내지 않은 것(24시간)·보유 기간이 지난 것의 객체를 지우고 장부에 표시한다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/storage", "schedule": "40 4 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { storage } from "@/lib/launch/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await (await storage()).purgeExpired())
}
