// Paddle 구독 엔터티 ↔ DB 구독 행 ↔ 계약 Subscription.
// Paddle 구독 상태는 active·canceled·past_due·paused·trialing 다섯이다(SDK 3.10.0 enums SubscriptionStatus,
// https://developer.paddle.com/api-reference/subscriptions/overview). 계약의 expired 는 Paddle 에서 나오지 않는다(다른 공급자용으로 DB 가 받는다).
// Paddle 에 없는 우리 칸(기간 끝 요금제 예약·가격 변경 동의)은 구독 custom_data 에 둔다 — 그래서 공급자 재조회 결과가 곧 「전체 상태」다(대장 D20).
// custom_data 는 체크아웃 거래에서 구독으로 복사된다(https://developer.paddle.com/build/transactions/custom-data.md 「How it works」).
import type { PendingPriceChange, Subscription } from "@launch-factory/contract"
import type { SubscriptionState, subscriptions } from "@launch-factory/db"
import type { Subscription as PaddleSubscription } from "@paddle/paddle-node-sdk"
import { planIdForPrice, type PaddlePlan } from "./plans.ts"

export const PROVIDER = "paddle"

/** 구독·거래 custom_data 에 쓰는 우리 키(최상위 customData 는 SDK 가 이름을 바꾸지 않는다 — case-helpers convertToSnakeCase) */
export const CD = {
  userId: "lf_user_id",
  orgId: "lf_org_id",
  scheduledPlanId: "lf_scheduled_plan_id",
  pendingPriceChange: "lf_pending_price_change",
  acceptedPriceChange: "lf_accepted_price_change",
} as const

/** custom_data 에 두는 가격 변경: 계약 모양 + 새 Paddle 가격 id */
export interface StoredPriceChange extends PendingPriceChange {
  priceId: string
}
export interface AcceptedPriceChange {
  priceId: string
  effectiveAt: string
  acceptedAt: string
}

export type CustomData = Record<string, unknown>

/** 키를 뺀 사본 */
export function omit(cd: CustomData, ...keys: string[]): CustomData {
  return Object.fromEntries(Object.entries(cd).filter(([k]) => !keys.includes(k)))
}

