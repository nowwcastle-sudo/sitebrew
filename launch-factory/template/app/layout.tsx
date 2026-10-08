import "./globals.css"
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { MotionBoot } from "@/components/motion/motion-boot"
import { ConsentBanner } from "@/components/product/product-blocks"
import { ProductAnalytics } from "@/components/product/analytics"
import { PRODUCT_NAME } from "@/content/copy.en"
import { metaCopy } from "@/content/copy.ux.en"
import { appUrl } from "@/lib/launch/config"
import { env } from "@/lib/launch/env"
import { analyticsEnabled, sentryDsn } from "@/lib/observability"
import { currentMockScene } from "@/lib/ports"

// 제품 앱 머리 기본값(L01): 제목 템플릿 「쪽 · 제품」, 메타 설명, 공유 미리보기(OG·Twitter), 쪽마다의 canonical. 값은 모두 제품 설정(PRODUCT_NAME·metaCopy·NEXT_PUBLIC_APP_URL)에서 온다 —
// 공장 코드에 실제 이름·주소를 넣지 않는다. 로그인한 사람의 쪽·결제·인증 쪽은 색인하지 않는다(proxy.ts 의 X-Robots-Tag — lib/seo.ts 가 목록). favicon·manifest·robots·sitemap 은 같은 폴더의 파일 규약이다.
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(appUrl()),
    title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
    description: metaCopy.description,
    applicationName: PRODUCT_NAME,
    alternates: { canonical: "./" },
    openGraph: { type: "website", siteName: metaCopy.siteName, title: PRODUCT_NAME, description: metaCopy.description, locale: "en_US" },
    twitter: { card: "summary", title: PRODUCT_NAME, description: metaCopy.description },
  }
}

export const viewport: Viewport = { themeColor: metaCopy.themeColor }

// 뿌리 레이아웃(v0 Task 10). proxy.ts 가 요청마다 만든 nonce 를 x-nonce 머리로 받아 <MotionBoot nonce> 에 넘긴다(엄격 CSP —
// nonce 가 없으면 인라인 스크립트·스타일이 막혀 등장 가림이 꺼질 뿐 내용이 숨지는 않는다). headers() 를 읽으므로 모든 쪽이 동적 렌더링이다
// (Next 공식 「Content Security Policy」: nonce 는 동적 렌더링에서만 붙는다 — 정적 판매 쪽의 CSP 는 대장 D15).
// env() 는 LF_MODE 가 없으면 이름을 대며 던진다 — 조용히 mock 으로 가지 않는다.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const e = env()
  // mock 전용(LFRUNNER · web-factory G1 계약): 장면 쿠키가 있으면 정규화한 장면을 표지로 단다 — 관문이 「장면이 안 걸렸는데 통과」를 잡는다. live 는 null 이라 표지가 없다
  const scene = e.LF_MODE === "mock" ? await currentMockScene() : null
  // 분석·오류 수집은 선택이다(LFOBS · 운영자 결정 2026-10-05): POSTHOG_HOST·POSTHOG_PROJECT_KEY·SENTRY_DSN 이 없으면 그 기능만 꺼지고 사이트는 켜진다. 켜짐 여부는 <html> 표지로 알린다 — 배포 확인(scripts/deploy-preview/ci.mjs)이 읽어 경고한다
  const host = process.env.POSTHOG_HOST || undefined
  const projectKey = process.env.POSTHOG_PROJECT_KEY || undefined // 호스트처럼 선택(LFOBS2) — 둘 중 하나라도 없으면 분석이 꺼진다
  const analyticsOn = analyticsEnabled(e.LF_MODE, host, projectKey)
  const errorsOn = Boolean(sentryDsn())
  return (
    <html lang="en" suppressHydrationWarning data-wf-session={scene?.canonical} data-analytics={analyticsOn ? "enabled" : "disabled"} data-error-reporting={errorsOn ? "enabled" : "disabled"}>
      <head>
        <MotionBoot nonce={nonce} />
      </head>
      <body>
        <ProductAnalytics mode={e.LF_MODE} projectKey={projectKey} host={host}>
          {children}
          <ConsentBanner />
        </ProductAnalytics>
      </body>
    </html>
  )
}
