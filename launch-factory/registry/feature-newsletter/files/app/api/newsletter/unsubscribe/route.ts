// launch-factory: 뉴스레터 수신거부(정보통신망법 시행령 별표 6 — 로그인 없이, 연락처 외 정보를 요구하지 않고, 링크 하나로). 주소의 `?t=` 는 서명 토큰이고 만료가 없다.
//   GET  — 본문 링크를 열면 그 자리에서 철회하고 /email?list=newsletter&r=unsubscribed 로 303. 두 번 열어도(미리 열기 포함) 같은 결과다.
//   POST — Gmail·Yahoo 의 「한 번에 수신거부」(RFC 8058, List-Unsubscribe-Post: List-Unsubscribe=One-Click). 쿠키·로그인 없이 같은 처리, 200/400 JSON.
// 이 주소가 보내는 메일마다 단 수신거부 링크이자 List-Unsubscribe 헤더의 주소다(service.listSubscribed 의 unsubscribeUrl).
import { createNewsletterHandlers } from "@launch-factory/newsletter"
import { newsletter } from "@/lib/launch/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return createNewsletterHandlers(await newsletter()).unsubscribe(request)
}

export async function POST(request: Request) {
  return createNewsletterHandlers(await newsletter()).unsubscribe(request)
}
