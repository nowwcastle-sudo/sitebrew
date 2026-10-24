"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Day, OpeningHours } from "@/registry/factory/content/content-core"
import { ArrowRight, Clock, ExternalLink, MapPin, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/registry/factory/ui/card"

import { BlockHeading } from "../_shared/block-heading"
import { openNow, openStatusText, useNow, type OpenStatusCopy } from "../_shared/open-now"

// 영업시간·오시는 길 — 지점 카드 목록. 지점마다 카드 하나: 이름 + 지금 상태 배지(요일별 시간을 줬을 때) · 주소 · 오늘 시간 ·
// 전화 · 지도 앱 두 링크(네이버·카카오) · 지점 페이지. 좁은 화면 한 열, 넓으면 두세 열. 지점 칸은 local 원형 branches 와 같다.
export type Branch = {
  name: string
  url: string
  address: string
  todayHours: string
  telephone: string
  naverMapUrl: string
  kakaoMapUrl: string
  // 요일별 영업시간 — 있으면 지금 상태를 배지로 그린다(서울 시각)
  hours?: OpeningHours
}
export type HoursLocationBranchListCopy = {
  title: string
  lead?: string
  // 목록 이름 — 지점 수가 들어간다(「지점 {n}곳」)
  countTemplate: string
  days: Record<Day, string>
  status: OpenStatusCopy
  todayLabel: string
  naverLabel: string
  kakaoLabel: string
  pageLabel: string
}
export type HoursLocationBranchListProps = BlockBase<HoursLocationBranchListCopy> & { branches: Branch[]; now?: string }

export function HoursLocationBranchList({ copy, branches, now: at, id = "branches", className }: HoursLocationBranchListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const now = useNow(at)
  return (
    <section ref={ref} id={id} data-block="hours-location-branch-list" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        <p data-enter className="shrink-0 text-base leading-[1.5]">
          {copy.countTemplate.replace("{n}", String(branches.length))}
        </p>
      </div>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {branches.map((b, i) => {
          const status = now && b.hours ? openNow(b.hours, now) : null
          const [head, detail] = status ? openStatusText(status, copy.status, copy.days) : ["", ""]
          const tel = normalizePhone(b.telephone)
          return (
            <li key={i} data-enter className="flex min-w-0">
              <Card className="w-full">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-[1.25rem] leading-[1.35] font-heading">
                    <h3>{b.name}</h3>
                  </CardTitle>
                  {status ? (
                    <Badge variant={status.state === "open" ? "default" : "outline"} data-state={status.state}>
                      {head}
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="flex items-start gap-2 text-base leading-[1.6] break-keep">
                    <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span>{b.address}</span>
                  </p>
                  <p className="flex items-start gap-2 text-base leading-[1.6] break-keep">
                    <Clock aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span>
                      {copy.todayLabel} <span data-numeric>{b.todayHours}</span>
                      {detail ? <span className="text-foreground"> · {detail}</span> : null}
                    </span>
                  </p>
                  {tel ? (
                    <a href={`tel:${tel}`} className="relative inline-flex min-h-11 w-fit items-center gap-2 text-base underline underline-offset-4">
                      <Phone aria-hidden="true" className="mt-1 size-4 shrink-0" />
                      <span data-numeric>{b.telephone}</span>
                    </a>
                  ) : null}
                </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" nativeButton={false} render={<a href={b.naverMapUrl} />}>
                    {copy.naverLabel}
                    <span className="sr-only"> {b.name}</span>
                    <ExternalLink aria-hidden="true" />
                  </Button>
                  <Button variant="outline" size="sm" nativeButton={false} render={<a href={b.kakaoMapUrl} />}>
                    {copy.kakaoLabel}
                    <span className="sr-only"> {b.name}</span>
                    <ExternalLink aria-hidden="true" />
                  </Button>
                  <a href={b.url} className="relative ms-auto inline-flex min-h-11 items-center gap-1 text-base underline-offset-4 hover:underline">
                    {copy.pageLabel}
                    <span className="sr-only"> {b.name}</span>
                    <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  </a>
                </CardFooter>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
