"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Phone } from "@/registry/factory/icons"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { useFloatingDrawn, useFloatingSpace } from "../_shared/floating-kit"

// 아래 고정 전화 줄 — 좁은 화면(md 미만)에서만 화면 아래에 붙는다. 넓은 화면에서는 붙지 않고 본문 흐름 안의 얇은 전화 안내 줄이 된다(마우스 사용자에게 아래 줄은 필요 없다).
// 하단 탭(bottom-tab/split-booking-bar 와 같은 자리)이 있는 쪽에서는 그리지 않는다. 줄 높이만큼 제자리 빈 칸을 두고 문서 뿌리의 scroll-padding-bottom 을 줘서 문서 끝 요소·키보드 초점이
// 줄에 가리지 않는다(useFloatingSpace — WCAG 2.4.11). 줄 높이는 --wf-float-bar 로 실려 같은 쪽의 다른 떠 있는 요소(퀵 메뉴·문의 단추)가 그 위로 앉는다. 기기 아래 안전 영역만큼 더 띄운다. 등장 모션 없음.
export type FloatingActionCallBarCopy = {
  // 읽기 도구용 구역 이름
  regionLabel: string
  // 안내 한 줄(선택): 운영 시간 같은 것
  note?: string
  // 전화 버튼: 보이는 이름 + 화면에 보이는 번호(tel: 링크는 normalizePhone 으로 만든다 — 다른 전화 링크와 같은 정규화)
  call: { label: string; phone: string }
  secondary?: Cta
}
export type FloatingActionCallBarProps = BlockBase<FloatingActionCallBarCopy> & {
  track?: AnalyticsPort["track"]
}

export function FloatingActionCallBar({ copy, track, id = "call-bar", className }: FloatingActionCallBarProps) {
  const bar = React.useRef<HTMLDivElement>(null)
  const drawn = useFloatingDrawn()
  useFloatingSpace(bar, { bar: true, active: drawn })
  if (!drawn) return null
  const tel = normalizePhone(copy.call.phone) ?? copy.call.phone.replace(/[^\d+]/g, "")
  return (
    <div data-block="floating-action-call-bar" className={cn("cn-block-fa-call", className)}>
      <div aria-hidden="true" className="cn-block-fa-call-spacer" />
      <div ref={bar} id={id} role="region" aria-label={copy.regionLabel} className="cn-block-fa-callbar">
        <div className="cn-block-fa-callbar-row">
          {copy.note ? <p className="cn-block-fa-callbar-note">{copy.note}</p> : null}
          <div className="cn-block-fa-callbar-buttons">
            <Button size="lg" nativeButton={false} render={<a href={`tel:${tel}`} onClick={() => track?.("cta_click", { id: "call-bar-call", label: copy.call.label, section: id })} />} className="cn-block-fa-callbar-button">
              <Phone aria-hidden="true" />
              {copy.call.label}
              <span data-numeric>{copy.call.phone}</span>
            </Button>
            {copy.secondary ? (
              <Button variant="outline" size="lg" nativeButton={false} render={<a href={copy.secondary.href} onClick={() => track?.("cta_click", { id: "call-bar-secondary", label: copy.secondary?.label ?? "", section: id })} />} className="cn-block-fa-callbar-button">
                {copy.secondary.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
