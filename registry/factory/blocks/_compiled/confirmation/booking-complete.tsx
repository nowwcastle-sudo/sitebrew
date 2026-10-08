"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { Calendar, CheckCircle, Clock, ExternalLink, MapPin, Phone, User } from "@/registry/factory/icons"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText, formatDateParts } from "../_shared/billing-format"
import { PrintButton } from "../_shared/print-button"
import { googleCalendarHref, icsHref } from "../_shared/calendar-links"

// 예약·문의 요청 완료(마케팅 규칙 A10·V4·T9 — factory-rules.md §22-4·§22-5·§22-6, 운영자 결정 Q13: 지역 가게는 링크 + 문의 폼, 자체 예약 시스템 없음 — 이 화면은 요청을 보낸 뒤다).
// 흐름을 끊지 않는다(A10): 요청한 내용(날짜·시각·인원·요청 번호) · 다음에 일어날 일과 그때(가게가 확인 → 확정 문자) · 도움(전화·채널) · 다음 행동 하나(오시는 길).
// 성공 뒤라서 여기서만 경험 평점을 묻는다(V4). 별점은 아무것도 고르지 않은 채로 시작하고(T9), 고르면 고맙다는 한 줄만 — 보상·재촉 없음.
// 계측(선택): 다음 행동 cta_click · 별점을 고르면 cta_click(id booking-rating-<n>) — 누가 골랐는지는 싣지 않는다.
export type ConfirmationBookingCompleteCopy = {
  title: string
  status: string
  detailsTitle: string
  labels: { date: string; people: string; ref: string }
  // 「{n}명」
  peopleUnit: string
  nextTitle: string
  next: { title: string; when: string }[]
  help: { title: string; phone?: string; phoneLabel: string; channel?: { label: string; href: string } }
  primary: { label: string; href: string }
  // 「인쇄·PDF로 저장」 버튼 글(대장 A104) — 있을 때만 그린다. 버튼은 인쇄물에 나오지 않는다
  print?: string
  // 캘린더에 넣기(대장 A65) — booking.confirmed 일 때만 보인다(요청만 한 예약은 시각이 확정이 아니라 숨긴다). eventTitle 의 「{ref}」는 요청 번호
  calendar?: { legend: string; ics: string; google: string; eventTitle: string; description?: string }
  rating?: { legend: string; option: string; thanks: string }
}
export type ConfirmationBookingCompleteProps = BlockBase<ConfirmationBookingCompleteCopy> & {
  // confirmed: 가게가 시각을 확정했다(캘린더 버튼이 나온다). minutes: 예약 길이(기본 60분). location: 캘린더 일정 장소
  booking: { at: IsoDate; people: number; ref: string; confirmed?: boolean; minutes?: number; location?: string }
  track?: AnalyticsPort["track"]
}

const WHEN: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }

