// 브라우저 오류 수집 — Sentry 공식 Next.js 안내의 instrumentation-client.ts(하이드레이션 전에 한 번 돈다). LFOBS · LFOBS2(늦게 받기).
// 이 파일은 첫 번째 JS 에 들어간다. Sentry SDK(약 83 KB gzip)를 정적으로 가져오지 않는다 — `load` 뒤 한가할 때 동적 import() 로 받아 init 한다(lib/sentry-lazy.ts 머리말, docs/qa/lfobs2.md).
// DSN 은 빌드 때 next.config.ts 가 SENTRY_DSN 에서 NEXT_PUBLIC_SENTRY_DSN 으로 넣는다(live 일 때만). 없으면 아무것도 받지 않는다: 오류 수집만 꺼지고 SDK 는 내려받지도 않는다.
// 개인정보: sendDefaultPii false · 이메일·토큰 가림(lib/observability.ts). 추적·세션 녹화(replay)는 연결하지 않는다 — 개인정보처리방침이 녹화를 알리지 않는다.
// 세션 건강(BrowserSession)·추적(BrowserTracing) 통합도 뺀다: 방문마다 세션 보고를 따로 보내는데 방침이 알리는 「오류 보고」가 아니다.
import { afterLoadWhenIdle, createLazyReporter, sentryHandle, setReporter } from "./lib/sentry-lazy"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined

if (dsn && typeof window !== "undefined") {
  setReporter(
    createLazyReporter({
      target: window,
      schedule: (run) => afterLoadWhenIdle(run),
      load: async () => {
        const [Sentry, { sentryInitOptions, startSentry }, { REPORT_PROBLEM_ENABLED }, { REPORT_PROBLEM_OPTIONS }] = await Promise.all([
          import("./lib/sentry-browser"),
          import("./lib/observability"),
          import("./lib/launch/feedback"),
          import("./lib/report-problem"),
        ])
        const nonce = (document.querySelector("script[nonce]") as HTMLScriptElement | null)?.nonce || undefined
        startSentry(Sentry.init, sentryInitOptions(dsn), {
          integrations: <I extends { name: string }>(defaults: I[]) => [
            // 실측(2026-10-05, 브라우저): 기본 통합에 BrowserSession·BrowserTracing 이 들어 있다 — 둘 다 뺀다(추적은 켜지 않으므로 추적 머리도 붙일 이유가 없다)
            ...defaults.filter((i) => i.name !== "BrowserSession" && i.name !== "BrowserTracing"),
            // 엄격 CSP: 피드백 창은 자기 <style> 을 넣는다 — nonce 를 같이 준다
            ...(REPORT_PROBLEM_ENABLED ? [Sentry.feedbackIntegration({ ...REPORT_PROBLEM_OPTIONS, styleNonce: nonce })] : []),
          ],
        })
        return Sentry
      },
    }),
  )
}

// Sentry 공식 안내의 onRouterTransitionStart — 아직 안 받아졌으면 아무 일도 하지 않는다(추적 통합을 뺐으므로 받아졌어도 기록할 구간이 없다)
export function onRouterTransitionStart(href: string, navigationType: string) {
  sentryHandle()?.captureRouterTransitionStart(href, navigationType)
}
