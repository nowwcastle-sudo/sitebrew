// Gumroad 판매·구독 알림 처리기. 공식 문서(https://gumroad.com/ping, 2026-09-30)가 정한 전달 규칙에 맞춘다:
//   - 본문은 x-www-form-urlencoded 이고 **서명이 없다** → 「알림은 데이터가 아니라 신호로 다뤄라: sale_id 로 판매를 API 에서 다시 읽고,
//     주기적으로 우리 기록과 맞춰라」. 그래서 본문에서 믿는 것은 id 와 사용자 연결 표(서명된 lf_ref)뿐이고, 상태는 모두 API 재조회 결과다.
//   - 적어도 한 번 전달, 순서 보장 없음(환불 알림이 판매 알림보다 먼저 올 수 있다). 중복 제거는 sale_id 만이 아니라 sale_id + resource_name.
//   - 5초 안에 응답. 재전송은 499·500·502·503·504 일 때만 1분·3분·10분·1시간 뒤 네 번. 그 밖의 2xx 아닌 응답은 다시 보내지 않는다.
// 구독 알림(cancellation·subscription_updated·subscription_ended·subscription_restarted, https://gumroad.com/api#put-/resource_subscriptions)은
// sale_id 가 없고 subscription_id 와 그 사건 시각을 싣는다.
//
// 순서:
//   1. 공유 비밀: 알림 주소(post_url)의 ?key= 를 설정 비밀과 비교한다(서명이 없어서 계획 Task 6 이 정한 대체). 틀리면 401, DB 를 건드리지 않는다.
//   2. 한 트랜잭션: 이벤트 id 기록(중복이면 끝) → API 재조회(판매 → 구독) → 순서 시각이 저장값보다 새로울 때만 반영.
//      재조회가 알림을 확인하지 못하면(없는 판매·구독) 트랜잭션을 되돌려 이벤트 id 도 남기지 않는다 — 위조 알림이 진짜 알림의 id 를 미리 막지 못한다.
//   3. 커밋 뒤 메일. 영수증·해지 메일은 Gumroad 가 판매자(MoR)로서 보낸다 → 기본 끔(대장 D93과 같은 규칙).
import { createHash, timingSafeEqual } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { applySubscriptionState, recordWebhookEvent, subscriptions, type Database } from "@launch-factory/db"
import { recipientOf, sendNotices, type MailConfig, type Notice } from "@launch-factory/billing-paddle"
import { GumroadApiError, type GumroadClient, type GumroadSale, type GumroadSubscriber } from "./gumroad.ts"
import { PROVIDER, stateFromGumroad } from "./map.ts"
import { planById, planIdForProduct, type GumroadPlan } from "./plans.ts"
import { REF_PARAM, verifyRef } from "./ref.ts"

export interface PingDeps {
  db: Database
  gumroad: GumroadClient
  plans: readonly GumroadPlan[]
  /** 알림 주소 ?key= 의 공유 비밀(GUMROAD_PING_SECRET). lf_ref 서명 키로도 쓴다 */
  pingSecret: string
  mail?: MailConfig
  log?: (line: string) => void
  now?: () => Date
}

export const SALE_RESOURCES = new Set(["sale", "refund", "dispute", "dispute_won"])
export const SUBSCRIPTION_RESOURCES = new Set(["cancellation", "subscription_updated", "subscription_ended", "subscription_restarted"])
/** 구독 알림마다 그 사건의 시각 칸(중복 제거 키에 넣는다 — 같은 구독이 해지 → 재시작 → 다시 해지되면 서로 다른 사건이다) */
const EVENT_TIME_FIELD: Record<string, string> = {
  cancellation: "cancelled_at",
  subscription_updated: "effective_as_of",
  subscription_ended: "ended_at",
  subscription_restarted: "restarted_at",
}
export const MAX_PING_BYTES = 64 * 1024

export type PingOutcome =
  | { kind: "duplicate"; eventId: string }
  | { kind: "ignored"; eventId: string; reason: string }
  | { kind: "unlinked"; eventId: string; subscriptionId: string }
  | { kind: "processed"; eventId: string; subscriptionId: string; applied: boolean; emails: number }

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]

