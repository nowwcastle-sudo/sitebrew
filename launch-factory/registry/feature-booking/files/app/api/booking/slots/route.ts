// launch-factory: 예약 가능 시간 조회(GET ?service=&from=YYYY-MM-DD&days=). 공개 조회라 로그인이 필요 없다.
import { toResponse } from "@launch-factory/booking"
import { booking } from "@/lib/launch/booking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const days = q.get("days")
  return toResponse(await (await booking()).slots({ service: q.get("service") ?? "", from: q.get("from") ?? "", ...(days ? { days: Number(days) } : {}) }))
}
