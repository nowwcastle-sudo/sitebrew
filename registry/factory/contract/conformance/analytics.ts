// 계측 포트 적합성 묶음(항목 contract-conformance — P3-3 Task 15, J3). 목은 mockAnalytics("?consent=<장면>") 과 그 events 다.
// 실제 어댑터(PostHog 등)는 make 가 { port, sent } 를 돌려준다 — sent 는 어댑터가 공급자에게 넘긴 이벤트(공급자 SDK 에 들어가기 직전을 가로챈 것).
// 동의(analytics)가 false 면 아무것도 보내지 않고, meta.attribution(계약 판 2)은 props 와 따로 손대지 않고 보내며, props 에 개인정보 칸을 더하지 않는다.
import type { AnalyticsPort, Attribution } from "@/registry/factory/contract/ports"
import type { EventName, EventProps } from "@/registry/factory/contract/events"
import { type ConformanceOptions, type ConformanceResult, deepEqual, runCheck, show } from "./conformance-core"

/** 어댑터가 공급자에게 넘긴 이벤트 하나(목의 TrackedEvent 와 같은 모양) */
export interface SentEvent {
  name: string
  props: unknown
  attribution?: Attribution
}
/** unset: 동의 결정 전(둘 다 false) · analytics: 계측만 동의 */
export type AnalyticsScenarioId = "unset" | "analytics"
export type MakeAnalytics = (setup: { consent: AnalyticsScenarioId }) =>
  | { port: AnalyticsPort; sent: () => readonly SentEvent[] | Promise<readonly SentEvent[]> }
  | Promise<{ port: AnalyticsPort; sent: () => readonly SentEvent[] | Promise<readonly SentEvent[]> }>

/** 이벤트마다 예시 props 하나(이름 표 events.ts 전체 — 빠지면 typecheck 가 잡는다). 개인정보 없음 */
export const SAMPLE_EVENTS: { [E in EventName]: EventProps[E] } = {
  page_view: { path: "/pricing", utmSource: "chatgpt.com", referrerKind: "ai" },
  cta_click: { id: "hero-primary", label: "시작하기(예시)", section: "hero-split" },
  form_start: { form: "contact" },
  form_submit: { form: "contact" },
  form_error: { form: "contact", fields: ["email"], kind: "field" },
  signup_start: { method: "password" },
  signup_complete: { method: "kakao", marketingConsent: false },
  login: { method: "google" },
  onboarding_step_complete: { step: "profile", index: 1, total: 3 },
  activation: { milestone: "first-project" },
  pricing_view: { plans: 3 },
  plan_select: { planId: "pro", interval: "month" },
  checkout_start: { planId: "pro" },
  checkout_complete: { planId: "pro", amount: 29_000, currency: "KRW" },
  trial_start: { planId: "pro", trialDays: 14 },
  upgrade_prompt_view: { trigger: "projects-limit" },
  upgrade_click: { trigger: "projects-limit", planId: "team" },
  limit_reached: { limit: "projects", used: 3, max: 3 },
  cancel_start: { planId: "pro" },
  cancel_alternative_view: { alternative: "pause" },
  cancel_alternative_accept: { alternative: "discount" },
  cancel_complete: { reason: "too_expensive", when: "period_end" },
  pause: { days: 30 },
  resume: {},
  payment_failed_view: { reason: "card_declined" },
  payment_method_update: { surface: "banner" },
  referral_share: { channel: "link" },
  consent_update: { analytics: true, marketing: false },
  web_vital: { metric: "INP", value: 180, rating: "good", path: "/pricing" },
  app_install: { source: "prompt" },
  add_to_cart: { productId: "sku-1", quantity: 2 },
  begin_checkout: { amount: 31_000, currency: "KRW" },
  purchase: { orderId: "order-1", amount: 31_000, currency: "KRW" },
  booking_view: { service: "consult" },
  booking_submit: { service: "consult", status: "confirmed" },
  booking_cancel: { service: "consult" },
}

/** 출처 태그 예시(모든 칸) */
export const SAMPLE_ATTRIBUTION: Attribution = { blockId: "hero-split", recipeId: "r1-measure", copyVariant: "b", experiment: { key: "hero-cta", arm: "b" } }

// 개인정보 칸 이름(이메일·전화·이름·주소). 이름 표 events.ts 의 칸(path·label·planId·marketingConsent …)은 걸리지 않는다.
const PII_KEY = /e[-_]?mail|phone|mobile|name|addr(ess)?|street|postal|zip/i
const EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i

