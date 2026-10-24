"use client"
// 계측 뿌리(v0 Task 10). 서버 레이아웃이 모드와 공개 키를 props 로 넘긴다 — 블록은 어느 쪽인지 모른다.
//   mock → web-factory 목 계측(브라우저 메모리, 동의가 false 면 아무것도 남기지 않는다)
//   live → 기능 번들의 AnalyticsProvider(PostHog — 동의 전에는 posthog-js 를 불러오지도 않는다)
//   live 인데 분석 호스트(POSTHOG_HOST)나 프로젝트 키(POSTHOG_PROJECT_KEY)가 없으면 → 분석이 꺼진 것이다(LFOBS·LFOBS2): 분석 스크립트를 불러오지 않고, 아무것도 보내지 않고, 동의 띠(ConsentBanner)도 그리지 않는다 — 켜지지 않은 분석을 동의로 약속하지 않는다.
// 블록에 넘기는 것은 useProductAnalytics() 의 포트를 withAttribution 으로 감싼 track 이다(J2 — 태그는 조립하는 쪽이 붙인다).
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { analyticsEnabled } from "@/lib/observability"
import { AnalyticsProvider, useAnalytics } from "@/components/launch/analytics-provider"
import { mockAnalytics } from "@/components/contract/adapter-mock"
import { withAttribution } from "@/components/contract/attribution"
import type { Attribution, AnalyticsPort, ConsentState } from "@/components/contract/ports"

const PortContext = createContext<AnalyticsPort | null>(null)
const EnabledContext = createContext(true)
const CONSENT_KEY = "lf_consent"

function readConsent(): ConsentState | undefined {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    return raw ? (JSON.parse(raw) as ConsentState) : undefined
  } catch {
    return undefined
  }
}
function writeConsent(consent: ConsentState) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)는 그 방문 동안만 기억한다
  }
}

function MockBridge({ children }: { children: ReactNode }) {
  const port = useMemo(() => mockAnalytics(""), [])
  return <PortContext.Provider value={port}>{children}</PortContext.Provider>
}

/** 분석이 꺼진 제품의 포트 — 같은 모양이지만 아무것도 보내지도 쌓지도 않고, 동의는 늘 「결정 전」이다 */
const OFF_PORT: AnalyticsPort = {
  track() {},
  consent: () => ({ analytics: false, marketing: false }),
  setConsent() {},
}
function OffBridge({ children }: { children: ReactNode }) {
  return <PortContext.Provider value={OFF_PORT}>{children}</PortContext.Provider>
}

function LiveBridge({ children }: { children: ReactNode }) {
  const port = useAnalytics()
  return <PortContext.Provider value={port}>{children}</PortContext.Provider>
}

export interface ProductAnalyticsProps {
  mode: "mock" | "live"
  /** POSTHOG_PROJECT_KEY — 공개 프로젝트 키(phc_…). live 에서만 쓴다. 없으면(호스트처럼) 분석이 꺼진다 */
  projectKey?: string
  host?: string
  children: ReactNode
}

/**
 * 분석을 고르지 않은 제품(enabled.json 에 analytics-posthog 없음)의 뿌리 — 계측 공급자(ProductAnalytics)를 올리지 않고 꺼진 포트만 준다.
 * 블록의 계측 훅(useBlockTrack)은 뿌리가 없으면 던지므로 뿌리 자리는 남기되 아무것도 보내지 않는다
 */
export function AnalyticsOff({ children }: { children: ReactNode }) {
  return (
    <EnabledContext.Provider value={false}>
      <OffBridge>{children}</OffBridge>
    </EnabledContext.Provider>
  )
}

export function ProductAnalytics({ mode, projectKey, host, children }: ProductAnalyticsProps) {
  const enabled = analyticsEnabled(mode, host, projectKey)
  if (!enabled) {
    return (
      <EnabledContext.Provider value={false}>
        <OffBridge>{children}</OffBridge>
      </EnabledContext.Provider>
    )
  }
  if (mode === "mock") return <MockBridge>{children}</MockBridge>
  if (!projectKey) throw new Error("POSTHOG_PROJECT_KEY is required in live mode")
  return (
    <AnalyticsProvider projectKey={projectKey} host={host} consent={typeof window === "undefined" ? undefined : readConsent()} onConsentChange={writeConsent}>
      <LiveBridge>{children}</LiveBridge>
    </AnalyticsProvider>
  )
}

/** 분석이 켜져 있는가 — 꺼져 있으면 동의 띠를 그리지 않는다(약속할 분석이 없다) */
export function useAnalyticsEnabled(): boolean {
  return useContext(EnabledContext)
}

/** 동의 상태(consent·setConsent)를 다루는 블록에 넘기는 포트 */
export function useProductAnalytics(): AnalyticsPort {
  const port = useContext(PortContext)
  if (!port) throw new Error("useProductAnalytics must be used inside <ProductAnalytics>")
  return port
}

/** 블록에 넘기는 track — 출처 태그(블록·레시피·문구 판)를 붙인다. 블록마다 한 번 감싼다 */
export function useBlockTrack(attribution: Attribution): AnalyticsPort["track"] {
  const port = useProductAnalytics()
  // attribution 객체는 렌더마다 새로 생기므로 문자열 key 로 비교한다(렌더마다 다시 감싸지 않는다)
  const key = JSON.stringify(attribution)
  return useMemo(() => withAttribution(port, JSON.parse(key) as Attribution).track, [port, key])
}
