"use client"

import * as React from "react"

// 며칠 쉬기(P3-2 레인 D1 공유 조각 block-shared-snooze). 마케팅 규칙 L7(거절한 선택을 다시 묻는 창에는 「7일간 보지 않기」)·
// P9(업그레이드 제안은 닫은 뒤 며칠 쉰다). 이 브라우저의 localStorage 에 「언제까지」를 적는다 — 동의·결제 상태가 아니라 보이기만 다룬다
// (쉬는 동안에도 동의는 바뀌지 않는다). 저장소를 못 쓰는 곳(사생활 보호 창 등)에서는 조용히 쉬지 않는다(늘 보인다).
// useSyncExternalStore 라 서버 렌더에서는 「모름」(null)이고, 하이드레이션 뒤 실제 값으로 다시 그린다.

const EVENT = "wf:snooze"
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}
const read = (key: string): string => {
  try {
    const until = Number(window.localStorage.getItem(key) ?? 0)
    return until > Date.now() ? "1" : "0"
  } catch {
    return "0"
  }
}

/** key 마다 쉬는 중인가. snoozed: true 쉬는 중 · false 보인다 · null 아직 모름(서버 렌더). snooze() 는 days 날 동안 쉰다 */
export function useSnooze(key: string, days: number) {
  const v = React.useSyncExternalStore(subscribe, () => read(key), () => "")
  const snooze = React.useCallback(() => {
    try {
      window.localStorage.setItem(key, String(Date.now() + days * 86_400_000))
    } catch {
      // 저장소를 못 쓰면 이번 화면에서만 닫는다(부르는 쪽 상태)
    }
    window.dispatchEvent(new Event(EVENT))
  }, [key, days])
  return { snoozed: v === "" ? null : v === "1", snooze }
}
