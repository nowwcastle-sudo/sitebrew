// 요금제 설정: 계약 Plan + Gumroad 멤버십 상품 + 서버 권한표.
// 한 요금제 = Gumroad 멤버십 상품 하나. 구독 객체(GET /subscribers/:id)에는 등급(tier)이 없고 product_id 만 있어서,
// 재조회로 확인할 수 있는 요금제 구분은 상품뿐이다(https://gumroad.com/api#get-/subscribers/:id).
// 무료 체험은 상품 설정이다 — 7일 또는 한 달 두 가지뿐(https://gumroad.com/help/article/82-membership-products 「Free trials」).
// 그래서 체험을 끌 수 있으려면(P13 checkout({ trial: false })) 체험 없는 상품이 따로 있어야 한다: trialProductId·trialUrl.
import type { Plan, RetentionOffer } from "@launch-factory/contract"
import { BillingConfigError, retentionOfferIssues } from "@launch-factory/billing-paddle"

export interface GumroadPlan extends Plan {
  gumroad: {
    /** 체험 없는 멤버십 상품 id(GET /products 의 id) */
    productId: string
    /** 그 상품 링크(https://<판매자>.gumroad.com/l/<permalink>) */
    url: string
    /** 체험을 켠 멤버십 상품. trialDays 가 있으면 필수 */
    trialProductId?: string
    trialUrl?: string
    /** 이 요금제로 볼 다른(옛) 상품 */
    otherProductIds?: string[]
  }
  /** 서버가 검사하는 기능 키(requireEntitlement) */
  entitlements?: string[]
}

/** Gumroad 무료 체험 길이(일): 한 주 또는 한 달(28~31일 — 우리 표시값 30) */
export const GUMROAD_TRIAL_DAYS = [7, 30] as const

const isHttpsUrl = (u: string | undefined) => {
  try {
    return !!u && new URL(u).protocol === "https:"
  } catch {
    return false
  }
}

export function validateGumroadConfig(plans: readonly GumroadPlan[], offers: readonly RetentionOffer[] = []): void {
  const problems: string[] = []
  const seenPlan = new Set<string>()
  const seenProduct = new Map<string, string>()
  for (const p of plans) {
    if (seenPlan.has(p.id)) problems.push(`plan ${p.id}: duplicate id`)
    seenPlan.add(p.id)
    if (!p.gumroad?.productId) problems.push(`plan ${p.id}: gumroad.productId is required`)
    if (!isHttpsUrl(p.gumroad?.url)) problems.push(`plan ${p.id}: gumroad.url must be an https product link`)
    const trialDays = p.trialDays ?? 0
    if (trialDays > 0) {
      if (!p.gumroad?.trialProductId || !isHttpsUrl(p.gumroad?.trialUrl)) problems.push(`plan ${p.id}: trialDays needs gumroad.trialProductId and trialUrl (Gumroad trials are a product setting)`)
      if (!(GUMROAD_TRIAL_DAYS as readonly number[]).includes(trialDays)) problems.push(`plan ${p.id}: Gumroad free trials are 7 days or one month (30) — got ${trialDays}`)
    } else if (p.gumroad?.trialProductId) problems.push(`plan ${p.id}: gumroad.trialProductId without trialDays`)
    if (p.interval === "once") problems.push(`plan ${p.id}: one-time products are not subscriptions — v0 Gumroad adapter handles memberships only`)
    if (!Number.isInteger(p.price.amount) || p.price.amount < 0) problems.push(`plan ${p.id}: price.amount must be a non-negative integer in minor units`)
    for (const productId of [p.gumroad?.productId, p.gumroad?.trialProductId, ...(p.gumroad?.otherProductIds ?? [])]) {
      if (!productId) continue
      const owner = seenProduct.get(productId)
      if (owner && owner !== p.id) problems.push(`product ${productId} belongs to both ${owner} and ${p.id}`)
      seenProduct.set(productId, p.id)
    }
  }
  const seenOffer = new Set<string>()
  for (const o of offers) {
    problems.push(...retentionOfferIssues(o))
    if (seenOffer.has(o.id)) problems.push(`retention offer ${o.id}: duplicate id`)
    seenOffer.add(o.id)
  }
  if (problems.length) throw new BillingConfigError(problems)
}

export function planById(plans: readonly GumroadPlan[], id: string): GumroadPlan | undefined {
  return plans.find((p) => p.id === id)
}

/** Gumroad 상품 id → 우리 요금제 id. 모르는 상품이면 null(같은 계정의 다른 상품 알림 — 무시한다) */
export function planIdForProduct(plans: readonly GumroadPlan[], productId: string): string | null {
  const p = plans.find((x) => x.gumroad.productId === productId || x.gumroad.trialProductId === productId || x.gumroad.otherProductIds?.includes(productId))
  return p?.id ?? null
}
