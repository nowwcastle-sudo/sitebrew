// Gumroad 구독 객체(GET /subscribers/:id) → DB 구독 행 전체 상태.
// 상태 7개와 뜻(https://gumroad.com/api#get-/products/:product_id/subscribers, 2026-09-30):
//   alive · payment_method_update_required · pending_cancellation · pending_failure · failed_payment · fixed_subscription_period_ended · cancelled
//   「failed_at·ended_at·cancelled_at 중 하나가 채워져 있고 지났으면 끝난 구독」.
// 해지는 기간 끝까지 이용한다(https://gumroad.com/help/article/278-guide-to-memberships 「Cancelling your membership」) — pending_cancellation 의
// cancelled_at 은 해지될 시각이다(구독 알림 cancellation 의 cancelled_at 「timestamp at which subscription will be cancelled」).
// Gumroad 에는 일시정지·가격 변경 동의가 없다 → pausedUntil·pendingPriceChange·scheduledPlanId 는 늘 비운다.
import type { SubscriptionState } from "@launch-factory/db"
import type { GumroadSubscriber } from "./gumroad.ts"
import { planIdForProduct, type GumroadPlan } from "./plans.ts"

export const PROVIDER = "gumroad"

export class UnknownSubscriberStatusError extends Error {
  constructor(status: string) {
    super(`Gumroad subscriber status ${status} is not one of the documented seven`)
    this.name = "UnknownSubscriberStatusError"
  }
}

/** recurrence(문서: monthly/quarterly/biannually/yearly/every_two_years) → 개월 */
export const RECURRENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, biannually: 6, yearly: 12, every_two_years: 24 }

const date = (v: string | null | undefined): Date | null => {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t) : null
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + months)
  return x
}

/**
 * 다음 청구 시각(추정). 구독 객체에 다음 청구일 칸이 없다. 체험이 끝나는 때(없으면 가입 시각)를 기준으로 청구 주기를 더해
 * now 뒤 첫 시각을 쓴다. 등급 올림은 갱신일을 그날로 옮기므로(가이드 「Changing tiers」) 그 뒤로는 어긋날 수 있다 — 실측은 대장 D162.
 */
export function nextBillingAt(sub: GumroadSubscriber, now: Date): Date | null {
  const trialEnd = date(sub.free_trial_ends_at)
  if (trialEnd && trialEnd > now) return trialEnd
  const anchor = trialEnd ?? date(sub.created_at)
  const months = RECURRENCE_MONTHS[sub.recurrence ?? ""]
  if (!anchor || !months) return null
  let at = anchor
  for (let i = 0; at <= now && i < 2400; i++) at = addMonths(anchor, months * (i + 1))
  return at
}

/** 저장할 전체 상태. userId 가 없으면 null(연결 안 된 구독). 모르는 상품이면 null — 호출자가 「무시」로 끝낸다 */
export function stateFromGumroad(
  sub: GumroadSubscriber,
  opts: { plans: readonly GumroadPlan[]; key: Date; now: Date; userId: string | null },
): SubscriptionState | null {
  const planId = planIdForProduct(opts.plans, sub.product_id)
  if (!planId || !opts.userId) return null
  const now = opts.now
  const trialEnd = date(sub.free_trial_ends_at)
  const inTrial = !!trialEnd && trialEnd > now
  const next = nextBillingAt(sub, now)
  const ended = date(sub.ended_at) ?? date(sub.cancelled_at) ?? date(sub.failed_at)
  const base = {
    provider: PROVIDER,
    providerSubId: sub.id,
    userId: opts.userId,
    orgId: null,
    planId,
    scheduledPlanId: null,
    pendingPriceChange: null,
    pausedUntil: null,
    updatedFromEventAt: opts.key,
  }
  switch (sub.status) {
    case "alive":
      return { ...base, status: inTrial ? "trialing" : "active", currentPeriodEnd: next, trialEnd: inTrial ? trialEnd : null, cancelAt: null, paymentIssue: null }
    case "pending_cancellation": {
      // 해지 예약: 해지될 때까지 그 상태(체험 중이면 trialing) 그대로 + cancelAt
      const cancelAt = date(sub.cancelled_at) ?? next
      return { ...base, status: inTrial ? "trialing" : "active", currentPeriodEnd: next, trialEnd: inTrial ? trialEnd : null, cancelAt, paymentIssue: null }
    }
    case "pending_failure":
    case "payment_method_update_required":
      // 결제 실패 뒤 재시도 중·결제수단 갱신 필요 — 아직 끝나지 않았다. 구독 객체에는 실패 사유가 없다
      return { ...base, status: "past_due", currentPeriodEnd: next, trialEnd: null, cancelAt: null, paymentIssue: { reason: "unknown" }, pastDueSince: date(sub.failed_at) ?? opts.key }
    case "cancelled":
      return { ...base, status: "canceled", currentPeriodEnd: ended, trialEnd: null, cancelAt: date(sub.cancelled_at) ?? ended, paymentIssue: null }
    case "failed_payment":
    case "fixed_subscription_period_ended":
      // 결제 실패로 끝남 · 기간이 정해진 구독이 끝남 → 계약 expired(사용자가 해지한 canceled 와 나눈다)
      return { ...base, status: "expired", currentPeriodEnd: ended, trialEnd: null, cancelAt: null, paymentIssue: null }
    default:
      throw new UnknownSubscriberStatusError(sub.status)
  }
}
