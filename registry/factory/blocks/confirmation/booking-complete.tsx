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
    <section ref={ref} id={id} data-block="confirmation-booking-complete" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div className="cn-block-cbc-layout">
        <div data-enter className="cn-block-cbc-ticket">
          <p className="cn-block-cbc-status">
            <CheckCircle aria-hidden="true" className="cn-block-cbc-status-icon" />
            {copy.status}
          </p>
          <h2 id={`${id}-title`} className="cn-block-cbc-title font-heading-ko">
            {copy.title}
          </h2>
          <h3 className="cn-block-cbc-sub font-heading-ko">{copy.detailsTitle}</h3>
          <dl data-booking="" className="cn-block-cbc-details">
            <div className="cn-block-cbc-detail">
              <dt className="cn-block-cbc-detail-term">
                <Calendar aria-hidden="true" className="cn-block-cbc-detail-icon" />
                {copy.labels.date}
              </dt>
              <dd>
                <time data-numeric dateTime={booking.at}>
                  {formatDateParts(booking.at, WHEN, locale, timeZone)}
                </time>
              </dd>
            </div>
            <div className="cn-block-cbc-detail">
              <dt className="cn-block-cbc-detail-term">
                <User aria-hidden="true" className="cn-block-cbc-detail-icon" />
                {copy.labels.people}
              </dt>
              <dd data-numeric>{fillText(copy.peopleUnit, { n: booking.people })}</dd>
            </div>
            <div className="cn-block-cbc-detail">
              <dt className="cn-block-cbc-detail-term">
                <CheckCircle aria-hidden="true" className="cn-block-cbc-detail-icon" />
                {copy.labels.ref}
              </dt>
              <dd data-numeric>{booking.ref}</dd>
            </div>
          </dl>
          {booking.confirmed && copy.calendar ? (
            <div data-calendar="" role="group" aria-label={copy.calendar.legend} className="cn-block-cbc-cal">
              <p className="cn-block-cbc-cal-legend">{copy.calendar.legend}</p>
              <div className="cn-block-cbc-cal-actions">
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
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.primary.href} />} data-next-action="" onClick={() => track?.("cta_click", { id: "booking-next", label: copy.primary.label, section: id })} className="cn-block-cbc-primary">
            <MapPin aria-hidden="true" />
            {copy.primary.label}
          </Button>
          {copy.print ? <PrintButton label={copy.print} /> : null}
        </div>
        <div data-enter className="cn-block-cbc-side">
          <div data-next-steps="" className="cn-block-cbc-next">
            <h3 className="cn-block-cbc-sub font-heading-ko">{copy.nextTitle}</h3>
            <ol className="cn-block-cbc-next-list">
              {copy.next.map((s, i) => (
                <li key={i} className="cn-block-cbc-next-item">
                  <Clock aria-hidden="true" className="cn-block-cbc-next-icon" />
                  <span>
                    <span className="cn-block-cbc-next-title font-heading-ko">{s.title}</span> <span data-when="">{s.when}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div data-help="" className="cn-block-cbc-help">
            <h3 className="cn-block-cbc-sub font-heading-ko">{copy.help.title}</h3>
            {tel && copy.help.phone ? (
              <a href={`tel:${tel}`} className="cn-block-cbc-link">
                <Phone aria-hidden="true" className="cn-block-cbc-link-icon" />
                {copy.help.phoneLabel} <span data-numeric>{copy.help.phone}</span>
              </a>
            ) : null}
            {copy.help.channel ? (
              <a href={copy.help.channel.href} className="cn-block-cbc-link">
                {copy.help.channel.label}
              </a>
            ) : null}
          </div>
          {copy.rating ? (
            <fieldset data-rating-ask="" className="cn-block-cbc-rating">
              <legend className="cn-block-cbc-rating-legend">{copy.rating.legend}</legend>
              <div className="cn-block-cbc-rating-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cn-block-cbc-rating-item">
                    <input type="radio" name={`${id}-rating`} value={n} checked={rated === n} onChange={() => rate(n)} className="cn-block-cbc-rating-input" />
                    <span aria-hidden="true" className="cn-block-cbc-rating-star">★</span>
                    <span className="cn-block-cbc-rating-text">{fillText(copy.rating?.option ?? "{n}", { n })}</span>
                  </label>
                ))}
              </div>
              <p role="status" className="cn-block-cbc-rating-thanks">
                {rated ? copy.rating.thanks : ""}
              </p>
            </fieldset>
          ) : null}
        </div>
      </div>
    </section>
  )
}
