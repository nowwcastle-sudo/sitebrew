// launch-factory: 구독 확인 링크(메일의 「구독 확인」 단추). 주소의 `?t=` 는 서명 토큰(7일)이다.
//   GET  — 열면 구독이 확정되고 /email?list=newsletter&r=confirmed|invalid|withdrawn 으로 303. 두 번 열어도 안전하다.
//   POST — 같은 처리를 JSON 으로. 메일 보안 프로그램이 링크를 미리 여는 환경이면 /email 쪽이 단추를 보이고 이 경로로 POST 해 확정한다.
import { createNewsletterHandlers } from "@launch-factory/newsletter"
import { newsletter } from "@/lib/launch/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return createNewsletterHandlers(await newsletter()).confirm(request)
}

export async function POST(request: Request) {
  return createNewsletterHandlers(await newsletter()).confirm(request)
}
