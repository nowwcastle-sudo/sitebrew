// launch-factory: 확인 메일의 「제가 가입한 게 아니에요」(A13). 주소의 `?t=` 는 기한 14일의 서명 토큰(notMeToken)이다.
//   GET  — 링크를 열면 아무것도 지우지 않고 /email?a=not-me&t=… 확인 화면으로 보낸다(메일 보안 프로그램이 링크를 미리 열어도 계정이 지워지지 않게).
//   POST — 확인 단추. 아직 이메일을 확인하지 않았고 결제 기록이 없는 그 계정만 지운다(removeUnverifiedByToken). 확인된 계정은 건드리지 않는다.
import { removeUnverifiedByToken } from "@launch-factory/auth"
import { database } from "@/lib/launch/db"
import { linkSecret } from "@/lib/launch/link-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store" } })

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t")
  return redirect(t ? `/email?a=not-me&t=${encodeURIComponent(t)}` : "/email?r=invalid")
}

export async function POST(request: Request) {
  const fromQuery = new URL(request.url).searchParams.get("t")
  const form = fromQuery ? null : await request.formData().catch(() => null)
  const t = fromQuery ?? (typeof form?.get("t") === "string" ? (form?.get("t") as string) : null)
  const result = await removeUnverifiedByToken(await database(), t, { secret: linkSecret() })
  return redirect(`/email?r=${!result.ok ? "invalid" : result.removed ? "removed" : result.reason === "gone" ? "removed" : "left"}`)
}
