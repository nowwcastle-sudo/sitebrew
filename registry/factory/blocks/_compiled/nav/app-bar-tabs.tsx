import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Bell, ChevronLeft, MoreHorizontal, Search, Settings, Share, ShoppingCart, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { IconButton } from "@/registry/factory/ui/icon-button"
import { SiteShellNavList } from "@/registry/factory/ui/site-shell-nav"

// 앱 바(PWA·대시보드) — 첫 줄: 뒤로 링크(선택) · 화면 제목 · 오른쪽 행동 아이콘 링크. 둘째 줄: 탭 모양 링크(현재 탭은 굵은 밑줄 + aria-current).
// 아이콘만 있는 링크는 IconButton(label 필수 → aria-label)이라 이름이 빠지지 않는다. 제목은 h1 이 아니다(h1 은 히어로·페이지 몫) — 화면 이름 줄이다.
// 탭이 넘치면 가로로 스크롤하고, 키보드로 옮긴 탭은 SiteShellNavList 가 보이게 굴린다. 모든 폭에서 위에 붙는다. 등장 모션 없음.
const ICONS = { search: Search, bell: Bell, settings: Settings, user: User, more: MoreHorizontal, share: Share, cart: ShoppingCart } as const
export type NavAppBarIcon = keyof typeof ICONS

export type NavAppBarTabsCopy = {
  title: string
  // 뒤로 링크 — label 은 보이지 않는 이름(aria-label). 없으면 뒤로 칸을 그리지 않는다.
  back?: Cta
  actions?: (Cta & { icon: NavAppBarIcon })[]
  tabsLabel: string
  tabs: Cta[]
}
export type NavAppBarTabsProps = BlockBase<NavAppBarTabsCopy> & {
  currentHref?: string
}

export function NavAppBarTabs({ copy, id = "app-bar", className, currentHref }: NavAppBarTabsProps) {
  return (
    <header id={id} data-block="nav-app-bar-tabs" data-sticky-nav="" className={cn("sticky top-0 z-30 border-b bg-background text-foreground", className)}>
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-1 px-2 md:px-6">
        {copy.back ? <IconButton icon={ChevronLeft} label={copy.back.label} variant="ghost" nativeButton={false} render={<a href={copy.back.href} />} /> : null}
        <p className="min-w-0 flex-1 px-2 text-[1.25rem] leading-[1.3] font-heading">{copy.title}</p>
        {copy.actions?.length ? (
          <div className="flex shrink-0 items-center gap-1">
            {copy.actions.map((a, i) => (
              <IconButton key={i} icon={ICONS[a.icon]} label={a.label} variant="ghost" nativeButton={false} render={<a href={a.href} />} />
            ))}
          </div>
        ) : null}
      </div>
      <nav aria-label={copy.tabsLabel} className="mx-auto max-w-6xl px-2 md:px-6">
        <SiteShellNavList className="flex flex-nowrap items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {copy.tabs.map((t, i) => (
            <li key={i} className="shrink-0">
              <a href={t.href} aria-current={currentHref === t.href ? "page" : undefined} className="inline-flex min-h-11 items-center border-b-2 border-transparent px-4 text-base whitespace-nowrap hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:border-primary">
                {t.label}
              </a>
            </li>
          ))}
        </SiteShellNavList>
      </nav>
    </header>
  )
}
