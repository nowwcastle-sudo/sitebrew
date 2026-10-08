"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { DAYS, formatOpeningHours, type Day, type HolidayPolicy, type Holidays, type OpeningHours, type SpecialHours } from "@/registry/factory/content/content-core"
import { Clock, MapPin, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { openNow, openStatusText, useNow, type OpenStatusCopy } from "../_shared/open-now"

// 영업시간·오시는 길 — 「지금 영업 중」 큰 표시. 첫 칸이 지금 상태(큰 글자) + 오늘 시간 + 다음 바뀌는 때, 곁에 전화·길찾기 두 행동.
// 아래 한 줄 주간 띠(월~일, 오늘 강조 — 좁은 화면은 두 열 목록). 상태는 서울 시각으로 판정하고, 붙기 전(서버 렌더)에는 자리만 잡는다.
export type HoursLocationTodayHighlightCopy = {
  title: string
  lead?: string
  days: Record<Day, string>
  status: OpenStatusCopy
  todayLabel: string
  closedLabel: string
  weekLabel: string
  address: string
  callLabel: string
  directions: { label: string; href: string }
}
export type HoursLocationTodayHighlightProps = BlockBase<HoursLocationTodayHighlightCopy> & {
  hours: OpeningHours
  // 특수일·공휴일(대장 A105) — 있으면 「지금 영업 중」·오늘 시간이 요일표보다 이것을 먼저 따른다
  special?: SpecialHours
  holidays?: Holidays
  holidayPolicy?: HolidayPolicy
  telephone: string
  now?: string
}

export function HoursLocationTodayHighlight({ copy, hours, special, holidays, holidayPolicy, telephone, now: at, id = "today", className }: HoursLocationTodayHighlightProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const now = useNow(at)
  const status = now ? openNow(hours, now, { special, holidays, holidayPolicy }) : null
  const [head, detail] = status ? openStatusText(status, copy.status, copy.days) : ["", ""]
  const byDay = new Map(hours.map((h) => [h.day, h]))
  // 오늘 시간은 요일표가 아니라 오늘 실제로 적용되는 시간(특수일·공휴일 휴무 반영)
  const todayHours = status?.hoursToday ?? undefined
  const tel = normalizePhone(telephone)
  const hoursText = (d: Day) => {
    const h = byDay.get(d)
    return h ? formatOpeningHours(h).replace(/^\S+\s/, "") : copy.closedLabel
  }
  return (
    <section ref={ref} id={id} data-block="hours-location-today-highlight" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-today-panel" data-state={status?.state}>
        <div className="cn-block-today-now">
          <p className="cn-block-today-head font-heading">{status ? head : <span aria-hidden="true">&nbsp;</span>}</p>
          <p className="cn-block-today-detail">
            {status ? (
              <>
                <Clock aria-hidden="true" className="cn-block-today-icon" />
                <span>
                  {copy.todayLabel} <span data-numeric>{todayHours ? formatOpeningHours(todayHours).replace(/^\S+\s/, "") : copy.closedLabel}</span>
                  {detail ? ` · ${detail}` : ""}
                </span>
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </p>
          <p className="cn-block-today-address">
            <MapPin aria-hidden="true" className="cn-block-today-icon" />
            <span>{copy.address}</span>
          </p>
        </div>
        <div className="cn-block-today-actions">
          {tel ? (
            <Button size="lg" nativeButton={false} render={<a href={`tel:${tel}`} />}>
              <Phone aria-hidden="true" />
              {copy.callLabel}
              <span data-numeric className="cn-block-today-tel">
                {telephone}
              </span>
            </Button>
          ) : null}
          <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.directions.href} />}>
            <MapPin aria-hidden="true" />
            {copy.directions.label}
          </Button>
        </div>
      </div>
      <div data-enter className="cn-block-today-week">
        <h3 className="cn-block-today-week-title font-heading">{copy.weekLabel}</h3>
        <ul className="cn-block-today-week-list">
          {DAYS.map((d) => {
            const today = status?.today === d
            return (
              <li key={d} data-today={today ? "" : undefined} aria-current={today ? "date" : undefined} className="cn-block-today-day">
                <span className="cn-block-today-day-name">
                  {copy.days[d]}
                  {today ? <span className="sr-only"> {copy.todayLabel}</span> : null}
                </span>
                <span data-numeric className="cn-block-today-day-hours">
                  {hoursText(d)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