export function ConfirmationBookingComplete({ copy, booking, track, locale, timeZone, id = "booking-complete", className }: ConfirmationBookingCompleteProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [rated, setRated] = React.useState<number | null>(null)
  const tel = copy.help.phone ? normalizePhone(copy.help.phone) : null
  const event = { uid: booking.ref, title: fillText(copy.calendar?.eventTitle ?? "{ref}", { ref: booking.ref }), start: booking.at, minutes: booking.minutes, location: booking.location, description: copy.calendar?.description }
  const rate = (n: number) => {
    setRated(n)
    track?.("cta_click", { id: `booking-rating-${n}`, label: fillText(copy.rating?.option ?? "{n}", { n }), section: id })
  }
  return (
    <section ref={ref} id={id} data-block="confirmation-booking-complete" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
        <div data-enter className="flex min-w-0 flex-col gap-4 rounded-lg border-2 border-dashed px-5 py-6 md:px-8">
          <p className="flex items-center gap-2 text-base leading-[1.5]">
            <CheckCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
            {copy.status}
          </p>
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] font-heading-ko">
            {copy.title}
          </h2>
          <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.detailsTitle}</h3>
          <dl data-booking="" className="flex flex-col divide-y border-y">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-base leading-[1.5]">
              <dt className="flex items-center gap-2">
                <Calendar aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {copy.labels.date}
              </dt>
              <dd>
                <time data-numeric dateTime={booking.at}>
                  {formatDateParts(booking.at, WHEN, locale, timeZone)}
                </time>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-base leading-[1.5]">
              <dt className="flex items-center gap-2">
                <User aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {copy.labels.people}
              </dt>
              <dd data-numeric>{fillText(copy.peopleUnit, { n: booking.people })}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-base leading-[1.5]">
              <dt className="flex items-center gap-2">
                <CheckCircle aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {copy.labels.ref}
              </dt>
              <dd data-numeric>{booking.ref}</dd>
            </div>
          </dl>
          {booking.confirmed && copy.calendar ? (
            <div data-calendar="" role="group" aria-label={copy.calendar.legend} className="flex flex-col gap-3 border-t pt-4">
              <p className="text-base font-medium">{copy.calendar.legend}</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" nativeButton={false} render={<a href={icsHref(event)} download="booking.ics" />}>
                  <Calendar aria-hidden="true" />
                  {copy.calendar.ics}
                </Button>
                <Button variant="outline" nativeButton={false} render={<a href={googleCalendarHref(event)} target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLink aria-hidden="true" />
                  {copy.calendar.google}
                </Button>
              </div>
            </div>
          ) : null}
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.primary.href} />} data-next-action="" onClick={() => track?.("cta_click", { id: "booking-next", label: copy.primary.label, section: id })} className="w-full">
            <MapPin aria-hidden="true" />
            {copy.primary.label}
          </Button>
          {copy.print ? <PrintButton label={copy.print} /> : null}
        </div>
        <div data-enter className="flex min-w-0 flex-col gap-6">
          <div data-next-steps="" className="flex flex-col gap-3">
            <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.nextTitle}</h3>
            <ol className="flex flex-col gap-3">
              {copy.next.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-base leading-[1.6]">
                  <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="text-base font-heading-ko">{s.title}</span> <span data-when="">{s.when}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div data-help="" className="flex flex-col items-start gap-1 border-t pt-4">
            <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.help.title}</h3>
            {tel && copy.help.phone ? (
              <a href={`tel:${tel}`} className="relative inline-flex min-h-11 items-center gap-1 text-base underline underline-offset-4">
                <Phone aria-hidden="true" className="size-4 shrink-0" />
                {copy.help.phoneLabel} <span data-numeric>{copy.help.phone}</span>
              </a>
            ) : null}
            {copy.help.channel ? (
              <a href={copy.help.channel.href} className="relative inline-flex min-h-11 items-center gap-1 text-base underline underline-offset-4">
                {copy.help.channel.label}
              </a>
            ) : null}
          </div>
          {copy.rating ? (
            <fieldset data-rating-ask="" className="flex flex-col gap-2 border-t pt-4">
              <legend className="float-start mb-2 w-full text-base leading-[1.5]">{copy.rating.legend}</legend>
              <div className="clear-both flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 has-[:checked]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
                    <input type="radio" name={`${id}-rating`} value={n} checked={rated === n} onChange={() => rate(n)} className="peer sr-only" />
                    <span aria-hidden="true" className="text-[1.25rem] leading-none text-foreground/30 peer-checked:text-primary">★</span>
                    <span className="text-base leading-none tabular-nums">{fillText(copy.rating?.option ?? "{n}", { n })}</span>
                  </label>
                ))}
              </div>
              <p role="status" className="min-h-6 text-base leading-[1.5] empty:hidden">
                {rated ? copy.rating.thanks : ""}
              </p>
            </fieldset>
          ) : null}
        </div>
      </div>
    </section>
  )
}
