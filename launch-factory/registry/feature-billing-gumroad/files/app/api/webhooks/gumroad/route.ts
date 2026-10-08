// launch-factory: Gumroad 판매 알림(ping). Gumroad 는 서명을 주지 않는다 — 주소의 공유 비밀(?key=)을 확인하고, 본문을 믿지 않고 API 로 다시 읽어 반영한다.
// 알림 주소(Gumroad 설정 → Advanced → Ping): https://<도메인>/api/webhooks/gumroad?key=<GUMROAD_PING_SECRET>
// 적어도 한 번 전달되고 순서 보장이 없다 — 중복·순서는 패키지가 처리하고, 놓친 것은 Cron 이 다시 맞춘다.
import { gumroad } from "@/lib/launch/gumroad"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return (await gumroad()).handlePing(request)
}
