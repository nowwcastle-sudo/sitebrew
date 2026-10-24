"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import { Bell, Calendar, ChevronLeft, ChevronRight, File, Filter, Home, Info, Mail, MapPin, Settings, ShoppingCart, Star, User } from "@/components/icons"
import { cn } from "@/lib/utils"

// 앱 사이드바(dashboard global/app-shell-sidebar) — 왼쪽에 붙는 주 메뉴. 처음에는 펼쳐져 글자 이름표가 보인다(아이콘만으로 뜻을 맞히게 하지 않는다). 접으면 아이콘 줄이 되고
// 링크의 이름은 눈에 안 보이는 글(sr-only)로 남아 접근 이름이 같으며, 접힌 항목에는 마우스를 올리면 이름 말풍선(title)이 뜬다. 지금 쪽 링크에 aria-current="page".
// 접기 단추는 진짜 버튼이고 aria-expanded 가 사이드바가 펼쳐졌는지 알린다. 넓은 화면(lg 이상)에서는 왼쪽에 고정된 세로 줄, 좁은 화면에서는 위에 붙는 가로 줄(항목은 가로로 밀린다 — 접기 단추는 없다).
// 제목은 h1 이 아니다(쪽 제목은 쪽 몫) — 묶음 이름은 글(p)이다. 접힘은 이 화면에서만 기억한다(저장하지 않는다). 등장 모션 없음.
const ICONS = { home: Home, file: File, orders: ShoppingCart, calendar: Calendar, mail: Mail, settings: Settings, user: User, bell: Bell, analytics: Filter, place: MapPin, help: Info, star: Star } as const
export type NavAppSidebarIcon = keyof typeof ICONS
export type NavAppSidebarItem = { label: string; href: string; icon: NavAppSidebarIcon }
export type NavAppSidebarCopy = {
  brand: { name: string; href: string }
  // 주 메뉴 이름(aria-label)
  navLabel: string
  groups: { label?: string; items: NavAppSidebarItem[] }[]
  // 접기·펴기 단추의 이름(보이는 글은 아이콘 + sr-only)
  collapse: string
  expand: string
}
export type NavAppSidebarProps = BlockBase<NavAppSidebarCopy> & {
  currentHref?: string
  defaultCollapsed?: boolean
}

export function NavAppSidebar({ copy, currentHref, defaultCollapsed = false, id = "app-sidebar", className }: NavAppSidebarProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const navId = `${id}-nav`
  return (
    <aside id={id} data-block="nav-app-sidebar" data-collapsed={collapsed ? "true" : "false"} className={cn("flex w-full flex-col gap-2 border-b bg-background p-2 text-foreground lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-e lg:border-b-0 lg:p-3 lg:data-[collapsed=true]:w-[4.5rem]", className)}>
      <div className="flex items-center justify-between gap-2">
        <a href={copy.brand.href} className="inline-flex min-h-11 min-w-0 items-center text-[1.125rem] leading-[1.3] [overflow-wrap:anywhere] font-heading">
          <span className={collapsed ? "sr-only" : undefined}>{copy.brand.name}</span>
          {collapsed ? (
            <span aria-hidden="true" className="inline-flex size-10 items-center justify-center border text-[1.125rem] leading-none">
              {[...copy.brand.name][0]}
            </span>
          ) : null}
        </a>
        <button type="button" aria-expanded={!collapsed} aria-controls={navId} onClick={() => setCollapsed((c) => !c)} className="relative hidden size-11 shrink-0 cursor-pointer items-center justify-center outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring lg:inline-flex">
          {collapsed ? <ChevronRight aria-hidden="true" className="size-5 shrink-0" /> : <ChevronLeft aria-hidden="true" className="size-5 shrink-0" />}
          <span className="sr-only">{collapsed ? copy.expand : copy.collapse}</span>
        </button>
      </div>
      <nav id={navId} aria-label={copy.navLabel} className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {copy.groups.map((g, gi) => (
          <div key={gi} className="flex shrink-0 gap-1 lg:flex-col">
            {g.label ? <p className={cn("px-3 pt-2 text-sm leading-[1.4] font-medium max-lg:hidden", collapsed && "sr-only")}>{g.label}</p> : null}
            <ul className="flex gap-1 lg:flex-col">
              {g.items.map((it) => {
                const Icon = ICONS[it.icon]
                return (
                  <li key={it.href}>
                    <a href={it.href} title={collapsed ? it.label : undefined} aria-current={currentHref === it.href ? "page" : undefined} className="relative flex min-h-11 items-center gap-3 px-3 text-base leading-[1.35] whitespace-nowrap outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-6">
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      <span className={cn("min-w-0 [overflow-wrap:anywhere] max-lg:whitespace-nowrap lg:whitespace-normal", collapsed && "sr-only")}>{it.label}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
