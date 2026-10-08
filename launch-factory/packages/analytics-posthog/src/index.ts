// @launch-factory/analytics-posthog — PostHog AnalyticsPort 어댑터(v0 Task 8).
// 서버 어댑터는 "./server"(posthog-node), React 훅 useExperiment 는 "./experiments"(react) 하위 경로로만 부른다.
export { createPostHogAnalytics, posthogInitConfig, armFromFlag, CONTROL_ARM, MASKED_URL_PARAMS } from "./client.ts"
export type { PostHogAnalytics, PostHogClientOptions, PostHogBrowserLike } from "./client.ts"
export { ATTRIBUTION_PROPERTY, attributionProperties, splitProperties, buildProperties, personalDataPaths, valueLooksPersonal } from "./props.ts"
export type { RejectedEvent } from "./props.ts"
export { referrerKind, utmSourceOf, hostKind, AI_DOMAINS, SEARCH_DOMAINS, SEARCH_PATTERNS, SOCIAL_DOMAINS, REFERRER_TABLE_DATE } from "./referrer.ts"
export type { ReferrerKind, ReferrerInput } from "./referrer.ts"
export { POSTHOG_REGIONS, POSTHOG_CSP, POSTHOG_PROCESSOR, resolvePostHog } from "./region.ts"
export type { PostHogRegion, PostHogRegionInfo } from "./region.ts"
