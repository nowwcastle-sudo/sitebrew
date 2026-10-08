"use client"

import * as React from "react"

// 떠 있는 행동 공유 조각(block-shared-floating-kit — FV1 Task 5.8, floating-action 세 변형이 같이 쓴다).
//   · useFloatingDrawn: 쪽에 하단 탭 블록(data-block^="bottom-tab-")이 있으면 false — 고정 줄 둘이 겹쳐 서로의 초점을 가리므로 떠 있는 행동은 그리지 않는다.
//     서버 렌더·첫 하이드레이션은 true(모름)이고, 붙은 뒤 하단 탭이 보이면(또는 나중에 붙으면) false 로 바뀐다.
//   · useFloatingSpace: 화면 아래쪽에 고정된 요소가 가리는 높이를 재서 문서 뿌리의 scroll-padding-bottom 에 싣는다 — 키보드로 옮긴 요소·앵커 목적지가
//     떠 있는 요소 뒤에 숨지 않는다(WCAG 2.4.11). 여러 개가 있으면 가장 큰 값을 쓰고, 마지막 하나가 떠나면 원래 값으로 되돌린다.
//     bar 를 켜면(아래 고정 줄) 그 높이를 --wf-float-bar 로 실어, 줄 위에 앉는 다른 떠 있는 요소가 그만큼 올라간다.
//     (_shared/bottom-bar-space 는 하단 탭·쿠키 띠 전용이라 --bottom-bar-height 를 쓴다 — 여기서는 서로 값을 덮지 않게 따로 둔다.)
//   · ChatIcon: 말풍선 그림(아이콘 정본 47개에 없다 — 장식이라 aria-hidden). scrollToTop: 「맨 위로」 — 동작 줄이기에서는 부드럽게 굴리지 않는다.
const TAB = '[data-block^="bottom-tab-"]'
export const FLOAT_BAR_VAR = "--wf-float-bar"

const subscribeTab = (cb: () => void) => {
  const mo = new MutationObserver((records) => {
    if (records.some((r) => r.addedNodes.length || r.removedNodes.length)) cb()
  })
  mo.observe(document.body, { childList: true, subtree: true })
  return () => mo.disconnect()
}

/** 하단 탭이 없는 쪽에서만 true */
export function useFloatingDrawn(): boolean {
  return React.useSyncExternalStore(
    subscribeTab,
    () => !document.querySelector(TAB),
    () => true,
  )
}

const covers = new Map<HTMLElement, number>()
let saved: string | null = null

function apply() {
  const html = document.documentElement
  if (covers.size === 0) {
    if (saved !== null) html.style.scrollPaddingBottom = saved
    saved = null
    return
  }
  if (saved === null) saved = html.style.scrollPaddingBottom
  const max = Math.max(0, ...covers.values())
  html.style.scrollPaddingBottom = max > 0 ? `${max + 8}px` : saved
}

export function useFloatingSpace(ref: React.RefObject<HTMLElement | null>, { bar = false, active = true }: { bar?: boolean; active?: boolean } = {}) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return
    const html = document.documentElement
    const measure = () => {
      const r = el.getBoundingClientRect()
      // 넓은 화면에서 흐름 안에 있거나(position 이 fixed 가 아님) 화면 위쪽 절반에 있는 요소(가장자리 세로 줄)는 아래를 가리지 않는다
      const lower = getComputedStyle(el).position === "fixed" && r.height > 0 && r.top > window.innerHeight / 2
      const covered = lower ? Math.ceil(window.innerHeight - r.top) : 0
      covers.set(el, covered)
      apply()
      if (bar) {
        if (covered > 0) html.style.setProperty(FLOAT_BAR_VAR, `${covered}px`)
        else html.style.removeProperty(FLOAT_BAR_VAR)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
      covers.delete(el)
      apply()
      if (bar) html.style.removeProperty(FLOAT_BAR_VAR)
    }
  }, [ref, bar, active])
}

/**
 * 높이가 막힌 떠 있는 알림의 글 칸(popup-today·update-toast — 뿌리가 max-h-[35dvh] 로 막힌다). 글이 길어 칸 안에서 넘치면 스크롤 칸이 되어 키보드로 닿는다
 * (tabIndex 0 + 이름 있는 region — axe scrollable-region-focusable). 넘치지 않으면 초점 칸을 더하지 않는다(탭 정지 하나를 공짜로 늘리지 않는다). 서버 렌더·첫 하이드레이션은 넘치지 않음이다.
 * 행동 줄은 이 칸 밖에 두어 글이 아무리 길어도 두 단추가 늘 보인다.
 */
export function ScrollText({ labelledBy, className, children }: { labelledBy: string; className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = React.useState(false)
  // 글(children)이 바뀔 때마다 다시 잰다(칸 크기가 그대로인 채 안쪽 글만 길어지는 경우는 ResizeObserver 가 못 본다)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 1)
  }, [children])
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      data-scroll-text=""
      tabIndex={overflow ? 0 : undefined}
      role={overflow ? "region" : undefined}
      aria-labelledby={overflow ? labelledBy : undefined}
      className={className}
    >
      {children}
    </div>
  )
}

/** 맨 위로 — 동작 줄이기를 켠 사람에게는 부드럽게 굴리지 않고 바로 간다 */
export function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.7 8.7 0 0 1-3.6-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
    </svg>
  )
}
