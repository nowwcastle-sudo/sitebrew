// 서버 액션 결과 → HTTP 응답. 상태 코드 규칙은 한 곳에서 정한다(문의의 toResponse 와 같은 모양, 예약 코드만 더했다).
import type { Locale } from "@launch-factory/i18n"
import { blockedResponse } from "@launch-factory/security/protect"
import type { BookingResult } from "./types.ts"

export function toResponse(result: BookingResult<unknown>, locale: Locale = "en"): Response {
  const json = (status: number) => new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
  if (result.ok) return json(200)
  switch (result.code) {
    case "rate_limited":
      return blockedResponse({ kind: "rate_limited", retryAfter: result.retryAfter ?? 1 }, locale)
    case "bot_check_failed":
      return json(400)
    case "bot_check_unavailable":
    case "provider_unavailable": // 예약 창구가 꺼져 있다 — Retry-After 없음(기다려도 같다)
    case "deposit_failed":
      return json(503)
    case "in_progress":
    case "slot_taken":
    case "cancel_closed":
    case "invalid_state":
      return json(409)
    case "not_found":
      return json(404)
    case "forbidden":
      return json(403)
  }
  if (result.fieldErrors) return json(400)
  return json(500)
}
