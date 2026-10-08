"use client"

import * as React from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

// 사용자가 동작 줄이기를 켰는가. 설정이 바뀌면 다시 그린다(DESIGN §8-7 — JS 애니메이션도 matchMedia 변화를 듣는다).
// 서버 렌더에서는 false(모름) — CSS 쪽 @media 가 첫 화면을 맡는다.
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
