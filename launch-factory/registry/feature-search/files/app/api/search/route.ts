// launch-factory: 검색 경로. GET /api/search?q=…&kinds=a,b&locale=ko&page=1&pageSize=10
// 결과 { ok: true, data: { items: [{ kind, ref, title, url, snippet: { text, ranges: [[시작, 끝]] } }], total, page, pageCount } }.
// 하이라이트는 HTML 이 아니라 text 안의 범위 배열이다 — 화면이 범위만 <mark> 로 감싼다. 한도 초과는 429 + Retry-After.
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { search } from "@/lib/launch/search"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return (await search()).handler(request, { locale: DEFAULT_LOCALE })
}
