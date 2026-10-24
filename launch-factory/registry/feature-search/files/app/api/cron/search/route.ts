// launch-factory: 검색 색인 새로 만들기 Cron(하루 한 번 권장). content/search-index.json 의 문서로 종류별 색인을 바꾼다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/search", "schedule": "20 4 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { reindex } from "@/lib/launch/search"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json({ indexed: await reindex() })
}
