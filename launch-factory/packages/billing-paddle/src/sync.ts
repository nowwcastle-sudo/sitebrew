// 상태 동기화: Paddle 이 준 구독 엔터티를 DB 에 저장하고, 상태가 바뀐 곳에서 보낼 메일을 고른다.
// 웹훅(재조회 결과)과 어댑터(PATCH·POST 응답 — Paddle 이 돌려준 갱신된 엔터티)가 같은 함수를 부른다.
// 메일은 트랜잭션이 커밋된 뒤 보낸다(sendNotices). 되돌려진 처리에서 메일이 나가지 않게 하려는 것이다. 재시도·동시 처리로 같은 메일이
// 두 번 나가지 않게 멱등 키를 싣는다(Resend Idempotency-Key — 대장 D36 형식 `price-change:<구독>:<consentBy>`).
import { eq } from "drizzle-orm"
import { applySubscriptionState, subscriptions, user, type Database } from "@launch-factory/db"
import { isTimeZone, LOCALES, type Locale, type Mailer, type SendResult } from "@launch-factory/email"
import type { Subscription as PaddleSubscription } from "@paddle/paddle-node-sdk"
import { PAST_DUE_GRACE_MS, paymentReason, PROVIDER, stateFromPaddle, type PaymentIssue, type SubscriptionRow } from "./map.ts"
import type { PaddleClient } from "./paddle.ts"
import { planById, type PaddlePlan } from "./plans.ts"

export interface MailConfig {
  mailer: Mailer
  /** 받는 사람의 언어 칸(user.locale — D74)이 비었을 때 쓰는 언어 */
  locale: Locale
  /**
   * 영수증(주문 확인)·해지 확인 메일을 우리가 보낼지. 기본 false(대장 D93 — 운영자 판정 2026-09-30 02:46): Paddle 은 판매자(MoR)로서
   * 영수증·결제 실패·해지 메일을 직접 보낸다. 우리가 또 보내면 같은 메일이 두 통이다. 스스로 메일을 보내지 않는 공급자(예: 토스, v0.2)만 켠다.
   * 가격 변경 동의 요청(L6)은 이 값과 상관없이 보낸다 — Paddle 안내에는 법이 요구하는 동의·거절 링크를 실을 수 없다.
   */
  sendBillingEmails?: boolean
  /**
   * 결제 실패 안내 메일(F11)을 우리가 보낼지. 기본 true — 구독이 past_due 가 될 때 한 번(재시도 날짜 알면·이용 가능한 마지막 날·카드 변경 링크).
   * Paddle Retain(Payment recovery 메일)을 live 에서 켰으면 같은 안내가 두 통이 되므로 false 로 끈다(템플릿: LF_PAYMENT_FAILED_EMAIL=off).
   * 결제 실패 메일은 sendBillingEmails 와 별개다 — 영수증·해지는 Paddle 이 보내 기본 끔이지만, 이 안내는 Retain 을 켜지 않으면 아무도 보내지 않는다.
   */
  sendPaymentFailedEmails?: boolean
  productName: string
  urls: {
    /** 구독 관리 화면(주문 확인 메일) */
    manage: string
    /** 가격 변경 동의 화면(acceptPriceChange 를 부르는 곳) */
    acceptPriceChange: string
    /** 거절 = 해지 화면(cancel 을 부르는 곳) */
    decline: string
    /** 다시 구독(선택) */
    resubscribe?: string
    /** 결제 수단을 바꾸는 우리 화면(결제 실패 안내의 링크). 없으면 manage 를 쓴다 — 결제 대행사 포털 링크는 임시 토큰이라 메일에 싣지 않는다 */
    updatePaymentMethod?: string
  }
}

/** 환경 설정값(LF_PAYMENT_FAILED_EMAIL) → 결제 실패 안내를 보낼지. 기본 켜짐 — off·0·false·no(대소문자 무시)만 끈다. Retain 을 켠 live 에서 중복을 막는 스위치다 */
export function paymentFailedEmailsEnabled(flag: string | undefined | null): boolean {
  return !/^(off|0|false|no)$/i.test((flag ?? "").trim())
}

export interface SyncDeps {
  db: Database
  paddle: PaddleClient
  plans: readonly PaddlePlan[]
  mail?: MailConfig
  /** past_due 유예(ms, D57). 결제 실패 안내의 「이용 가능한 마지막 날」을 센다. 기본 7일 */
  pastDueGraceMs?: number
  /** 운영 로그(개인정보 없는 한 줄). 기본은 아무것도 하지 않는다 */
  log?: (line: string) => void
}

/** 받는 사람(사용자 행). locale·timeZone 은 D74 칸 — 요청 머리가 없는 웹훅·Cron 메일이 이것으로 언어·시각을 고른다 */
export interface Recipient {
  to: string
  locale?: Locale
  timeZone?: string
}

