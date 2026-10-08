// 결제 포트 적합성 묶음(항목 contract-conformance — P3-3 Task 15, J3). adapter-mock 의 ?sub= 장면(상태 7개 + pending-price-change)이
// 곧 시나리오 표다. 실제 어댑터(Paddle 등)는 make(setup) 이 그 장면의 구독을 가진 새 포트를 돌려주게 해 같은 검사를 통과한다.
// 검사는 필드의 있음·없음·모양만 본다(날짜·금액 값은 공급자마다 다르다). 쓰기 검사는 상태를 바꾸므로 검사마다 make 를 새로 부른다.
import type { ActionResult } from "@/registry/factory/contract/block-contract"
import type { BillingPort, Money, Plan, RetentionOffer, Subscription, SubscriptionStatus } from "@/registry/factory/contract/ports"
import { retentionOfferIssues } from "@/registry/factory/lib/retention-offer"
import { CONFIRMED_METHODS, type ConformanceOptions, type ConformanceResult, autoConfirmed, confirmationProblem, deepEqual, runCheck, show } from "./conformance-core"

/** adapter-mock MOCK_SUBS + MOCK_SUB_SCENARIOS 와 같은 목록(적합성 테스트가 둘이 같은지 본다) */
export const BILLING_SCENARIO_IDS = ["none", "trialing", "active", "past_due", "paused", "canceled", "expired", "pending-price-change"] as const
export type BillingScenarioId = (typeof BILLING_SCENARIO_IDS)[number]

/** make 에 넘기는 준비. retentionOffers 를 주면 어댑터는 그 해지 대안만 쓴다(한도를 넘는 대안은 만들 때 던지거나 적용을 거절한다) */
export interface BillingSetup {
  sub: BillingScenarioId
  retentionOffers?: readonly RetentionOffer[]
}
export type MakeBilling = (setup: BillingSetup) => BillingPort | Promise<BillingPort>

/** 기계가 읽는 오류 이름: 체험 기간 없는 요금제에 checkout({ trial: true }) (P3-2 10c 판정) */
export const TRIAL_UNAVAILABLE = "trial_unavailable"

/**
 * 장면 표. status 는 subscription() 의 상태, requires·forbids 는 있어야·없어야 할 칸, cancel 은 해지(가입과 같은 한 번의 호출, 사유 없이)가
 * 되어야 하는가(allowed)·거절되어야 하는가(refused)·보지 않는가(skip — 이미 끝난 구독).
 */
export interface BillingScenario {
  sub: BillingScenarioId
  status: SubscriptionStatus
  hasPlan: boolean
  requires: readonly (keyof Subscription)[]
  forbids: readonly (keyof Subscription)[]
  cancel: "allowed" | "refused" | "skip"
}

export const BILLING_SCENARIOS: readonly BillingScenario[] = [
  { sub: "none", status: "none", hasPlan: false, requires: [], forbids: ["cancelAt", "pendingPriceChange", "paymentIssue"], cancel: "refused" },
  { sub: "trialing", status: "trialing", hasPlan: true, requires: ["trialEnd"], forbids: ["cancelAt", "pendingPriceChange"], cancel: "allowed" },
  { sub: "active", status: "active", hasPlan: true, requires: ["currentPeriodEnd"], forbids: ["cancelAt", "pendingPriceChange", "paymentIssue", "trialEnd"], cancel: "allowed" },
  { sub: "past_due", status: "past_due", hasPlan: true, requires: ["paymentIssue"], forbids: ["cancelAt"], cancel: "allowed" },
  { sub: "paused", status: "paused", hasPlan: true, requires: ["pausedUntil"], forbids: ["cancelAt"], cancel: "allowed" },
  { sub: "canceled", status: "canceled", hasPlan: true, requires: [], forbids: [], cancel: "skip" },
  { sub: "expired", status: "expired", hasPlan: true, requires: [], forbids: [], cancel: "skip" },
  { sub: "pending-price-change", status: "active", hasPlan: true, requires: ["pendingPriceChange", "currentPeriodEnd"], forbids: ["cancelAt"], cancel: "allowed" },
]

/** 체험 켬/끔 표(P13 + 10c 판정). plan 은 어댑터 요금제 중 체험 기간이 있는 것(with-trial)·없는 것(without-trial) */
export interface TrialCase {
  id: string
  plan: "with-trial" | "without-trial"
  trial?: boolean
  expect: "trialing" | "active" | typeof TRIAL_UNAVAILABLE
}

