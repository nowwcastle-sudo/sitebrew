import { realTossTestSession, tossTestService } from "@/lib/launch/toss-test"
import { canonicalTossCallback } from "@/lib/toss-test-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  try {
    const service = await tossTestService()
    if (!service) return new Response(null, { status: 404, headers })
    const session = await realTossTestSession()
    if (!session) return new Response(null, { status: 401, headers })
    const canonical = canonicalTossCallback(request, service.config.origin, "/api/toss/registration/fail")
    if (!canonical) return new Response(null, { status: 400, headers })
    const url = new URL(canonical.url)
    const states = url.searchParams.getAll("state")
    if (states.length !== 1) return new Response(null, { status: 400, headers })
    const status = await service.registration.status({ userId: session.userId, state: states[0] })
    const target = new URL("/account/billing/toss-test", service.config.origin)
    target.searchParams.set("registration", status === "pending" ? "failed" : "invalid")
    // 실패 URL은 구독을 바꾸지 않는다. 만료 전 재진입은 기존 세션이 막는다.
    return new Response(null, { status: 303, headers: { ...headers, Location: target.toString() } })
  } catch { return new Response(null, { status: 503, headers }) }
}
