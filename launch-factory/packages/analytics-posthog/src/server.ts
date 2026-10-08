// 서버 AnalyticsPort 어댑터(posthog-node) — 웹훅·서버 액션에서 나는 이벤트(checkout_complete 등).
// 서버는 방문자의 동의를 모른다. 그래서 요청마다 forRequest({ distinctId, consent })로 포트를 만든다 — consent 는 부르는 쪽이
// 저장해 둔 결정(쿠키·DB)을 넘긴다. analytics 가 true 가 아니면 브라우저 어댑터와 똑같이 보내지도 쌓지도 않는다.
// 짧게 사는 함수(Vercel)라 captureImmediate 로 보내고, 응답 전에 flush() 를 기다린다
// (PostHog 문서 https://posthog.com/docs/libraries/node 「Short-lived/serverless」: flushAt 1·flushInterval 0, captureImmediate, shutdown).
import type { AnalyticsPort, ConsentState, EventName, EventProps, TrackMeta } from "@launch-factory/contract"
import { PostHog, type PostHogOptions } from "posthog-node"
import { buildProperties, type RejectedEvent } from "./props.ts"
import { resolvePostHog, type PostHogRegion, type PostHogRegionInfo } from "./region.ts"

export type PostHogNodeLike = Pick<PostHog, "captureImmediate" | "shutdown">

export interface ServerAnalyticsOptions {
  projectKey: string
  host?: string
  region?: PostHogRegion
  /** 테스트·녹화 응답용. 없으면 posthog-node 클라이언트를 만든다 */
  client?: PostHogNodeLike
  /** posthog-node 의 fetch 바꿔 끼우기(녹화 응답 테스트). 없으면 전역 fetch */
  fetch?: PostHogOptions["fetch"]
  onReject?: (rejected: RejectedEvent) => void
  /** 보내기 실패(네트워크 등). track 은 던지지 않는다 */
  onError?: (error: unknown) => void
  now?: () => Date
}

export interface RequestContext {
  /** PostHog distinct id — 제품의 내부 사용자 id(이메일이 아니다) */
  distinctId: string
  consent: ConsentState | undefined
  onConsentChange?: (consent: ConsentState) => void
}

export interface ServerAnalytics {
  readonly enabled: true
  readonly region: PostHogRegionInfo & { host: string }
  forRequest(ctx: RequestContext): AnalyticsPort & { flush(): Promise<void> }
  /** 지금까지 보낸 것이 끝날 때까지 기다린다 */
  flush(): Promise<void>
  shutdown(): Promise<void>
}

export function createServerAnalytics(options: ServerAnalyticsOptions): ServerAnalytics {
  if (!options.projectKey?.trim()) throw new Error("POSTHOG_PROJECT_KEY is empty (owner action O5)")
  const region = resolvePostHog({ host: options.host, region: options.region })
  const now = options.now ?? (() => new Date())
  // 서버 IP 로 위치를 찍으면 뜻이 없다 — disableGeoip
  const client = options.client ?? new PostHog(options.projectKey, { host: region.host, flushAt: 1, flushInterval: 0, disableGeoip: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
  const inFlight = new Set<Promise<unknown>>()
  const flush = async () => {
    while (inFlight.size) await Promise.all([...inFlight])
  }

  return {
    enabled: true,
    region,
    forRequest({ distinctId, consent: initial, onConsentChange }) {
      if (!distinctId?.trim()) throw new Error("distinctId is empty")
      if (/@/.test(distinctId)) throw new Error("distinctId must not be an email address: use the internal user id")
      let consent: ConsentState = initial ? { ...initial } : { analytics: false, marketing: false }
      return {
        track<E extends EventName>(name: E, props: EventProps[E], meta?: TrackMeta) {
          if (consent.analytics !== true) return
          const built = buildProperties(name, structuredClone(props), meta?.attribution && structuredClone(meta.attribution))
          if ("rejected" in built) {
            options.onReject?.(built.rejected)
            return
          }
          const p = client
            .captureImmediate({ distinctId, event: name, properties: built.properties, disableGeoip: true })
            .catch((e: unknown) => options.onError?.(e))
            .finally(() => inFlight.delete(p))
          inFlight.add(p)
        },
        consent: () => ({ ...consent }),
        setConsent(next) {
          consent = { analytics: next.analytics === true, marketing: next.marketing === true, decidedAt: now().toISOString() }
          onConsentChange?.({ ...consent })
        },
        flush,
      }
    },
    flush,
    async shutdown() {
      await flush()
      await client.shutdown()
    },
  }
}

/**
 * 분석이 꺼진 제품(POSTHOG_HOST 가 없음 — LFOBS)의 서버 계측. 같은 모양을 지키되 아무것도 보내지도 쌓지도 않는다.
 * 호출하는 쪽은 켜졌는지 몰라도 된다 — `forRequest(...).track` 은 조용히 아무 일도 하지 않고, 동의 상태는 항상 「결정 전」으로 읽힌다.
 */
export interface DisabledServerAnalytics {
  readonly enabled: false
  readonly region: null
  forRequest(ctx: RequestContext): AnalyticsPort & { flush(): Promise<void> }
  flush(): Promise<void>
  shutdown(): Promise<void>
}

export function disabledServerAnalytics(): DisabledServerAnalytics {
  return {
    enabled: false,
    region: null,
    forRequest() {
      return {
        track() {},
        consent: () => ({ analytics: false, marketing: false }),
        setConsent() {},
        flush: async () => {},
      }
    },
    flush: async () => {},
    shutdown: async () => {},
  }
}
