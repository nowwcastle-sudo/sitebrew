// Paddle BillingPort 어댑터(계약 판 2). 블록은 포트 메서드만 부르고, 이 어댑터가 Paddle Billing API 를 부른다.
// 읽기(subscription)는 DB(웹훅·어댑터가 동기화한 행)에서, 쓰기는 Paddle 에 보낸 뒤 Paddle 이 돌려준 갱신된 구독을 DB 에 저장한다.
// 모든 메서드는 거부하지 않고 ActionResult 로 끝난다. 실패의 code 는 기계가 읽는 이름이다(예: trial_unavailable — P3-2 10c 판정).
//
// Paddle 사실(SDK 3.10.0 + 공식 문서, 2026-09-30 확인):
// - 항목(요금제) 변경은 예약할 수 없고 바로 적용된다. scheduled_change 는 cancel·pause·resume 만 있다(SDK ScheduledChangeAction).
//   그래서 changePlan({ when: "period_end" })는 우리가 예약한다 — 구독 custom_data 에 적고 Vercel Cron(schedule.ts)이 기간 끝 전에 바꾼다.
// - 다음 청구까지 30분 안이거나 past_due 면 구독을 바꿀 수 없다(https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade).
// - 예약된 변경이 있으면 청구를 다음 기간으로 미루는 proration 은 못 쓴다(https://developer.paddle.com/errors/subscriptions/subscription_invalid_billing_mode_for_scheduled_change.md).
// - 호스팅 체크아웃: 거래를 만들면 checkout.url 이 온다. 대시보드에 기본 결제 링크가 없으면 transaction_default_checkout_url_not_set 오류다.
import { and, desc, eq } from "drizzle-orm"
import type { ActionResult, BillingPort, PendingPriceChange, RetentionOffer, Subscription } from "@launch-factory/contract"
import { subscriptions, type Database } from "@launch-factory/db"
import type { Subscription as PaddleSubscription } from "@paddle/paddle-node-sdk"
import { CD, customDataOf, omit, pendingOf, PAST_DUE_GRACE_MS, PROVIDER, toContract, type CustomData, type LaunchSubscription, type StoredPriceChange, type SubscriptionRow } from "./map.ts"
import { createPaddleClient, paddleErrorOf, type PaddleClient, type PaddleEnv } from "./paddle.ts"
import { contractPlans, planById, validateBillingConfig, type PaddlePlan } from "./plans.ts"
import { retentionOfferIssues } from "./retention.ts"
import { runScheduledChanges, SCHEDULE_DEFAULTS, type ScheduleOptions, type ScheduleReport } from "./schedule.ts"
import { storeEntity, type MailConfig, type SyncDeps } from "./sync.ts"
import { handlePaddleWebhook } from "./webhook.ts"

/** 계약 ActionResult 의 실패 + code(web-factory b2fb648 에서 계약에 더해진 선택 칸 — 우리 잠금 9b4d4a6 에는 아직 없다, 대장 D50) */
export type BillingFailure = { ok: false; formError?: string; retryable?: boolean; code?: string }
export type BillingResult<T> = { ok: true; data: T } | BillingFailure

export const fail = (code: string, formError: string, retryable = false): BillingFailure => ({ ok: false, code, formError, ...(retryable ? { retryable } : {}) })
const ok = <T>(data: T): BillingResult<T> => ({ ok: true, data })

export interface BillingSession {
  userId: string
  orgId?: string
}

export interface PaddleBillingConfig {
  db: Database
  plans: readonly PaddlePlan[]
  /** 기본 "sandbox". "production" 은 LF_PADDLE_LIVE=1 일 때만 */
  env?: PaddleEnv
  apiKey?: string
  webhookSecret?: string
  /** 테스트·다른 구성 주입용. 주면 apiKey·env 로 만들지 않는다(그래도 env 검사는 한다) */
  paddle?: PaddleClient
  retentionOffers?: readonly RetentionOffer[]
  mail?: MailConfig
  /** 요금제 즉시 변경의 청구 방식(기본 prorated_immediately — 예약된 변경이 있어도 쓸 수 있는 값) */
  prorationNow?: "prorated_immediately" | "full_immediately" | "do_not_bill"
  schedule?: Partial<ScheduleOptions>
  now?: () => Date
  vars?: Record<string, string | undefined>
  log?: (line: string) => void
  /** past_due 유예(ms, 대장 D57). 기본 7일. subscription() 의 graceEndsAt 과 requireEntitlement 의 pastDueGraceMs 를 같은 값으로 둔다 */
  pastDueGraceMs?: number
}

