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
    <section ref={ref} id={id} data-block="hours-location-hours-table-map-link" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
        <div data-enter className="flex min-w-0 flex-col gap-4">
          <p className="flex min-h-8 flex-wrap items-baseline gap-x-3 gap-y-1 text-base leading-[1.5]" data-state={status?.state}>
            {status ? (
              <>
                <span className="text-[1.25rem] leading-[1.3] font-heading">{head}</span>
                {detail ? <span className="text-base text-foreground">{detail}</span> : null}
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </p>
          <table className="w-full border-collapse text-left">
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
                  <tr key={d} data-today={today ? "" : undefined} aria-current={today ? "date" : undefined} className="border-b data-[today]:bg-muted">
                    <th scope="row" className="w-24 py-3 ps-3 pe-4 text-left align-top text-base leading-[1.5] font-normal in-data-[today]:font-medium">
                      {copy.days[d]}
                      {today ? <span className="ms-2 inline-block border px-1.5 text-base leading-[1.4]">{copy.todayLabel}</span> : null}
                    </th>
                    <td data-numeric className="py-3 pe-3 text-base leading-[1.5] tabular-nums">
                      {h ? formatOpeningHours(h).replace(/^\S+\s/, "") : copy.closedLabel}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {spCopy && specialRows.length ? (
            <div data-special="" className="mt-6 flex flex-col gap-2 border-t pt-4">
              <h3 className="text-base leading-[1.4] font-heading">{spCopy.title}</h3>
              <ul className="flex flex-col gap-1">
                {specialRows.map((r) => (
                  <li key={r.date} className="text-base leading-[1.6]">
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
        <div data-enter className="flex min-w-0 flex-col gap-6">
          <div className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-base leading-[1.5] font-medium">{copy.addressLabel}</span>
              <address className="text-[1.125rem] leading-[1.6] not-italic break-keep">{copy.address}</address>
            </div>
          </div>
          {addressUsable ? <CopyButton text={copy.address} copy={{ copy: copy.copyLabel, copied: copy.copiedLabel, manual: copy.copyManualLabel ?? copy.address }} size="sm" className="flex flex-wrap items-center gap-3 ps-8" /> : null}
          {copy.transit || copy.parking ? (
            <dl className="flex flex-col gap-4 border-t pt-6">
              {[copy.transit, copy.parking].filter((x): x is NonNullable<typeof x> => !!x).map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <dt className="text-base leading-[1.5] font-medium">{f.label}</dt>
                  <dd className="text-base leading-[1.7]">{f.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {maps.length > 0 ? (
            <nav aria-label={copy.mapsLabel} className="border-t pt-6">
              <ul className="flex flex-wrap gap-3">
                {maps.map((m) => (
                  <li key={m.href}>
                    <Button variant="outline" nativeButton={false} render={<a href={m.href} />} className="min-h-11">
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
