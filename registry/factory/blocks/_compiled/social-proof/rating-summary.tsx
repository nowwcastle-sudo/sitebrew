"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Star } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { countUp, rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Card } from "@/registry/factory/ui/card"
import { Progress } from "@/registry/factory/ui/progress"

// 사회적 증거 — 평점 요약. 왼쪽 기둥: 평균 별점 큰 숫자 + 별 + 후기 수 + 별점별 막대 분포(5점 → 1점). 오른쪽: 대표 후기 3개(짧게).
// 숫자는 data-numeric(고른 폭). 별은 장식(aria-hidden) — 점수는 글자로 읽힌다. 막대는 Progress(레시피 모양), 이름은 「5점 72%」.
export type SocialProofRatingSummaryCopy = {
  title: string
  lead?: string
  score: number
  outOf: number
  // 후기 수 문구 틀 — {n} 자리에 ko-KR 로 적은 전체 수(예: 「후기 {n}개」).
  countTemplate: string
  // 점수 단위(예: 「점」 → 「5점」).
  scoreUnit: string
  // 5점부터 1점까지 받은 수(길이 = outOf).
  distribution: number[]
  reviews: { rating: number; text: string; name: string; date: string }[]
}
export type SocialProofRatingSummaryProps = BlockBase<SocialProofRatingSummaryCopy>

const fmt = (n: number) => n.toLocaleString("ko-KR")

export function SocialProofRatingSummary({ copy, id = "social-proof", className }: SocialProofRatingSummaryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
    countUp(s, s.q("[data-count-up]"), { at: 0 })
  })
  const total = copy.distribution.reduce((a, b) => a + b, 0)
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const stars = (value: number, key: string) => (
    <span aria-hidden="true" className="inline-flex gap-1">
      {Array.from({ length: copy.outOf }, (_, i) => (
        <Star key={`${key}-${i}`} data-on={i < Math.round(value) ? "" : undefined} className="size-5 text-border data-[on]:fill-current data-[on]:text-foreground" />
      ))}
    </span>
  )
  return (
    <section ref={ref} id={id} data-block="social-proof-rating-summary" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid gap-12 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-16">
        <div data-enter className="flex min-w-0 flex-col gap-4 md:sticky md:top-24 md:self-start">
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
            {copy.title}
          </h2>
          {copy.lead ? <p className="text-base leading-[1.7]">{copy.lead}</p> : null}
          <p className="flex items-baseline gap-2 pt-2">
            <span data-numeric data-count-up className="text-[4.5rem] leading-none md:text-[5.5rem] font-heading">
              {copy.score.toFixed(1)}
            </span>
            <span data-numeric className="text-[1.25rem] leading-none text-muted-foreground">
              / {copy.outOf}
            </span>
          </p>
          {stars(copy.score, "avg")}
          <p className="text-base leading-[1.5]">{copy.countTemplate.replace("{n}", fmt(total))}</p>
          <dl className="flex flex-col gap-2 pt-2">
            {copy.distribution.map((n, i) => {
              const label = `${copy.outOf - i}${copy.scoreUnit}`
              return (
                <div key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
                  <dt data-numeric className="text-base">
                    {label}
                  </dt>
                  <dd className="m-0 flex min-w-0 items-center gap-3">
                    <Progress value={pct(n)} aria-label={`${label} ${pct(n)}%`} className="min-w-0 flex-1 flex-nowrap" />
                    <span data-numeric className="w-12 shrink-0 text-end text-base">
                      {pct(n)}%
                    </span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
        <ul className="grid content-start gap-4">
          {copy.reviews.map((r, i) => (
            <li key={i} data-enter>
              <Card className="gap-3 px-(--card-spacing)">
                <p className="flex items-center gap-2 text-base">
                  {stars(r.rating, `r${i}`)}
                  <span data-numeric>
                    {r.rating}
                    {copy.scoreUnit}
                  </span>
                </p>
                <p className="text-base leading-[1.7]">{r.text}</p>
                <p className="flex justify-between gap-4 text-base">
                  <span>{r.name}</span>
                  <span data-numeric>{r.date}</span>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
