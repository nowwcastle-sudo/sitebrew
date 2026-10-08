// 브라우저 AnalyticsPort 어댑터(posthog-js). 동의가 먼저다(계획 Review Focus 2):
//   - 동의 전(unset)·거부(analytics false): 아무것도 보내지 않고 쌓지도 않는다. posthog-js 를 불러오지도, init 하지도 않는다
//     (init 만으로도 기능 플래그 요청·저장소 쓰기가 날 수 있다).
//   - 동의(true)로 바뀌면: 그 뒤에 부른 track 만 보낸다. SDK 를 불러오는 동안 부른 track 은 불러온 뒤 순서대로 보낸다
//     — 동의 뒤의 이벤트라 「동의 전 이벤트를 쌓았다 보내기」가 아니다. 보내기 직전에 동의를 다시 보고, 그사이 철회했으면 버린다.
//   - 이중 잠금: init 은 opt_out_capturing_by_default: true 로 하고 동의일 때만 opt_in_capturing 한다. before_send 도 동의를 본다.
//   - 철회(false): opt_out_capturing. 그 뒤 track 은 버린다.
// 출처 태그 meta.attribution 은 wf_block·wf_recipe·wf_copy·wf_experiment 속성으로 싣는다(props.ts). 개인정보 모양 props 는 거부한다.
import type { AnalyticsPort, ConsentState, EventName, EventProps, TrackMeta } from "@launch-factory/contract"
import type { CaptureResult, PostHog, PostHogConfig } from "posthog-js"
import { buildProperties, type RejectedEvent } from "./props.ts"
import { referrerKind, utmSourceOf } from "./referrer.ts"
import { resolvePostHog, type PostHogRegion, type PostHogRegionInfo } from "./region.ts"

/** 어댑터가 부르는 posthog-js 메서드만. 테스트는 이 모양의 가짜를 넘긴다 */
export type PostHogBrowserLike = Pick<PostHog, "init" | "capture" | "opt_in_capturing" | "opt_out_capturing" | "getFeatureFlag" | "onFeatureFlags">

export const CONTROL_ARM = "control"

export interface PostHogClientOptions {
  /** POSTHOG_PROJECT_KEY(공개 프로젝트 키 phc_…, O5) */
  projectKey: string
  /** POSTHOG_HOST(O5). 없으면 region 의 수집 호스트 */
  host?: string
  region?: PostHogRegion
  /** 저장해 둔 동의 결정(동의 배너 쿠키 등). 없으면 결정 전(둘 다 false, decidedAt 없음) */
  consent?: ConsentState
  /** setConsent 마다 부른다 — 결정을 저장하는 곳 */
  onConsentChange?: (consent: ConsentState) => void
  /** 개인정보 모양이라 거부한 이벤트(값은 싣지 않는다). 기본은 조용히 버린다 */
  onReject?: (rejected: RejectedEvent) => void
  /** posthog-js 불러오기. 기본은 동적 import("posthog-js") — 동의 전에는 부르지 않는다 */
  load?: () => PostHogBrowserLike | Promise<PostHogBrowserLike>
  /** page_view 의 유입 분류에 쓰는 현재 주소·리퍼러. 기본은 location·document.referrer */
  location?: () => { href?: string; hostname?: string; referrer?: string }
  now?: () => Date
}

export interface PostHogAnalytics extends AnalyticsPort {
  readonly region: PostHogRegionInfo & { host: string }
  /** 불러오기와 그때까지 부른 track 이 끝날 때까지 기다린다 */
  flush(): Promise<void>
  /** 실험 갈래. 동의 전·플래그를 아직 못 받음·꺼짐이면 "control". 켜짐(true)은 "test", 다변량은 그 값 */
  experiment(key: string): string
  /** 플래그를 받거나 동의가 바뀌면 부른다. 해제 함수를 돌려준다 */
  onExperimentsChange(listener: () => void): () => void
}

/** URL 쿼리에서 PostHog 가 가릴 칸 이름(mask_personal_data_properties 에 더한다) */
export const MASKED_URL_PARAMS = ["email", "e-mail", "mail", "phone", "tel", "mobile", "name", "address", "token", "code", "key", "password", "secret"]

