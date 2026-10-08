// 서버(Node) 오류 수집 — Sentry 공식 Next.js 안내의 sentry.server.config.ts(instrumentation.ts 의 register 가 부른다). LFOBS.
// DSN(SENTRY_DSN)이 없거나 mock 이면 init 을 부르지 않는다 — 오류 수집만 꺼지고 사이트는 켜진다. 개인정보 가림·sendDefaultPii false 는 lib/observability.ts 의 sentryInitOptions 가 준다.
import * as Sentry from "@sentry/nextjs"
import { sentryDsn, sentryInitOptions, startSentry } from "./lib/observability"

startSentry(Sentry.init, sentryInitOptions(sentryDsn()))
