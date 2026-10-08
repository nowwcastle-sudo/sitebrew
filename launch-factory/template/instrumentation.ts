// 서버가 켜질 때 한 번 부르는 자리(Next 공식 「instrumentation」 register). 환경이 틀리면 서버가 이름을 대며 멈춘다.
// live 인데 키가 없으면 빠진 이름을 모두 알린다(lib/live-env.ts). 조용히 mock 으로 가지 않는다.
// 오류 수집(LFOBS): Sentry 공식 Next.js 안내대로 register 가 런타임별 설정 파일을 부르고, onRequestError 가 서버가 던진 오류(서버 컴포넌트·액션·경로)를 Sentry 로 보낸다.
// SENTRY_DSN 이 없거나 mock 이면 설정 파일이 init 을 부르지 않아 둘 다 아무 일도 하지 않는다.
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { templateEnv } = await import("./lib/live-env")
    templateEnv() // 환경 검사가 먼저 — 틀리면 여기서 멈춘다
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config")
}

export const onRequestError = Sentry.captureRequestError
