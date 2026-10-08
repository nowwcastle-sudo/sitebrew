// 서버 액션 결과 → 구획 속성(LFAX M04 · R21). components/product/action-scope.tsx 가 DOM 요소에 쓴다. 순수 함수라 DOM 없이 시험한다.
//   data-error-code      마지막 결과의 실패 code (성공이 오면 지워진다)
//   data-retryable       같은 요청을 그대로 다시 보내면 성공할 수 있는가(true|false)
//   data-retry-after     code 가 rate_limited 일 때 남은 초
//   data-awaiting-approval  사람이 확인해야 멈춘 것(code confirmation_required) — 실패가 아니라 「승인 대기」라 error-code 를 달지 않는다

export const RESULT_ATTRS = ["data-error-code", "data-retryable", "data-retry-after", "data-awaiting-approval"] as const

/** 속성을 읽고 쓰는 데 필요한 요소의 부분(시험에서 가짜로 끼운다) */
export interface AttrTarget {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

type Failure = { ok: false; code?: unknown; retryable?: unknown; retryAfter?: unknown }

/** 결과를 요소 속성으로 쓴다. 성공이면 이전 실패 표지를 지운다. code 가 없는 실패는 action_failed 다 */
export function markResult(el: AttrTarget, result: { ok: boolean }): void {
  for (const a of RESULT_ATTRS) el.removeAttribute(a)
  if (result.ok) return
  const f = result as Failure
  const code = typeof f.code === "string" && f.code ? f.code : "action_failed"
  if (code === "confirmation_required") {
    el.setAttribute("data-awaiting-approval", "true")
    return
  }
  el.setAttribute("data-error-code", code)
  el.setAttribute("data-retryable", String(f.retryable === true))
  if (typeof f.retryAfter === "number" && f.retryAfter > 0) el.setAttribute("data-retry-after", String(Math.ceil(f.retryAfter)))
}
