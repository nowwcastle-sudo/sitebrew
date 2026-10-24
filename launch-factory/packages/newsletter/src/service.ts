// 뉴스레터 구독 서비스 — 조립만 한다. 입력 검사(validate)·링크 서명(tokens)·메일 요청(mails)·저장(db)은 각자의 모듈이고, 여기는 순서를 정하고 의존을 주입받는다.
//
// 구독 신청 순서: 요청 제한 → 멱등 키(같은 키의 성공 결과가 있으면 그대로) → 입력 검사 → Turnstile → 저장 → 확인 메일.
//   - 입력 검사가 Turnstile 앞: 토큰은 한 번만 검증되므로(timeout-or-duplicate) 칸을 고쳐 다시 보낼 때 토큰을 태우지 않는다.
//   - 멱등 키가 Turnstile 앞: 시간 초과 뒤 같은 제출을 다시 보내면 이미 쓴 토큰을 다시 검증하지 않고 첫 결과를 돌려준다. 확인 메일도 멱등 구간 안이라 한 통이다.
//   - 이미 구독 중이든 아니든 응답은 같다(주소가 명단에 있는지 알려 주지 않는다). 이미 구독 중이면 메일도 없다.
//   - 메일 실패는 신청의 실패가 아니다(행은 남고 응답은 같다) — 운영 알림(onError)으로만 보낸다. 오류에 이메일 주소를 싣지 않는다.
// 확인 → 구독 완료 안내(전송자·동의한 날·결과 = 정보통신망법 제50조제7항 통지를 겸한다). 수신거부 → 처리 결과 통지. 둘 다 최선 노력이다(구독자는 계정이 없어 outbox 가 없다).
// 저장하지 않는 것: IP·브라우저 정보(요청 제한 키에만 잠깐 쓴다). 보내기(캠페인)는 이 부품의 일이 아니다 — listSubscribed 가 내보내기용 목록을 낸다.
import { findSubscriberById, listSubscribedPage, listSubscribersForAdmin, markNewsletterConfirmSent, purgeExpiredSubscribers, requestSubscription, confirmSubscriber, unsubscribeSubscriber, withIdempotency, type Database, type NewsletterStatus, type SubscriberRow } from "@launch-factory/db"
import type { Mailer, SendRequest, TemplateName } from "@launch-factory/email"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { blockedByBot, blockedByRate, blockedResult, type LaunchActionResult } from "@launch-factory/security/protect"
import type { RateLimiter } from "@launch-factory/security/rate-limit"
import { TURNSTILE_FIELD, type Turnstile } from "@launch-factory/security/turnstile"
import { confirmMail, unsubscribeNoticeMail, welcomeMail, type MailIdentity } from "./mails.ts"
import { newsletterLinks, readConfirmToken, readUnsubscribeToken, unsubscribeUrl } from "./tokens.ts"
import { NEWSLETTER_CONSENT_VERSION, parseSubscribe, readFields, type SubscribeInput } from "./validate.ts"

/** 보유 기간(일): 확인하지 않은 신청은 14일 뒤, 수신거부 기록은 1년 뒤 지운다. 구독 중인 사람은 기한이 없다 */
export const NEWSLETTER_RETENTION = { pendingDays: 14, unsubscribedDays: 365 } as const
/** 같은 대기 주소에 확인 메일을 다시 보내기까지 기다리는 시간(메일 폭탄 방지) */
export const CONFIRM_RESEND_COOLDOWN_MS = 5 * 60_000

const DAY = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/
const MIN_SECRET_LENGTH = 16

export interface NewsletterServiceOptions {
  db: Database
  mailer: Mailer
  limiter: RateLimiter
  turnstile: Turnstile
  /** 링크 서명 비밀(16자 이상, 앱 비밀에서 파생). 없는 비밀로 서명 없는 링크를 만들지 않는다 */
  secret: string
  /** 앱 주소(메일 링크의 뿌리, https 권장) */
  baseUrl: string
  productName: string
  /** 구독 완료·수신거부 통지의 전송자 명칭(정보통신망법 제50조⑦). 없으면 productName */
  senderName?: string
  timeZone?: string
  /** 요청 제한 경로 이름. 기본 "newsletter"(10분에 5번) */
  route?: string
  now?: () => Date
  /** 메일 실패 등 — 신청은 저장됐으므로 결과는 성공이다. 운영 알림으로 보낸다. 이메일 주소·비밀값을 싣지 않는다 */
  onError?: (error: Error) => void
}