export function customDataOf(entity: { customData: unknown }): CustomData {
  const cd = entity.customData
  return cd && typeof cd === "object" && !Array.isArray(cd) ? { ...(cd as CustomData) } : {}
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

export function pendingOf(cd: CustomData): StoredPriceChange | null {
  const v = cd[CD.pendingPriceChange] as StoredPriceChange | undefined
  return v && typeof v === "object" && typeof v.priceId === "string" && typeof v.consentBy === "string" ? v : null
}
export function acceptedOf(cd: CustomData): AcceptedPriceChange | null {
  const v = cd[CD.acceptedPriceChange] as AcceptedPriceChange | undefined
  return v && typeof v === "object" && typeof v.priceId === "string" ? v : null
}

export type PaymentIssue = NonNullable<Subscription["paymentIssue"]>

/** Paddle 결제 오류 코드(SDK enums ErrorCode) → 계약 사유 */
export function paymentReason(errorCode: string | null | undefined): PaymentIssue["reason"] {
  switch (errorCode) {
    case "declined":
    case "declined_not_retryable":
    case "blocked_card":
    case "fraud":
      return "card_declined"
    case "expired_card":
      return "expired_card"
    case "not_enough_balance":
      return "insufficient_funds"
    default:
      return "unknown"
  }
}

export class UnknownPriceError extends Error {
  constructor(priceId: string) {
    super(`Paddle price ${priceId} is not in the plans config — add it to paddle.priceId, trialPriceId or otherPriceIds`)
    this.name = "UnknownPriceError"
  }
}

const date = (v: string | null | undefined): Date | null => (v ? new Date(v) : null)

/**
 * 재조회한 Paddle 구독 → DB 행 전체 상태. userId 는 custom_data 에서, 없으면 이미 저장된 행에서 가져온다(없으면 null — 연결 안 된 구독).
 * key 는 순서 판단 시각(updatedFromEventAt). 모르는 가격이면 던진다 — 설정을 고치면 Paddle 재전송이 처리된다.
 */
export function stateFromPaddle(
  entity: PaddleSubscription,
  opts: { plans: readonly PaddlePlan[]; key: Date; fallbackUserId?: string | null; paymentIssue?: PaymentIssue | null },
): SubscriptionState | null {
  const cd = customDataOf(entity)
  const userId = str(cd[CD.userId]) ?? opts.fallbackUserId ?? null
  if (!userId) return null
  const priceId = entity.items[0]?.price?.id
  if (!priceId) throw new UnknownPriceError("(no items)")
  const planId = planIdForPrice(opts.plans, priceId)
  if (!planId) throw new UnknownPriceError(priceId)
  const sc = entity.scheduledChange
  const status = entity.status
  const pending = pendingOf(cd)
  return {
    provider: PROVIDER,
    providerSubId: entity.id,
    userId,
    orgId: str(cd[CD.orgId]),
    status,
    planId,
    scheduledPlanId: str(cd[CD.scheduledPlanId]),
    pendingPriceChange: pending ? { from: pending.from, to: pending.to, effectiveAt: pending.effectiveAt, consentBy: pending.consentBy, kind: pending.kind } : null,
    currentPeriodEnd: date(entity.currentBillingPeriod?.endsAt),
    trialEnd: status === "trialing" ? date(entity.items[0]?.trialDates?.endsAt ?? entity.currentBillingPeriod?.endsAt) : null,
    cancelAt: sc?.action === "cancel" ? date(sc.effectiveAt) : status === "canceled" ? date(entity.canceledAt) : null,
    // 일시정지 중에는 다음 예정 변경(재개 또는 그 시각의 해지)이 끝나는 때다
    pausedUntil: status === "paused" && sc ? date(sc.action === "resume" ? sc.effectiveAt : (sc.resumeAt ?? sc.effectiveAt)) : null,
    paymentIssue: status === "past_due" ? (opts.paymentIssue ?? { reason: "unknown" }) : null,
    updatedFromEventAt: opts.key,
  }
}

export type SubscriptionRow = typeof subscriptions.$inferSelect

/**
 * past_due 유예 기본값(대장 D57 — 운영자 판정 2026-09-30 02:40): past_due 가 시작된 뒤 7일 동안은 유료 기능을 그대로 쓴다.
 * 지나면 유료 기능만 막고 데이터는 둔다. Paddle 재시도 기간(실결제 기본 30일 안팎)을 통째로 주던 Task 5 기본값을 바꾼다.
 */
export const PAST_DUE_GRACE_MS = 7 * 24 * 3600 * 1000

/** 유예가 끝나는 때. past_due 가 아니면 null. 시작 시각이 비어 있으면(옛 행) 마지막 반영 시각으로 센다 */
export function graceEndsAtOf(row: Pick<SubscriptionRow, "status" | "pastDueSince" | "updatedFromEventAt">, graceMs = PAST_DUE_GRACE_MS): Date | null {
  if (row.status !== "past_due") return null
  const since = row.pastDueSince ?? row.updatedFromEventAt
  return new Date(since.getTime() + Math.max(0, graceMs))
}

/** 계약 Subscription + 결제 실패 유예 기한(D57 — 화면의 결제 실패 배너가 기한을 보인다). 계약 선택 칸은 web-factory 에 요청함(대장 D110) */
export type LaunchSubscription = Subscription & { graceEndsAt?: string }

/** DB 행 → 계약 Subscription(빈 칸은 빼고, 시각은 ISO) */
export function toContract(row: SubscriptionRow | null | undefined, graceMs = PAST_DUE_GRACE_MS): LaunchSubscription {
  if (!row) return { planId: null, status: "none" }
  const iso = (d: Date | null) => (d ? d.toISOString() : undefined)
  const out: LaunchSubscription = { planId: row.planId, status: row.status }
  const grace = graceEndsAtOf(row, graceMs)
  if (grace) out.graceEndsAt = grace.toISOString()
  const put = <K extends keyof Subscription>(k: K, v: Subscription[K] | undefined | null) => {
    if (v !== undefined && v !== null) out[k] = v
  }
  put("currentPeriodEnd", iso(row.currentPeriodEnd))
  put("trialEnd", iso(row.trialEnd))
  put("cancelAt", iso(row.cancelAt))
  put("pausedUntil", iso(row.pausedUntil))
  put("scheduledPlanId", row.scheduledPlanId)
  put("pendingPriceChange", row.pendingPriceChange)
  put("paymentIssue", row.paymentIssue)
  return out
}

/** 순서 판단 시각: 이벤트 발생 시각과 재조회한 엔터티의 updated_at 중 늦은 것(둘 다 Paddle 시계). 재조회 상태는 적어도 이만큼 새롭다 */
export function orderingKey(occurredAt: string | null, updatedAt: string): Date {
  const a = occurredAt ? Date.parse(occurredAt) : -Infinity
  const b = Date.parse(updatedAt)
  const k = Math.max(a, b)
  if (!Number.isFinite(k)) throw new Error("Paddle timestamps are missing or invalid")
  return new Date(k)
}
