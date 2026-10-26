// launch-factory: 올리기 티켓 경로(POST JSON { kind, contentType, size, fileName? }). 429 + Retry-After · 칸 오류 400 · 로그인 필요 401 · 꺼짐 503.
// 브라우저는 응답의 url 로 파일을 직접 PUT 하고 /api/storage/complete 를 부른다. 클라이언트 도우미는 @launch-factory/storage/client.
import { storageHandlers } from "@/lib/launch/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return (await storageHandlers()).ticket(request)
}
