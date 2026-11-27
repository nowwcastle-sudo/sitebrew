import { handleTestRegistrationCallback } from "./callback.ts"
import type { createTestRegistration } from "./registration.ts"

/** 실제 앱에서 서버 인증 라이브러리의 세션 조회를 주입한다. 브라우저 입력으로 userId를 받지 않는다. */
export function createTestRegistrationEndpoints(options: { registration: ReturnType<typeof createTestRegistration>; origin: string; session: () => Promise<{ userId: string; impersonatedBy?: string } | null> }) {
  const root = new URL(options.origin)
  if (root.protocol !== "https:" || root.origin !== options.origin) throw new Error("Invalid test endpoint origin")
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }
  async function begin(request: Request, planId: string) {
    if (request.method !== "POST" || request.headers.get("origin") !== root.origin) return { status: "invalid" as const }
    const session = await options.session()
    if (!session || session.impersonatedBy) return { status: "unauthorized" as const }
    return options.registration.start({ userId: session.userId, planId })
  }
  async function complete(request: Request) {
    let session: Awaited<ReturnType<typeof options.session>>
    try { session = await options.session() } catch { return new Response(null, { status: 503, headers }) }
    if (!session || session.impersonatedBy) return new Response(null, { status: 401, headers })
    return handleTestRegistrationCallback(request, session.userId, options.registration)
  }
  return { begin, complete }
}
