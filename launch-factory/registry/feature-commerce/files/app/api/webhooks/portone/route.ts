// launch-factory: PortOne V2 웹훅. 서명 검증(Standard Webhooks, 원문 본문) → webhook-id 중복 제거 → 공급자 재조회로 결제 확정(리디렉션 반환과 같은 함수)을 패키지가 한다.
//   400  서명·헤더·본문이 틀렸다(주문은 변하지 않는다)
//   200  처리했거나 중복이거나 쓰지 않는 이벤트
//   503  공급자가 아직 결제 완료로 보지 않는다(PortOne 이 다시 보낸다)
//   404  이 사이트가 웹훅을 받지 않는다 — 상점이 꺼졌거나(PortOne 값 없음) mock 이다. 아무것도 읽지도 쓰지도 않는다
// 상점의 주문이 아닌 결제 번호는 payment-claim.ts 가 물어본다(기본 「내 것 아님」 — 예약금 항목이 붙으면 그 결제를 확정한다).
// 본문 원문이 필요하므로 request.text() 로 한 번만 읽는다. PortOne 콘솔 웹훅 주소: https://<도메인>/api/webhooks/portone
import { handleWebhook } from "@launch-factory/commerce"
import { commerceDeps, webhookSecret } from "@/lib/launch/commerce"
import { claimOtherPayment } from "@/lib/launch/payment-claim"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = webhookSecret()
  if (!secret) return Response.json({ error: "not_found" }, { status: 404 })
  const reply = await handleWebhook(await commerceDeps(), { secret, rawBody: await request.text(), headers: request.headers, unclaimed: claimOtherPayment })
  return Response.json(reply.body, { status: reply.status })
}
