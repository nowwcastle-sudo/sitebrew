// 예약 작업(v0 은 Vercel Cron — 계획 D13, Inngest 는 v0.2). 한 번 돌 때 두 가지를 한다.
// 1. 동의 기한이 지난 가격 변경(L6 — 무응답은 동의가 아니다): 새 가격을 청구하지 않는다.
//    price_increase → 예정을 지우고 옛 가격을 유지한다. trial_to_paid → 유료로 넘어가지 않게 체험 끝(적용일)에 해지한다.
// 2. 다음 청구가 leadTime 안에 오는 구독: 기간 끝 요금제 예약(scheduledPlanId)이나 동의받은 새 가격으로 항목을 바꾼다(do_not_bill —
//    이번 기간은 이미 냈고, 곧 올 갱신이 새 가격으로 청구된다). Paddle 은 다음 청구 30분 안에는 구독을 바꾸지 못하게 하므로 그 전에만 한다.
// 실패는 구독마다 보고하고 다른 구독은 계속한다(던지지 않는다). 경로 처리기는 CRON_SECRET 을 확인한 뒤 이 함수를 부른다(Task 10).
import { and, inArray, isNotNull, lte, gt, eq } from "drizzle-orm"
import { subscriptions } from "@launch-factory/db"
import { acceptedOf, CD, customDataOf, omit, pendingOf, PROVIDER } from "./map.ts"
import { paddleErrorOf } from "./paddle.ts"
import { planById } from "./plans.ts"
import { storeEntity, type SyncDeps } from "./sync.ts"

export interface ScheduleOptions {
  /** 청구 몇 ms 전부터 항목을 바꾸나(Cron 주기보다 넉넉히). 기본 6시간 */
  leadTimeMs: number
  /** 이보다 청구가 가까우면 바꾸지 않는다(Paddle 30분 제한 + 여유 5분) */
  minBeforeBillingMs: number
}
export const SCHEDULE_DEFAULTS: ScheduleOptions = { leadTimeMs: 6 * 3600_000, minBeforeBillingMs: 35 * 60_000 }

export interface ScheduleReport {
  switched: { subId: string; priceId: string; reason: "scheduled_plan" | "accepted_price" }[]
  lapsed: { subId: string; kind: "price_increase" | "trial_to_paid" }[]
  tooLate: string[]
  failed: { subId: string; code: string }[]
}

export async function runScheduledChanges(deps: SyncDeps, now: Date, opts: ScheduleOptions = SCHEDULE_DEFAULTS): Promise<ScheduleReport> {
  const report: ScheduleReport = { switched: [], lapsed: [], tooLate: [], failed: [] }
  const { db, paddle } = deps
  const t = now.getTime()

  // 1. 동의 기한이 지난 가격 변경
  const pendingRows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, PROVIDER), isNotNull(subscriptions.pendingPriceChange), inArray(subscriptions.status, ["trialing", "active", "past_due", "paused"])))
  for (const row of pendingRows) {
    const change = row.pendingPriceChange
    if (!change || Date.parse(change.consentBy) >= t) continue
    try {
      const entity = await paddle.subscriptions.get(row.providerSubId)
      const cd = customDataOf(entity)
      const pending = pendingOf(cd)
      if (!pending) {
        await storeEntity(deps, entity) // 이미 지워졌다 — DB 만 맞춘다
        continue
      }
      const rest = omit(cd, CD.pendingPriceChange)
      let updated = await paddle.subscriptions.update(row.providerSubId, { customData: rest })
      if (pending.kind === "trial_to_paid") {
        updated = await paddle.subscriptions.cancel(row.providerSubId, { effectiveFrom: "next_billing_period" })
      }
      await storeEntity(deps, updated)
      report.lapsed.push({ subId: row.providerSubId, kind: pending.kind })
    } catch (e) {
      report.failed.push({ subId: row.providerSubId, code: paddleErrorOf(e).code })
    }
  }

  // 2. 곧 갱신되는 구독의 예약 변경
  const dueRows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.provider, PROVIDER),
        inArray(subscriptions.status, ["trialing", "active"]),
        gt(subscriptions.currentPeriodEnd, now),
        lte(subscriptions.currentPeriodEnd, new Date(t + opts.leadTimeMs)),
      ),
    )
  for (const row of dueRows) {
    if (row.cancelAt) continue // 해지 예약된 구독은 바꾸지 않는다
    try {
      const entity = await paddle.subscriptions.get(row.providerSubId)
      const cd = customDataOf(entity)
      const scheduled = typeof cd[CD.scheduledPlanId] === "string" ? (cd[CD.scheduledPlanId] as string) : null
      const accepted = acceptedOf(cd)
      const target = scheduled ? planById(deps.plans, scheduled)?.paddle.priceId : accepted?.priceId
      if (!target) continue
      const end = row.currentPeriodEnd as Date
      if (end.getTime() - t < opts.minBeforeBillingMs) {
        report.tooLate.push(row.providerSubId)
        continue
      }
      const rest = omit(cd, CD.scheduledPlanId, CD.acceptedPriceChange)
      const updated = await paddle.subscriptions.update(row.providerSubId, {
        items: [{ priceId: target, quantity: 1 }],
        prorationBillingMode: "do_not_bill",
        customData: rest,
      })
      await storeEntity(deps, updated)
      report.switched.push({ subId: row.providerSubId, priceId: target, reason: scheduled ? "scheduled_plan" : "accepted_price" })
    } catch (e) {
      report.failed.push({ subId: row.providerSubId, code: paddleErrorOf(e).code })
    }
  }
  return report
}