/** 동의 뒤 init 설정. 자동 수집(페이지뷰·클릭·녹화·설문·성능·예외)은 모두 끈다 — 보내는 것은 포트의 track 뿐이다 */
export function posthogInitConfig(host: string, isConsented: () => boolean): Partial<PostHogConfig> {
  return {
    api_host: host,
    opt_out_capturing_by_default: true,
    before_send: (cr: CaptureResult | null) => (isConsented() ? cr : null),
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    person_profiles: "identified_only",
    mask_personal_data_properties: true,
    custom_personal_data_properties: MASKED_URL_PARAMS,
  }
}

export function armFromFlag(value: boolean | string | undefined): string {
  if (typeof value === "string" && value) return value
  return value === true ? "test" : CONTROL_ARM
}

const unset = (): ConsentState => ({ analytics: false, marketing: false })

function browserLocation(): { href?: string; hostname?: string; referrer?: string } {
  if (typeof document === "undefined" || typeof location === "undefined") return {}
  return { href: location.href, hostname: location.hostname, referrer: document.referrer }
}

export function createPostHogAnalytics(options: PostHogClientOptions): PostHogAnalytics {
  if (!options.projectKey?.trim()) throw new Error("POSTHOG_PROJECT_KEY is empty (owner action O5)")
  const region = resolvePostHog({ host: options.host, region: options.region })
  const now = options.now ?? (() => new Date())
  // 이름 붙은 내보내기 posthog(= 기본 인스턴스). CJS(main)·ESM(module) 빌드 둘 다 있다 — default 는 NodeNext 에서 모듈 전체로 풀린다
  const load = options.load ?? (async (): Promise<PostHogBrowserLike> => (await import("posthog-js")).posthog)
  const locate = options.location ?? browserLocation

  let consent: ConsentState = options.consent ? { ...options.consent } : unset()
  let loading: Promise<PostHogBrowserLike> | undefined
  let client: PostHogBrowserLike | undefined
  let optedIn = false
  const inFlight = new Set<Promise<unknown>>()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const consented = () => consent.analytics === true

  // 동의일 때만 부른다. 불러온 뒤 동의가 여전하면 opt-in 한다
  function ready(): Promise<PostHogBrowserLike> {
    loading ??= Promise.resolve()
      .then(load)
      .then((ph) => {
        ph.init(options.projectKey, posthogInitConfig(region.host, consented))
        ph.onFeatureFlags(() => notify())
        client = ph
        return ph
      })
    return loading.then((ph) => {
      if (consented() && !optedIn) {
        ph.opt_in_capturing({ captureEventName: false })
        optedIn = true
      }
      return ph
    })
  }
  const keep = (p: Promise<unknown>) => {
    const q = p.catch(() => undefined).finally(() => inFlight.delete(q))
    inFlight.add(q)
  }

  function enrichPageView(props: EventProps["page_view"]): EventProps["page_view"] {
    if (props.referrerKind !== undefined) return props
    const loc = locate()
    const utmSource = props.utmSource ?? utmSourceOf(loc.href)
    return { ...props, ...(utmSource ? { utmSource } : {}), referrerKind: referrerKind({ referrer: loc.referrer, utmSource, selfHost: loc.hostname }) }
  }

  if (consented()) keep(ready())

  return {
    region,
    track<E extends EventName>(name: E, props: EventProps[E], meta?: TrackMeta) {
      if (!consented()) return // 쌓지 않는다
      const full = name === "page_view" ? enrichPageView(props as EventProps["page_view"]) : props
      const built = buildProperties(name, structuredClone(full), meta?.attribution && structuredClone(meta.attribution))
      if ("rejected" in built) {
        options.onReject?.(built.rejected)
        return
      }
      keep(
        ready().then((ph) => {
          if (consented()) ph.capture(name, built.properties)
        }),
      )
    },
    consent: () => ({ ...consent }),
    setConsent(next) {
      consent = { analytics: next.analytics === true, marketing: next.marketing === true, decidedAt: now().toISOString() }
      options.onConsentChange?.({ ...consent })
      if (consent.analytics) keep(ready())
      else if (client && optedIn) {
        client.opt_out_capturing()
        optedIn = false
      }
      notify()
    },
    async flush() {
      while (inFlight.size) await Promise.all([...inFlight])
    },
    experiment(key) {
      if (!consented() || !client) return CONTROL_ARM
      return armFromFlag(client.getFeatureFlag(key))
    },
    onExperimentsChange(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
