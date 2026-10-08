"use client"

import * as React from "react"

// 닫은 것 기억하기(P3-2 레인 D2 공유 조각 block-shared-dismiss-memory). 마케팅 규칙 A6·A8(factory-rules.md §22-6): 공지 띠·팝업은 닫은 것을 기억한다.
// where: "local" 은 이 브라우저에 오래(공지 띠·체크리스트 닫기), "session" 은 이 방문 동안만(이탈 제안 — 방문당 1회, A5).
// 저장소를 못 쓰는 곳(사생활 보호 창 등)에서는 기억하지 못한다 — 부르는 쪽이 이번 화면 상태로 닫는다.
// useSyncExternalStore 라 서버 렌더에서는 「모름」(null)이고, 하이드레이션 뒤 실제 값으로 다시 그린다.

const EVENT = "wf:dismiss-memory"
type Where = "local" | "session"
const storeOf = (where: Where) => (where === "session" ? window.sessionStorage : window.localStorage)
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}
const read = (key: string, where: Where): string => {
  try {
    return storeOf(where).getItem(key) === "1" ? "1" : "0"
  } catch {
    return "0"
  }
}

/** key 마다 닫았는가. dismissed: true 닫음 · false 보인다 · null 아직 모름(서버 렌더). set(true) 닫기 · set(false) 다시 열기 */
export function useDismissMemory(key: string, where: Where = "local") {
  const v = React.useSyncExternalStore(
    subscribe,
    () => read(key, where),
    () => "",
  )
  const set = React.useCallback(
    (on: boolean) => {
      try {
        if (on) storeOf(where).setItem(key, "1")
        else storeOf(where).removeItem(key)
      } catch {
        // 저장소를 못 쓰면 이번 화면에서만(부르는 쪽 상태)
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key, where],
  )
  return { dismissed: v === "" ? null : v === "1", set }
}
