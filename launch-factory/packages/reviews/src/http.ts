// 서비스 결과 → HTTP 응답(상태 코드 규칙은 이 한 곳). 서비스 로직은 HTTP 를 모른다.
import { blockedResponse } from "@launch-factory/security/protect"
import type { Locale } from "@launch-factory/i18n"
import type { ReviewsResult } from "./types.ts"

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" }

export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = { "cache-control": "no-store" }): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } })
}

/** 429 + Retry-After · 봇 400 · 확인 불가·꺼짐 503 · 처리 중·중복 409 · 로그인 필요 401 · 칸 오류 400 · 그 밖의 실패 500 */
export function toResponse(result: ReviewsResult<unknown>, locale: Locale = "en"): Response {
  if (result.ok) return jsonResponse(result, 200)
  switch (result.code) {
    case "rate_limited":
      return blockedResponse({ kind: "rate_limited", retryAfter: result.retryAfter ?? 1 }, locale)
    case "bot_check_failed":
      return jsonResponse(result, 400)
    case "bot_check_unavailable":
    case "provider_unavailable":
      return jsonResponse(result, 503)
    case "in_progress":
    case "duplicate":
      return jsonResponse(result, 409)
    case "sign_in_required":
      return jsonResponse(result, 401)
  }
  return jsonResponse(result, result.fieldErrors ? 400 : 500)
}
