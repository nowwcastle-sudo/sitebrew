// launch-factory: 탈퇴 파기 Cron(하루 한 번 권장). 유예가 지난 탈퇴 요청을 파기하고, 기간이 지난 보존 거래기록·접속기록을 정리한다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/purge", "schedule": "0 5 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
// 두 번 와도 안전하다(같은 요청을 한 번만 잡는다 — Vercel 은 같은 실행을 두 번 보낼 수 있다). 실패한 단계는 다음 Cron 이 이어서 한다.
import { purge } from "@/lib/launch/account"
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await purge())
}
