// launch-factory: mock 전용 로컬 저장소(PUT·GET). **live 에서는 404** 다 — 서비스는 live 에서 이 경로로 가는 주소를 만들지 않는다.
import { storageLocal } from "@/lib/launch/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(request: Request): Promise<Response> {
  const local = await storageLocal()
  return local ? local.handle(request) : new Response(null, { status: 404 })
}

export const GET = handle
export const PUT = handle
