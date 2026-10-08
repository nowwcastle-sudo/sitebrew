// 분석(PostHog)과 오류 수집(Sentry)이 켜져 있는가를 한 곳에서 정한다(LFOBS · 운영자 결정 2026-10-05).
// 원칙은 INQUIRY_OWNER_EMAIL 과 같다(docs/qa/lfenv.md): 선택 이름이 없으면 **그 기능만 꺼지고 사이트는 켜진다**. 값이 있는데 틀리면 켜질 때 멈춘다(lib/live-env.ts).
//   POSTHOG_HOST·POSTHOG_PROJECT_KEY  **둘 중 하나라도 없으면** 분석이 꺼진다 — 분석 스크립트·동의 띠·쿠키 설정 링크·서버 계측 모두(LFOBS2: 프로젝트 키도 호스트처럼 선택). mock 은 목 계측이라 늘 켜져 있다.
//   SENTRY_DSN    없으면 오류 수집이 꺼진다. mock 은 DSN 이 있어도 보내지 않는다(개발 기계가 운영 프로젝트로 오류를 보내지 않게 한다).
// 이 파일은 브라우저에도 간다 — 서버 전용 모듈(env()·DB)을 가져오지 않고 process.env 를 직접 읽는 값은 기본 인자로만 둔다.
import { sentryIngestOrigin, sentryOptions } from "@launch-factory/security/sentry"

type Source = Record<string, string | undefined>

/** 분석이 켜져 있는가. mock 은 늘 켜짐(목 계측), live 는 POSTHOG_HOST 와 POSTHOG_PROJECT_KEY 가 **둘 다** 있을 때만. 값이 브라우저에서도 쓰이므로 필수 인자다 */
export function analyticsEnabled(mode: string | undefined, host: string | undefined, projectKey: string | undefined): boolean {
  return mode === "mock" || (mode === "live" && Boolean(host) && Boolean(projectKey))
}

/** 분석이 꺼져 있는가(live 인데 POSTHOG_HOST 나 POSTHOG_PROJECT_KEY 가 없음) — proxy 가 PostHog 출처를 CSP 에서 빼는 판정. 모드를 모르면(LF_MODE 없음) 끈 것으로 보지 않는다: 열어 두는 쪽이 예전 동작이다 */
export function analyticsOff(source: Source = process.env): boolean {
  return source.LF_MODE === "live" && !(source.POSTHOG_HOST && source.POSTHOG_PROJECT_KEY)
}

/** 서버가 읽는 Sentry DSN. live 에서 값이 있을 때만 — 없거나 mock 이면 undefined(오류 수집 꺼짐) */
export function sentryDsn(source: Source = process.env): string | undefined {
  return source.LF_MODE === "live" ? source.SENTRY_DSN || undefined : undefined
}

/** proxy 가 CSP connect-src 에 더할 Sentry 수집 출처(브라우저 SDK 가 오류를 보내는 곳 한 곳). DSN 이 없으면 아무것도 열지 않는다 */
export function sentryCsp(dsn: string | undefined): { connectSrc?: readonly string[] } {
  const origin = sentryIngestOrigin(dsn)
  return origin ? { connectSrc: [origin] } : {}
}

/**
 * Sentry.init 옵션. DSN 이 없으면 undefined(오류 수집 꺼짐 — init 을 부르지 않는다).
 * 개인정보: packages/security 의 sentryOptions 가 sendDefaultPii false · beforeSend(이메일·전화·토큰 가림, 사용자는 내부 id 만, 쿠키·비밀 머리 삭제) · beforeBreadcrumb 를 준다.
 * 더한 것: 추적(tracesSampleRate)은 두지 않는다(꺼짐), 세션 녹화(replay)는 이 템플릿이 연결하지 않는다 — 개인정보처리방침이 녹화를 알리지 않는다.
 */
export function sentryInitOptions(dsn: string | undefined, source: Source = process.env) {
  if (!dsn) return undefined
  return sentryOptions({ dsn, environment: source.VERCEL_ENV || source.NODE_ENV, release: source.VERCEL_GIT_COMMIT_SHA || undefined })
}

/** 옵션이 있을 때만 init 을 부른다. 불렀으면 true. 서버·엣지·브라우저 설정 파일이 같은 한 줄을 쓴다 */
export function startSentry(init: (options: NonNullable<ReturnType<typeof sentryInitOptions>> & Record<string, unknown>) => unknown, options: ReturnType<typeof sentryInitOptions>, extra: Record<string, unknown> = {}): boolean {
  if (!options) return false
  init({ ...options, ...extra })
  return true
}
