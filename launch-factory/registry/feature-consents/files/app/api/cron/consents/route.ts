// launch-factory: 마케팅 수신동의 2년 재확인 Cron(하루 한 번 권장 — A16, 정보통신망법 제50조제8항 · 시행령 제62조의3).
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/consents", "schedule": "20 5 * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
// 두 번 와도 안전하다(보낸 기록이 있는 동의는 다시 뽑히지 않는다). 실패한 사람은 다음 실행이 이어서 한다. 응답은 { due, sent, skipped, failed } 건수다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { runReconfirm } from "@/lib/launch/marketing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await runReconfirm())
}
