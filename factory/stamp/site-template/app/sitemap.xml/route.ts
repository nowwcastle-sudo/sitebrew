import { seoFiles } from "@/components/ax/seo-files"
import { seoInput } from "@/lib/site"

// sitemap.xml — 색인 제외(noindex) 쪽을 뺀 모든 쪽. 주소는 site.url 기준 절대 주소다(seo-files 가 같은 사이트만 받는다).
export const dynamic = "force-static"

export function GET() {
  return new Response(seoFiles(seoInput()).sitemap(), { headers: { "content-type": "application/xml; charset=utf-8" } })
}
