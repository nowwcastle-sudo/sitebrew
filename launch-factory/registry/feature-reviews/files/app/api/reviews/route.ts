// launch-factory: 후기·상품 문의 경로.
//   GET  /api/reviews?subjectType=&subjectId=&kind=review|question&sort=latest|rating-desc|rating-asc&rating=&page=&pageSize= — 공개 읽기(게시된 글만, 캐시 가능)
//   POST /api/reviews (FormData 또는 JSON) — 제출. 429 + Retry-After · 봇 400 · 칸 오류 400 · 로그인 필요 401 · 중복·처리 중 409 · 확인 불가 503.
//     폼에 숨은 입력 둘을 더한다: Turnstile 토큰 `cf-turnstile-response`, 폼을 열 때 만든 `idempotencyKey`.
import { reviews, submitContext } from "@/lib/launch/reviews"

export const runtime = "nodejs"

export async function GET(request: Request) {
  return (await reviews()).listHandler(request)
}

export async function POST(request: Request) {
  return (await reviews()).handler(request, await submitContext())
}
