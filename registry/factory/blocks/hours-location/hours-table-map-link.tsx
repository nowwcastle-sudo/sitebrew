"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { DAYS, formatOpeningHours, isNeedsCheck, type Day, type HolidayPolicy, type Holidays, type OpeningHours, type SpecialHours } from "@/registry/factory/content/content-core"
import { ExternalLink, MapPin } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { formatDateParts } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { blockLabels } from "../_shared/block-labels"
import { CopyButton } from "../_shared/copy-button"
import { openNow, openStatusText, seoulDate, useNow, type OpenStatusCopy } from "../_shared/open-now"

// 영업시간·오시는 길 — 요일 표 + 지도 앱 링크. 왼쪽: 지금 상태 한 줄 + 월~일 표(오늘 줄 강조, 빠진 요일은 휴무).
// 오른쪽: 주소(복사) · 대중교통 · 주차 · 지도 앱 링크 목록(네이버·카카오·구글). 지도 iframe 은 쓰지 않는다 — 앱 링크가 길찾기를 맡는다.
export type HoursLocationHoursTableMapLinkCopy = {
  title: string
  lead?: string
  // 표 제목(읽기 도구용 caption)과 머리글
  tableCaption: string
  dayHeader: string
  hoursHeader: string
  days: Record<Day, string>
  todayLabel: string
  closedLabel: string
  status: OpenStatusCopy
  address: string
  addressLabel: string
  copyLabel: string
  copiedLabel: string
  // 클립보드가 막혔을 때(권한·인앱 브라우저) 알리는 글 — 「직접 복사해 주세요」. 없으면 주소 글자 그대로 보인다
  copyManualLabel?: string
  transit?: { label: string; text: string }
  parking?: { label: string; text: string }
  // 특수일·공휴일 안내(대장 A105) — 화면에 보이는 값이 JSON-LD specialOpeningHoursSpecification 과 같아야 한다. 이름이 없으면 날짜만
  special?: { title: string; closed: string }
  mapsLabel: string
  maps: { label: string; href: string }[]
}
export type HoursLocationHoursTableMapLinkProps = BlockBase<HoursLocationHoursTableMapLinkCopy> & {
  hours: OpeningHours
  // 특수일·공휴일(대장 A105) — 있으면 「지금 영업 중」·오늘 시간이 요일표보다 이것을 먼저 따른다
  special?: SpecialHours
  holidays?: Holidays
  holidayPolicy?: HolidayPolicy
  // 기준 시각(ISO) — 주면 그 시각으로 고정(예시·검사), 비우면 브라우저 시각(붙은 뒤)
  now?: string
}

const SPECIAL_DATE: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", weekday: "short" }

