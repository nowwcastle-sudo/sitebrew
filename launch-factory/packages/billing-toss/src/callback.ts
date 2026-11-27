import type { createTestRegistration } from "./registration.ts"

// 어댑터 조립자는 세션을 서버에서 확인하고 userId를 전달한다. URL·authKey는 응답이나 로그에 넣지 않는다.
export async function handleTestRegistrationCallback(request: Request, userId: string | null, registration: ReturnType<typeof createTestRegistration>): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }
  if (request.method !== "GET") return new Response(null, { status: 405, headers })
  if (!userId) return new Response(null, { status: 401, headers })
  try {
    const status = await registration.complete({ userId, requestUrl: request.url })
    return new Response(null, { status: 303, headers: { ...headers, Location: registration.returnUrl(status) } })
  } catch { return new Response(null, { status: 503, headers }) }
}
