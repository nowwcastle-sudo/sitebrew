"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { AlertTriangle, CheckCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

// 상태 화면 — 오프라인 + 저장된 내용. 위 띠: 「오프라인입니다 · 마지막 저장 시각」(role=status) + [다시 연결 확인].
// 아래: 이 기기에 저장해 둔 내용 목록(항목마다 「저장된 내용」 표지와 저장 시각) — 연결 없이도 읽을 수 있는 것만 보인다.
// 연결 상태는 브라우저 online·offline 이벤트로 따라간다(online 을 주면 그 값으로 고정 — 예시·검사). 다시 연결되면 띠가
// 「다시 연결되었습니다」 + [새로 고침](onReload, 없으면 링크 없이 문구만)으로 바뀐다.
// 저장해 둔 것이 없는 앱(서비스 워커·저장소를 아직 안 쓰는 사이트)은 마지막 저장 시각과 저장된 내용 구획을 빼고 위 띠만 쓴다(FV1 Task 5.18): lastSavedLabel·lastSaved·title·emptyCached 는 선택이고,
// 저장된 항목도 안내 글도 없으면 아래 구획을 그리지 않는다 — 없는 저장을 있는 것처럼 보이지 않는다.
export type CachedItem = { title: string; body?: string; savedAt: string; href?: string }
export type StateScreenOfflineCachedCopy = {
  title?: string
  offline: string
  online: string
  lastSavedLabel?: string
  lastSaved?: string
  recheckLabel: string
  reloadLabel: string
  cachedBadge: string
  emptyCached?: string
}
export type StateScreenOfflineCachedProps = BlockBase<StateScreenOfflineCachedCopy> & {
  items: CachedItem[]
  online?: boolean
  onRecheck?: () => void
  onReload?: () => void
}

const subscribe = (on: () => void) => {
  window.addEventListener("online", on)
  window.addEventListener("offline", on)
  return () => {
    window.removeEventListener("online", on)
    window.removeEventListener("offline", on)
  }
}
const snapshot = () => navigator.onLine
// 서버 렌더에서는 오프라인으로 그린다 — 이 화면은 연결이 끊겼을 때 보이는 화면이다
const serverSnapshot = () => false

export function StateScreenOfflineCached({ copy, items, online: fixed, onRecheck, onReload, id = "offline", className }: StateScreenOfflineCachedProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const live = React.useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const online = fixed ?? live
  const hasCached = items.length > 0 || !!copy.emptyCached
  return (
    <section
      ref={ref}
      id={id}
      data-block="state-screen-offline-cached"
      data-online={online ? "" : undefined}
      aria-labelledby={copy.title && hasCached ? `${id}-title` : undefined}
      aria-label={copy.title && hasCached ? undefined : copy.offline}
      className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}
    >
      <div data-enter className="flex flex-col gap-4 border-2 border-foreground px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="status" className="flex items-start gap-3">
          {online ? <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0" />}
          <p className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
            <span className="text-[1.125rem] leading-[1.4] font-heading">{online ? copy.online : copy.offline}</span>
            {copy.lastSavedLabel && copy.lastSaved ? (
              <span className="text-base leading-[1.5]">
                {copy.lastSavedLabel} <span data-numeric>{copy.lastSaved}</span>
              </span>
            ) : null}
          </p>
        </div>
        {online ? (
          onReload ? (
            <Button type="button" onClick={onReload}>
              {copy.reloadLabel}
            </Button>
          ) : null
        ) : onRecheck ? (
          <Button type="button" variant="outline" onClick={onRecheck}>
            {copy.recheckLabel}
          </Button>
        ) : null}
      </div>
      {hasCached ? (
        <div className="flex flex-col gap-6">
          {copy.title ? (
            <h2 id={`${id}-title`} data-enter className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] font-heading">
              {copy.title}
            </h2>
          ) : null}
          {items.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it, i) => (
                <li key={i} data-enter className="flex flex-col items-start gap-2 border px-5 py-5">
                  <span className="border border-dashed px-2 text-base leading-[1.5]">{copy.cachedBadge}</span>
                  {it.href ? (
                    <a href={it.href} className="relative inline-flex min-h-11 items-center text-[1.125rem] leading-[1.45] underline-offset-4 [&[href]]:underline font-heading">
                      {it.title}
                    </a>
                  ) : (
                    <span className="relative inline-flex min-h-11 items-center text-[1.125rem] leading-[1.45] underline-offset-4 [&[href]]:underline font-heading">{it.title}</span>
                  )}
                  {it.body ? <p className="text-base leading-[1.6]">{it.body}</p> : null}
                  <p className="text-base leading-[1.5]">
                    <span data-numeric>{it.savedAt}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base leading-[1.7]">{copy.emptyCached}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
