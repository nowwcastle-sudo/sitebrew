// launch-factory: Paddle 웹훅. 서명 검증 → 이벤트 id 중복 제거 → 공급자 재조회 → 순서 시각이 새로울 때만 반영(패키지가 한다).
// 서명이 틀리면 401 이고 DB 는 변하지 않는다. 본문 원문이 필요하므로 여기서 body 를 읽지 않는다.
// Paddle 알림 설정의 주소: https://<도메인>/api/webhooks/paddle (운영자 할 일 O3)
import { billing } from "@/lib/launch/billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return (await billing()).handleWebhook(request)
}
