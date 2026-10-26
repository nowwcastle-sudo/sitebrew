// launch-factory: 뉴스레터 구독 신청 경로(POST, FormData 또는 JSON). 429 + Retry-After · 봇 400 · 칸 오류 400 · 확인 불가 503 · 처리 중 409.
// 폼 칸: email · consent("yes" — 체크박스, 미리 체크하지 않는다) · source(선택, 폼 이름표). 숨은 입력 둘을 더한다: Turnstile 토큰 `cf-turnstile-response`, 폼을 열 때 만든 `idempotencyKey`.
import { createNewsletterHandlers } from "@launch-factory/newsletter"
import { newsletter } from "@/lib/launch/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return createNewsletterHandlers(await newsletter()).subscribe(request)
}
