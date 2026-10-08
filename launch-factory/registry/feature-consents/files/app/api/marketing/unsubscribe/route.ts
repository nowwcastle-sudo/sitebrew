// launch-factory: 광고 메일의 로그인 없는 수신거부(G03 — 정보통신망법 제50조·시행령 별표 6 공통 2: 수신거부는 전송에 쓴 연락처 외 정보를 요구하지 않는다 = 로그인 요구 금지).
// 주소의 `?t=` 는 서명 토큰(@launch-factory/consent 의 unsubscribeToken)이다. 이 주소가 메일 본문의 수신거부 링크이자 헤더 List-Unsubscribe 의 주소다(RFC 8058).
//   GET  — 본문 링크를 열면 그 자리에서 바로 철회하고 /email?r=… 결과 화면으로 보낸다. 메일 보안 프로그램이 미리 열어도 같은 결과다(이미 철회돼 있으면 아무것도 쓰지 않는다).
//   POST — Gmail·Yahoo 의 「한 번에 수신거부」(List-Unsubscribe-Post: List-Unsubscribe=One-Click). 쿠키·로그인 없이 같은 처리, 200/400 JSON.
// 철회가 실제로 일어났으면 처리 결과 통지 메일(정보통신망법 제50조제7항)을 응답 뒤에 보낸다(A06 과 같은 메일).
import { after } from "next/server"
import { withdrawByToken } from "@launch-factory/consent"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { sendResultNotice } from "@/lib/launch/consents"
import { database } from "@/lib/launch/db"
import { linkSecret } from "@/lib/launch/link-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function withdraw(token: string | null) {
  const result = await withdrawByToken(await database(), token, { secret: linkSecret() })
  if (result.ok && result.changed) {
    after(() => sendResultNotice({ userId: result.userId, changes: [{ channel: result.channel, granted: false }], at: result.at, locale: DEFAULT_LOCALE }, "unsubscribe_link").catch((e) => console.error("[unsubscribe] result notice failed", e)))
  }
  return result
}

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store" } })

export async function GET(request: Request) {
  const result = await withdraw(new URL(request.url).searchParams.get("t"))
  return redirect(`/email?r=${result.ok ? "unsubscribed" : "invalid"}`)
}

export async function POST(request: Request) {
  const result = await withdraw(new URL(request.url).searchParams.get("t"))
  return Response.json({ ok: result.ok }, { status: result.ok ? 200 : 400, headers: { "cache-control": "no-store" } })
}
