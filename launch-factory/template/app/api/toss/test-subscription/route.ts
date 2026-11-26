import { realTossTestSession, tossTestService } from "@/lib/launch/toss-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }

export async function POST(request: Request) {
  try {
    const service = await tossTestService()
    if (!service) return Response.json({ status: "unavailable" }, { status: 404, headers })
    if (request.headers.get("origin") !== service.config.origin) return Response.json({ status: "invalid" }, { status: 403, headers })
    const session = await realTossTestSession()
    if (!session) return Response.json({ status: "unauthorized" }, { status: 401, headers })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || !("action" in input)) return Response.json({ status: "invalid" }, { status: 400, headers })
    const port = service.billing.port(session.userId)
    const result = input.action === "reconcile" ? await port.reconcile() : input.action === "cancel_now" || input.action === "cancel_period" ? await port.cancel({ when: input.action === "cancel_now" ? "now" : "period_end", confirmed: "confirmed" in input && input.confirmed === true ? true : undefined }) : null
    if (!result) return Response.json({ status: "invalid" }, { status: 400, headers })
    return Response.json(result, { status: result.ok ? 200 : 409, headers })
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers }) }
}
