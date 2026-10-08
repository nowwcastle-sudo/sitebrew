"use client"

import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"

// 소리 켜기 단추(FV1 Task 5.7, 공유 조각 block-shared-sound-toggle). 배경 영상은 늘 소리 없이(muted) 시작하고, 사용자가 이 단추를 누른 뒤에만 소리를 낸다.
// 이 조각은 영상을 재생하지 않는다 — 이미 재생 중인 영상의 음소거만 푼다(자동 재생 정책: 소리 있는 재생은 사용자 조작이 있어야 한다).
// 쓰는 법: 장면 뿌리 ref 로 useSoundToggle(ref, active?) 를 부르고, 돌려받은 { on, toggle } 을 <SoundToggle on onToggle label /> 에 넘긴다.
//   · 영상이 컷마다 따로 있으면(몽타주) 컷 칸에 data-wf-cut 을 달고 켜진 컷에만 data-active — 켜진 컷의 영상만 소리가 난다. active 에 컷 번호를 넘기면 컷이 바뀔 때 다시 맞춘다.
//   · 단추 이름은 늘 같고(「소리 켜기」) 눌림 상태(aria-pressed)로 말한다. 44px 칸, 불투명 포커스 링, 동작 줄이기에서는 영상이 돌지 않으니 숨긴다(loop-pause 와 같다).
export function useSoundToggle(scope: React.RefObject<HTMLElement | null>, active?: number | string) {
  const [on, setOn] = React.useState(false)
  const toggle = React.useCallback(() => setOn((v) => !v), [])
  React.useEffect(() => {
    const root = scope.current
    if (!root) return
    for (const v of root.querySelectorAll("video")) {
      const cut = v.closest("[data-wf-cut]")
      const audible = on && (cut === null || cut.hasAttribute("data-active"))
      v.muted = !audible
    }
  }, [scope, on, active])
  return { on, toggle }
}

export function SoundToggle({ on, onToggle, label, className }: { on: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <button type="button" data-wf-sound-toggle="" aria-pressed={on} aria-label={label} onClick={onToggle} className={cn("inline-flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-(--wf-shadow-surface) outline-hidden focus-visible:ring-3 focus-visible:ring-ring motion-reduce:hidden", className)}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
        <path d="M2 6v4h3l4 3V3L5 6z" fill="currentColor" />
        {on ? <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /> : <path d="M11 6l4 4M15 6l-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
      </svg>
    </button>
  )
}
