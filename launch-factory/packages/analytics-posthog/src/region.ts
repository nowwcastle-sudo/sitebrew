// PostHog 지역·호스트 — 국외 이전 고지 문구(템플릿 개인정보처리방침)와 CSP(connect-src, 미룬 일 D14 → Task 10)에 쓴다.
// 출처(2026-09-30 확인):
//   - 호스트: https://posthog.com/docs/libraries/js/config (api_host US `https://us.i.posthog.com`, ui_host 예 `https://us.posthog.com`)
//             https://posthog.com/docs/advanced/content-security-policy (us/eu `.i.posthog.com`·`-assets.i.posthog.com`)
//   - 위치: https://posthog.com/handbook/company/security
//           「Customers can choose whether to host data on our AWS servers in the EU (eu-central-1 in Germany) or the US (us-east-1 in Virginia).」
//   - CSP: 위 CSP 문서는 하위 도메인이 바뀔 수 있다며 `https://*.posthog.com` 보다 좁히지 말라고 권한다.

export type PostHogRegion = "us" | "eu"

export interface PostHogRegionInfo {
  region: PostHogRegion
  /** posthog-js `api_host`·posthog-node `host` */
  apiHost: string
  /** 스크립트·설정 CDN */
  assetsHost: string
  /** 앱 화면(역방향 프록시를 쓸 때 posthog-js `ui_host`) */
  uiHost: string
  /** 국외 이전 고지에 넣을 값: 이전되는 나라(ISO 3166-1 alpha-2 — 나라 이름은 메시지 목록 transfer.country.<코드>)·장소·보관 업체 */
  transfer: { countryCode: "US" | "DE"; place: string; provider: string; providerRegion: string }
}

export const POSTHOG_REGIONS: Readonly<Record<PostHogRegion, PostHogRegionInfo>> = {
  us: {
    region: "us",
    apiHost: "https://us.i.posthog.com",
    assetsHost: "https://us-assets.i.posthog.com",
    uiHost: "https://us.posthog.com",
    transfer: { countryCode: "US", place: "Virginia", provider: "Amazon Web Services", providerRegion: "us-east-1" },
  },
  eu: {
    region: "eu",
    apiHost: "https://eu.i.posthog.com",
    assetsHost: "https://eu-assets.i.posthog.com",
    uiHost: "https://eu.posthog.com",
    transfer: { countryCode: "DE", place: "Frankfurt", provider: "Amazon Web Services", providerRegion: "eu-central-1" },
  },
}

/** 국외 이전 고지의 받는 자(처리 위탁 수탁자) 이름 */
export const POSTHOG_PROCESSOR = "PostHog, Inc."

/**
 * CSP 에 더할 출처. `@launch-factory/security` 의 `securityHeaders(nonce, { extend: POSTHOG_CSP })` 모양 그대로다.
 * 어댑터는 `disable_external_dependency_loading: true` 로 원격 스크립트(녹화·설문·사이트 앱)를 부르지 않지만,
 * PostHog 권고대로 script-src 도 넣어 둔다(`'strict-dynamic'` 이 있는 브라우저는 호스트 목록을 무시한다).
 * 역방향 프록시(같은 출처)로 보내면 더할 것이 없다.
 */
export const POSTHOG_CSP = {
  connectSrc: ["https://*.posthog.com"],
  scriptSrc: ["https://*.posthog.com"],
} as const satisfies Record<string, readonly string[]>

/**
 * POSTHOG_HOST(O5) → 지역. US·EU 수집 호스트나 앱 호스트면 지역을 알아낸다.
 * 역방향 프록시처럼 모르는 호스트면 region 을 따로 받아야 한다(국외 이전 고지가 비면 안 되므로 추측하지 않고 던진다).
 */
export function resolvePostHog(input: { host?: string; region?: PostHogRegion }): PostHogRegionInfo & { host: string } {
  const host = input.host?.trim().replace(/\/+$/, "")
  if (!host) {
    if (!input.region) throw new Error("cannot determine the PostHog region: set POSTHOG_HOST or region (us|eu)")
    return { ...POSTHOG_REGIONS[input.region], host: POSTHOG_REGIONS[input.region].apiHost }
  }
  let hostname: string
  try {
    const url = new URL(host)
    if (url.protocol !== "https:") throw new Error("https")
    hostname = url.hostname
  } catch {
    throw new Error("POSTHOG_HOST must be an https:// URL")
  }
  const known = (Object.values(POSTHOG_REGIONS) as PostHogRegionInfo[]).find((r) =>
    [r.apiHost, r.assetsHost, r.uiHost].some((h) => new URL(h).hostname === hostname),
  )
  if (known && input.region && input.region !== known.region) throw new Error(`POSTHOG_HOST is in region ${known.region} but region is ${input.region}`)
  const region = known?.region ?? input.region
  if (!region) throw new Error("POSTHOG_HOST is not a PostHog host (a proxy?): also set region (us|eu)")
  // 알려진 호스트(앱·CDN 주소를 넣은 경우 포함)는 수집 호스트로 맞춘다. 프록시는 준 주소 그대로다.
  return { ...POSTHOG_REGIONS[region], host: known ? known.apiHost : host }
}
