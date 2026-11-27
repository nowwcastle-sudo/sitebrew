import { tossTestService } from "@/lib/launch/toss-test"
import { canonicalTossCallback } from "@/lib/toss-test-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await tossTestService()
    if (!service) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
    const canonical = canonicalTossCallback(request, service.config.origin, "/api/toss/registration/complete")
    if (!canonical) return new Response(null, { status: 400, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
    const response = await service.endpoints.complete(canonical)
    if (response.status !== 303) return response
    const result = new URL(response.headers.get("location") as string).searchParams.get("registration")
    const target = new URL("/account/billing/toss-test", service.config.origin)
    target.searchParams.set("registration", ["registered", "canceled", "unresolved", "invalid"].includes(result ?? "") ? result as string : "invalid")
    return new Response(null, { status: 303, headers: { "Location": target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }) }
}
