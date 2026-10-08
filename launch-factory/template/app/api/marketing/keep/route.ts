// launch-factory: 2년 재확인 메일의 「계속 받기」(A16). 주소의 `?t=` 는 기한이 있는 서명 토큰(keepToken)이다.
//   GET  — 링크를 열면 아무것도 바꾸지 않고 /email?a=keep&t=… 확인 화면으로 보낸다. 메일 보안 프로그램이 링크를 미리 열어도 동의가 갱신되지 않게 — 갱신은 사람이 확인 단추(POST)를 눌러야 한다.
//   POST — 확인 단추. 지금 동의 상태인 사람의 동의 시각을 지금으로 갱신하고(새 2년) /email?r=… 결과로 보낸다. 이미 철회한 사람은 되살리지 않는다.
import { keepByToken } from "@launch-factory/consent"
import { database } from "@/lib/launch/db"
import { linkSecret } from "@/lib/launch/link-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store" } })

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t")
  return redirect(t ? `/email?a=keep&t=${encodeURIComponent(t)}` : "/email?r=invalid")
}

export async function POST(request: Request) {
  const fromQuery = new URL(request.url).searchParams.get("t")
  const form = fromQuery ? null : await request.formData().catch(() => null)
  const t = fromQuery ?? (typeof form?.get("t") === "string" ? (form?.get("t") as string) : null)
  const result = await keepByToken(await database(), t, { secret: linkSecret() })
  return redirect(`/email?r=${result.ok ? "kept" : result.reason === "withdrawn" ? "withdrawn" : "invalid"}`)
}
