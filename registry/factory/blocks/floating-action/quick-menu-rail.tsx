"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Calendar, ChevronUp, Mail, MapPin, Phone } from "@/registry/factory/icons"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { cn } from "@/registry/factory/lib/utils"

import { ChatIcon, scrollToTop, useFloatingDrawn, useFloatingSpace } from "../_shared/floating-kit"

// 가장자리 고정 퀵 메뉴(공공·기관·병원 사이트의 전화·상담·맨 위로). 넓은 화면(xl)에서는 오른쪽 가장자리 세로 줄(본문 폭 바깥 여백에 앉아 첫 화면 본문을 가리지 않는다),
// 좁은 화면에서는 오른쪽 아래 모서리의 가로 줄이다. 아래 고정 줄(call-bar·쿠키 띠)이 있으면 그 위로 올라앉는다(--wf-float-bar·--bottom-bar-height).
// 아래쪽에 앉는 모양은 가린 높이를 재서 문서 뿌리의 scroll-padding-bottom 에 싣는다(useFloatingSpace — WCAG 2.4.11 초점 가림 방지). 하단 탭이 있는 쪽에서는 그리지 않는다.
// 항목은 전화(tel: 은 normalizePhone — 다른 전화 링크와 같은 정규화)·바깥 링크 몇 개 + 맨 위로 단추. 글자 이름표가 늘 보인다(아이콘만 두지 않는다). 위젯 스크립트 없음.
export type QuickMenuItem =
  | { kind: "call"; label: string; phone: string }
  | { kind: "link"; icon: "chat" | "mail" | "map" | "calendar"; label: string; href: string }
export type FloatingActionQuickMenuRailCopy = {
  // 읽기 도구용 구역 이름
  label: string
  items: QuickMenuItem[]
  top: { label: string }
}
export type FloatingActionQuickMenuRailProps = BlockBase<FloatingActionQuickMenuRailCopy> & {
  track?: AnalyticsPort["track"]
}

const LINK_ICONS = { mail: Mail, map: MapPin, calendar: Calendar } as const

export function FloatingActionQuickMenuRail({ copy, track, id = "quick-menu", className }: FloatingActionQuickMenuRailProps) {
  const ref = React.useRef<HTMLElement>(null)
  const drawn = useFloatingDrawn()
  useFloatingSpace(ref, { active: drawn })
  if (!drawn) return null
  const click = (key: string, label: string) => track?.("cta_click", { id: `quick-menu-${key}`, label, section: id })
  return (
    <nav ref={ref} id={id} data-block="floating-action-quick-menu-rail" aria-label={copy.label} className={cn("cn-block-fa-rail", className)}>
      <ul className="cn-block-fa-rail-list">
        {copy.items.map((item, i) => {
          const Icon = item.kind === "call" ? Phone : item.icon === "chat" ? null : LINK_ICONS[item.icon]
          const href = item.kind === "call" ? `tel:${normalizePhone(item.phone) ?? item.phone.replace(/[^\d+]/g, "")}` : item.href
          return (
            <li key={i} className="cn-block-fa-rail-cell">
              <a href={href} onClick={() => click(item.kind === "call" ? "call" : item.icon, item.label)} className="cn-block-fa-item">
                {Icon ? <Icon aria-hidden="true" className="cn-block-fa-item-icon" /> : <ChatIcon className="cn-block-fa-item-icon" />}
                <span className="cn-block-fa-item-label">{item.label}</span>
              </a>
            </li>
          )
        })}
        <li className="cn-block-fa-rail-cell">
          <button
            type="button"
            data-top=""
            onClick={() => {
              click("top", copy.top.label)
              scrollToTop()
            }}
            className="cn-block-fa-item"
          >
            <ChevronUp aria-hidden="true" className="cn-block-fa-item-icon" />
            <span className="cn-block-fa-item-label">{copy.top.label}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
