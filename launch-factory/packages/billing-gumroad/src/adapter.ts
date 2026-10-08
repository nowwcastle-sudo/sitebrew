// Gumroad BillingPort 대비 어댑터(계약 판 2). Paddle 이 승인되지 않으면 쓴다(운영자 판정 2026-09-26 「미승인 시 Gumroad」).
// 읽기(subscription)는 DB(알림·재조회가 동기화한 행), 결제는 호스팅 상품 링크다.
//
// Gumroad 공개 API(https://gumroad.com/api, 2026-09-30 라이브 번들에서 엔드포인트 목록 전체 확인)에는 구독을 바꾸는 쓰기가 없다 —
// 구독은 GET /products/:product_id/subscribers · GET /subscribers/:id 두 읽기뿐이다. 해지·재시작·등급 변경·결제수단 변경은 손님이
// Gumroad 「Manage membership」 화면에서 한다(https://gumroad.com/help/article/278-guide-to-memberships, …/192-how-do-i-cancel-my-membership).
// 일시정지와 가격 변경 동의는 Gumroad 에 없다(가격 인상은 Gumroad 가 기존 손님에게 7일 전 안내 메일만 보낸다 — …/82-membership-products).
// 그래서 그 메서드는 흉내 내지 않고 계약 실패 { ok: false, code: "provider_unsupported" } 로 끝낸다. manageUrl 을 설정하면 실패에 실어
// 블록이 손님을 그 화면으로 보낼 수 있게 한다(계약에는 아직 그 칸이 없다 — 대장 D160).
import type { ActionResult, BillingPort, Plan, RetentionOffer, Subscription } from "@launch-factory/contract"
import { subscriptions, type Database } from "@launch-factory/db"
import { and, eq, inArray } from "drizzle-orm"
import { contractPlans, LIVE_STATUSES, liveRowOf, PAST_DUE_GRACE_MS, sendNotices, toContract, type BillingFailure, type BillingResult, type LaunchSubscription, type MailConfig } from "@launch-factory/billing-paddle"
import { createGumroadClient, type GumroadClient } from "./gumroad.ts"
import { PROVIDER } from "./map.ts"
import { applyGumroadSubscription, handleGumroadPing, type PingDeps } from "./ping.ts"
import { planById, validateGumroadConfig, type GumroadPlan } from "./plans.ts"
import { signRef, REF_PARAM } from "./ref.ts"

/** 공급자가 API 로 할 수 없는 동작(계약에 「지원 안 함」 갈래를 요청함 — 대장 D160) */
export const PROVIDER_UNSUPPORTED = "provider_unsupported"

/** API 가 없어 provider_unsupported 로 끝나는 포트 메서드 */
export const UNSUPPORTED_METHODS = ["changePlan", "cancel", "pause", "resume", "updatePaymentMethod", "acceptPriceChange", "applyRetentionOffer"] as const

export type GumroadFailure = BillingFailure & { manageUrl?: string }

export interface GumroadSession {
  userId: string
  orgId?: string
  /** 있으면 결제 폼 이메일을 미리 채운다(?email= — https://gumroad.com/help/article/270-url-parameters) */
  email?: string
}

export interface GumroadBillingConfig {
  db: Database
  plans: readonly GumroadPlan[]
  accessToken?: string
  /** 알림 주소 ?key= 공유 비밀이자 lf_ref 서명 키(GUMROAD_PING_SECRET) */
  pingSecret?: string
  /** 테스트·다른 구성 주입용. 주면 accessToken 으로 만들지 않는다 */
  gumroad?: GumroadClient
  retentionOffers?: readonly RetentionOffer[]
  mail?: MailConfig
  /** 손님이 해지·재시작·등급 변경을 하는 곳(예: Gumroad 라이브러리). 주면 provider_unsupported 실패에 싣는다 */
  manageUrl?: string
  now?: () => Date
  log?: (line: string) => void
  /** past_due 유예(ms, 대장 D57). 기본 7일 */
  pastDueGraceMs?: number
}

const ok = <T>(data: T): BillingResult<T> => ({ ok: true, data })
const fail = (code: string, formError: string, retryable = false): BillingFailure => ({ ok: false, code, formError, ...(retryable ? { retryable } : {}) })