export interface SubmitContext {
  /** 요청 머리(IP). ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  locale?: Locale
}

export interface SubscribeReceipt {
  message: string
}

export type ConfirmResult = { ok: true; changed: boolean } | { ok: false; reason: "invalid" | "withdrawn" }
export type UnsubscribeResult = { ok: true; changed: boolean } | { ok: false; reason: "invalid" }

export interface SubscriberListItem {
  id: string
  email: string
  locale: string
  source: string
  consentAt: Date
  confirmedAt: Date
  /** 보내는 메일마다 달 서명 수신거부 링크(로그인 불필요, 만료 없음) */
  unsubscribeUrl: string
}

/** 직원용 구독자 한 줄/상세. 서명 링크·토큰은 싣지 않는다(수신거부 링크는 구독자 본인의 열쇠다). 동의 증빙(판·시각)은 상세용으로 모두 들어 있다 */
export interface SubscriberAdminView {
  id: string
  email: string
  status: NewsletterStatus
  locale: string
  source: string
  consentVersion: string
  consentAt: Date
  confirmSentAt: Date | null
  confirmedAt: Date | null
  unsubscribedAt: Date | null
  /** 기록을 지우는 시각(대기·철회만, 구독 중이면 null) */
  expiresAt: Date | null
  createdAt: Date
}
export interface SubscriberAdminQuery {
  status?: NewsletterStatus
  /** 이메일 일부(대소문자 무시) */
  search?: string
  limit?: number
  /** 건너뛸 줄 수(쪽 매김, 0 이상) */
  offset?: number
}
export type WithdrawResult = { ok: true; changed: boolean } | { ok: false; reason: "not_found" }

export interface NewsletterService {
  /** 구독 신청 */
  subscribe(input: SubscribeInput, ctx?: SubmitContext): Promise<LaunchActionResult<SubscribeReceipt>>
  /** 블록 submit 포트 모양. ctx 는 요청마다 만든다(서버 액션 안에서 headers()로) */
  action(ctx?: SubmitContext): (input: Record<string, string>) => Promise<LaunchActionResult<SubscribeReceipt>>
  /** 확인 링크 처리. 두 번 눌러도 안전하다 */
  confirm(token: unknown): Promise<ConfirmResult>
  /** 수신거부 링크 처리. 로그인·만료 없이 즉시 철회, 두 번 눌러도 안전하다 */
  unsubscribe(token: unknown): Promise<UnsubscribeResult>
  /** 구독 중인 사람을 id 순으로 한 쪽(내보내기용). next 가 있으면 다음 쪽의 after */
  listSubscribed(o?: { after?: string; limit?: number }): Promise<{ items: SubscriberListItem[]; next: string | null }>
  /** 직원용 목록(관리 화면): 상태·이메일 일부로 거르고 최근 신청 순. 서명 링크·토큰 없음. total 은 거른 전체 건수 */
  listForAdmin(q?: SubscriberAdminQuery): Promise<{ items: SubscriberAdminView[]; total: number }>
  /** 직원용 상세. 없거나 id 모양이 틀리면 null */
  getForAdmin(id: string): Promise<SubscriberAdminView | null>
  /** 구독자가 요청한 수신거부를 직원이 대신 처리한다(링크 수신거부와 같은 전이·통지). 동의·확인 증빙은 남는다. 구독을 만들거나 확인해 주는 길은 없다 */
  withdraw(id: string): Promise<WithdrawResult>
  /** 한 구독자의 서명 수신거부 링크 */
  unsubscribeUrl(id: string): string
  /** 기한이 지난 신청·철회 기록을 지운다(Cron). 지운 수 */
  purgeExpired(): Promise<number>
}

