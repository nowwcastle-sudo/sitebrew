// 요금제 설정: 계약 Plan + Paddle 가격 id + 서버 권한표.
// Paddle 은 체험 기간이 가격(price.trial_period)에 붙는다(https://developer.paddle.com/build/products/create-products-prices.md
// 「Create a price with a paid trial」, https://developer.paddle.com/build/trials/create-trial.md). 그래서 체험이 있는 요금제는 가격이 둘이다:
// trialPriceId(trial_period 있음)와 priceId(없음). checkout({ trial: false })는 priceId 로 체험 없이 바로 결제한다(P13).
import type { Plan, RetentionOffer } from "@launch-factory/contract"
import { retentionOfferIssues } from "./retention.ts"

export interface PaddlePlan extends Plan {
  paddle: {
    /** 체험 없는 현재 가격(새 가입·요금제 변경·가격 인상 뒤 가격) */
    priceId: string
    /** 체험 기간이 있는 가격. trialDays 가 있으면 필수 */
    trialPriceId?: string
    /** 이 요금제의 옛(또는 다른) 가격. 가격을 올린 뒤에도 옛 가격 구독자를 이 요금제로 알아보려고 둔다 */
    otherPriceIds?: string[]
  }
  /** 서버가 검사하는 기능 키(requireEntitlement). 화면용 features 문구와 따로 둔다 */
  entitlements?: string[]
}

export class BillingConfigError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`billing config: ${problems.join(" / ")}`)
    this.name = "BillingConfigError"
    this.problems = problems
  }
}

/** 요금제·해지 대안 설정을 만들 때 검사한다. 한도를 넘는 해지 대안은 여기서 던진다(적합성 billing.retention.refuse). */
export function validateBillingConfig(plans: readonly PaddlePlan[], offers: readonly RetentionOffer[] = []): void {
  const problems: string[] = []
  const seenPlan = new Set<string>()
  const seenPrice = new Map<string, string>()
  for (const p of plans) {
    if (seenPlan.has(p.id)) problems.push(`plan ${p.id}: duplicate id`)
    seenPlan.add(p.id)
    if (!p.paddle?.priceId) problems.push(`plan ${p.id}: paddle.priceId is required`)
    if ((p.trialDays ?? 0) > 0 && !p.paddle?.trialPriceId) problems.push(`plan ${p.id}: trialDays needs paddle.trialPriceId (Paddle trials live on the price)`)
    if (!(p.trialDays ?? 0) && p.paddle?.trialPriceId) problems.push(`plan ${p.id}: paddle.trialPriceId without trialDays`)
    // 전자상거래법 제13조제6항·시행령 제20조의2: 무료→유료 전환은 전환 전 30일 안에 동의를 받는다. 체험이 30일을 넘으면 가입 때 받은 동의가
    // 그 창 밖이라 따로 동의를 받아야 한다(schedulePriceChange kind trial_to_paid). v0 은 체험을 30일 이하로 막는다.
    if ((p.trialDays ?? 0) > 30) problems.push(`plan ${p.id}: trialDays over 30 needs a separate trial-to-paid consent (e-commerce act §13(6)); keep trials at 30 days or less`)
    if (!Number.isInteger(p.price.amount) || p.price.amount < 0) problems.push(`plan ${p.id}: price.amount must be a non-negative integer in minor units`)
    for (const priceId of [p.paddle?.priceId, p.paddle?.trialPriceId, ...(p.paddle?.otherPriceIds ?? [])]) {
      if (!priceId) continue
      const owner = seenPrice.get(priceId)
      if (owner && owner !== p.id) problems.push(`price ${priceId} belongs to both ${owner} and ${p.id}`)
      seenPrice.set(priceId, p.id)
    }
  }
  const seenOffer = new Set<string>()
  for (const o of offers) {
    problems.push(...retentionOfferIssues(o))
    if (seenOffer.has(o.id)) problems.push(`retention offer ${o.id}: duplicate id`)
    seenOffer.add(o.id)
    if (o.kind === "downgrade" && o.planId && !seenPlan.has(o.planId)) problems.push(`retention offer ${o.id}: unknown planId ${o.planId}`)
  }
  if (problems.length) throw new BillingConfigError(problems)
}

export function planById(plans: readonly PaddlePlan[], id: string): PaddlePlan | undefined {
  return plans.find((p) => p.id === id)
}

/** Paddle 가격 id → 우리 요금제 id. 모르는 가격이면 null */
export function planIdForPrice(plans: readonly PaddlePlan[], priceId: string): string | null {
  const p = plans.find((x) => x.paddle.priceId === priceId || x.paddle.trialPriceId === priceId || x.paddle.otherPriceIds?.includes(priceId))
  return p?.id ?? null
}

/** 계약 plans() 결과 — Paddle 설정·권한표는 빼고 계약 모양만 */
export function contractPlans(plans: readonly Plan[]): Plan[] {
  return plans.map((p) => {
    const plan: Plan = { id: p.id, name: p.name, price: p.price, interval: p.interval, features: p.features }
    if (p.trialDays !== undefined) plan.trialDays = p.trialDays
    if (p.recommended !== undefined) plan.recommended = p.recommended
    if (p.limits !== undefined) plan.limits = p.limits
    return plan
  })
}