export function gumroadBilling(config: GumroadBillingConfig) {
  validateGumroadConfig(config.plans, config.retentionOffers ?? [])
  const gumroad = config.gumroad ?? createGumroadClient({ accessToken: config.accessToken ?? "" })
  const now = config.now ?? (() => new Date())
  const graceMs = config.pastDueGraceMs ?? PAST_DUE_GRACE_MS
  const deps: PingDeps = { db: config.db, gumroad, plans: config.plans, pingSecret: config.pingSecret ?? "", mail: config.mail, log: config.log, now }
  const offers = config.retentionOffers ?? []

  const unsupported = (what: string): GumroadFailure => ({
    ...fail(PROVIDER_UNSUPPORTED, `${what} is managed on Gumroad's "Manage membership" page, not here.`),
    ...(config.manageUrl ? { manageUrl: config.manageUrl } : {}),
  })

  function port(session: GumroadSession) {
    const billing = {
      async plans(): Promise<ActionResult<Plan[]>> {
        return ok(contractPlans(config.plans))
      },

      async subscription(): Promise<ActionResult<LaunchSubscription>> {
        try {
          return ok(toContract(await liveRowOf(config.db, session.userId, PROVIDER), graceMs))
        } catch {
          return fail("read_failed", "Could not load the subscription. Try again.", true)
        }
      },

      /**
       * 호스팅 상품 링크(https://<판매자>.gumroad.com/l/<permalink>)에 붙이는 것(https://gumroad.com/help/article/270-url-parameters):
       * ?wanted=true(바로 결제 폼), ?monthly=true|?yearly=true(결제 주기), ?email=(미리 채움), 그리고 lf_ref(서명된 사용자 연결 — 판매 알림 url_params 로 돌아온다).
       * 새 구독은 판매 알림으로 들어온다. 체험을 끄려면 체험 없는 상품으로 보낸다(Gumroad 체험은 상품 설정이다).
       */
      async checkout({ planId, trial }: { planId: string; trial?: boolean }) {
        const plan = planById(config.plans, planId)
        if (!plan) return fail("unknown_plan", `Unknown plan ${planId}.`)
        const hasTrial = (plan.trialDays ?? 0) > 0
        if (trial === true && !hasTrial) return fail("trial_unavailable", `${plan.name} has no free trial.`)
        if (!config.pingSecret) return fail("checkout_unavailable", "Checkout is not configured.")
        const live = await liveRowOf(config.db, session.userId, PROVIDER)
        if (live && (LIVE_STATUSES as readonly string[]).includes(live.status)) return fail("already_subscribed", "You already have a subscription.")
        const url = new URL((trial ?? hasTrial) ? (plan.gumroad.trialUrl as string) : plan.gumroad.url)
        url.searchParams.set("wanted", "true")
        url.searchParams.set(plan.interval === "year" ? "yearly" : "monthly", "true")
        if (session.email) url.searchParams.set("email", session.email)
        url.searchParams.set(REF_PARAM, signRef(config.pingSecret, session.userId, now()))
        return ok({ redirectUrl: url.toString() })
      },

      async changePlan(input: { planId: string; when: "now" | "period_end" }): Promise<BillingResult<Subscription> | GumroadFailure> {
        void input
        return unsupported("Changing tiers")
      },
      async cancel(input: { reason?: string; detail?: string; when: "period_end" | "now" }): Promise<BillingResult<Subscription> | GumroadFailure> {
        void input
        return unsupported("Cancelling")
      },
      async pause(input: { until: string }): Promise<BillingResult<Subscription> | GumroadFailure> {
        void input
        return unsupported("Pausing")
      },
      async resume(): Promise<BillingResult<Subscription> | GumroadFailure> {
        return unsupported("Restarting")
      },
      async updatePaymentMethod(): Promise<BillingResult<{ redirectUrl: string }> | GumroadFailure> {
        return unsupported("Updating the payment method")
      },
      async acceptPriceChange(): Promise<BillingResult<Subscription> | GumroadFailure> {
        return unsupported("Price changes")
      },
      async applyRetentionOffer({ offerId }: { offerId: string }): Promise<BillingResult<Subscription> | GumroadFailure> {
        if (!offers.some((o) => o.id === offerId)) return fail("unknown_offer", "This offer is not available.")
        return unsupported("Retention offers")
      },
    }
    return billing satisfies BillingPort
  }

  /** 관리·정기 대조용: 구독 하나를 다시 읽어 저장한다(알림이 재전송까지 모두 실패했을 때 — 문서 「reconcile periodically」) */
  async function resync(providerSubId: string): Promise<LaunchSubscription | null> {
    const key = now()
    const sub = await gumroad.getSubscriber(providerSubId)
    const r = await config.db.transaction((tx) => applyGumroadSubscription(tx, deps, { sub, key }))
    await sendNotices(deps, r.notices)
    const rows = await config.db.select().from(subscriptions).where(and(eq(subscriptions.provider, PROVIDER), eq(subscriptions.providerSubId, providerSubId)))
    return rows[0] ? toContract(rows[0], graceMs) : null
  }

  /** 살아 있는 Gumroad 구독 행을 모두 다시 읽는다(Vercel Cron 에서). 연결 안 된 새 구독은 찾지 못한다 — 대장 D163 */
  async function reconcile(): Promise<{ checked: number; failed: number }> {
    const rows = await config.db
      .select({ id: subscriptions.providerSubId })
      .from(subscriptions)
      .where(and(eq(subscriptions.provider, PROVIDER), inArray(subscriptions.status, [...LIVE_STATUSES])))
    let failed = 0
    for (const r of rows) {
      try {
        await resync(r.id)
      } catch (e) {
        failed += 1
        config.log?.(`[billing-gumroad] reconcile ${r.id} failed: ${e instanceof Error ? e.name : "error"}`)
      }
    }
    return { checked: rows.length, failed }
  }

  return {
    port,
    plans: config.plans,
    /** Next 경로 처리기: `export const POST = (req: Request) => billing.handlePing(req)` */
    handlePing: (req: Request) => handleGumroadPing(req, deps),
    resync,
    reconcile,
  }
}

export type GumroadBilling = ReturnType<typeof gumroadBilling>
