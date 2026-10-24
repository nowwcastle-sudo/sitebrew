import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/launch/config"
import { sitemapPaths } from "@/lib/seo"

// sitemap.xml(L02): 공개 쪽만. 마지막 수정 시각은 알 수 없어 적지 않는다(꾸며 낸 값은 검색 엔진이 무시한다).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl().replace(/\/$/, "")
  return sitemapPaths().map((p) => ({ url: p === "/" ? `${base}/` : `${base}${p}` }))
}
