// web-factory 계측 적합성 묶음(analyticsConformance)을 브라우저·서버 어댑터에 돌리는 실행기. conformance.test.mjs 와 scripts/conformance-all.mjs 가 같이 쓴다.
import { createPostHogAnalytics } from "../src/index.ts"
import { createServerAnalytics } from "../src/server.ts"
import { consentOf, fakePostHogJs, fakePostHogNode, toSent } from "./fakes.mjs"

/** 묶음이 돌려야 하는 검사 수(web-factory v0.0.12 기준 — b2fb648 의 34개에서 36개로: SAMPLE_EVENTS 에 web_vital·app_install 예시가 늘어 이벤트별 검사가 둘 늘었다. 4febd6e·840924e) */
export const ANALYTICS_PINS = { total: 36, expectedFailures: {} }

/** 브라우저 어댑터 make(posthog-js 가짜 — SDK 에 넘긴 capture 호출을 되읽음) */
export const makeClient = ({ consent }) => {
  const ph = fakePostHogJs()
  const port = createPostHogAnalytics({ projectKey: "phc_test", region: "us", consent: consentOf(consent), load: () => ph, location: () => ({}) })
  return {
    port,
    sent: async () => {
      await port.flush()
      return ph.captures().map((c) => toSent(c.event, c.properties))
    },
  }
}

/** 서버 어댑터 make(posthog-node 가짜 — captureImmediate 호출을 되읽음) */
export const makeServer = ({ consent }) => {
  const node = fakePostHogNode()
  const server = createServerAnalytics({ projectKey: "phc_test", region: "eu", client: node })
  const port = server.forRequest({ distinctId: "user_1", consent: consentOf(consent) })
  return {
    port,
    sent: async () => {
      await port.flush()
      return node.captured.map((m) => toSent(m.event, m.properties))
    },
  }
}

/** @param {{ mod: { analyticsConformance: Function } }} loaded */
export async function runAnalyticsConformance(loaded) {
  const client = await loaded.mod.analyticsConformance(makeClient, { timeoutMs: 2_000 })
  const server = await loaded.mod.analyticsConformance(makeServer, { timeoutMs: 2_000 })
  return [
    { adapter: "analytics-posthog/client", suite: "analyticsConformance", results: client, pins: ANALYTICS_PINS },
    { adapter: "analytics-posthog/server", suite: "analyticsConformance", results: server, pins: ANALYTICS_PINS },
  ]
}
