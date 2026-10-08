import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/launch/config"

// robots.txt(L02). 모두 허용하고 sitemap 만 알린다 — 로그인한 쪽의 색인 제외는 X-Robots-Tag(proxy.ts, lib/seo.ts)가 맡는다(막으면 그 머리를 못 읽는다).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${appUrl()}/sitemap.xml` }
}
