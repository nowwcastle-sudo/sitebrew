import { realTossTestSession, tossTestService } from "@/lib/launch/toss-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  try {
    const service = await tossTestService()
    if (!service) return Response.json({ status: "unavailable" }, { status: 404, headers })
    if (request.headers.get("origin") !== service.config.origin) return Response.json({ status: "invalid" }, { status: 403, headers })
    const session = await realTossTestSession()
    if (!session) return Response.json({ status: "unauthorized" }, { status: 401, headers })
    const checkout = await service.billing.port(session.userId).checkout({ planId: "test-monthly" })
    if (!checkout.ok) return Response.json({ status: "unavailable" }, { status: 409, headers })
    const result = await service.endpoints.begin(request, "test-monthly")
    return Response.json(result, { status: result.status === "unauthorized" ? 401 : result.status === "invalid" ? 403 : 200, headers })
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers }) }
}
