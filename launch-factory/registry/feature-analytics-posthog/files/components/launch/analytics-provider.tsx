"use client"
// launch-factory: 브라우저 계측. 동의가 먼저다 — 동의 전(unset)·거부에서는 posthog-js 를 불러오지도 init 하지도 않고, 아무것도 보내지 않는다.
// projectKey 는 공개 프로젝트 키(phc_…)다. 서버 컴포넌트(레이아웃)가 POSTHOG_PROJECT_KEY·POSTHOG_HOST 를 읽어 props 로 넘긴다.
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { createPostHogAnalytics, type PostHogAnalytics, type PostHogClientOptions } from "@launch-factory/analytics-posthog"

const AnalyticsContext = createContext<PostHogAnalytics | null>(null)

export function AnalyticsProvider({ children, ...options }: PostHogClientOptions & { children: ReactNode }) {
  // 옵션은 첫 렌더 값으로 한 번만 만든다(동의 저장은 onConsentChange 로)
  const analytics = useMemo(() => createPostHogAnalytics(options), [])
  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>
}

/** 블록에 넘기는 AnalyticsPort. Provider 밖에서 부르면 던진다 */
export function useAnalytics(): PostHogAnalytics {
  const analytics = useContext(AnalyticsContext)
  if (!analytics) throw new Error("useAnalytics must be used inside <AnalyticsProvider>")
  return analytics
}
