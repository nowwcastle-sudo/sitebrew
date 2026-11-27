import { realTossTestSession, tossTestService } from "@/lib/launch/toss-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 개발용 시험 모드만 허용한다. 요청에서 금액·상품·사용자를 받지 않는다.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  try {
    const service = await tossTestService()
    if (!service) return Response.json({ status: "unavailable" }, { status: 404, headers })
    if (request.headers.get("origin") !== service.config.origin) return Response.json({ status: "invalid" }, { status: 403, headers })
    const session = await realTossTestSession()
    if (!session) return Response.json({ status: "unauthorized" }, { status: 401, headers })
    const rows = await service.db.query<{ id: string }>("SELECT id FROM toss_ledger_subscriptions WHERE user_id=$1 AND product_id=$2 AND status='enabled'", [session.userId, service.productId])
    if (rows.rows.length !== 1) return Response.json({ status: "not_claimed" }, { status: 409, headers })
    const status = await service.ledger.chargeInitial(rows.rows[0].id, session.userId)
    return Response.json({ status }, { status: status === "not_claimed" ? 409 : 200, headers })
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers }) }
}
