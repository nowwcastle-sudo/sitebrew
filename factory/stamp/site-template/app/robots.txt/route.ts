import { seoFiles } from "@/components/ax/seo-files"
import { seoInput } from "@/lib/site"

// robots.txt — 검색 봇·AI 검색 봇 허용(seo-files 기본), 끝에 Sitemap. 사이트 주소·이름은 content/site.json 에서 온다(J9).
export const dynamic = "force-static"

export function GET() {
  return new Response(seoFiles(seoInput()).robots, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
