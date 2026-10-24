// launch-factory: 예약 접수 경로(POST, FormData 또는 JSON). 429 + Retry-After · 봇 400 · 칸 오류 400 · 마감 409 · 확인 불가 503 · 처리 중 409.
// 폼에 숨은 입력 둘을 더한다: Turnstile 토큰 `cf-turnstile-response`, 폼을 열 때 만든 `idempotencyKey`.
import { currentUserId } from "@/lib/launch/booking-session"
import { booking } from "@/lib/launch/booking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return (await booking()).handler(request, { userId: await currentUserId() })
}
