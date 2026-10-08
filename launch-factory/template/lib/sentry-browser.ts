// 늦게 받는 브라우저 Sentry 의 입구(LFOBS2). instrumentation-client.ts 가 이 모듈을 동적 import() 한다 — @sentry/nextjs 자체를 동적 import() 하면 이름공간 전체가 한 덩어리로 실려
// 쓰지 않는 코드(세션 녹화·추적 등)가 걷어지지 않는다(실측: 늦게 받는 덩어리가 +80 KB gzip 커졌다, docs/qa/lfobs2.md §2). 쓰는 이름만 가져와 다시 내보내면 번들러가 나머지를 걷어 낸다.
// 이 파일은 첫 번째 JS 에 들어가면 안 된다 — 동적 import() 로만 가져온다(시험 lfobs.test.mjs 가 지킨다).
export { captureException, captureRouterTransitionStart, feedbackIntegration, getFeedback, init } from "@sentry/nextjs"
