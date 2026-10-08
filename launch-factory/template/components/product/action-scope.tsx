"use client"

import * as React from "react"
import { markResult } from "@/lib/action-result-marker"

// 서버 액션 결과를 기계가 읽는 속성으로 보인다(LFAX M04 · 규칙 R21 · factory-rules.md §23-7 U21).
// 블록은 실패를 글(formError·fieldErrors)로만 그린다 — 자동화가 글을 해석하지 않고 원인을 알도록, 조립하는 쪽이 블록에 넘기는 액션을 `watch` 로 감싸
// 마지막 실패의 code·retryable 을 이 구획의 속성으로 단다:
//   data-error-code="rate_limited"      마지막 결과의 실패 code (성공이 오면 지워진다)
//   data-retryable="true|false"         같은 요청을 그대로 다시 보내면 성공할 수 있는가
//   data-retry-after="10"               code 가 rate_limited 일 때 남은 초
//   data-awaiting-approval="true"       사람이 확인해야 멈춘 것(code confirmation_required) — 실패가 아니라 「승인 대기」라 error-code 를 달지 않는다
// 속성은 DOM 에 바로 쓴다(상태를 두지 않는다) — 블록이 다시 그려지거나 액션 함수의 정체가 바뀌지 않는다. 구획은 레이아웃에 영향이 없다(contents).
// (v0.0.11 — 승인 행동의 `confirmed: true` 는 이제 블록이 확인 단계 뒤 직접 싣는다. 예전 `watch.confirmed(action)` 은 걷었다. 블록의 알림·읽기 오류도 같은 `data-error-code`·`data-retryable` 을 달아
// 결제 쪽 화면에서는 이 구획을 걷었고, 요청 제한(`data-retry-after` — 블록은 `role="timer"` 의 `data-cooldown` 으로 다르게 낸다)이 날 수 있는 인증 화면과 폼 알림이 없는 알림 구획에는 남긴다 — docs/qa/lfpin-v011.md §5.)

export interface Watch {
  <A extends unknown[], R extends { ok: boolean }>(action: (...args: A) => Promise<R>): (...args: A) => Promise<R>
}

export function ActionScope({ children, name }: { children: (watch: Watch) => React.ReactNode; name?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  // 같은 액션은 같은 감싼 함수로 — 블록의 usePortRead 같은 효과가 함수 정체가 바뀌어 다시 도는 일이 없다
  const cache = React.useRef(new WeakMap<object, unknown>())
  const watch = React.useMemo<Watch>(() => {
    const mark = (r: { ok: boolean }) => {
      if (ref.current) markResult(ref.current, r)
      return r
    }
    return (<A extends unknown[], R extends { ok: boolean }>(action: (...args: A) => Promise<R>) => {
      const hit = cache.current.get(action)
      if (hit) return hit as (...args: A) => Promise<R>
      const next = async (...args: A) => mark(await action(...args)) as R
      cache.current.set(action, next)
      return next
    }) as Watch
  }, [])
  return (
    <div ref={ref} className="contents" data-action-scope={name}>
      {children(watch)}
    </div>
  )
}
