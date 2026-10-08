import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import { withSentryConfig } from "@sentry/nextjs/config"
import type { NextConfig } from "next"

// 이 저장소(워크스페이스) 안에서는 패키지가 위 폴더에 있어 Turbopack 뿌리를 저장소 뿌리로 잡는다. 제품으로 복제한 뒤에는 이 폴더가 뿌리다.
// 아래 두 목록은 기능 레지스트리 항목이 알리는 공통 설정(meta.launch.setup — D183·D184)과 같다: 패키지는 TypeScript 원본을 내보내므로
// transpilePackages, mock 모드 메모리 DB(PGlite, WASM)는 번들하지 않으므로 serverExternalPackages.
// Next 16.3.7 문서 「transpilePackages」: 워크스페이스 안 패키지는 Turbopack 이 스스로 컴파일하고, `node_modules` 에서 오는 패키지가 TypeScript 원본을 내보내면 이 목록이 필요하다
// (제품으로 복제해 게시본을 받을 때). 같은 패키지를 transpilePackages 와 serverExternalPackages 양쪽에 적으면 빌드가 시작에서 던진다.
// PGlite(WASM)를 serverExternalPackages 에 두어야 하는지는 문서에 없다 — registry-install 시험의 실측(D183)이다.
const here = dirname(fileURLToPath(import.meta.url))
const inWorkspace = existsSync(join(here, "..", "packages", "contract"))

const config: NextConfig = {
  // Next 16.3 은 개발 서버를 켜면 AGENTS.md·CLAUDE.md 를 스스로 만든다 — 템플릿에는 두지 않는다
  agentRules: false,
  turbopack: { root: inWorkspace ? join(here, "..") : here },
  transpilePackages: [
    "@launch-factory/account-lifecycle",
    "@launch-factory/analytics-posthog",
    "@launch-factory/auth",
    "@launch-factory/billing-paddle",
    "@launch-factory/consent",
    "@launch-factory/contract",
    "@launch-factory/db",
    "@launch-factory/email",
    "@launch-factory/env",
    "@launch-factory/i18n",
    "@launch-factory/security",
  ],
  serverExternalPackages: ["@electric-sql/pglite"],
}

// 개발 서버(next dev)만 LF_MODE 를 mock 으로 시작한다 — 키 없이 npm run dev 가 켜진다(v0 Task 10). 빌드·운영 서버는 LF_MODE 가 없으면 이름을 대며 멈춘다(조용히 mock 으로 가지 않는다).
export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) process.env.LF_MODE ||= "mock"
  // 오류 수집(Sentry, LFOBS) — 공식 안내(https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)의 withSentryConfig.
  //  · 브라우저 SDK 가 DSN 을 읽도록 빌드 때 SENTRY_DSN 을 NEXT_PUBLIC_SENTRY_DSN 에 넣는다 — live 빌드이고 값이 있을 때만(mock·값 없음은 빈 칸 = 브라우저 수집 꺼짐).
  //    그래서 SENTRY_DSN 은 **빌드와 실행 양쪽 환경**에 같은 값이 있어야 서버·브라우저가 함께 켜진다(Vercel 환경 변수는 둘 다에 준다).
  //  · 소스맵 업로드는 SENTRY_AUTH_TOKEN 이 있을 때만 켠다(없으면 끈다 — CI 에 새 비밀을 더하지 않는다). 올릴 때는 SENTRY_ORG·SENTRY_PROJECT 도 환경에서 읽는다(docs/qa/lfobs.md).
  //  · telemetry: false — 빌드가 Sentry 로 사용 통계를 보내지 않는다. tunnelRoute 는 쓰지 않는다: 수집 출처 한 곳을 CSP connect-src 로 연다(proxy.ts).
  const dsn = process.env.LF_MODE === "live" ? process.env.SENTRY_DSN || "" : ""
  return withSentryConfig(
    { ...config, env: { ...config.env, NEXT_PUBLIC_SENTRY_DSN: dsn } },
    {
      authToken: process.env.SENTRY_AUTH_TOKEN || undefined,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      telemetry: false,
      silent: !process.env.CI,
    },
  )
}