export function HoursLocationHoursTableMapLink({ copy, hours, special, holidays, holidayPolicy, now: at, locale, id = "hours", className }: HoursLocationHoursTableMapLinkProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const now = useNow(at)
  const status = now ? openNow(hours, now, { special, holidays, holidayPolicy }) : null
  const [head, detail] = status ? openStatusText(status, copy.status, copy.days) : ["", ""]
  const byDay = new Map(hours.map((h) => [h.day, h]))
  // 화면에 보일 특수일 = 특수일 + (공휴일 정책이 closed 일 때) 공휴일 휴무. 오늘 이후만(기준 시각을 알 때), 날짜순
  const today = now ? seoulDate(now) : ""
  const rowMap = new Map<string, { date: string; label?: string; closed: boolean; opens?: string; closes?: string }>()
  for (const x of special ?? []) rowMap.set(x.date, { date: x.date, label: x.label ?? holidays?.find((h) => h.date === x.date)?.label, closed: !!x.closed, opens: x.opens, closes: x.closes })
  if (holidayPolicy === "closed") for (const x of holidays ?? []) if (!rowMap.has(x.date)) rowMap.set(x.date, { date: x.date, label: x.label, closed: true })
  const spCopy = copy.special
  // 주소가 비었거나 「확인 필요」 자리 표시면 복사해 갈 글이 없다 — 복사 단추를 그리지 않는다. 지도 링크도 가는 곳이 비었거나 자리 표시면 뺀다(FIT-8)
  const addressUsable = copy.address.trim() !== "" && !isNeedsCheck(copy.address)
  const maps = copy.maps.filter((m) => m.href.trim() !== "" && !isNeedsCheck(m.href))
  const specialRows = [...rowMap.values()].filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <section ref={ref} id={id} data-block="hours-location-hours-table-map-link" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="cn-block-hours-split">
        <div data-enter className="cn-block-hours-table-wrap">
          <p className="cn-block-hours-status" data-state={status?.state}>
            {status ? (
              <>
                <span className="cn-block-hours-status-head font-heading">{head}</span>
                {detail ? <span className="cn-block-hours-status-detail">{detail}</span> : null}
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </p>
          <table className="cn-block-hours-table">
            <caption className="sr-only">{copy.tableCaption}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">{copy.dayHeader}</th>
                <th scope="col">{copy.hoursHeader}</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => {
                const h = byDay.get(d)
                const today = status?.today === d
                return (
                  <tr key={d} data-today={today ? "" : undefined} aria-current={today ? "date" : undefined} className="cn-block-hours-row">
                    <th scope="row" className="cn-block-hours-day">
                      {copy.days[d]}
                      {today ? <span className="cn-block-hours-today">{copy.todayLabel}</span> : null}
                    </th>
                    <td data-numeric className="cn-block-hours-time">
                      {h ? formatOpeningHours(h).replace(/^\S+\s/, "") : copy.closedLabel}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {spCopy && specialRows.length ? (
            <div data-special="" className="cn-block-hours-special">
              <h3 className="cn-block-hours-special-title font-heading">{spCopy.title}</h3>
              <ul className="cn-block-hours-special-list">
                {specialRows.map((r) => (
                  <li key={r.date} className="cn-block-hours-special-item">
                    <time dateTime={r.date} data-numeric>
                      {formatDateParts(`${r.date}T00:00:00Z`, SPECIAL_DATE, locale, "UTC")}
                    </time>{" "}
                    {r.label ? <span>{r.label}</span> : null}{" "}
                    <span data-numeric>{r.closed ? spCopy.closed : `${r.opens}~${r.closes === "24:00" ? blockLabels(locale).hours24 : r.closes}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div data-enter className="cn-block-hours-place">
          <div className="cn-block-hours-address">
            <MapPin aria-hidden="true" className="cn-block-hours-icon" />
            <div className="cn-block-hours-address-text">
              <span className="cn-block-hours-label">{copy.addressLabel}</span>
              <address className="cn-block-hours-address-line">{copy.address}</address>
            </div>
          </div>
          {addressUsable ? <CopyButton text={copy.address} copy={{ copy: copy.copyLabel, copied: copy.copiedLabel, manual: copy.copyManualLabel ?? copy.address }} size="sm" className="cn-block-hours-copy" /> : null}
          {copy.transit || copy.parking ? (
            <dl className="cn-block-hours-facts">
              {[copy.transit, copy.parking].filter((x): x is NonNullable<typeof x> => !!x).map((f) => (
                <div key={f.label} className="cn-block-hours-fact">
                  <dt className="cn-block-hours-label">{f.label}</dt>
                  <dd className="cn-block-hours-fact-text">{f.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {maps.length > 0 ? (
            <nav aria-label={copy.mapsLabel} className="cn-block-hours-maps">
              <ul className="cn-block-hours-map-list">
                {maps.map((m) => (
                  <li key={m.href}>
                    <Button variant="outline" nativeButton={false} render={<a href={m.href} />} className="cn-block-hours-map-link">
                      {m.label}
                      <ExternalLink aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  )
}
