// @launch-factory/reviews — 후기·상품 문의 서비스(계획 3c Task 1).
//
// 쓰기 입구 순서(inquiry 와 같다): 요청 제한 → 멱등 키 → 입력 검사 → Turnstile → 저장.
//   - 검사를 Turnstile 앞에 둔다: 토큰은 한 번만 검증되므로 칸을 고쳐 다시 보낼 때 토큰을 태우지 않는다.
//   - 후기는 로그인이 필요하고(한 사람이 한 대상에 한 번), 질문은 로그인 없이도 된다.
// 읽기: 게시된 글만 나간다. 작성자 이름은 저장 전에 가려져 있고, 사용자 id·상태·숨김 사유는 응답에 없다.
// 관리: 답변·상태 바꾸기는 관리자 또는 소유자만(행위자 판정은 inquiry 의 isAdminActor 를 그대로 쓴다). 지우는 함수는 없다 — 숨김은 사유 필수 + admin_actions 한 줄.
import { changeReviewStatus, findUserReview, getReview, type ReviewRow, insertReview, listReviews, listReviewsForModeration, ratingCounts, REVIEW_KINDS, REVIEW_STATUSES, setReviewAnswer, withIdempotency, type Database, type ReviewKind, type ReviewStatus } from "@launch-factory/db"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { isAdminActor, type InquiryActor } from "@launch-factory/inquiry"
import { blockedByBot, blockedByRate, blockedResult } from "@launch-factory/security/protect"
import type { RateLimiter } from "@launch-factory/security/rate-limit"
import { TURNSTILE_FIELD, type Turnstile } from "@launch-factory/security/turnstile"
import { jsonResponse, toResponse } from "./http.ts"
import { maskName } from "./mask.ts"
import { summarize, toPublic } from "./summary.ts"
import type { ReviewList, ReviewsResult, SubmitContext, SubmitReceipt } from "./types.ts"
import { DEFAULT_PAGE_SIZE, parseListQuery, parseSubmit, readFields, type ParsedList, type SubmitInput } from "./validate.ts"

export type Moderation = "after" | "before"
export type ReviewsActor = InquiryActor

export interface ReviewsServiceOptions {
  db: Database
  limiter: RateLimiter
  turnstile: Turnstile
  /** after(기본): 바로 게시하고 나중에 검토. before: 검토를 마친 뒤에 게시 */
  moderation?: Moderation
  /** 요청 제한 경로 이름. 기본 "reviewsSubmit"(10분에 5번) */
  route?: string
  /** 날짜(YYYY-MM-DD)를 읽는 시간대. 기본 UTC */
  timeZone?: string
  /** 판매자 답변의 작성자 표시. 없으면 메시지 목록의 「판매자」 */
  sellerName?: string
  /** 본문에 넣을 수 있는 링크 수. 기본 2 */
  maxLinks?: number
  adminRoles?: string[]
  adminUserIds?: string[]
  now?: () => Date
  /** 저장 실패 등 — 사용자에게는 일반 문구만 간다. 운영 알림으로 보낸다 */
  onError?: (error: Error) => void
}

export type AdminFailure = { ok: false; error: "forbidden" | "not_found" | "invalid_input" | "reason_required" }

export interface ModerationItem {
  id: string
  kind: ReviewKind
  subjectType: string
  subjectId: string
  rating: number | null
  title: string | null
  body: string
  author: string
  status: ReviewStatus
  verified: boolean
  answerBody: string | null
  hiddenReason: string | null
  createdAt: string
}

export interface ModerationQuery {
  status?: string
  kind?: string
  subjectType?: string
  subjectId?: string
  /** 제목·본문·작성자 이름에서 찾는다 */
  search?: string
  page?: number
  pageSize?: number
}

export interface ReviewsService {
  submit(input: SubmitInput, ctx?: SubmitContext): Promise<ReviewsResult<SubmitReceipt>>
  /** 블록 submit 포트 모양. ctx 는 요청마다 만든다 */
  action(ctx?: SubmitContext): (input: Record<string, string>) => Promise<ReviewsResult<SubmitReceipt>>
  /** POST 처리기(FormData 또는 JSON) */
  handler(request: Request, ctx?: Omit<SubmitContext, "headers">): Promise<Response>
  /** 게시된 글 목록 + (후기면) 별점 요약 */
  list(query: ParsedList): Promise<ReviewList>
  /** GET 처리기(?subjectType=&subjectId=&kind=&sort=&rating=&page=&pageSize=). 공개 읽기라 캐시할 수 있다 */
  listHandler(request: Request, ctx?: { locale?: Locale }): Promise<Response>
  answer(actor: ReviewsActor, input: { id: string; body: string }): Promise<{ ok: true; data: { id: string } } | AdminFailure>
  setStatus(actor: ReviewsActor, input: { id: string; status: string; reason?: string }): Promise<{ ok: true; data: { id: string; changed: boolean; status: ReviewStatus } } | AdminFailure>
  listForModeration(actor: ReviewsActor, query?: ModerationQuery): Promise<{ ok: true; data: { items: ModerationItem[]; total: number; page: number; pageCount: number } } | AdminFailure>
  /** 관리 화면의 글 하나(상태와 상관없이). 없는 id 는 not_found. 사용자 id 는 싣지 않는다 */
  moderationItem(actor: ReviewsActor, id: string): Promise<{ ok: true; data: ModerationItem } | AdminFailure>
}

