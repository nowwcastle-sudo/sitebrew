"use client"

import * as React from "react"

// 루프 애니메이션을 화면 밖에서, 그리고 탭이 숨었을 때 멈춘다(DESIGN §8-4 MOTION-019).
// 멈춘 동안 요소에 data-paused 를 단다 — motion-core css 가 그 요소와 자손의 animation-play-state 를 paused 로 둔다.
// 돌려주는 값(멈췄는가)으로 JS 루프(rAF)도 멈출 수 있다. 컴포넌트가 사라지면 관찰과 표지를 정리한다.
export function usePauseOffscreen<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    let inView = true
    const apply = () => {
      const next = !inView || document.visibilityState === "hidden"
      el.toggleAttribute("data-paused", next)
      setPaused(next)
    }
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            inView = entries.some((e) => e.isIntersecting)
            apply()
          })
    io?.observe(el)
    document.addEventListener("visibilitychange", apply)
    apply()
    return () => {
      io?.disconnect()
      document.removeEventListener("visibilitychange", apply)
      el.removeAttribute("data-paused")
    }
  }, [ref])

  return paused
}
