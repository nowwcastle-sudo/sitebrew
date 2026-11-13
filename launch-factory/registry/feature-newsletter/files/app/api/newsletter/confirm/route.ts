// launch-factory: 구독 확인 링크(메일의 「구독 확인」 단추). 주소의 `?t=` 는 서명 토큰(7일)이다.
//   GET  — 아무것도 바꾸지 않고 /email?list=newsletter&a=newsletter&t=… (「구독 확인」 단추 쪽)으로 303. 메일 보안 프로그램이 링크를 미리 열어도 구독이 확정되지 않는다.
//   POST — 확인 단추. 사람이 누를 때만 구독이 확정된다(같은 토큰, 기한 7일). 폼 POST 는 /email?list=newsletter&r=confirmed|already|invalid|withdrawn 으로 303, 그 밖의 POST 는 JSON.
//          두 번 눌러도 해가 없다(already). 다른 사이트에서 온 브라우저 POST 는 403.
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
