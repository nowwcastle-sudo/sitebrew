import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Bell, ChevronDown, Search } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

// 앱 상단 바(dashboard global/top-bar) — 사이드바 오른쪽에서 쪽 위에 붙는 한 줄: 쪽 이름(선택) · 전역 검색(role=search, 눈에 안 보이는 라벨 + 자리 글) · 알림 링크(읽지 않은 수는 숫자 + 읽는 글) · 계정 메뉴.
// 계정 메뉴는 <details> 라 자바스크립트 없이도 열리고 닫힌다. 로그아웃은 링크가 아니라 POST 폼이다(미리 불러오기·크롤러가 로그아웃시키지 않게) — signOutAction 이 있을 때만 그린다.
// 검색 폼은 method=get 으로 search.action 쪽에 q 를 보낸다(검색 쪽은 조립하는 쪽 몫). 쪽 제목은 h1 이 아니다(쪽 제목은 쪽 몫) — 쪽 이름 칸은 글(p)이다. 서버 컴포넌트. 등장 모션 없음.
// 쪽 흐름 안에 앉고 붙지 않는다 — 그래서 sticky 표지(data-sticky-nav)를 달지 않는다(달면 블록 관문이 검수대 띠로 읽어 안쪽 검색 칸·알림·계정 단추를 히트 영역·axe 에서 통째로 뺀다).
// 검색·알림은 선택이다 — 갈 곳(검색을 받는 쪽·알림이 모이는 쪽)이 없으면 칸을 주지 않는다(눌러도 아무 일도 없는 검색 칸·알림 종을 그리지 않는다, FV1 Task 5.18). 칸을 안 주면 그 자리만 빠지고 나머지는 그대로다.
export type NavTopBarCopy = {
  // 쪽 이름(선택) — 지금 화면이 어디인지
  title?: string
  search?: { label: string; placeholder?: string; action: string }
  notifications?: { label: string; href: string; count?: number; countLabel?: string }
  account: {
    // 계정 메뉴 단추의 보이는 글(이름 또는 「계정」)
    menuLabel: string
    links: Cta[]
    signOutLabel?: string
  }
}
export type NavTopBarProps = BlockBase<NavTopBarCopy> & {
  signOutAction?: React.ComponentProps<"form">["action"]
}

export function NavTopBar({ copy, signOutAction, id = "top-bar", className }: NavTopBarProps) {
  const n = copy.notifications?.count
  return (
    <header id={id} data-block="nav-top-bar" className={cn("sticky top-0 z-30 border-b bg-background text-foreground w-full", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 md:flex-nowrap md:px-6 md:py-2">
        {copy.title ? <p className="min-w-0 flex-1 text-[1.125rem] leading-[1.3] [overflow-wrap:anywhere] font-heading">{copy.title}</p> : <span aria-hidden="true" className="min-w-0 flex-1 text-[1.125rem] leading-[1.3] [overflow-wrap:anywhere]" />}
        {copy.search ? (
          <form role="search" method="get" action={copy.search.action} className="relative order-last w-full md:order-none md:w-80">
            <label htmlFor={`${id}-q`} className="sr-only">
              {copy.search.label}
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <input id={`${id}-q`} type="search" name="q" autoComplete="off" placeholder={copy.search.placeholder ?? copy.search.label} className="min-h-11 w-full min-w-0 border bg-background ps-9 pe-3 text-base outline-hidden placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring" />
          </form>
        ) : null}
        <div className="flex shrink-0 items-center gap-1">
          {copy.notifications ? (
            <a href={copy.notifications.href} className="relative inline-flex size-11 items-center justify-center outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring">
              <Bell aria-hidden="true" className="size-5" />
              <span className="sr-only">
                {copy.notifications.label}
                {n ? ` ${copy.notifications.countLabel ? copy.notifications.countLabel.replace("{count}", String(n)) : n}` : ""}
              </span>
              {n ? (
                <span aria-hidden="true" data-numeric className="absolute end-0.5 top-0.5 inline-flex min-w-5 items-center justify-center bg-foreground px-1 text-sm leading-[1.4] text-background">
                  {n > 99 ? "99+" : n}
                </span>
              ) : null}
            </a>
          ) : null}
          <details className="relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3 text-base outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {copy.account.menuLabel}
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 [details[open]>summary>&]:rotate-180" />
            </summary>
            <div className="absolute end-0 top-full z-40 mt-1 flex min-w-56 max-w-[calc(100vw-2rem)] flex-col gap-1 border bg-background p-2">
              {copy.account.links.length ? (
                <ul className="flex flex-col">
                  {copy.account.links.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} className="flex min-h-11 w-full items-center px-3 text-start text-base hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {signOutAction && copy.account.signOutLabel ? (
                <form method="post" action={signOutAction} data-sign-out="" className="border-t pt-1">
                  <button type="submit" className="flex min-h-11 w-full items-center px-3 text-start text-base hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:underline">
                    {copy.account.signOutLabel}
                  </button>
                </form>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
