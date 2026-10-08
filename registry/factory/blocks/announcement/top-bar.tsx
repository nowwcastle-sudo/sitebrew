"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { ArrowRight, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { DaysLeft, useNow } from "../_shared/billing-format"
import { useDismissMemory } from "../_shared/dismiss-memory"

// 맨 위 공지 띠(마케팅 규칙 A8·L8 — factory-rules.md §22-1·§22-6). 메시지 하나 + 선택 링크 하나 + 닫기. 닫은 것은 이 브라우저에 기억한다(공지 id 마다 — 새 공지는 다시 보인다).
// 기간이 있다: endsAt(필수)이 지나면(또 startsAt 전이면) 그리지 않는다(A8). 남은 날은 showCountdown 을 켤 때만, 실제 endsAt 으로 센다(L8 — 고정 문구·되돌아가는 타이머 없음).
// 고정(fixed)·스티키가 아니라 흐름 안 띠다(내용을 가리지 않는다). 계측(선택): 링크·닫기를 누르면 cta_click.
export type AnnouncementTopBarCopy = {
  // 읽기 도구용 구역 이름(보이지 않는 h2)
  label: string
  message: string
  link?: { label: string; href: string }
  dismiss: string
  // 「{days}일 남았어요」
  countdown?: string
}
export type AnnouncementTopBarProps = BlockBase<AnnouncementTopBarCopy> & {
  // 공지 id — 닫은 것을 이 id 로 기억한다(문구를 바꾸면 id 도 바꾼다)
  announcementId: string
  endsAt: IsoDate
  startsAt?: IsoDate
  now?: IsoDate
  showCountdown?: boolean
  track?: AnalyticsPort["track"]
}

export function AnnouncementTopBar({ copy, announcementId, endsAt, startsAt, now, showCountdown = false, track, id = "announcement", className }: AnnouncementTopBarProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: -6 })
  })
  const at = new Date(useNow(now)).getTime()
  const { dismissed, set } = useDismissMemory(`wf-announcement:${announcementId}`)
  const [closedNow, setClosedNow] = React.useState(false)
  const live = at < new Date(endsAt).getTime() && (!startsAt || at >= new Date(startsAt).getTime())
  const visible = live && !closedNow && dismissed !== true
  const close = () => {
    track?.("cta_click", { id: `announcement-dismiss-${announcementId}`, label: copy.dismiss, section: id })
    setClosedNow(true)
    set(true)
  }
  return (
    <section ref={ref} id={id} data-block="announcement-top-bar" data-announcement={announcementId} data-ends-at={endsAt} aria-labelledby={`${id}-title`} hidden={!visible || undefined} className={cn("cn-block-atb-section", className)}>
      <h2 id={`${id}-title`} className="sr-only">
        {copy.label}
      </h2>
      <div data-enter className="cn-block-atb-bar">
        <p className="cn-block-atb-message">
          <span>{copy.message}</span>
          {showCountdown && copy.countdown ? <DaysLeft endsAt={endsAt} now={new Date(at).toISOString()} template={copy.countdown} className="cn-block-atb-countdown" /> : null}
          {copy.link ? (
            <a href={copy.link.href} onClick={() => track?.("cta_click", { id: `announcement-${announcementId}`, label: copy.link?.label ?? "", section: id })} className="cn-block-atb-link">
              {copy.link.label}
              <ArrowRight aria-hidden="true" className="cn-block-atb-link-icon" />
            </a>
          ) : null}
        </p>
        <Button type="button" variant="ghost" size="icon" aria-label={copy.dismiss} onClick={close} className="cn-block-atb-dismiss">
          <X aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
