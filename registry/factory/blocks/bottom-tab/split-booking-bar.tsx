"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Calendar, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { Button } from "@/registry/factory/ui/button"

import { useBottomBarSpace } from "../_shared/bottom-bar-space"

// 전화·예약 두 버튼 고정 줄(동네 가게·병원) — 위에 짧은 안내 한 줄(선택, 예: 오늘 영업 시간), 아래에 같은 폭 두 버튼: 전화(tel: — 외곽선)·예약(주색).
// 화면 아래에 고정되고, 문서 --bottom-bar-height·scroll-padding-bottom + 문서 끝 여백(useBottomBarSpace pad — 푸터가 줄 뒤에 오므로 제자리 빈 칸이 아니라 끝 여백)으로
// 문서 끝 요소·푸터 링크 포커스가 가리지 않는다. 넓은 화면에서는 두 버튼이 오른쪽에 모이고 안내가 왼쪽에 선다. 안전 영역만큼 더 띄운다. 등장 모션 없음.
export type BottomTabSplitBookingBarCopy = {
  regionLabel: string
  note?: string
  // 전화 버튼: 보이는 이름 + 화면에 보이는 번호 모양(tel: 링크는 normalizePhone 으로 만든다).
  call: { label: string; phone: string }
  // 예약 버튼 — 예약 수단이 전화뿐이면(booking 이 전화와 같은 곳) 주지 않는다: 같은 곳으로 가는 버튼 둘을 그리지 않고 전화 버튼 하나가 주 행동이 된다.
  booking?: Cta
}
export type BottomTabSplitBookingBarProps = BlockBase<BottomTabSplitBookingBarCopy>

export function BottomTabSplitBookingBar({ copy, id = "booking-bar", className }: BottomTabSplitBookingBarProps) {
  const bar = React.useRef<HTMLDivElement>(null)
  useBottomBarSpace(bar, { pad: true })
  const tel = normalizePhone(copy.call.phone) ?? copy.call.phone.replace(/[^\d+]/g, "")
  return (
    <div data-block="bottom-tab-split-booking-bar" className={cn("cn-block-bottom-root", className)}>
      <div ref={bar} id={id} role="region" aria-label={copy.regionLabel} className="cn-block-bottom-bar">
        <div data-solo={copy.note ? undefined : ""} className="cn-block-bottom-split-row">
          {copy.note ? <p className="cn-block-bottom-note">{copy.note}</p> : null}
          <div className="cn-block-bottom-split-buttons">
            <Button variant={copy.booking ? "outline" : "default"} size="lg" nativeButton={false} render={<a href={`tel:${tel}`} />} className="cn-block-bottom-split-button">
              <Phone aria-hidden="true" />
              {copy.call.label}
            </Button>
            {copy.booking ? (
              <Button size="lg" nativeButton={false} render={<a href={copy.booking.href} />} className="cn-block-bottom-split-button">
                <Calendar aria-hidden="true" />
                {copy.booking.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