/** 결제 포털 링크(D75). redirectUrl = 포털 첫 화면(청구서 PDF·거래 목록), paymentMethodUrl = 그 구독의 결제수단 변경 딥 링크 */
export interface PortalLinks {
  redirectUrl: string
  paymentMethodUrl?: string
}

/**
 * 계약 BillingPort + 계약에 아직 없는 것(web-factory 에 선택 칸·메서드를 요청함 — 대장 D110):
 * portal()(D75), subscription 결과의 graceEndsAt(D57).
 */
export interface LaunchBillingPort extends BillingPort {
  subscription(): Promise<ActionResult<LaunchSubscription>>
  portal(): Promise<BillingResult<PortalLinks>>
}

/** 살아 있는 구독(한 사용자는 동시에 하나) */
export const LIVE_STATUSES = ["trialing", "active", "past_due", "paused"] as const

/** provider 기본값은 paddle. 대비 어댑터(billing-gumroad)가 같은 표를 자기 provider 로 읽는다 */
export async function liveRowOf(db: Database, userId: string, provider: string = PROVIDER): Promise<SubscriptionRow | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.provider, provider)))
    .orderBy(desc(subscriptions.updatedFromEventAt))
  return rows.find((r) => (LIVE_STATUSES as readonly string[]).includes(r.status)) ?? rows[0] ?? null
}
const isLive = (r: SubscriptionRow | null): r is SubscriptionRow => !!r && (LIVE_STATUSES as readonly string[]).includes(r.status)

const MONTH_MS = 30 * 24 * 3600 * 1000
function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + months)
  return x
}

export interface SchedulePriceChangeInput {
  providerSubId: string
  /** 새 Paddle 가격 id — 같은 요금제의 priceId 또는 otherPriceIds 에 있어야 한다 */
  priceId: string
  kind: PendingPriceChange["kind"]
  from: PendingPriceChange["from"]
  to: PendingPriceChange["to"]
  consentBy: string
}