export const TRIAL_CASES: readonly TrialCase[] = [
  { id: "trial-on", plan: "with-trial", trial: true, expect: "trialing" },
  { id: "trial-off", plan: "with-trial", trial: false, expect: "active" },
  { id: "trial-default-with", plan: "with-trial", expect: "trialing" },
  { id: "trial-default-without", plan: "without-trial", expect: "active" },
  { id: "trial-unavailable", plan: "without-trial", trial: true, expect: TRIAL_UNAVAILABLE },
]

/** 한도 안의 해지 대안(R2 — lib retention-offer). downgrade 는 어댑터의 체험 없는 요금제로 간다 */
export const retentionOffersWithin = (downgradePlanId: string): RetentionOffer[] => [
  { id: "conf-pause-1m", kind: "pause", pauseMonths: 1 },
  { id: "conf-downgrade", kind: "downgrade", planId: downgradePlanId },
  { id: "conf-discount-30-3m", kind: "discount", discount: { percent: 30, months: 3 } },
  { id: "conf-discount-10-2m", kind: "discount", discount: { percent: 10, months: 2 } },
]

/** 한도를 넘는 해지 대안 — 어댑터는 만들 때 던지거나 applyRetentionOffer 를 거절해야 한다 */
export const RETENTION_OFFERS_OVER_LIMIT: readonly RetentionOffer[] = [
  { id: "conf-discount-40-3m", kind: "discount", discount: { percent: 40, months: 3 } },
  { id: "conf-discount-30-1m", kind: "discount", discount: { percent: 30, months: 1 } },
  { id: "conf-discount-30-4m", kind: "discount", discount: { percent: 30, months: 4 } },
]

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))
const moneyProblem = (m: Money | undefined, at: string) =>
  !m || !Number.isInteger(m.amount) || m.amount < 0 || typeof m.vatIncluded !== "boolean" ? `${at} 금액 모양이 틀렸어요: ${show(m)}` : null

function stateProblem(s: BillingScenario, sub: Subscription): string | null {
  if (sub.status !== s.status) return `status ${sub.status} — ${s.status} 여야 해요`
  if (s.hasPlan ? typeof sub.planId !== "string" || !sub.planId : sub.planId !== null) return `planId ${show(sub.planId)} — ${s.hasPlan ? "요금제 id" : "null"} 여야 해요`
  const missing = s.requires.filter((k) => sub[k] === undefined)
  if (missing.length) return `없는 칸: ${missing.join(", ")}`
  const extra = s.forbids.filter((k) => sub[k] !== undefined)
  if (extra.length) return `있으면 안 되는 칸: ${extra.join(", ")}`
  for (const k of ["currentPeriodEnd", "trialEnd", "cancelAt", "pausedUntil"] as const) if (sub[k] !== undefined && !isDate(sub[k])) return `${k} 가 날짜가 아니에요: ${show(sub[k])}`
  return null
}

// 읽기 결과를 꺼낸다 — 실패면 던져 runCheck 가 실패 결과로 바꾼다.
function data<T>(r: ActionResult<T>, what: string): T {
  if (!r.ok) throw new Error(`${what} 실패: ${show(r)}`)
  return r.data
}
async function current(port: BillingPort): Promise<Subscription> {
  return data(await port.subscription(), "subscription()")
}
async function afterCheckout(port: BillingPort, r: ActionResult<{ redirectUrl?: string; subscription?: Subscription }>): Promise<Subscription> {
  return data(r, "checkout").subscription ?? (await current(port))
}

/**
 * 결제 포트 적합성. make 는 준비(장면·해지 대안)마다 새 포트를 돌려준다(목: `(s) => mockBilling("?sub=" + s.sub, { retentionOffers: s.retentionOffers })`).
 * 호스팅 결제창만 돌려주는 어댑터는 샌드박스에서 결제를 끝낸 뒤 subscription() 이 새 구독을 보이게 make 를 꾸민다.
 */
