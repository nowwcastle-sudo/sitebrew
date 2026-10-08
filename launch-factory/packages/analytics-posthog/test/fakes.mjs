// posthog-js·posthog-node 가짜. 어댑터가 SDK 에 넘긴 호출을 그대로 적는다(SDK 안의 opt-out·before_send 로 걸러지기 **전**).
// 그래서 「동의 전 0건」은 어댑터 스스로 SDK 를 부르지 않았다는 뜻이다(SDK 의 잠금에 기대지 않는다).
import { splitProperties } from "../src/index.ts"

export function fakePostHogJs() {
  const calls = [] // [method, ...args]
  const flags = {}
  const flagListeners = []
  let config
  let optedOut = false
  const delivered = [] // SDK 안의 잠금(opt-out·before_send)까지 지난 것
  return {
    calls,
    delivered,
    flags,
    get config() {
      return config
    },
    captures: () => calls.filter((c) => c[0] === "capture").map(([, event, properties]) => ({ event, properties })),
    init(token, cfg) {
      calls.push(["init", token])
      config = cfg
      optedOut = cfg?.opt_out_capturing_by_default === true
      return this
    },
    capture(event, properties) {
      calls.push(["capture", event, structuredClone(properties)])
      if (optedOut) return undefined
      const cr = { uuid: "u", event, properties: { ...properties } }
      const out = config?.before_send ? config.before_send(cr) : cr
      if (out) delivered.push(out)
      return out ?? undefined
    },
    opt_in_capturing(options) {
      calls.push(["opt_in_capturing", options])
      optedOut = false
    },
    opt_out_capturing() {
      calls.push(["opt_out_capturing"])
      optedOut = true
    },
    getFeatureFlag(key) {
      return flags[key]
    },
    onFeatureFlags(cb) {
      flagListeners.push(cb)
      return () => {}
    },
    /** 테스트: 플래그 응답이 온 것처럼 */
    receiveFlags(values) {
      Object.assign(flags, values)
      for (const cb of flagListeners) cb([], {}, {})
    },
  }
}

export function fakePostHogNode() {
  const captured = []
  let shut = false
  return {
    captured,
    get shut() {
      return shut
    },
    async captureImmediate(message) {
      captured.push(structuredClone(message))
    },
    async shutdown() {
      shut = true
    },
  }
}

/** 적합성 묶음의 SentEvent 모양으로 되읽는다(wf_* → attribution) */
export const toSent = (event, properties) => ({ name: event, ...splitProperties(properties ?? {}) })

export const DECIDED = "2026-09-30T00:00:00.000Z"
export const consentOf = (scenario) => (scenario === "analytics" ? { analytics: true, marketing: false, decidedAt: DECIDED } : undefined)
