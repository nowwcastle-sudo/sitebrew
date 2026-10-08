"use client"

import * as React from "react"

import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { uiLabels } from "@/registry/factory/ui/locale-labels"

// 가로로 밀어 보는 표의 안내(공유 조각 block-shared-scroll-hint — REL10B, 운영자 결정 2026-10-04).
// 자료 표(열이 많은 관리 목록·요금제 비교판·추세 표)는 좁은 화면에서 쌓지 않고 가로 스크롤 그대로 두되, 더 볼 것이 있다는 것을 알린다:
//   · 표 칸 가장자리에 옅은 띠 — 그쪽으로 더 밀 수 있을 때만(data-more-start·data-more-end) 보인다.
//   · 표 아래 짧은 글(「옆으로 밀어 보세요」) — 표가 칸보다 넓을 때만 보이고(data-overflow) 표가 다 들어가면 사라진다.
// 글·띠는 눈으로만 본다(aria-hidden, 초점을 받지 않는다) — 스크롤 칸은 ui/table 의 table-container(tabIndex 0·role region·이름)라 키보드·읽기 도구는 그것으로 움직인다.
// 글은 copy 가 주면 그것, 없으면 부품 문구 표(ui/locale-labels 의 scrollHint — locale ko·en)다. 서버 렌더·첫 칠은 「넘치지 않음」이라 글·띠가 없고, 하이드레이션 뒤 잰다.
type Edge = { overflow: boolean; start: boolean; end: boolean }
const NONE: Edge = { overflow: false, start: false, end: false }

export function ScrollHint({ locale, text, className, children }: { locale?: "ko" | "en"; text?: string; className?: string; children: React.ReactNode }) {
  const root = React.useRef<HTMLDivElement>(null)
  const [edge, setEdge] = React.useState<Edge>(NONE)
  React.useLayoutEffect(() => {
    const box = root.current?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!box) return
    const measure = () => {
      const max = box.scrollWidth - box.clientWidth
      const at = Math.abs(box.scrollLeft)
      const next: Edge = max > 1 ? { overflow: true, start: at > 1, end: at < max - 1 } : NONE
      setEdge((prev) => (prev.overflow === next.overflow && prev.start === next.start && prev.end === next.end ? prev : next))
    }
    measure()
    box.addEventListener("scroll", measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (box.firstElementChild) ro.observe(box.firstElementChild)
    return () => {
      box.removeEventListener("scroll", measure)
      ro.disconnect()
    }
  }, [])
  const label = text ?? uiLabels(locale).scrollHint
  return (
    <div ref={root} data-overflow={edge.overflow ? "" : undefined} className={cn("cn-block-scroll", className)}>
      <div data-more-start={edge.start ? "" : undefined} data-more-end={edge.end ? "" : undefined} className="cn-block-scroll-frame">
        {children}
      </div>
      <p aria-hidden="true" data-scroll-hint="" className="cn-block-scroll-hint">
        {label}
        <ArrowRight aria-hidden="true" className="cn-block-scroll-hint-icon" />
      </p>
    </div>
  )
}
