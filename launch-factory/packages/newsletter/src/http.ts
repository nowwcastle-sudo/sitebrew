// HTTP 어댑터 — 서비스를 Request → Response 로 감싼다(Next 라우트 처리기·Fetch API 호환, 프레임워크를 모른다). 규칙은 서비스에 있고 여기는 모양만 바꾼다.
//   subscribe    POST  FormData 또는 JSON → 200 · 429 + Retry-After · 봇 확인 실패 400 · 확인 불가 503 · 칸 오류 400 · 처리 중 409
//   confirm      GET   메일 링크 → 결과 쪽으로 303 (로그인 불필요)
//                POST  같은 처리를 JSON 으로(확인 단추를 쪽에서 POST 로 받는 제품 — 메일 보안 프로그램이 GET 링크를 미리 열어도 구독이 확정되지 않게 하려면 이 길을 쓴다)
//   unsubscribe  GET   메일 링크 → 결과 쪽으로 303 (로그인 불필요, 만료 없음)
//                POST  RFC 8058 한 번에 수신거부(List-Unsubscribe-Post) → 쿠키·로그인 없이 JSON 200/400
// GET 으로 상태를 바꾸는 것은 메일 보안 프로그램의 미리 열기에 취약하다. 수신거부는 늘 멱등이라 해가 없고, 확인은 위 POST 길이 있다. HEAD 는 아무것도 하지 않는다.
import { isLocale, type Locale } from "@launch-factory/i18n"
import { blockedResponse, type LaunchActionResult, type LaunchFailure } from "@launch-factory/security/protect"
import type { NewsletterService, SubmitContext } from "./service.ts"

export interface NewsletterHandlersOptions {
  /** 링크를 누른 뒤 가는 결과 쪽 경로. 기본 "/email" — `?list=newsletter&r=confirmed|invalid|withdrawn|unsubscribed` 를 붙인다 */
  resultPath?: string
}

export interface NewsletterHandlers {
  subscribe(request: Request, ctx?: Omit<SubmitContext, "headers">): Promise<Response>
  confirm(request: Request): Promise<Response>
  unsubscribe(request: Request): Promise<Response>
}

const NO_STORE = { "cache-control": "no-store" } as const
const json = (body: unknown, status: number): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE } })
const methodNotAllowed = (allow: string): Response => new Response(null, { status: 405, headers: { allow } })

/** 서버 액션 결과 → HTTP 응답(상태 코드 규칙은 한 곳에서) */
export function toResponse(result: LaunchActionResult<unknown>, locale: Locale = "en"): Response {
  if (result.ok) return json(result, 200)
  const f: LaunchFailure = result
  if (f.code === "rate_limited") return blockedResponse({ kind: "rate_limited", retryAfter: f.retryAfter ?? 1 }, locale)
  if (f.code === "bot_check_failed") return json(f, 400)
  if (f.code === "bot_check_unavailable") return json(f, 503)
  if (f.code === "in_progress") return json(f, 409)
  if (f.fieldErrors) return json(f, 400)
  return json(f, 500)
}

export function createNewsletterHandlers(service: NewsletterService, options: NewsletterHandlersOptions = {}): NewsletterHandlers {
  const resultPath = options.resultPath ?? "/email"
  const redirect = (r: string): Response => new Response(null, { status: 303, headers: { location: `${resultPath}?list=newsletter&r=${r}`, ...NO_STORE } })
  const tokenOf = (request: Request): string | null => new URL(request.url).searchParams.get("t")

  return {
    async subscribe(request, ctx = {}) {
      if (request.method !== "POST") return methodNotAllowed("POST")
      let input: Record<string, unknown> | FormData
      try {
        input = (request.headers.get("content-type") ?? "").includes("application/json") ? ((await request.json()) as Record<string, unknown>) : await request.formData()
      } catch {
        input = {}
      }
      const result = await service.subscribe(input, { ...ctx, headers: request.headers })
      return toResponse(result, isLocale(ctx.locale) ? ctx.locale : "en")
    },

    async confirm(request) {
      if (request.method === "POST") {
        const result = await service.confirm(tokenOf(request))
        return result.ok ? json({ ok: true }, 200) : json({ ok: false, reason: result.reason }, 400)
      }
      if (request.method !== "GET") return methodNotAllowed("GET, POST")
      const result = await service.confirm(tokenOf(request))
      return redirect(result.ok ? "confirmed" : result.reason)
    },

    async unsubscribe(request) {
      if (request.method === "POST") {
        const result = await service.unsubscribe(tokenOf(request))
        return result.ok ? json({ ok: true }, 200) : json({ ok: false }, 400)
      }
      if (request.method !== "GET") return methodNotAllowed("GET, POST")
      const result = await service.unsubscribe(tokenOf(request))
      return redirect(result.ok ? "unsubscribed" : "invalid")
    },
  }
}
