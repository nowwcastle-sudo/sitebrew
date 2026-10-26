// launch-factory: 예약 Cron(30분마다 권장). 시작 전 안내를 한 번만 보내고, 예약금 결제 대기 시간이 지난 예약을 닫아 자리를 풀고, 보유 기간이 지난 예약을 지운다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/booking", "schedule": "*/30 * * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { booking } from "@/lib/launch/booking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  const service = await booking()
  return Response.json({ reminded: await service.remindDue(), expiredDeposits: await service.expireDeposits(), purged: await service.purgeExpired() })
}