export const ANSWER_MAX = 2000
export const REASON_MAX = 500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/
/** Postgres 유일 제약 위반(drizzle 이 오류를 감싸 cause 에 코드를 둔다) */
const isUniqueViolation = (e: unknown) => [e, (e as { cause?: unknown } | null)?.cause].some((x) => (x as { code?: unknown } | null)?.code === "23505")
const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size))

/** 표 행 → 관리 화면 한 줄(사용자 id·답변자 id 는 옮기지 않는다) */
const toModerationItem = (r: Omit<ReviewRow, "userId" | "answeredBy">): ModerationItem => ({
  id: r.id,
  kind: r.kind,
  subjectType: r.subjectType,
  subjectId: r.subjectId,
  rating: r.rating,
  title: r.title,
  body: r.body,
  author: r.authorName,
  status: r.status,
  verified: r.verified,
  answerBody: r.answerBody,
  hiddenReason: r.hiddenReason,
  createdAt: r.createdAt.toISOString(),
})

export function createReviewsService(o: ReviewsServiceOptions): ReviewsService {
  const moderation = o.moderation ?? "after"
  if (moderation !== "after" && moderation !== "before") throw new Error(`reviews moderation must be "after" or "before", got ${String(moderation)}`)
  const route = o.route ?? "reviewsSubmit"
  const now = o.now ?? (() => new Date())
  const onError = o.onError ?? ((e: Error) => console.error(e.message))
  const adminOpts = { ...(o.adminRoles ? { adminRoles: o.adminRoles } : {}), ...(o.adminUserIds ? { adminUserIds: o.adminUserIds } : {}) }
  const mayModerate = (actor: ReviewsActor) => isAdminActor(actor, adminOpts) || actor.isOwner === true
  const seller = (locale: Locale) => o.sellerName ?? t(locale, "reviews.seller")
  const localeOf = (v: unknown): Locale => (isLocale(v) ? v : "en")

  function receipt(kind: ReviewKind, status: "published" | "pending", locale: Locale): string {
    if (kind === "review") return t(locale, status === "pending" ? "reviews.receivedReviewPending" : "reviews.receivedReview")
    return t(locale, status === "pending" ? "reviews.receivedQuestionPending" : "reviews.receivedQuestion")
  }

  async function submit(input: SubmitInput, ctx: SubmitContext = {}): Promise<ReviewsResult<SubmitReceipt>> {
    const locale = localeOf(ctx.locale)
    try {
      const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }
      const rate = blockedByRate(await o.limiter.check(route, who))
      if (rate) return blockedResult(rate, locale)

      const f = readFields(input)
      const key = f.get("idempotencyKey")
      const at = now()
      const run = async (): Promise<ReviewsResult<SubmitReceipt>> => {
        const parsed = parseSubmit(input, { locale, ...(o.maxLinks !== undefined ? { maxLinks: o.maxLinks } : {}) })
        if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
        const v = parsed.value
        if (v.kind === "review" && !ctx.userId) return { ok: false, code: "sign_in_required", retryable: false, formError: t(locale, "reviews.signInRequired") }
        const duplicate = (): ReviewsResult<SubmitReceipt> => {
          const text = t(locale, "reviews.duplicate")
          return { ok: false, code: "duplicate", retryable: false, formError: text, fieldErrors: { subjectId: [text] } }
        }
        if (v.kind === "review" && ctx.userId && (await findUserReview(o.db, ctx.userId, v))) return duplicate()
        const bot = blockedByBot(await o.turnstile.verify({ token: f.get(TURNSTILE_FIELD), remoteIp: o.limiter.ip(who), ...(key ? { idempotencyKey: key } : {}) }))
        if (bot) return blockedResult(bot, locale)

        const status = moderation === "before" ? "pending" : "published"
        try {
          const row = await insertReview(o.db, {
            kind: v.kind,
            subjectType: v.subjectType,
            subjectId: v.subjectId,
            userId: ctx.userId ?? null,
            // 원래 이름은 여기서 버린다 — 가린 이름만 저장한다
            authorName: maskName(v.authorName ?? ctx.displayName ?? "") || t(locale, "reviews.anonymous"),
            rating: v.rating ?? null,
            title: v.title ?? null,
            body: v.body,
            locale,
            status,
            createdAt: at,
            updatedAt: at,
          })
          return { ok: true, data: { id: row.id, status }, message: receipt(v.kind, status, locale) }
        } catch (e) {
          if (isUniqueViolation(e)) return duplicate() // 동시에 두 번 보낸 경우
          throw e
        }
      }
      if (!key || !IDEMPOTENCY_KEY.test(key)) return await run()
      const outcome = await withIdempotency(o.db, { scope: `reviews:${route}`, key, now: at }, run)
      if ("inProgress" in outcome) return { ok: false, code: "in_progress", retryable: true, formError: t(locale, "protect.inProgress") }
      return outcome.result
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
      return { ok: false, retryable: true, formError: t(locale, "reviews.failed") }
    }
  }

  async function list(q: ParsedList): Promise<ReviewList> {
    const { rows, total } = await listReviews(o.db, { ...q, status: "published", limit: q.pageSize, offset: (q.page - 1) * q.pageSize })
    const base: ReviewList = {
      items: rows.map((r) => toPublic(r, { ...(o.timeZone ? { timeZone: o.timeZone } : {}), sellerName: seller(localeOf(r.locale)) })),
      total,
      page: q.page,
      pageCount: pageCount(total, q.pageSize),
    }
    if (q.kind !== "review") return base
    const { counts } = await ratingCounts(o.db, q)
    return { ...base, summary: summarize(counts, now(), o.timeZone) }
  }

  const found = (id: string) => (UUID.test(id) ? getReview(o.db, id) : Promise.resolve(undefined))

  return {
    submit,
    action: (ctx = {}) => (input) => submit(input, ctx),
    async handler(request, ctx = {}) {
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } })
      let input: SubmitInput
      try {
        input = (request.headers.get("content-type") ?? "").includes("application/json") ? ((await request.json()) as Record<string, unknown>) : await request.formData()
      } catch {
        input = {}
      }
      return toResponse(await submit(input, { ...ctx, headers: request.headers }), localeOf(ctx.locale))
    },
    list,
    async listHandler(request, ctx = {}) {
      if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } })
      const locale = localeOf(ctx.locale)
      const parsed = parseListQuery(new URL(request.url).searchParams, { locale })
      if (!parsed.ok) return jsonResponse({ ok: false, fieldErrors: parsed.fieldErrors }, 400)
      try {
        return jsonResponse({ ok: true, data: await list(parsed.value) }, 200, { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" })
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)))
        return jsonResponse({ ok: false, retryable: true, formError: t(locale, "reviews.failed") }, 500)
      }
    },

    async answer(actor, input) {
      if (!mayModerate(actor)) return { ok: false, error: "forbidden" }
      const body = typeof input.body === "string" ? input.body.trim() : ""
      if (!body || Array.from(body).length > ANSWER_MAX) return { ok: false, error: "invalid_input" }
      if (!(await found(input.id))) return { ok: false, error: "not_found" }
      const row = await setReviewAnswer(o.db, input.id, { body, by: actor.userId, at: now() })
      return row ? { ok: true, data: { id: row.id } } : { ok: false, error: "not_found" }
    },

    async setStatus(actor, input) {
      if (!mayModerate(actor)) return { ok: false, error: "forbidden" }
      const to = REVIEW_STATUSES.find((s) => s === input.status)
      if (!to) return { ok: false, error: "invalid_input" }
      const reason = typeof input.reason === "string" ? input.reason.trim() : ""
      if (Array.from(reason).length > REASON_MAX) return { ok: false, error: "invalid_input" }
      if (to === "hidden" && !reason) return { ok: false, error: "reason_required" }
      if (!UUID.test(input.id)) return { ok: false, error: "not_found" }
      const r = await changeReviewStatus(o.db, { id: input.id, to, ...(reason ? { reason } : {}), adminUserId: actor.userId, at: now() })
      return r.ok ? { ok: true, data: { id: input.id, changed: r.changed, status: r.to } } : { ok: false, error: r.error }
    },

    async listForModeration(actor, query = {}) {
      if (!mayModerate(actor)) return { ok: false, error: "forbidden" }
      const status = query.status === undefined ? undefined : REVIEW_STATUSES.find((s) => s === query.status)
      const kind = query.kind === undefined ? undefined : REVIEW_KINDS.find((k) => k === query.kind)
      if ((query.status !== undefined && !status) || (query.kind !== undefined && !kind)) return { ok: false, error: "invalid_input" }
      const pageSize = Math.min(Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)), 50)
      const page = Math.max(1, Math.trunc(query.page ?? 1))
      const { rows, total } = await listReviewsForModeration(o.db, {
        ...(status ? { status } : {}),
        ...(kind ? { kind } : {}),
        ...(query.subjectType ? { subjectType: query.subjectType } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.search ? { search: query.search } : {}),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      const items = rows.map(toModerationItem)
      return { ok: true, data: { items, total, page, pageCount: pageCount(total, pageSize) } }
    },

    async moderationItem(actor, id) {
      if (!mayModerate(actor)) return { ok: false, error: "forbidden" }
      const row = await found(id)
      if (!row) return { ok: false, error: "not_found" }
      return { ok: true, data: toModerationItem(row) }
    },
  }
}
