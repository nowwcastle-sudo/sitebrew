// HTTP 어댑터 — 서비스를 Request → Response 로 감싼다(Next 라우트 처리기·Fetch API 호환, 프레임워크를 모른다). 규칙은 서비스에 있고 여기는 모양만 바꾼다.
//   subscribe    POST  FormData 또는 JSON → 200 · 429 + Retry-After · 봇 확인 실패 400 · 확인 불가 503 · 칸 오류 400 · 처리 중 409
//   confirm      GET   메일 링크 → 아무것도 바꾸지 않고 「구독 확인」 단추가 있는 쪽(?a=newsletter&t=…)으로 303 (로그인 불필요)
//                POST  확인 단추 — 사람이 누를 때만 구독이 확정된다. 쪽의 폼 POST(form-urlencoded·multipart)는 결과 쪽으로 303, 그 밖의 POST 는 JSON 200/400.
//                      다른 사이트에서 온 브라우저 POST(Sec-Fetch-Site: cross-site)는 403. 이미 확인된 토큰은 해 없이 「already」
//   unsubscribe  GET   메일 링크 → 결과 쪽으로 303 (로그인 불필요, 만료 없음)
//                POST  RFC 8058 한 번에 수신거부(List-Unsubscribe-Post) → 쿠키·로그인 없이 JSON 200/400
// GET 으로 상태를 바꾸는 것은 메일 보안 프로그램의 미리 열기에 취약하다(CWE-352) — 그래서 확인은 GET 이 아니라 단추(POST)가 확정한다. 수신거부는 늘 멱등이라 GET 으로 해도 해가 없다. HEAD 는 아무것도 하지 않는다.
import { isLocale, type Locale } from "@launch-factory/i18n"
import { BodyTooLargeError, DEFAULT_FORM_BODY_BYTES, payloadTooLarge, readFormInput } from "@launch-factory/security/body"
import { blockedResponse, type LaunchActionResult, type LaunchFailure } from "@launch-factory/security/protect"
import type { NewsletterService, SubmitContext } from "./service.ts"

export interface NewsletterHandlersOptions {
  /** 링크를 누른 뒤 가는 쪽 경로. 기본 "/email" — 결과는 `?list=newsletter&r=confirmed|already|invalid|withdrawn|unsubscribed`, 확인 링크를 열면 `?list=newsletter&a=newsletter&t=<토큰>`(확인 단추 쪽)을 붙인다 */
  resultPath?: string
  /** 가입 요청 본문 상한(바이트). 기본 64KB — 이보다 큰 본문은 읽기를 끊고 413 */
  maxBodyBytes?: number
}

export interface NewsletterHandlers {
  subscribe(request: Request, ctx?: Omit<SubmitContext, "headers">): Promise<Response>
  confirm(request: Request): Promise<Response>
  unsubscribe(request: Request): Promise<Response>
}

const NO_STORE = { "cache-control": "no-store" } as const
const json = (body: unknown, status: number): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE } })
/** 브라우저의 폼 제출(확인 단추)이 보내는 본문 형식 */
const FORM_CONTENT_TYPE = /^(application\/x-www-form-urlencoded|multipart\/form-data)/i
const methodNotAllowed =(allow: string): Response => new Response(null, { status: 405, headers: { allow } })

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
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_FORM_BODY_BYTES
  const redirect = (r: string): Response => new Response(null, { status: 303, headers: { location: `${resultPath}?list=newsletter&r=${r}`, ...NO_STORE } })
  const tokenOf = (request: Request): string | null => new URL(request.url).searchParams.get("t")

  return {
    async subscribe(request, ctx = {}) {
      if (request.method !== "POST") return methodNotAllowed("POST")
      let input: Record<string, unknown> | FormData
      try {
        input = await readFormInput(request, maxBodyBytes) // 상한까지만 읽는다(CWE-400)
      } catch (e) {
        if (e instanceof BodyTooLargeError) return payloadTooLarge()
        throw e
      }
      const result = await service.subscribe(input, { ...ctx, headers: request.headers })
      return toResponse(result, isLocale(ctx.locale) ? ctx.locale : "en")
    },

    async confirm(request) {
      if (request.method === "POST") {
        // 다른 사이트의 쪽이 사용자 브라우저로 이 주소에 POST 하는 것을 막는다(토큰을 모르면 어차피 안 되지만 한 겹 더). 브라우저가 아닌 호출은 이 머리가 없어 영향이 없다
        if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403, headers: NO_STORE })
        const fromForm = FORM_CONTENT_TYPE.test(request.headers.get("content-type") ?? "")
        const fromQuery = tokenOf(request)
        const field = fromQuery || !fromForm ? null : ((await request.formData().catch(() => null))?.get("t") ?? null)
        const result = await service.confirm(fromQuery ?? (typeof field === "string" ? field : null))
        if (fromForm) return redirect(result.ok ? (result.changed ? "confirmed" : "already") : result.reason)
        return result.ok ? json({ ok: true, changed: result.changed }, 200) : json({ ok: false, reason: result.reason }, 400)
      }
      if (request.method !== "GET") return methodNotAllowed("GET, POST")
      // GET 은 읽기만 한다 — 토큰을 확인 단추 쪽에 실어 보낼 뿐 구독은 그대로다
      const t = tokenOf(request)
      return t ? new Response(null, { status: 303, headers: { location: `${resultPath}?list=newsletter&a=newsletter&t=${encodeURIComponent(t)}`, ...NO_STORE } }) : redirect("invalid")
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