/**
 * 값 안의 개인정보 칸 경로(깊이 우선, "a.b[0].c"). 칸 이름이 이메일·전화·이름·주소 꼴이거나 문자열 값이 이메일 꼴이면 걸린다.
 * 블록·조립 코드의 props 검사에도 쓸 수 있다.
 */
export function piiPaths(value: unknown, at = ""): string[] {
  if (typeof value === "string") return EMAIL_VALUE.test(value) ? [at || "(값)"] : []
  if (typeof value !== "object" || value === null) return []
  if (Array.isArray(value)) return value.flatMap((v, i) => piiPaths(v, `${at}[${i}]`))
  return Object.entries(value).flatMap(([k, v]) => [...(PII_KEY.test(k) ? [at ? `${at}.${k}` : k] : []), ...piiPaths(v, at ? `${at}.${k}` : k)])
}

const TAG_KEYS = ["attribution", "blockId", "recipeId", "copyVariant", "experiment"]

export async function analyticsConformance(make: MakeAnalytics, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  const cta = SAMPLE_EVENTS.cta_click

  await check("analytics.consent.default-false", async () => {
    const c = (await make({ consent: "unset" })).port.consent()
    if (c.analytics !== false || c.marketing !== false) return `정하기 전 동의가 켜져 있어요(사전 선택): ${show(c)}`
    return c.decidedAt === undefined ? null : `정하기 전인데 decidedAt 이 있어요: ${c.decidedAt}`
  })
  await check("analytics.track.dropped-without-consent", async () => {
    const { port, sent } = await make({ consent: "unset" })
    port.track("cta_click", cta, { attribution: SAMPLE_ATTRIBUTION })
    port.track("page_view", SAMPLE_EVENTS.page_view)
    const got = await sent()
    return got.length === 0 ? null : `동의 전인데 보냈어요: ${show(got)}`
  })
  // 양성 대조: 동의하면 보낸다(무엇이든 버리는 어댑터가 위 검사를 거저 통과하지 않게)
  await check("analytics.track.recorded-with-consent", async () => {
    const { port, sent } = await make({ consent: "analytics" })
    port.track("cta_click", cta)
    const got = await sent()
    return got.length === 1 && got[0].name === "cta_click" ? null : `동의했는데 cta_click 하나가 보내지지 않았어요: ${show(got)}`
  })
  await check("analytics.track.dropped-after-withdrawal", async () => {
    const { port, sent } = await make({ consent: "analytics" })
    port.setConsent({ analytics: false, marketing: false })
    const c = port.consent()
    if (c.analytics !== false || !c.decidedAt) return `철회가 동의 상태에 남지 않았어요: ${show(c)}`
    port.track("cta_click", cta, { attribution: SAMPLE_ATTRIBUTION })
    const got = await sent()
    return got.length === 0 ? null : `철회했는데 보냈어요: ${show(got)}`
  })
  await check("analytics.meta.attribution-passthrough", async () => {
    const { port, sent } = await make({ consent: "analytics" })
    port.track("cta_click", cta, { attribution: SAMPLE_ATTRIBUTION })
    const got = await sent()
    if (got.length !== 1) return `이벤트 하나여야 해요: ${show(got)}`
    if (!deepEqual(got[0].attribution, SAMPLE_ATTRIBUTION)) return `태그가 바뀌었어요: ${show(got[0].attribution)} — ${show(SAMPLE_ATTRIBUTION)}`
    const props = (got[0].props ?? {}) as Record<string, unknown>
    const leaked = TAG_KEYS.filter((k) => k in props)
    return leaked.length ? `태그가 props 에 섞였어요: ${leaked.join(", ")}` : null
  })
  await check("analytics.meta.absent-without-meta", async () => {
    const { port, sent } = await make({ consent: "analytics" })
    port.track("cta_click", cta)
    const got = await sent()
    return got.length === 1 && (got[0].attribution === undefined || deepEqual(got[0].attribution, {})) ? null : `meta 없이 불렀는데 태그가 붙었어요: ${show(got)}`
  })
  // 이벤트마다: 보낸 props 에 개인정보 칸이 없다
  for (const name of Object.keys(SAMPLE_EVENTS) as EventName[]) {
    await check(`analytics.props.no-pii.${name}`, async () => {
      const { port, sent } = await make({ consent: "analytics" })
      port.track(name, SAMPLE_EVENTS[name])
      const got = await sent()
      if (got.length !== 1) return `이벤트 하나여야 해요: ${show(got)}`
      const found = piiPaths(got[0].props)
      return found.length ? `개인정보 칸: ${found.join(", ")}` : null
    })
  }
  return out
}
