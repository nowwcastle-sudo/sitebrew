// 엣지 런타임 오류 수집 — Sentry 공식 Next.js 안내의 sentry.edge.config.ts. 이 템플릿은 엣지 경로가 없지만(proxy 는 Node) 제품이 더하면 같은 설정으로 켜진다. LFOBS.
import * as Sentry from "@sentry/nextjs"
import { sentryDsn, sentryInitOptions, startSentry } from "./lib/observability"

startSentry(Sentry.init, sentryInitOptions(sentryDsn()))
