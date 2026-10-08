"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { Calendar, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { DateText, DaysLeft, fill, useNow } from "../_shared/billing-format"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { HeroTexture, type TextureLike } from "../_shared/hero-parts"

// 출시·행사 띠 배너(마케팅 규칙 A8·L8 — factory-rules.md §22-1·§22-6). 넓은 띠 하나에 한 메시지: 머리말 · h2 · 한 줄 · 기간(시작·끝 실제 날짜) · 행동 하나 · 닫기(기억).
// 기간이 있다 — endsAt(필수)이 지나면(startsAt 전에도) 그리지 않는다. 남은 날은 showCountdown 을 켤 때만 실제 endsAt 으로 센다(L8 — 상시 「곧 종료」·되돌아가는 타이머 없음).
// 계측(선택): 행동·닫기를 누르면 cta_click.
export type AnnouncementLaunchBannerCopy = {
  eyebrow?: string
  title: string
  body: string
  // 「{start}부터 {end}까지」 또는 「{end}까지」
  period: string
  cta: { label: string; href: string }
  dismiss: string
  // 「{days}일 남았어요」
  countdown?: string
}
export type AnnouncementLaunchBannerProps = BlockBase<AnnouncementLaunchBannerCopy> & {
  announcementId: string
  endsAt: IsoDate
  startsAt?: IsoDate
  now?: IsoDate
  showCountdown?: boolean
  track?: AnalyticsPort["track"]
  // 질감(스타일 축 X, P3-2 Task 8 대장 A20 — 히어로 옆 띠): 레시피 머리가 X1~X3 이면 조립하는 쪽이 Texture 를 넘긴다. 띠 판 뒤 층으로 깐다.
  texture?: TextureLike
}

export function AnnouncementLaunchBanner({ copy, locale, timeZone, announcementId, endsAt, startsAt, now, showCountdown = false, track, texture, id = "launch", className }: AnnouncementLaunchBannerProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const nowIso = useNow(now)
  const at = new Date(nowIso).getTime()
  const { dismissed, set } = useDismissMemory(`wf-launch:${announcementId}`)
  const [closedNow, setClosedNow] = React.useState(false)
  const live = at < new Date(endsAt).getTime() && (!startsAt || at >= new Date(startsAt).getTime())
  const visible = live && !closedNow && dismissed !== true
  const close = () => {
    track?.("cta_click", { id: `launch-dismiss-${announcementId}`, label: copy.dismiss, section: id })
    setClosedNow(true)
    set(true)
  }
  return (
    <section ref={ref} id={id} data-block="announcement-launch-banner" data-announcement={announcementId} aria-labelledby={`${id}-title`} hidden={!visible || undefined} className={cn("cn-block-alb-section", className)}>
      <div data-enter className="cn-block-alb-band">
        <HeroTexture texture={texture} />
        <Button type="button" variant="ghost" size="icon-lg" aria-label={copy.dismiss} onClick={close} className="cn-block-alb-dismiss">
          <X aria-hidden="true" />
        </Button>
        <div className="cn-block-alb-text">
          {copy.eyebrow ? <p className="cn-block-alb-eyebrow">{copy.eyebrow}</p> : null}
          <h2 id={`${id}-title`} className="cn-block-alb-title font-heading-ko">
            {copy.title}
          </h2>
          <p className="cn-block-alb-body">{copy.body}</p>
        </div>
        <div className="cn-block-alb-side">
          <p data-period="" className="cn-block-alb-period">
            <Calendar aria-hidden="true" className="cn-block-alb-period-icon" />
            <span>{fill(copy.period, { start: startsAt ? <DateText locale={locale} timeZone={timeZone} iso={startsAt} as="since" /> : "", end: <DateText locale={locale} timeZone={timeZone} iso={endsAt} /> })}</span>
          </p>
          {showCountdown && copy.countdown ? <DaysLeft endsAt={endsAt} now={nowIso} template={copy.countdown} className="cn-block-alb-countdown font-heading-ko" /> : null}
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.cta.href} />} onClick={() => track?.("cta_click", { id: `launch-${announcementId}`, label: copy.cta.label, section: id })} className="cn-block-alb-cta">
            {copy.cta.label}
          </Button>
        </div>
      </div>
    </section>
  )
}