export function createNewsletterService(o: NewsletterServiceOptions): NewsletterService {
  if (typeof o.secret !== "string" || o.secret.length < MIN_SECRET_LENGTH) throw new Error(`newsletter service needs a secret of at least ${MIN_SECRET_LENGTH} characters`)
  if (!o.baseUrl || !/^https?:\/\//.test(o.baseUrl)) throw new Error("newsletter service needs baseUrl (the app address, e.g. https://example.com)")
  if (!o.productName) throw new Error("newsletter service needs productName")
  if (o.senderName !== undefined && o.senderName.trim() === "") throw new Error("newsletter service senderName must not be empty")
  const now = o.now ?? (() => new Date())
  const route = o.route ?? "newsletter"
  const onError = o.onError ?? ((e: Error) => console.error(e.message))
  const identity: MailIdentity = { productName: o.productName, ...(o.senderName ? { senderName: o.senderName } : {}), ...(o.timeZone ? { timeZone: o.timeZone } : {}) }
  const localeOf = (v: unknown): Locale => (isLocale(v) ? v : "en")
  const adminView = (r: SubscriberRow): SubscriberAdminView => ({ id: r.id, email: r.email, status: r.status, locale: r.locale, source: r.source, consentVersion: r.consentVersion, consentAt: r.consentAt, confirmSentAt: r.confirmSentAt, confirmedAt: r.confirmedAt, unsubscribedAt: r.unsubscribedAt, expiresAt: r.expiresAt, createdAt: r.createdAt })

  /** 수신거부(링크든 직원 대행이든 같은 전이): 철회로 바꾸고 기록 보유 기간을 둔다. 확인한 적 있는 사람에게만 처리 결과를 알린다 */
  async function withdraw(id: string): Promise<WithdrawResult> {
    const at = now()
    const result = await unsubscribeSubscriber(o.db, { id, at, expiresAt: new Date(at.getTime() + NEWSLETTER_RETENTION.unsubscribedDays * DAY) })
    if (result.kind === "missing") return { ok: false, reason: "not_found" }
    if (result.kind === "already") return { ok: true, changed: false }
    const { row } = result
    // 확인 전에 거부한 사람은 동의한 적이 없으니 「동의 철회」 통지 대상이 아니다
    if (row.confirmedAt) await deliver("unsubscribe notice", unsubscribeNoticeMail(identity, { to: row.email, locale: localeOf(row.locale), subscriberId: row.id, at }))
    return { ok: true, changed: true }
  }

  /** 보낸다. 실패는 신청·확인·철회의 실패가 아니다 — 이름 하나만 운영 알림으로(주소·본문 없이). 보냈으면 true */
  async function deliver<N extends TemplateName>(label: string, request: SendRequest<N>): Promise<boolean> {
    try {
      const sent = await o.mailer.send(request)
      if (!sent.ok) onError(new Error(`newsletter ${label} mail failed (${sent.error.name})`))
      return sent.ok
    } catch {
      onError(new Error(`newsletter ${label} mail failed (exception)`))
      return false
    }
  }

  async function register(email: string, source: string, locale: Locale, at: Date): Promise<LaunchActionResult<SubscribeReceipt>> {
    const outcome = await requestSubscription(o.db, {
      email,
      locale,
      source,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
      at,
      pendingExpiresAt: new Date(at.getTime() + NEWSLETTER_RETENTION.pendingDays * DAY),
      resendAfter: new Date(at.getTime() - CONFIRM_RESEND_COOLDOWN_MS),
    })
    if (outcome.kind === "created" || outcome.kind === "renewed") {
      const { row } = outcome
      const { confirmUrl } = newsletterLinks({ baseUrl: o.baseUrl, secret: o.secret, id: row.id, consentAt: row.consentAt, now: at })
      const sent = await deliver("confirm", confirmMail(identity, { to: row.email, locale, subscriberId: row.id, at, confirmUrl }))
      if (sent) await markNewsletterConfirmSent(o.db, row.id, at)
    }
    return { ok: true, data: { message: t(locale, "newsletter.subscribed") } }
  }

  async function subscribe(input: SubscribeInput, ctx: SubmitContext = {}): Promise<LaunchActionResult<SubscribeReceipt>> {
    const locale = localeOf(ctx.locale)
    try {
      const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: null }
      const rate = blockedByRate(await o.limiter.check(route, who))
      if (rate) return blockedResult(rate, locale)

      const f = readFields(input)
      const key = f.get("idempotencyKey")
      const at = now()
      const run = async (): Promise<LaunchActionResult<SubscribeReceipt>> => {
        const parsed = parseSubscribe(f, locale)
        if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
        const bot = blockedByBot(await o.turnstile.verify({ token: f.get(TURNSTILE_FIELD), remoteIp: o.limiter.ip(who), ...(key ? { idempotencyKey: key } : {}) }))
        if (bot) return blockedResult(bot, locale)
        return register(parsed.email, parsed.source, locale, at)
      }
      if (!key || !IDEMPOTENCY_KEY.test(key)) return await run()
      const outcome = await withIdempotency(o.db, { scope: `newsletter:${route}`, key, now: at }, run)
      if ("inProgress" in outcome) return { ok: false, code: "in_progress", retryable: true, formError: t(locale, "protect.inProgress") }
      return outcome.result
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
      return { ok: false, retryable: true, formError: t(locale, "newsletter.failed") }
    }
  }

  return {
    subscribe,
    action: (ctx = {}) => (input) => subscribe(input, ctx),

    async confirm(token) {
      const at = now()
      const link = readConfirmToken(token, o.secret, at)
      if (!link) return { ok: false, reason: "invalid" }
      const result = await confirmSubscriber(o.db, { id: link.id, consentAt: link.consentAt, at })
      if (result.kind === "withdrawn") return { ok: false, reason: "withdrawn" }
      if (result.kind === "stale") return { ok: false, reason: "invalid" }
      if (result.kind === "already") return { ok: true, changed: false }
      const { row } = result
      await deliver("welcome", welcomeMail(identity, { to: row.email, locale: localeOf(row.locale), subscriberId: row.id, consentAt: row.consentAt, unsubscribeUrl: unsubscribeUrl(o.baseUrl, o.secret, row.id) }))
      return { ok: true, changed: true }
    },

    async unsubscribe(token) {
      const id = readUnsubscribeToken(token, o.secret)
      if (!id) return { ok: false, reason: "invalid" }
      const done = await withdraw(id)
      return done.ok ? done : { ok: false, reason: "invalid" }
    },

    withdraw: (id) => (UUID.test(id) ? withdraw(id) : Promise.resolve({ ok: false, reason: "not_found" })),

    async listForAdmin({ status, search, limit = 100, offset = 0 } = {}) {
      const page = await listSubscribersForAdmin(o.db, { ...(status ? { status } : {}), ...(search ? { search } : {}), limit: Math.min(Math.max(Math.trunc(limit) || 100, 1), 500), offset: Math.max(Math.trunc(offset) || 0, 0) })
      return { items: page.rows.map(adminView), total: page.total }
    },

    async getForAdmin(id) {
      if (!UUID.test(id)) return null
      const row = await findSubscriberById(o.db, id)
      return row ? adminView(row) : null
    },

    async listSubscribed({ after, limit = 100 } = {}) {
      const page = await listSubscribedPage(o.db, { ...(after ? { after } : {}), limit: Math.min(Math.max(Math.trunc(limit) || 100, 1), 500) })
      const items = page.rows.map((r) => ({
        id: r.id,
        email: r.email,
        locale: r.locale,
        source: r.source,
        consentAt: r.consentAt,
        confirmedAt: r.confirmedAt as Date,
        unsubscribeUrl: unsubscribeUrl(o.baseUrl, o.secret, r.id),
      }))
      return { items, next: page.next }
    },

    unsubscribeUrl: (id) => unsubscribeUrl(o.baseUrl, o.secret, id),
    purgeExpired: () => purgeExpiredSubscribers(o.db, now()),
  }
}
