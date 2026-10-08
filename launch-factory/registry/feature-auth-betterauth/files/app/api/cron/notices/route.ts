// launch-factory: 마케팅 수신 처리 결과 통지 재시도 Cron(D210, 한 시간 주기 — 재시도 간격의 가장 작은 단위). 보내기가 실패해 발신함에 남은 통지를 다시 보낸다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/notices", "schedule": "10 * * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
// 두 번 와도(동시에도) 안전하다 — 보낸 통지는 다시 뽑히지 않고 열린 통지는 먼저 잡은 실행만 보낸다. 시도 횟수를 다 쓴 통지는 멈추고 로그(exhausted)로 알린다.
// 응답은 { due, sent, skipped, failed, exhausted, raced } 건수다(메일 내용·주소는 없다).
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { retryMarketingNotices } from "@/lib/launch/notices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return Response.json(await retryMarketingNotices())
}
