// Next 16 의 proxy(옛 middleware) — 요청마다 CSP nonce 를 만들고 보안 헤더를 붙인다(v0 Task 10, 대장 D14).
// 지시어는 @launch-factory/security 의 securityHeaders 가 정한다: script-src 'self' 'nonce-…' 'strict-dynamic', style-src 'self' 'nonce-…'.
// nonce 는 요청 머리 x-nonce 로 레이아웃에 전해진다(app/layout.tsx 가 <MotionBoot nonce> 에 넘긴다). 동적 렌더링에서만 nonce 가 붙는다(D15).
// Next 16 공식 가이드 「Content Security Policy」: nonce 를 쓰려면 proxy 에서 요청 머리 Content-Security-Policy 에도 싣는다 — Next 가 그 머리에서 nonce 를 읽어 자기 스크립트에 붙인다.
import { NextResponse, type NextRequest } from "next/server"
import { POSTHOG_CSP } from "@launch-factory/analytics-posthog"
import { createNonce, securityHeaders } from "@launch-factory/security"
import { analyticsOff, sentryCsp, sentryDsn } from "./lib/observability.ts"
import { mergeCsp, paddleCsp, turnstileCsp } from "./lib/product-csp.ts"
import { isNoIndexPath } from "./lib/seo.ts"
import { checkoutClientToken, turnstileSiteKey } from "./lib/site-keys.ts"

// 서버가 그리는 인라인 style 속성은 nonce 로 열 수 없다(nonce 는 <style> 요소용) — 값이 정해진 것은 해시로 연다(대장 D14: 해시 방식 먼저).
// 'unsafe-hashes' 는 이 해시와 같은 속성에만 작용한다. 목록은 SSR HTML 의 style 속성을 모아 낸 것이고(verify.heavy.mjs 가 모든 쪽에서 다시 검사한다),
// 블록을 갱신해 새 속성이 생기면 그 시험이 실패한다. sign-in 의 「로그인 유지」 체크(base-ui)가 그리는 시각적 숨김 입력의 style 이다.
const STYLE_ATTR_HASHES = ["sha256-qEKUM5Nf3NMojcHSmLZ+c8ntxh6x/5XWh7iOAHlGAkI="]

export function proxy(request: NextRequest) {
  const nonce = createNonce()
  const headers = securityHeaders(nonce, { dev: process.env.NODE_ENV === "development", extend: mergeCsp(analyticsOff() ? {} : POSTHOG_CSP,sentryCsp(sentryDsn()), turnstileCsp(turnstileSiteKey()), paddleCsp(checkoutClientToken()), { styleSrc: ["'unsafe-hashes'", ...STYLE_ATTR_HASHES.map((h) => `'${h}'`)] }) })
  const forward = new Headers(request.headers)
  forward.set("x-nonce", nonce)
  forward.set("content-security-policy", headers.get("content-security-policy") ?? "")
  const response = NextResponse.next({ request: { headers: forward } })
  headers.forEach((value, key) => response.headers.set(key, value))
  // 로그인한 사람의 쪽·결제·인증 쪽·API 는 색인하지 않는다(L02 — 목록은 lib/seo.ts. robots.txt 로 막지 않고 이 머리로 알린다)
  if (isNoIndexPath(request.nextUrl.pathname)) response.headers.set("x-robots-tag", "noindex")
  return response
}

export const config = {
  // 정적 파일·이미지 최적화·prefetch 는 제외한다(Next 공식 가이드의 matcher 예시)
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }],
}
