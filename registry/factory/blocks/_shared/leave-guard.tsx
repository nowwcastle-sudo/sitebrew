"use client"

import * as React from "react"

// 저장 안 한 변경 경고(P3-2 Task 7a, 대장 A49): 입력이 남은 채로 탭을 닫거나 다른 주소로 가려 하면 브라우저 확인 창(beforeunload)을 띄운다.
// 문구는 브라우저가 정한다(사이트가 못 바꾼다). 앱 안 링크 가로채기·긴 입력 초안 보존(sessionStorage)은 v0.2 — Next.js App Router 에는 경로 이동을 가로챌 방법이 없다.
// 블록 안의 링크(「건너뛰기」·「시작하기」처럼 의도한 나가기)를 누르면 경고하지 않는다 — scope 안 a[href] 클릭 뒤 1.5초는 통과시킨다.
const INTENDED_MS = 1500

/** window(beforeunload)와 scope(click)에 붙이고 떼는 함수를 돌려준다 — 시험이 가짜 EventTarget 으로 부른다 */
export function attachLeaveGuard(win: EventTarget, scope?: EventTarget | null, now: () => number = Date.now): () => void {
  let intended = -Infinity
  const onClick = (e: Event) => {
    const t = e.target as { closest?: (s: string) => unknown } | null
    if (t?.closest?.("a[href]")) intended = now()
  }
  const onUnload = (e: Event) => {
    if (now() - intended < INTENDED_MS) return
    e.preventDefault()
    ;(e as BeforeUnloadEvent).returnValue = ""
  }
  scope?.addEventListener("click", onClick, true)
  win.addEventListener("beforeunload", onUnload)
  return () => {
    scope?.removeEventListener("click", onClick, true)
    win.removeEventListener("beforeunload", onUnload)
  }
}

/** active(입력이 남았고 아직 보내지 않았다)일 때만 켠다 */
export function useLeaveGuard(active: boolean, scope?: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!active) return
    return attachLeaveGuard(window, scope?.current ?? null)
  }, [active, scope])
}
