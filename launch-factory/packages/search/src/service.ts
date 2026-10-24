// 검색 서비스 조립(계획 3c Task 2). 순수 판단은 normalize·query·snippet 이, SQL 은 @launch-factory/db 가 맡고 여기는 그것들을 잇기만 한다.
// 순서: 요청 제한 → 질의 정리(빈 질의는 빈 결과) → 조회 → 조각 만들기.
// 조회는 읽기뿐이고 개인정보가 없다(색인에는 공개 쪽·상품·글의 글만 든다). 요청 제한은 남용(전수 긁기·DB 부하)을 막는다.
import { deleteSearchDocument, countSearchDocuments, querySearchDocuments, replaceSearchKind, upsertSearchDocuments, type Database } from "@launch-factory/db"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { blockedByRate, blockedResponse, blockedResult, type LaunchActionResult } from "@launch-factory/security/protect"
import type { RateLimiter } from "@launch-factory/security/rate-limit"
import { isKind, normalizeDocument, type SearchDocumentInput } from "./normalize.ts"
import { buildQuery, type SearchInput } from "./query.ts"
import { makeSnippet, type Snippet } from "./snippet.ts"

export interface SearchItem {
  kind: string
  ref: string
  title: string
  url: string
  snippet: Snippet
}

export interface SearchResult {
  items: SearchItem[]
  total: number
  page: number
  pageCount: number
}

export interface SearchServiceOptions {
  db: Database
  limiter: RateLimiter
  /** 요청 제한 경로 이름. 기본 "search"(1분에 30번) */
  route?: string
  now?: () => Date
  /** DB 오류 등 — 사용자에게는 일반 실패만 보이고 원인은 여기로 간다(운영 알림) */
  onError?: (error: Error) => void
}

export interface SearchContext {
  /** 요청 머리(IP). ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  userId?: string | null
  /** 오류 문구 언어(기본 en). 결과를 걸러내는 `locale` 과는 다르다 */
  locale?: Locale
}

export interface SearchService {
  search(input: SearchInput, ctx?: SearchContext): Promise<LaunchActionResult<SearchResult>>
  /** 라우트 처리기(GET). 429 + Retry-After · 그 밖 실패 500 · GET 아님 405 */
  handler(request: Request, ctx?: Omit<SearchContext, "headers">): Promise<Response>
  /** (kind, ref) 가 같으면 덮어쓴다. 색인한 문서 수를 돌려준다 */
  indexDocuments(docs: readonly SearchDocumentInput[]): Promise<number>
  removeDocument(kind: string, ref: string): Promise<boolean>
  /** 한 트랜잭션에서 그 종류 문서를 모두 `docs` 로 바꾼다. 검사나 저장이 하나라도 실패하면 옛 문서가 그대로다 */
  replaceKind(kind: string, docs: readonly SearchDocumentInput[]): Promise<number>
  count(): Promise<number>
}

export function createSearchService(o: SearchServiceOptions): SearchService {
  const route = o.route ?? "search"
  const now = o.now ?? (() => new Date())
  const onError = o.onError ?? ((e: Error) => console.error(e.message))
  const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)))

  const stamp = (docs: readonly SearchDocumentInput[], at: Date) => docs.map((d) => ({ ...normalizeDocument(d), updatedAt: at }))

  async function search(input: SearchInput, ctx: SearchContext = {}): Promise<LaunchActionResult<SearchResult>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "en"
    try {
      const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }
      const rate = blockedByRate(await o.limiter.check(route, who))
      if (rate) return blockedResult(rate, locale)

      const q = buildQuery(input)
      if (!q) return { ok: true, data: { items: [], total: 0, page: 1, pageCount: 0 } }
      const { rows, total } = await querySearchDocuments(o.db, { patterns: q.patterns, ...(q.kinds ? { kinds: q.kinds } : {}), ...(q.locale ? { locale: q.locale } : {}), limit: q.pageSize, offset: q.offset })
      return {
        ok: true,
        data: {
          items: rows.map((r) => ({ kind: r.kind, ref: r.ref, title: r.title, url: r.url, snippet: makeSnippet(r.body, q.terms) })),
          total,
          page: q.page,
          pageCount: Math.ceil(total / q.pageSize),
        },
      }
    } catch (e) {
      onError(toError(e))
      return { ok: false, retryable: true, formError: t(locale, "protect.actionFailed") }
    }
  }

  return {
    search,
    async handler(request, ctx = {}) {
      if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } })
      const p = new URL(request.url).searchParams
      const kinds = p.get("kinds")?.split(",").map((k) => k.trim()).filter(Boolean)
      const result = await search({ q: p.get("q"), ...(kinds?.length ? { kinds } : {}), locale: p.get("locale"), page: p.get("page"), pageSize: p.get("pageSize") }, { ...ctx, headers: request.headers })
      if (result.ok) return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
      if (result.code === "rate_limited") return blockedResponse({ kind: "rate_limited", retryAfter: result.retryAfter ?? 1 }, ctx.locale)
      return new Response(JSON.stringify(result), { status: 500, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
    },
    indexDocuments: (docs) => (docs.length === 0 ? Promise.resolve(0) : upsertSearchDocuments(o.db, stamp(docs, now()))),
    removeDocument: (kind, ref) => deleteSearchDocument(o.db, kind, ref),
    async replaceKind(kind, docs) {
      if (!isKind(kind)) throw new Error(`replaceKind: kind ${JSON.stringify(kind)} is not a valid kind`)
      const rows = stamp(docs, now())
      const stray = rows.find((r) => r.kind !== kind)
      if (stray) throw new Error(`replaceKind: document kind ${JSON.stringify(stray.kind)} does not match ${JSON.stringify(kind)}`)
      return replaceSearchKind(o.db, kind, rows)
    },
    count: () => countSearchDocuments(o.db),
  }
}
