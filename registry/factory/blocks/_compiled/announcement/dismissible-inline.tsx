"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { Bell } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { DateText, fill, useNow } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { useSnooze } from "../_shared/snooze"

// 본문 안 알림 판(마케팅 규칙 A8·L3·L7·L8 — factory-rules.md §22-1·§22-6). 한 메시지(제목·한 줄·기간)와 권하는 행동 하나. 권유를 다시 묻는 판이라(들를 때마다 보인다)
// 실제 거절 선택지 「괜찮아요」(권하는 행동과 대등 — L3)와 「7일간 보지 않기」를 함께 둔다(L7). 거절은 이 공지 id 로 기억하고, 쉬기는 7일만.
// 기간이 있다: endsAt(필수)이 지나면 그리지 않고, 판에 「{date}까지」로 끝나는 날을 적는다(L8 — 실제 값). 계측(선택): 누르면 cta_click.
export type AnnouncementDismissibleInlineCopy = {
  title: string
  body: string
  // 「{date}까지」
  until: string
  action: { label: string; href: string }
  decline: string
  snooze: string
}
export type AnnouncementDismissibleInlineProps = BlockBase<AnnouncementDismissibleInlineCopy> & {
  announcementId: string
  endsAt: IsoDate
  startsAt?: IsoDate
  now?: IsoDate
  track?: AnalyticsPort["track"]
}

export function AnnouncementDismissibleInline({ copy, locale, timeZone, announcementId, endsAt, startsAt, now, track, id = "notice", className }: AnnouncementDismissibleInlineProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const at = new Date(useNow(now)).getTime()
  const declined = useDismissMemory(`wf-notice:${announcementId}`)
  const { snoozed, snooze } = useSnooze(`wf-notice-snooze:${announcementId}`, 7)
  const [closedNow, setClosedNow] = React.useState(false)
  const live = at < new Date(endsAt).getTime() && (!startsAt || at >= new Date(startsAt).getTime())
  const visible = live && !closedNow && declined.dismissed !== true && snoozed !== true
  const decide = (why: "decline" | "snooze") => {
    track?.("cta_click", { id: `notice-${why}-${announcementId}`, label: why === "decline" ? copy.decline : copy.snooze, section: id })
    setClosedNow(true)
    if (why === "decline") declined.set(true)
    else snooze()
  }
  return (
    <section ref={ref} id={id} data-block="announcement-dismissible-inline" data-announcement={announcementId} aria-labelledby={`${id}-title`} hidden={!visible || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 md:gap-12 md:px-8 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 py-8 md:py-10", className)}>
      <div data-enter className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-5 rounded-lg border border-s-8 border-s-primary px-5 py-5 md:grid-cols-[auto_1fr_auto] md:items-center md:px-6">
        <Bell aria-hidden="true" className="mt-1 size-6 text-primary md:mt-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${id}-title`} className="text-[1.25rem] leading-[1.35] font-heading-ko">
            {copy.title}
          </h2>
          <p className="text-base leading-[1.6]">{copy.body}</p>
          <p data-until="" className="text-base leading-[1.5]">
            {fill(copy.until, { date: <DateText locale={locale} timeZone={timeZone} iso={endsAt} /> })}
          </p>
        </div>
        <div className="col-span-2 flex flex-col items-stretch gap-1 md:col-span-1 md:w-80">
          <ChoiceRow label={copy.title}>
            <ChoiceButton choice="decline" type="button" onClick={() => decide("decline")}>
              {copy.decline}
            </ChoiceButton>
            <ChoiceButton choice="primary" nativeButton={false} role="link" render={<a href={copy.action.href} />} onClick={() => track?.("cta_click", { id: `notice-${announcementId}`, label: copy.action.label, section: id })}>
              {copy.action.label}
            </ChoiceButton>
          </ChoiceRow>
          <Button type="button" variant="link" data-snooze="" onClick={() => decide("snooze")} className="self-center">
            {copy.snooze}
          </Button>
        </div>
      </div>
    </section>
  )
}
