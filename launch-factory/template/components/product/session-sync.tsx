"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { SESSION_CHANGED_EVENT } from "@/lib/welcome"

// 위 띠(web-factory 블록 nav/account-bar)는 서버 컴포넌트라 서버가 읽은 세션으로 그린다(LFADA). 서버 레이아웃은 쪽을 옮겨도 다시 그려지지 않아서(Next),
// 이 조각이 두 때에 서버에게 세션을 다시 읽게 한다 — ① 쪽을 옮길 때(LFFIX F8 와 같은 이유: 로그인·로그아웃 직후에 띠가 낡은 채로 남지 않게)
// ② 이 화면 안에서 로그인·가입이 끝났다는 신호(announceSessionChanged — 쪽 이동 없이 「됐어요」를 보이는 이메일 로그인·가입, UXOK).
// router.refresh() 는 화면의 클라이언트 상태(입력 중인 폼 등)를 지우지 않고 서버 조각만 다시 가져온다.
// 같은 자리에서 위 띠의 높이를 `--site-header-h` 로 알린다 — 붙은 띠에 포커스·바로가기로 옮긴 글이 가려지지 않게 globals.css 가 scroll-padding-top 으로 쓴다(WCAG 2.4.11, LFRUNFIX F1).
export function SessionSync() {
  const router = useRouter()
  const pathname = usePathname()
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    router.refresh()
  }, [pathname, router])
  React.useEffect(() => {
    const ask = () => router.refresh()
    window.addEventListener(SESSION_CHANGED_EVENT, ask)
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, ask)
  }, [router])
  React.useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-sticky-nav]")
    if (!el) return
    const set = () => document.documentElement.style.setProperty("--site-header-h", `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty("--site-header-h")
    }
  }, [])
  return null
}