export type Notice = (
  | { kind: "cancellation"; to: string; subId: string; key: string; accessUntil?: string }
  | { kind: "paymentFailed"; to: string; subId: string; key: string; accessUntil: string; retryAt?: string }
  | { kind: "priceChange"; to: string; subId: string; key: string; planName: string; change: NonNullable<SubscriptionRow["pendingPriceChange"]> }
  | { kind: "orderConfirmation"; to: string; subId: string; key: string; orderId: string; planName: string; amount: { amount: number; currency: "KRW" | "USD" | "EUR" | "JPY"; vatIncluded: boolean }; orderedAt: string }
) & { locale?: Locale; timeZone?: string }

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]

export interface ApplyResult {
  applied: boolean
  /** custom_data 에 사용자 id 가 없고 저장된 행도 없다 — 저장하지 않았다 */
  unlinked?: boolean
  notices: Notice[]
}

/** past_due 면 가장 최근 past_due 거래의 결제 실패 코드로 사유를 만든다(구독 엔터티에는 사유가 없다) */
export async function paymentIssueOf(paddle: PaddleClient, entity: PaddleSubscription): Promise<PaymentIssue | null> {
  if (entity.status !== "past_due") return null
  const page = await paddle.transactions.list({ subscriptionId: [entity.id], status: ["past_due"], orderBy: "created_at[DESC]", perPage: 5 }).next()
  const payments = page.flatMap((t) => t.payments ?? [])
  payments.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const failed = payments.find((p) => p.errorCode)
  return { reason: paymentReason(failed?.errorCode) }
}

export async function currentRow(tx: Tx | Database, providerSubId: string): Promise<SubscriptionRow | null> {
  const rows = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.providerSubId, providerSubId))
    .for("update")
  return rows.find((r) => r.provider === PROVIDER) ?? null
}

export async function emailOf(tx: Tx, userId: string): Promise<string | null> {
  return (await recipientOf(tx, userId))?.to ?? null
}

export async function recipientOf(tx: Tx | Database, userId: string): Promise<Recipient | null> {
  const rows = await tx.select({ email: user.email, locale: user.locale, timeZone: user.timeZone }).from(user).where(eq(user.id, userId))
  const r = rows[0]
  if (!r?.email) return null
  const locale = LOCALES.find((l) => l === r.locale)
  return { to: r.email, ...(locale ? { locale } : {}), ...(isTimeZone(r.timeZone) ? { timeZone: r.timeZone } : {}) }
}

const cancelled = (r: { cancelAt: Date | null; status: string } | null | undefined) => !!r && (r.cancelAt !== null || r.status === "canceled")

/**
 * 한 트랜잭션 안에서 부른다. 저장된 행을 잠그고(FOR UPDATE) 새 상태를 쓴 뒤(순서 보호는 applySubscriptionState 의 한 문장),
 * 반영됐으면 이전 행과 비교해 보낼 메일을 돌려준다.
 */
export async function applyPaddleSubscription(
  tx: Tx,
  deps: SyncDeps,
  entity: PaddleSubscription,
  key: Date,
  paymentIssue?: PaymentIssue | null,
  /** past_due 가 이 상태로 시작됐다면 그 시각(웹훅은 이벤트 occurred_at — D57). 이미 past_due 였으면 DB 가 처음 값을 지킨다 */
  pastDueSince?: Date,
): Promise<ApplyResult> {
  const prev = await currentRow(tx, entity.id)
  const state = stateFromPaddle(entity, { plans: deps.plans, key, fallbackUserId: prev?.userId, paymentIssue })
  if (!state) return { applied: false, unlinked: true, notices: [] }
  if (pastDueSince) state.pastDueSince = pastDueSince
  const { applied } = await applySubscriptionState(tx as unknown as Database, state)
  if (!applied || !deps.mail) return { applied, notices: [] }

  const notices: Notice[] = []
  const who = await recipientOf(tx, state.userId)
  if (!who) return { applied, notices }
  const { to, ...lang } = who
  // 해지: 해지 예약이나 해지가 「처음」 나타날 때 한 번(예약된 해지가 나중에 실행될 때는 다시 보내지 않는다). Paddle 이 보내므로 기본은 끔(D93)
  if (deps.mail.sendBillingEmails === true && cancelled(state as { cancelAt: Date | null; status: string }) && !cancelled(prev)) {
    const cancelAt = state.cancelAt ?? null
    const ended = state.status === "canceled"
    notices.push({
      kind: "cancellation",
      to,
      ...lang,
      subId: entity.id,
      key: `cancellation:${entity.id}:${cancelAt ? cancelAt.toISOString() : "now"}`,
      ...(!ended && cancelAt ? { accessUntil: cancelAt.toISOString() } : {}),
    })
  }
  // 결제 실패 안내(F11): 구독이 past_due 로 「들어갈」 때 한 번. 이미 past_due 인 행에 뒤따르는 이벤트(transaction.payment_failed·재시도 실패)는 보내지 않는다 —
  // 한 번의 실패에 subscription.past_due 와 transaction.payment_failed 가 함께 와도 한 통이다. 멱등 키는 past_due 시작 시각(새 실패 주기마다 새 키).
  if (deps.mail.sendPaymentFailedEmails !== false && state.status === "past_due" && prev?.status !== "past_due") {
    const since = pastDueSince ?? key
    const retryAt = (state.paymentIssue as { retryAt?: string } | null | undefined)?.retryAt
    notices.push({
      kind: "paymentFailed",
      to,
      ...lang,
      subId: entity.id,
      key: `payment-failed:${entity.id}:${since.toISOString()}`,
      accessUntil: new Date(since.getTime() + Math.max(0, deps.pastDueGraceMs ?? PAST_DUE_GRACE_MS)).toISOString(),
      ...(retryAt ? { retryAt } : {}),
    })
  }
  // 가격 변경 안내(L6·전자상거래법 제13조제6항): 새 가격 변경이 나타날 때 한 번. 30일 창은 schedulePriceChange 가 지킨다
  const change = state.pendingPriceChange
  if (change && change.consentBy !== prev?.pendingPriceChange?.consentBy) {
    notices.push({
      kind: "priceChange",
      to,
      ...lang,
      subId: entity.id,
      key: `price-change:${entity.id}:${change.consentBy}`,
      planName: planById(deps.plans, state.planId)?.name ?? state.planId,
      change,
    })
  }
  return { applied, notices }
}