/** 재조회가 알림을 확인하지 못함. retry 면 503(Gumroad 가 다시 보낸다 — 막 만들어진 판매가 아직 안 보일 수 있다), 아니면 400 */
class Unverified extends Error {
  readonly retry: boolean
  constructor(message: string, retry: boolean) {
    super(message)
    this.name = "Unverified"
    this.retry = retry
  }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function sameSecret(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest()
  const y = createHash("sha256").update(b).digest()
  return timingSafeEqual(x, y) && a.length === b.length
}

/** 폼(key·url_params[key]) 또는 JSON 본문 → 값 읽기 */
function parsePing(raw: string, contentType: string): { get(k: string): string | null; urlParam(k: string): string | null } {
  if (contentType.includes("application/json")) {
    const body = JSON.parse(raw) as Record<string, unknown>
    const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : null)
    const up = body.url_params && typeof body.url_params === "object" ? (body.url_params as Record<string, unknown>) : {}
    return { get: (k) => s(body[k]), urlParam: (k) => s(up[k]) }
  }
  const form = new URLSearchParams(raw)
  return { get: (k) => form.get(k), urlParam: (k) => form.get(`url_params[${k}]`) }
}

async function currentRow(tx: Tx, providerSubId: string) {
  const rows = await tx
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, PROVIDER), eq(subscriptions.providerSubId, providerSubId)))
    .for("update")
  return rows[0] ?? null
}

const cancelled = (r: { cancelAt: Date | null; status: string } | null | undefined) => !!r && (r.cancelAt !== null || r.status === "canceled")

async function fetchOrUnverified<T>(what: string, body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch (e) {
    if (e instanceof GumroadApiError && e.code === "not_found") throw new Unverified(`${what} not found`, true)
    throw e
  }
}

type Currency = "KRW" | "USD" | "EUR" | "JPY"
const CURRENCIES = new Set(["KRW", "USD", "EUR", "JPY"])

export interface ApplyInput {
  sub: GumroadSubscriber
  /** 순서 시각: 이 구독을 읽기 시작한 때(재조회 상태는 적어도 이만큼 새롭다) */
  key: Date
  /** 새 구독의 사용자(서명 확인된 lf_ref). 저장된 행이 있으면 무시한다 — 처음 연결이 이긴다 */
  linkUserId?: string | null
  sale?: GumroadSale
}

/** 한 트랜잭션 안: 행 잠금 → 전체 상태 저장(순서 보호는 applySubscriptionState 의 한 문장) → 보낼 메일 */
export async function applyGumroadSubscription(tx: Tx, deps: PingDeps, input: ApplyInput): Promise<{ applied: boolean; unlinked?: boolean; ignored?: boolean; notices: Notice[] }> {
  const { sub, key } = input
  if (!planIdForProduct(deps.plans, sub.product_id)) return { applied: false, ignored: true, notices: [] }
  const prev = await currentRow(tx, sub.id)
  const userId = prev?.userId ?? input.linkUserId ?? null
  const now = (deps.now ?? (() => new Date()))()
  const state = stateFromGumroad(sub, { plans: deps.plans, key, now, userId })
  if (!state) return { applied: false, unlinked: true, notices: [] }
  const { applied } = await applySubscriptionState(tx as unknown as Database, state)
  const notices: Notice[] = []
  if (!applied || deps.mail?.sendBillingEmails !== true) return { applied, notices }
  const who = await recipientOf(tx, state.userId)
  if (!who) return { applied, notices }
  const { to, ...lang } = who
  if (cancelled(state as { cancelAt: Date | null; status: string }) && !cancelled(prev)) {
    const cancelAt = (state.cancelAt as Date | null) ?? null
    notices.push({
      kind: "cancellation",
      to,
      ...lang,
      subId: sub.id,
      key: `cancellation:${sub.id}:${cancelAt ? cancelAt.toISOString() : "now"}`,
      ...(state.status !== "canceled" && cancelAt ? { accessUntil: cancelAt.toISOString() } : {}),
    })
  }
  const sale = input.sale
  const currency = sale?.currency?.toUpperCase()
  if (sale && Number.isInteger(sale.price) && currency && CURRENCIES.has(currency)) {
    notices.push({
      kind: "orderConfirmation",
      to,
      ...lang,
      subId: sub.id,
      key: `order:${sale.id}`,
      orderId: sale.id,
      planName: planById(deps.plans, state.planId)?.name ?? state.planId,
      amount: { amount: (sale.price as number) + (sale.tax_included_in_price ? 0 : (sale.tax_cents ?? 0)), currency: currency as Currency, vatIncluded: true },
      orderedAt: sale.created_at,
    })
  }
  return { applied, notices }
}

