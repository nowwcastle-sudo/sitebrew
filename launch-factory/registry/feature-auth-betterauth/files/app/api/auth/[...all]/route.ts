// launch-factory: Better Auth 요청 처리기. 요청 제한(rate_limit)·봇 방어(botCheck)는 이 처리기(auth.handler)에서만 걸린다 —
// 그래서 인증 경로는 모두 여기로 들어온다. 429 응답에는 기계가 읽는 code·retryAfter 를 더한다(LFAX H07 — Better Auth 는 글만 준다).
import { withMachineCodes } from "@launch-factory/auth"
import { getAuth } from "@/lib/launch/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withMachineCodes(await (await getAuth()).handler(request))
}

export async function POST(request: Request) {
  return withMachineCodes(await (await getAuth()).handler(request))
}