/** 커밋 뒤 메일 보내기. 실패는 던지지 않고 결과로 돌려준다(상태 동기화는 이미 끝났다) */
export async function sendNotices(deps: Pick<SyncDeps, "mail" | "log">, notices: readonly Notice[]): Promise<{ key: string; result: SendResult | { ok: false; error: { name: string; message: string } } }[]> {
  const mail = deps.mail
  if (!mail || notices.length === 0) return []
  const out = []
  for (const n of notices) {
    // D74: 받는 사람의 언어·시간대(없으면 설정 기본 언어, 시간대는 언어 기본)
    const base = { locale: n.locale ?? mail.locale, productName: mail.productName, ...(n.timeZone ? { timeZone: n.timeZone } : {}) }
    let result
    try {
      if (n.kind === "cancellation") {
        result = await mail.mailer.send({
          to: n.to,
          template: "cancellation",
          idempotencyKey: n.key,
          input: { ...base, ...(n.accessUntil ? { accessUntil: n.accessUntil } : {}), ...(mail.urls.resubscribe ? { resubscribeUrl: mail.urls.resubscribe } : {}) },
        })
      } else if (n.kind === "paymentFailed") {
        result = await mail.mailer.send({
          to: n.to,
          template: "paymentFailed",
          idempotencyKey: n.key,
          input: { ...base, updateUrl: mail.urls.updatePaymentMethod ?? mail.urls.manage, accessUntil: n.accessUntil, ...(n.retryAt ? { retryAt: n.retryAt } : {}) },
        })
      } else if (n.kind === "priceChange") {
        result = await mail.mailer.send({
          to: n.to,
          template: "priceChange",
          idempotencyKey: n.key,
          input: { ...base, planName: n.planName, change: n.change, acceptUrl: mail.urls.acceptPriceChange, declineUrl: mail.urls.decline },
        })
      } else {
        result = await mail.mailer.send({
          to: n.to,
          template: "orderConfirmation",
          idempotencyKey: n.key,
          input: { ...base, orderId: n.orderId, planName: n.planName, amount: n.amount, orderedAt: n.orderedAt, manageUrl: mail.urls.manage },
        })
      }
    } catch (e) {
      result = { ok: false as const, error: { name: e instanceof Error ? e.name : "error", message: e instanceof Error ? e.message : String(e) } }
    }
    if (!result.ok) deps.log?.(`[billing-paddle] email ${n.kind} failed for ${n.subId}: ${result.error.name}`)
    out.push({ key: n.key, result })
  }
  return out
}

/**
 * 어댑터 경로: Paddle 이 돌려준 갱신된 엔터티를 저장한다(순서 시각 = 엔터티 updated_at). 저장 뒤 메일을 보내고 DB 행을 돌려준다.
 * 웹훅이 먼저 더 새 상태를 저장했으면 이 쓰기는 버려지고 더 새 행이 돌아온다.
 */
export async function storeEntity(deps: SyncDeps, entity: PaddleSubscription): Promise<SubscriptionRow | null> {
  const issue = await paymentIssueOf(deps.paddle, entity)
  const { notices } = await deps.db.transaction((tx) => applyPaddleSubscription(tx, deps, entity, new Date(entity.updatedAt), issue))
  await sendNotices(deps, notices)
  const rows = await deps.db.select().from(subscriptions).where(eq(subscriptions.providerSubId, entity.id))
  return rows.find((r) => r.provider === PROVIDER) ?? null
}