/** Next 경로 처리기: `export const POST = (req: Request) => billing.handlePing(req)`. Gumroad 알림 주소는 `https://…/api/webhooks/gumroad?key=<비밀>` */
export async function handleGumroadPing(req: Request, deps: PingDeps): Promise<Response> {
  if (!deps.pingSecret) {
    deps.log?.("[billing-gumroad] GUMROAD_PING_SECRET is missing (register D161)")
    return json(500, { error: "ping_secret_missing" })
  }
  const given = new URL(req.url).searchParams.get("key") ?? ""
  if (!sameSecret(given, deps.pingSecret)) return json(401, { error: "invalid_key" })
  const raw = await req.text()
  if (!raw || raw.length > MAX_PING_BYTES) return json(400, { error: "bad_body" })
  let ping: ReturnType<typeof parsePing>
  try {
    ping = parsePing(raw, req.headers.get("content-type") ?? "")
  } catch {
    return json(400, { error: "bad_body" })
  }

  const resource = ping.get("resource_name") || "sale"
  const saleLike = SALE_RESOURCES.has(resource)
  if (!saleLike && !SUBSCRIPTION_RESOURCES.has(resource)) return json(200, { kind: "ignored", eventId: "", reason: `resource ${resource}` })
  const saleId = ping.get("sale_id")
  const pingSubId = ping.get("subscription_id")
  if (saleLike ? !saleId : !pingSubId) return json(400, { error: "missing_id" })
  // 중복 제거 키(문서: sale_id + resource_name). 구독 알림은 구독 id + 사건 시각. 재전송이 붙이는 retry_count 는 키에 넣지 않는다
  const stamp = saleLike ? null : ping.get(EVENT_TIME_FIELD[resource] as string)
  const eventId = saleLike ? `${resource}:${saleId}` : `${resource}:${pingSubId}:${stamp ?? createHash("sha256").update(raw.replace(/(^|&)retry_count=\d+/, "")).digest("hex").slice(0, 32)}`
  const claimed = Date.parse((saleLike ? ping.get("sale_timestamp") : stamp) ?? "")
  const now = deps.now ?? (() => new Date())

  let outcome: PingOutcome
  let notices: Notice[]
  try {
    const r = await deps.db.transaction(async (tx) => {
      const { duplicate } = await recordWebhookEvent(tx as unknown as Database, {
        provider: PROVIDER,
        eventId,
        occurredAt: Number.isFinite(claimed) ? new Date(claimed) : now(),
        payloadHash: createHash("sha256").update(raw).digest("hex"),
      })
      if (duplicate) return { outcome: { kind: "duplicate", eventId } as PingOutcome, notices: [] as Notice[] }
      const key = now()
      let sale: GumroadSale | undefined
      let subId = pingSubId
      if (saleLike) {
        sale = await fetchOrUnverified("sale", () => deps.gumroad.getSale(saleId as string))
        // 알림이 말한 구독과 API 의 판매가 가리키는 구독이 다르면 위조·혼선이다(다시 보내도 같다 → 400)
        if (pingSubId && sale.subscription_id !== pingSubId) throw new Unverified("subscription_id does not match the sale", false)
        if (!sale.subscription_id) return { outcome: { kind: "ignored", eventId, reason: "not a membership sale" } as PingOutcome, notices: [] as Notice[] }
        subId = sale.subscription_id
      }
      const sub = await fetchOrUnverified("subscriber", () => deps.gumroad.getSubscriber(subId as string))
      if (sub.id !== subId) throw new Unverified("subscriber id does not match", false)
      if (sale && sub.product_id !== sale.product_id) throw new Unverified("sale and subscriber products differ", false)
      const linkUserId = saleLike ? verifyRef(deps.pingSecret, ping.urlParam(REF_PARAM), new Date(Date.parse(sale?.created_at ?? "") || key.getTime())) : null
      const applied = await applyGumroadSubscription(tx, deps, { sub, key, linkUserId, sale: resource === "sale" ? sale : undefined })
      if (applied.ignored) return { outcome: { kind: "ignored", eventId, reason: "product not in plans" } as PingOutcome, notices: [] as Notice[] }
      if (applied.unlinked) {
        deps.log?.(`[billing-gumroad] ${resource} ${eventId}: subscription ${sub.id} has no linked user (missing or invalid ${REF_PARAM})`)
        return { outcome: { kind: "unlinked", eventId, subscriptionId: sub.id } as PingOutcome, notices: [] as Notice[] }
      }
      return {
        outcome: { kind: "processed", eventId, subscriptionId: sub.id, applied: applied.applied, emails: applied.notices.length } as PingOutcome,
        notices: applied.notices,
      }
    })
    outcome = r.outcome
    notices = r.notices
  } catch (e) {
    // 트랜잭션이 이벤트 기록까지 되돌렸다. 메시지에 본문·비밀을 싣지 않는다.
    if (e instanceof Unverified) {
      deps.log?.(`[billing-gumroad] ${resource} ${eventId} unverified: ${e.message}`)
      return json(e.retry ? 503 : 400, { error: "unverified", eventId })
    }
    deps.log?.(`[billing-gumroad] ${resource} ${eventId} failed: ${e instanceof Error ? e.name : "error"}`)
    return json(500, { error: "processing_failed", eventId })
  }
  await sendNotices(deps, notices)
  return json(200, outcome)
}
