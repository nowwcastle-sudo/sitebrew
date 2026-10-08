// 색인 정책 한 곳(L01·L02). 공개 쪽은 sitemap.ts 가 알리고, 로그인한 사람의 쪽·결제·인증·API 는 proxy.ts 가 X-Robots-Tag: noindex 를 붙인다.
// robots.txt 는 일부러 이 쪽들을 막지 않는다 — 크롤러가 막힌 쪽의 noindex 머리를 읽지 못해 주소만 검색에 남을 수 있어서다(Google 「robots.txt 와 noindex 를 같이 쓰지 말 것」).
// 새 쪽을 만들면 둘 중 한 곳에 넣는다(template.test 가 두 목록과 실제 경로를 맞춰 본다).

/** 색인해도 되는 공개 쪽 — sitemap.xml 에 실린다 */
export const PUBLIC_PATHS = ["/", "/pricing", "/contact", "/terms", "/privacy", "/refund"] as const

/** 색인하지 않는 쪽(경로 앞부분). 계정·결제·인증 쪽은 사람마다 내용이 다르거나 입력 전용이다 */
export const NOINDEX_PREFIXES = ["/account", "/upgrade", "/billing", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/api"] as const

/** 이 주소(경로만)를 색인하지 말라고 알려야 하는가 */
export function isNoIndexPath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
