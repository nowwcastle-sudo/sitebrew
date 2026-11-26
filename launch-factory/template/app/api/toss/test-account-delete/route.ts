// 실제 Better Auth 세션과 탈퇴 확인 규칙을 통과하는 개발 시험 전용 입구다.
import { authActions } from "@launch-factory/auth"
import { accountPort } from "@/lib/launch/account"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { realTossTestSession, tossTestConfig } from "@/lib/launch/toss-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  const config = tossTestConfig()
  if (!config) return Response.json({ status: "unavailable" }, { status: 404, headers })
  if (request.headers.get("origin") !== config.origin) return Response.json({ status: "invalid" }, { status: 403, headers })
  try {
    if (!(await realTossTestSession())) return Response.json({ status: "unauthorized" }, { status: 401, headers })
    const input: unknown = await request.json()
    const result = await authActions(await accountPort(), { locale: DEFAULT_LOCALE }).deleteAccount(input)
    return Response.json(result.ok ? { status: "requested" } : { status: "unavailable" }, { status: result.ok ? 200 : 400, headers })
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers }) }
}
