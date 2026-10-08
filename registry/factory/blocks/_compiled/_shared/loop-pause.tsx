"use client"

import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"

// 움직임 정지 단추(P3-5 MOTKIT, 공유 조각 block-shared-loop-pause): 5초 넘게 스스로 도는 배경(영상·켄 번스·이름표 순환)을 멈추고 다시 튼다(WCAG 2.2.2 ·
// DESIGN §8-7). 단추 상태가 정본이다 — 부르는 쪽은 useLoopPause 의 rootProps 를 장면 뿌리에 펴고(data-wf-user-paused → 장면 유휴 반복 정지,
// 화면에 다시 들어와도 그대로), paused 를 영상(MediaVideo paused)에 넘긴다. 이름은 늘 같고 눌림 상태(aria-pressed)로 말한다.
// 동작 줄이기에서는 아무것도 돌지 않아 단추를 숨긴다. 44px 칸, 불투명 포커스 링(묶음 2).
export function useLoopPause() {
  const [paused, setPaused] = React.useState(false)
  const toggle = React.useCallback(() => setPaused((p) => !p), [])
  return { paused, toggle, rootProps: paused ? { "data-wf-user-paused": "" } : {} }
}

export function LoopPause({ paused, onToggle, label, className }: { paused: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <button type="button" data-wf-loop-pause="" aria-pressed={paused} aria-label={label} onClick={onToggle} className={cn("inline-flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-(--wf-shadow-surface) outline-hidden focus-visible:ring-3 focus-visible:ring-ring motion-reduce:hidden", className)}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
        {paused ? (
          <path d="M5 3v10l8-5z" fill="currentColor" />
        ) : (
          <>
            <rect x="4" y="3" width="3" height="10" fill="currentColor" />
            <rect x="9" y="3" width="3" height="10" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  )
}