export function paddleBilling(config: PaddleBillingConfig) {
  validateBillingConfig(config.plans, config.retentionOffers ?? [])
  const paddle = config.paddle ?? createPaddleClient({ apiKey: config.apiKey ?? "", env: config.env, vars: config.vars })
  if (config.paddle && config.env === "production" && (config.vars ?? process.env).LF_PADDLE_LIVE !== "1") {
    // 주입한 클라이언트여도 production 선언은 같은 규칙을 따른다
    createPaddleClient({ apiKey: "x", env: "production", vars: config.vars })
  }
  const now = config.now ?? (() => new Date())
  const deps: SyncDeps = { db: config.db, paddle, plans: config.plans, mail: config.mail, pastDueGraceMs: config.pastDueGraceMs, log: config.log }
  const offers = config.retentionOffers ?? []
  const scheduleOptions: ScheduleOptions = { ...SCHEDULE_DEFAULTS, ...config.schedule }
  const graceMs = config.pastDueGraceMs ?? PAST_DUE_GRACE_MS

  /** Paddle 호출을 감싼다: SDK 오류는 code 와 함께 실패 결과로 */
  async function guard<T>(body: () => Promise<BillingResult<T>>): Promise<BillingResult<T>> {
    try {
      return await body()
    } catch (e) {
      const err = paddleErrorOf(e)
      config.log?.(`[billing-paddle] ${err.code}`)
      return fail(err.code, err.detail, err.retryable)
    }
  }

  async function saved(entity: PaddleSubscription): Promise<BillingResult<Subscription>> {
    return ok(toContract(await storeEntity(deps, entity), graceMs))
  }

  /** custom_data 를 합쳐 PATCH 한다(PATCH 는 custom_data 를 통째로 바꾼다) */
  async function patchCustomData(subId: string, change: (cd: CustomData) => CustomData, extra: Record<string, unknown> = {}): Promise<PaddleSubscription> {
    const current = await paddle.subscriptions.get(subId)
    return paddle.subscriptions.update(subId, { ...extra, customData: change(customDataOf(current)) })
  }

  function port(session: BillingSession): LaunchBillingPort {
    const live = async () => {
      const row = await liveRowOf(config.db, session.userId)
      return isLive(row) ? row : null
    }
    const noSub = () => fail("no_subscription", "There is no active subscription.")

    const billing = {
      async plans(): Promise<ActionResult<ReturnType<typeof contractPlans>>> {
        return ok(contractPlans(config.plans))
      },

      async subscription(): Promise<ActionResult<LaunchSubscription>> {
        try {
          return ok(toContract(await liveRowOf(config.db, session.userId), graceMs))
        } catch {
          return fail("read_failed", "Could not load the subscription. Try again.", true)
        }
      },

      async checkout({ planId, trial }: { planId: string; trial?: boolean }) {
        const plan = planById(config.plans, planId)
        if (!plan) return fail("unknown_plan", `Unknown plan ${planId}.`)
        const hasTrial = (plan.trialDays ?? 0) > 0
        // P3-2 10c: 체험 없는 요금제에 trial: true → 결제창을 열지 않고 끝낸다
        if (trial === true && !hasTrial) return fail("trial_unavailable", `${plan.name} has no free trial.`)
        const withTrial = trial ?? hasTrial
        const priceId = withTrial ? (plan.paddle.trialPriceId as string) : plan.paddle.priceId
        return guard(async () => {
          if (await live()) return fail("already_subscribed", "You already have a subscription. Change plan instead.")
          const customData: CustomData = { [CD.userId]: session.userId, ...(session.orgId ? { [CD.orgId]: session.orgId } : {}) }
          const txn = await paddle.transactions.create({ items: [{ priceId, quantity: 1 }], customData })
          const url = txn.checkout?.url
          if (!url) return fail("checkout_url_missing", "Checkout is not available. Set a default payment link in Paddle.")
          return ok({ redirectUrl: url })
        })
      },

      async changePlan({ planId, when }: { planId: string; when: "now" | "period_end" }) {
        const plan = planById(config.plans, planId)
        if (!plan) return fail("unknown_plan", `Unknown plan ${planId}.`)
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          if (row.planId === planId) {
            // 지금 요금제로 되돌리면 예약만 거둔다
            if (!row.scheduledPlanId) return fail("same_plan", "You are already on this plan.")
            return saved(await patchCustomData(row.providerSubId, (cd) => omit(cd, CD.scheduledPlanId)))
          }
          if (when === "period_end") {
            // Paddle 은 항목 변경을 예약할 수 없다 → custom_data 에 적고 Cron 이 기간 끝 전에 바꾼다(scheduledPlanId)
            const entity = await patchCustomData(row.providerSubId, (cd) => ({ ...cd, [CD.scheduledPlanId]: planId }))
            return saved(entity)
          }
          const entity = await patchCustomData(
            row.providerSubId,
            (cd) => omit(cd, CD.scheduledPlanId),
            { items: [{ priceId: plan.paddle.priceId, quantity: 1 }], prorationBillingMode: config.prorationNow ?? "prorated_immediately" },
          )
          return saved(entity)
        })
      },

      async cancel({ when }: { reason?: string; detail?: string; when: "period_end" | "now" }) {
        // reason·detail 은 Paddle 에 보내지 않는다(detail 은 개인정보가 섞일 수 있다 — 계약 주석)
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          if (when === "now") return saved(await paddle.subscriptions.cancel(row.providerSubId, { effectiveFrom: "immediately" }))
          if (row.status === "paused") {
            // 일시정지 중인 구독은 Paddle 이 즉시 해지를 기본으로 한다(cancel-subscription 문서). 「기간 끝」은 재개 예정 시각에 해지하도록 예약을 바꾼다.
            const at = row.pausedUntil ?? row.currentPeriodEnd
            if (!at) return saved(await paddle.subscriptions.cancel(row.providerSubId, { effectiveFrom: "immediately" }))
            return saved(await paddle.subscriptions.update(row.providerSubId, { scheduledChange: { action: "cancel", effectiveAt: at.toISOString() } }))
          }
          return saved(await paddle.subscriptions.cancel(row.providerSubId, { effectiveFrom: "next_billing_period" }))
        })
      },

      async pause({ until }: { until: string }) {
        const at = Date.parse(until)
        if (!Number.isFinite(at) || at <= now().getTime()) return fail("invalid_date", "Pick a resume date in the future.")
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          if (row.cancelAt) await paddle.subscriptions.update(row.providerSubId, { scheduledChange: null })
          return saved(await paddle.subscriptions.pause(row.providerSubId, { effectiveFrom: "immediately", resumeAt: new Date(at).toISOString() }))
        })
      },

      async resume() {
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          if (row.status === "paused") return saved(await paddle.subscriptions.resume(row.providerSubId, { effectiveFrom: "immediately" }))
          if (row.cancelAt) return saved(await paddle.subscriptions.update(row.providerSubId, { scheduledChange: null }))
          return fail("nothing_to_resume", "The subscription is not paused or scheduled to cancel.")
        })
      },

      async updatePaymentMethod() {
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          const txn = await paddle.subscriptions.getPaymentMethodChangeTransaction(row.providerSubId)
          const url = txn.checkout?.url
          return url ? ok({ redirectUrl: url }) : fail("checkout_url_missing", "Payment method update is not available right now.", true)
        })
      },

      /**
       * D75 결제 포털: Paddle POST /customers/{customer_id}/portal-sessions — 인증된 링크라 손님이 다시 로그인하지 않는다
       * (https://developer.paddle.com/build/customers/integrate-customer-portal.md). 링크는 캐시하지 않고 누를 때마다 만든다.
       * 대상은 세션 사용자의 구독뿐이다 — 입력으로 구독·고객 id 를 받지 않고, Paddle custom_data 의 사용자도 한 번 더 맞춰 본다.
       * 해지된 구독도 청구서를 볼 수 있게 가장 최근 행을 쓴다.
       */
      async portal() {
        return guard(async () => {
          const row = await liveRowOf(config.db, session.userId)
          if (!row || row.userId !== session.userId) return noSub()
          const entity = await paddle.subscriptions.get(row.providerSubId)
          const owner = customDataOf(entity)[CD.userId]
          if (typeof owner === "string" && owner !== session.userId) {
            config.log?.("[billing-paddle] portal owner mismatch")
            return fail("not_owner", "There is no subscription for this account.")
          }
          if (!entity.customerId) return fail("no_customer", "The billing portal is not available for this subscription.")
          const ps = await paddle.customerPortalSessions.create(entity.customerId, [entity.id])
          const deep = ps.urls.subscriptions.find((s) => s.id === entity.id)?.updateSubscriptionPaymentMethod
          return ok({ redirectUrl: ps.urls.general.overview, ...(deep ? { paymentMethodUrl: deep } : {}) })
        })
      },

      async acceptPriceChange() {
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          const entity = await paddle.subscriptions.get(row.providerSubId)
          const cd = customDataOf(entity)
          const pending = pendingOf(cd)
          if (!pending) return fail("nothing_to_accept", "There is no price change to accept.")
          if (now().getTime() > Date.parse(pending.consentBy)) return fail("consent_window_closed", "The consent deadline has passed.")
          const rest = omit(cd, CD.pendingPriceChange)
          const accepted = { priceId: pending.priceId, effectiveAt: pending.effectiveAt, acceptedAt: now().toISOString() }
          return saved(await paddle.subscriptions.update(row.providerSubId, { customData: { ...rest, [CD.acceptedPriceChange]: accepted } }))
        })
      },

      async applyRetentionOffer({ offerId }: { offerId: string }) {
        const offer = offers.find((o) => o.id === offerId)
        if (!offer) return fail("unknown_offer", "This offer is not available.")
        if (retentionOfferIssues(offer).length) return fail("offer_over_limit", "This offer is not available.")
        return guard(async () => {
          const row = await live()
          if (!row) return noSub()
          const subId = row.providerSubId
          if (offer.kind === "pause") {
            if (row.cancelAt) await paddle.subscriptions.update(subId, { scheduledChange: null })
            const until = addMonths(now(), offer.pauseMonths as number)
            return saved(await paddle.subscriptions.pause(subId, { effectiveFrom: "immediately", resumeAt: until.toISOString() }))
          }
          if (offer.kind === "downgrade") {
            const target = offer.planId as string
            const entity = await patchCustomData(subId, (cd) => ({ ...cd, [CD.scheduledPlanId]: target }), row.cancelAt ? { scheduledChange: null } : {})
            return saved(entity)
          }
          // discount: 월 요금제만(Paddle 의 반복 횟수는 청구 주기 단위다 — maximum_recurring_intervals)
          const plan = planById(config.plans, row.planId)
          const d = offer.discount as { percent: number; months: number }
          if (plan?.interval !== "month") return fail("offer_unsupported", "This offer is only available on monthly plans.")
          const discount = await paddle.discounts.create({
            amount: String(d.percent),
            type: "percentage",
            description: `Retention offer ${offer.id}: ${d.percent}% for ${d.months} months`,
            enabledForCheckout: false,
            recur: true,
            maximumRecurringIntervals: d.months,
          })
          return saved(await paddle.subscriptions.update(subId, { discount: { id: discount.id, effectiveFrom: "next_billing_period" }, scheduledChange: null }))
        })
      },
    }
    return billing satisfies LaunchBillingPort
  }

  /**
   * 가격 변경을 알린다(관리 작업 — 블록이 부르지 않는다). 전자상거래법 제13조제6항·시행령 제20조의2: 증액·유료 전환 **전 30일 안에**
   * 일시·전후 가격·결제방법에 동의를 받고 취소·해지 방법을 알린다. 그래서 적용일이 30일보다 멀면 지금 알리지 않는다(outside_consent_window).
   * 적용일은 다음 청구일이어야 한다. 동의 기한은 Cron 이 새 가격으로 바꿀 여유(leadTime)를 남긴다.
   */
  async function schedulePriceChange(input: SchedulePriceChangeInput): Promise<BillingResult<Subscription>> {
    return guard(async () => {
      const rows = await config.db.select().from(subscriptions).where(and(eq(subscriptions.provider, PROVIDER), eq(subscriptions.providerSubId, input.providerSubId)))
      const row = rows[0]
      if (!isLive(row ?? null) || !row) return fail("no_subscription", "No live subscription.")
      const plan = planById(config.plans, row.planId)
      if (!plan || (plan.paddle.priceId !== input.priceId && !plan.paddle.otherPriceIds?.includes(input.priceId))) return fail("unknown_price", "The new price does not belong to this plan.")
      const effective = row.currentPeriodEnd
      if (!effective) return fail("no_billing_date", "The subscription has no next billing date.")
      const t = now().getTime()
      if (effective.getTime() - t > MONTH_MS) return fail("outside_consent_window", "Ask for consent within 30 days before the new price applies.")
      const consentBy = Date.parse(input.consentBy)
      if (!Number.isFinite(consentBy) || consentBy <= t || consentBy > effective.getTime() - scheduleOptions.leadTimeMs) {
        return fail("invalid_consent_deadline", "The consent deadline must be in the future and before the switch window.")
      }
      if (input.from.currency !== input.to.currency) return fail("currency_mismatch", "Old and new prices must use the same currency.")
      const change: StoredPriceChange = {
        priceId: input.priceId,
        kind: input.kind,
        from: input.from,
        to: input.to,
        effectiveAt: effective.toISOString(),
        consentBy: new Date(consentBy).toISOString(),
      }
      const entity = await patchCustomData(row.providerSubId, (cd) => {
        return { ...omit(cd, CD.acceptedPriceChange), [CD.pendingPriceChange]: change }
      })
      return saved(entity)
    })
  }

  return {
    port,
    plans: config.plans,
    /** Next 경로 처리기: `export const POST = (req: Request) => billing.handleWebhook(req)` */
    handleWebhook: (req: Request) => handlePaddleWebhook(req, { ...deps, webhookSecret: config.webhookSecret ?? "" }),
    /** Vercel Cron 경로에서 부른다(schedule.ts) */
    runScheduledChanges: (at: Date = now()): Promise<ScheduleReport> => runScheduledChanges(deps, at, scheduleOptions),
    schedulePriceChange,
    /** 테스트·관리용: 공급자 상태를 다시 읽어 저장한다 */
    resync: async (providerSubId: string) => toContract(await storeEntity(deps, await paddle.subscriptions.get(providerSubId))),
  }
}

export type PaddleBilling = ReturnType<typeof paddleBilling>
