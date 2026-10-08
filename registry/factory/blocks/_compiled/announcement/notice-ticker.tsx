"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"

import { DateText } from "../_shared/billing-format"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"

// 굴러가는 공지 줄(공공·기관·쇼핑몰의 맨 위 공지 롤링). 공지 여럿이 한 줄 자리에서 5초마다 하나씩 바뀐다(같은 칸에 겹쳐 쌓고 활성 하나만 보인다 — 높이가 가장 긴 공지에 맞아 바뀔 때 흔들리지 않는다).
// 스스로 움직이는 정보라 멈출 수 있어야 한다(WCAG 2.2.2): 정지 단추(_shared/loop-pause — 눌림 상태 aria-pressed) + 마우스를 올리거나 초점이 들어오면 멈춘다.
// 동작 줄이기(reducedMotion)에서는 굴리지 않고 공지를 모두 목록으로 보인다 — 움직이는 쪽 모양(겹쳐 쌓기)은 CSS motion-safe 에서만 걸리므로 서버 렌더·JS 없는 화면도 같다.
// 굴리는 동안 활성이 아닌 공지는 inert(초점·읽기 도구 밖)이고 줄은 aria-live="off"(바뀔 때마다 낭독하지 않는다). 공지 하나면 굴리지 않고 정지 단추도 없다.
// 선택: 날짜(공지가 올라간 날)·링크, 「전체 보기」 링크. 계측(선택): cta_click.
export type NoticeItem = { text: string; href?: string; date?: IsoDate }
export type AnnouncementNoticeTickerCopy = {
  // 읽기 도구용 구역 이름(보이지 않는 h2)
  label: string
  items: NoticeItem[]
  // 정지 단추의 이름(늘 같다 — 눌림 상태로 말한다): 「공지 자동 넘김」
  pause: string
  viewAll?: { label: string; href: string }
}
export type AnnouncementNoticeTickerProps = BlockBase<AnnouncementNoticeTickerCopy> & {
  // 공지가 바뀌는 간격(ms) — 5초 아래로는 내려가지 않는다(읽을 시간)
  intervalMs?: number
  track?: AnalyticsPort["track"]
}

export function AnnouncementNoticeTicker({ copy, locale, timeZone, intervalMs = 5000, track, id = "notice-ticker", className }: AnnouncementNoticeTickerProps) {
  const reducedMotion = useReducedMotion()
  const loop = useLoopPause()
  const [at, setAt] = React.useState(0)
  // 마우스를 올렸거나 초점이 들어와 있는 동안
  const [held, setHeld] = React.useState(false)
  const items = copy.items
  const rolling = !reducedMotion && items.length > 1
  const current = at % Math.max(1, items.length)
  React.useEffect(() => {
    if (!rolling || loop.paused || held) return
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") setAt((i) => i + 1)
    }, Math.max(5000, intervalMs))
    return () => window.clearInterval(t)
  }, [rolling, loop.paused, held, intervalMs])
  return (
    <section
      id={id}
      data-block="announcement-notice-ticker"
      aria-labelledby={`${id}-title`}
      {...loop.rootProps}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      className={cn("w-full border-b bg-muted", className)}
    >
      <h2 id={`${id}-title`} className="sr-only">
        {copy.label}
      </h2>
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1 md:gap-4 md:px-8">
        <ul aria-live="off" className="grid min-w-0 flex-1 motion-reduce:flex motion-reduce:flex-col motion-reduce:gap-1">
          {items.map((item, i) => (
            <li key={i} data-active={i === current ? "" : undefined} inert={rolling && i !== current ? true : undefined} className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-0 py-1.5 text-base leading-[1.5] motion-safe:col-start-1 motion-safe:row-start-1 motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-enter) motion-safe:ease-(--ease-standard) motion-safe:not-data-[active]:pointer-events-none motion-safe:not-data-[active]:translate-y-2 motion-safe:not-data-[active]:opacity-0">
              {item.date ? <DateText iso={item.date} as="since" locale={locale} timeZone={timeZone} className="text-sm leading-[1.4]" /> : null}
              {item.href ? (
                <a href={item.href} onClick={() => track?.("cta_click", { id: `notice-ticker-${i + 1}`, label: item.text, section: id })} className="relative inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]">
                  {item.text}
                </a>
              ) : (
                <span className="min-w-0 [overflow-wrap:anywhere]">{item.text}</span>
              )}
            </li>
          ))}
        </ul>
        {rolling ? <LoopPause paused={loop.paused} onToggle={loop.toggle} label={copy.pause} className="shrink-0" /> : null}
        {copy.viewAll ? (
          <a href={copy.viewAll.href} className="relative inline-flex min-h-11 shrink-0 items-center gap-1 text-base underline underline-offset-4">
            {copy.viewAll.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        ) : null}
      </div>
    </section>
  )
}