export async function billingConformance(makeBilling: MakeBilling, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  // 확인을 요구하는 어댑터(options.requireConfirmation)는 옛 검사의 승인 행동 호출에 `confirmed: true` 를 자동으로 싣는다. raw 는 확인 검사가 쓰는 감싸지 않은 포트다
  const raw = makeBilling
  const make: MakeBilling = options.requireConfirmation ? async (s) => autoConfirmed(await raw(s), CONFIRMED_METHODS.billing) : raw

  // 요금제 짝: 체험 기간이 있는 것 하나, 없는 것 하나(체험 표·해지 표가 쓴다)
  let pair: { withTrial: Plan; withoutTrial: Plan } | null = null
  await check("billing.plans.trial-pair", async () => {
    const plans = data(await (await make({ sub: "none" })).plans(), "plans()")
    const bad = plans.map((p) => moneyProblem(p.price, `요금제 ${p.id}`)).find(Boolean)
    if (bad) return bad
    const withTrial = plans.find((p) => (p.trialDays ?? 0) > 0)
    const withoutTrial = plans.find((p) => !p.trialDays)
    if (!withTrial || !withoutTrial) return `체험 기간이 있는 요금제와 없는 요금제가 하나씩 있어야 해요: ${show(plans.map((p) => [p.id, p.trialDays]))}`
    pair = { withTrial, withoutTrial }
    return null
  })
  const planOf = (kind: TrialCase["plan"]) => {
    if (!pair) throw new Error("billing.plans.trial-pair 가 실패해 요금제를 고를 수 없어요")
    return kind === "with-trial" ? pair.withTrial : pair.withoutTrial
  }

  // 장면마다 처음 상태
  for (const s of BILLING_SCENARIOS) await check(`billing.state.${s.sub}`, async () => stateProblem(s, await current(await make({ sub: s.sub }))))

  // 해지: 가입(checkout)과 같이 한 번의 호출, 사유 없이. period_end 는 그때까지 이용(상태 그대로 + cancelAt), now 는 canceled
  for (const s of BILLING_SCENARIOS) {
    if (s.cancel === "refused") {
      await check(`billing.cancel.${s.sub}.refused`, async () => {
        const r = await (await make({ sub: s.sub })).cancel({ when: "period_end" })
        return r.ok ? `구독이 없는데 해지가 성공했어요: ${show(r)}` : null
      })
    }
    if (s.cancel !== "allowed") continue
    await check(`billing.cancel.${s.sub}.period-end`, async () => {
      const port = await make({ sub: s.sub })
      const got = data(await port.cancel({ when: "period_end" }), "cancel(period_end)")
      if (!isDate(got.cancelAt)) return `cancelAt 이 없어요: ${show(got)}`
      if (got.status !== s.status) return `기간 끝 해지 뒤 status ${got.status} — 그때까지 ${s.status} 여야 해요`
      return isDate((await current(port)).cancelAt) ? null : "subscription() 에 cancelAt 이 남지 않았어요"
    })
    await check(`billing.cancel.${s.sub}.now`, async () => {
      const port = await make({ sub: s.sub })
      const got = data(await port.cancel({ when: "now" }), "cancel(now)")
      if (got.status !== "canceled") return `즉시 해지 뒤 status ${got.status} — canceled 여야 해요`
      return (await current(port)).status === "canceled" ? null : "subscription() 이 canceled 가 아니에요"
    })
  }
  // 가입과 해지의 대칭: 방금 가입한 구독을 같은 한 번의 호출로 해지한다
  for (const [id, kind, when] of [["trial-signup", "with-trial", "period_end"], ["paid-signup", "without-trial", "now"]] as const) {
    await check(`billing.cancel.parity.${id}`, async () => {
      const port = await make({ sub: "none" })
      await afterCheckout(port, await port.checkout({ planId: planOf(kind).id }))
      const got = data(await port.cancel({ when }), `cancel(${when})`)
      if (when === "now") return got.status === "canceled" ? null : `가입 직후 즉시 해지가 canceled 가 아니에요: ${got.status}`
      return isDate(got.cancelAt) ? null : `가입 직후 기간 끝 해지에 cancelAt 이 없어요: ${show(got)}`
    })
  }

  // 체험 켬/끔(P13)과 체험 없는 요금제의 trial: true(10c 판정)
  for (const t of TRIAL_CASES) {
    await check(`billing.trial.${t.id}`, async () => {
      const port = await make({ sub: "none" })
      const planId = planOf(t.plan).id
      const r = await port.checkout(t.trial === undefined ? { planId } : { planId, trial: t.trial })
      if (t.expect === TRIAL_UNAVAILABLE) {
        if (r.ok) return `체험 없는 요금제 ${planId} 에 trial: true 가 성공했어요: ${show(r.data)}`
        if (r.code !== TRIAL_UNAVAILABLE) return `오류 code ${show(r.code)} — "${TRIAL_UNAVAILABLE}" 여야 해요`
        if (!r.formError) return "화면에 보일 formError 가 없어요"
        const after = await current(port)
        return after.status === "none" ? null : `거절했는데 구독이 바뀌었어요: ${after.status}`
      }
      const sub = await afterCheckout(port, r)
      if (sub.status !== t.expect) return `status ${sub.status} — ${t.expect} 여야 해요(요금제 ${planId}, trial ${show(t.trial)})`
      if (t.expect === "trialing" && !isDate(sub.trialEnd)) return "체험 중인데 trialEnd 가 없어요"
      if (t.expect === "active" && sub.trialEnd !== undefined) return `바로 결제인데 trialEnd 가 있어요: ${sub.trialEnd}`
      return null
    })
  }

  // 가격 변경 동의(L6): 모양 · 동의하면 사라짐 · 동의할 것이 없으면 거절
  await check("billing.price-change.shape", async () => {
    const pc = (await current(await make({ sub: "pending-price-change" }))).pendingPriceChange
    if (!pc) return "pendingPriceChange 가 없어요"
    const bad = moneyProblem(pc.from, "바뀌기 전") ?? moneyProblem(pc.to, "바뀐 뒤")
    if (bad) return bad
    if (pc.from.currency !== pc.to.currency) return `전후 통화가 달라요: ${pc.from.currency} → ${pc.to.currency}`
    if (!isDate(pc.effectiveAt) || !isDate(pc.consentBy)) return `effectiveAt·consentBy 가 날짜가 아니에요: ${show(pc)}`
    if (Date.parse(pc.consentBy) > Date.parse(pc.effectiveAt)) return "동의 기한(consentBy)이 적용일(effectiveAt)보다 늦어요"
    return pc.kind === "trial_to_paid" || pc.kind === "price_increase" ? null : `kind ${show(pc.kind)} 를 모르겠어요`
  })
  await check("billing.price-change.accept", async () => {
    const port = await make({ sub: "pending-price-change" })
    const got = data(await port.acceptPriceChange(), "acceptPriceChange()")
    if (got.pendingPriceChange !== undefined) return "동의했는데 결과에 pendingPriceChange 가 남았어요"
    if (got.status !== "active") return `동의 뒤 status ${got.status} — active 여야 해요`
    return (await current(port)).pendingPriceChange === undefined ? null : "subscription() 에 pendingPriceChange 가 남았어요"
  })
  await check("billing.price-change.nothing-to-accept", async () => {
    const r = await (await make({ sub: "active" })).acceptPriceChange()
    return r.ok ? "동의할 가격 변경이 없는데 성공했어요" : null
  })

  // 해지 대안(R2): 표가 lib 한도와 맞는가 · 한도 밖은 거절 · 한도 안은 적용되고 예약된 해지를 거둔다
  await check("billing.retention.table", async () => {
    const inside = retentionOffersWithin("plan").flatMap((o) => retentionOfferIssues(o))
    if (inside.length) return `한도 안 표가 lib 검사에 걸려요: ${inside.join(" ")}`
    const passing = RETENTION_OFFERS_OVER_LIMIT.filter((o) => retentionOfferIssues(o).length === 0)
    return passing.length ? `한도 밖 표가 lib 검사를 통과해요: ${passing.map((o) => o.id).join(", ")}` : null
  })
  for (const offer of RETENTION_OFFERS_OVER_LIMIT) {
    await check(`billing.retention.refuse.${offer.id}`, async () => {
      let port: BillingPort
      try {
        port = await make({ sub: "active", retentionOffers: [offer] })
      } catch {
        return null // 만들 때 거절 — 맞다
      }
      const r = await port.applyRetentionOffer({ offerId: offer.id })
      return r.ok ? `한도 밖 대안이 적용됐어요: ${show(offer)}` : null
    })
  }
  for (const kind of ["conf-pause-1m", "conf-downgrade", "conf-discount-30-3m", "conf-discount-10-2m"]) {
    await check(`billing.retention.apply.${kind}`, async () => {
      const offers = retentionOffersWithin(planOf("without-trial").id)
      const offer = offers.find((o) => o.id === kind) as RetentionOffer
      const port = await make({ sub: "active", retentionOffers: offers })
      data(await port.cancel({ reason: "too_expensive", when: "period_end" }), "cancel(period_end)")
      const got = data(await port.applyRetentionOffer({ offerId: offer.id }), "applyRetentionOffer")
      if (got.cancelAt !== undefined) return "대안을 받았는데 예약된 해지(cancelAt)가 남았어요"
      if (offer.kind === "pause" && (got.status !== "paused" || !isDate(got.pausedUntil))) return `일시정지 대안인데 ${show(got)}`
      if (offer.kind === "downgrade" && got.scheduledPlanId !== offer.planId && got.planId !== offer.planId) return `다운그레이드 대안인데 요금제가 ${offer.planId} 로 가지 않아요: ${show(got)}`
      if (offer.kind === "discount" && got.status !== "active") return `할인 대안 뒤 status ${got.status} — active 여야 해요`
      return (await current(port)).cancelAt === undefined ? null : "subscription() 에 cancelAt 이 남았어요"
    })
  }
  await check("billing.retention.unknown-offer", async () => {
    const r = await (await make({ sub: "active", retentionOffers: retentionOffersWithin(planOf("without-trial").id) })).applyRetentionOffer({ offerId: "conf-no-such-offer" })
    return r.ok ? "모르는 대안 id 가 적용됐어요" : null
  })
  await check("billing.retention.no-subscription", async () => {
    const r = await (await make({ sub: "none", retentionOffers: retentionOffersWithin(planOf("without-trial").id) })).applyRetentionOffer({ offerId: "conf-pause-1m" })
    return r.ok ? "구독이 없는데 대안이 적용됐어요" : null
  })

  // 승인 행동의 확인 입력(G11(d), P3-7 AXC — options.requireConfirmation 인 어댑터만): ① 확인 없이 부르면 confirmation_required(retryable false)이고 구독이 그대로 ② 확인과 함께 부르면 성공.
  // 감싸지 않은 포트(raw)로 부른다 — 한 검사 안에서 같은 포트에 먼저 확인 없이, 다음에 확인과 함께(거절이 상태를 건드렸다면 ②의 결과가 달라진다).
  if (options.requireConfirmation) {
    const gate = async (id: string, setup: BillingSetup, run: (port: BillingPort, confirmed: boolean) => Promise<ActionResult<unknown>>, after?: (sub: Subscription) => string | null) => {
      await check(`billing.confirmation.${id}`, async () => {
        const port = await raw(setup)
        const before = await current(port)
        const refused = await run(port, false)
        const problem = confirmationProblem(refused)
        if (problem) return problem
        const unchanged = await current(port)
        if (!deepEqual(before, unchanged)) return `승인 대기인데 구독이 바뀌었어요: ${show(before)} → ${show(unchanged)}`
        const done = await run(port, true)
        if (!done.ok) return `확인과 함께 부르면 성공해야 해요: ${show(done)}`
        return after ? after(await current(port)) : null
      })
    }
    const otherPlan = async (): Promise<string> => {
      const port = await raw({ sub: "active" })
      const planId = (await current(port)).planId
      const plan = data(await port.plans(), "plans()").find((p) => p.id !== planId)
      if (!plan) throw new Error("바꿀 다른 요금제가 없어요")
      return plan.id
    }
    let target = ""
    await gate(
      "change-plan",
      { sub: "active" },
      async (port, confirmed) => port.changePlan({ planId: (target ||= await otherPlan()), when: "period_end", ...(confirmed ? { confirmed: true as const } : {}) }),
      (s) => (s.scheduledPlanId === target || s.planId === target ? null : `요금제 변경(${target})이 구독에 남지 않았어요: ${show(s)}`),
    )
    await gate("cancel", { sub: "active" }, (port, confirmed) => port.cancel({ when: "period_end", ...(confirmed ? { confirmed: true as const } : {}) }), (s) => (isDate(s.cancelAt) ? null : "해지 예약(cancelAt)이 구독에 남지 않았어요"))
    await gate(
      "apply-retention-offer",
      { sub: "active", retentionOffers: retentionOffersWithin(planOf("without-trial").id) },
      (port, confirmed) => port.applyRetentionOffer({ offerId: "conf-pause-1m", ...(confirmed ? { confirmed: true as const } : {}) }),
      (s) => (s.status === "paused" ? null : `일시정지 대안을 받았는데 status ${s.status}`),
    )
    await gate("accept-price-change", { sub: "pending-price-change" }, (port, confirmed) => port.acceptPriceChange(confirmed ? { confirmed: true } : undefined), (s) =>
      s.pendingPriceChange === undefined ? null : "동의했는데 pendingPriceChange 가 남았어요",
    )
  }
  return out
}
