// 색인 정책 한 곳(L01·L02). 공개 쪽은 sitemap.ts 가 알리고, 로그인한 사람의 쪽·결제·인증·API 는 proxy.ts 가 X-Robots-Tag: noindex 를 붙인다.
// robots.txt 는 일부러 이 쪽들을 막지 않는다 — 크롤러가 막힌 쪽의 noindex 머리를 읽지 못해 주소만 검색에 남을 수 있어서다(Google 「robots.txt 와 noindex 를 같이 쓰지 말 것」).
// 새 쪽을 만들면 둘 중 한 곳에 넣는다(template.test 가 두 목록과 실제 경로를 맞춰 본다).
import { hasUrl } from "./launch/enabled.ts"
import publicPaths from "./public-paths.json" with { type: "json" }

/** 색인해도 되는 공개 쪽 — sitemap.xml 에 실린다. 목록은 public-paths.json 에 있다(launch-factory 의 얹기 엔진 drop 이 같은 파일을 읽는다) */
export const PUBLIC_PATHS: readonly string[] = publicPaths

/** 사이트맵에 실을 쪽 — PUBLIC_PATHS 에서 시안을 얹을 때 지워진 쪽(enabled.json)을 뺀다. 템플릿 그대로면 PUBLIC_PATHS 전부다. 시안이 sitemap.xml 을 가져오면 얹기가 app/sitemap.ts 를 지우지만, 안 가져온 제품에서는 이 목록이 지운 쪽을 사이트맵에서 빼는 유일한 길이다 */
export const sitemapPaths = (): readonly string[] => PUBLIC_PATHS.filter(hasUrl)

/** 색인하지 않는 쪽(경로 앞부분). 계정·결제·상점(장바구니·주문)·관리 화면·인증 쪽은 사람마다 내용이 다르거나 입력 전용이다 */
export const NOINDEX_PREFIXES = ["/account", "/upgrade", "/billing", "/cart", "/checkout", "/orders", "/admin", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/api"] as const

/** 이 주소(경로만)를 색인하지 말라고 알려야 하는가 */
export function isNoIndexPath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
