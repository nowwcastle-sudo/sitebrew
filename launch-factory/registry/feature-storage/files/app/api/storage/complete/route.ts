// launch-factory: 올리기 끝내기 경로(POST JSON { id }). 저장소에 실제 크기·형식을 물어 정책에 맞으면 ready, 속였으면 객체를 지우고 422.
import { storageHandlers } from "@/lib/launch/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return (await storageHandlers()).complete(request)
}
