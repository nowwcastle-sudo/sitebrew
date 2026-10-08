"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Bell, Calendar, Heart, Home, MapPin, Search, Settings, ShoppingCart, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { useBottomBarSpace } from "../_shared/bottom-bar-space"

// 모바일 하단 탭 — 아이콘 + 짧은 이름 탭 4~5개를 화면 아래에 고정한다(현재 탭은 윗선 + 아이콘 주색 + aria-current).
// 넓은 화면(768 이상)에서는 가운데 떠 있는 줄(최대 32rem)로 남는다. 문서 뿌리에 --bottom-bar-height 와 scroll-padding-bottom 을 싣고 줄이 가리는 만큼 문서 끝 여백을 더해(useBottomBarSpace pad —
// 푸터가 줄 뒤에 오므로 제자리 빈 칸이 아니라 문서 끝 여백) 문서 끝 요소·포커스가 줄에 가리지 않는다. 기기 아래 안전 영역만큼 더 띄운다. 등장 모션 없음.
const ICONS = { home: Home, search: Search, cart: ShoppingCart, user: User, heart: Heart, calendar: Calendar, bell: Bell, settings: Settings, map: MapPin } as const
export type BottomTabIcon = keyof typeof ICONS

export type BottomTabIconTabsCopy = {
  navLabel: string
  tabs: (Cta & { icon: BottomTabIcon })[]
}
export type BottomTabIconTabsProps = BlockBase<BottomTabIconTabsCopy> & {
  currentHref?: string
}

export function BottomTabIconTabs({ copy, id = "bottom-tabs", className, currentHref }: BottomTabIconTabsProps) {
  const bar = React.useRef<HTMLElement>(null)
  useBottomBarSpace(bar, { pad: true })
  return (
    <div data-block="bottom-tab-icon-tabs" className={cn("cn-block-bottom-root", className)}>
      <nav ref={bar} id={id} aria-label={copy.navLabel} className="cn-block-bottom-bar cn-block-bottom-tabs-bar">
        <ul className="cn-block-bottom-tabs">
          {copy.tabs.map((t, i) => {
            const Icon = ICONS[t.icon]
            return (
              <li key={i} className="min-w-0 flex-1">
                <a href={t.href} aria-current={currentHref === t.href ? "page" : undefined} className="cn-block-bottom-tab">
                  <span aria-hidden="true" className="cn-block-bottom-tab-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="cn-block-bottom-tab-label">{t.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
