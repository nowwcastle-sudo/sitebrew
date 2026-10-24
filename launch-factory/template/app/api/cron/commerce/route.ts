// launch-factory: 상점 Cron(10분마다). 결제 대기 시간(30분)이 지난 주문을 정리한다 — 재고를 돌려주고 취소한다.
// 웹훅을 놓쳐 결제는 됐는데 대기로 남은 주문은 취소하지 않고 공급자에 다시 물어 확정한다.
// vercel.json 에 `{ "crons": [{ "path": "/api/cron/commerce", "schedule": "*/10 * * * *" }] }` 를 더한다. CRON_SECRET 이 없으면 401 이다.
import { expirePending, withDefaults } from "@launch-factory/commerce"
import { commerceDeps, commerceEnabled } from "@/lib/launch/commerce"
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  // 상점이 꺼진 사이트(PortOne 값 없음)는 정리할 주문이 없다 — 오류가 아니다
  if (!commerceEnabled()) return Response.json({ skipped: "commerce_disabled" })
  return Response.json(await expirePending(withDefaults(await commerceDeps())))
}
