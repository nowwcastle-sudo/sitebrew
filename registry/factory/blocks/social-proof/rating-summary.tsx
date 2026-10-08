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
    <span aria-hidden="true" className="cn-block-proof-stars">
      {Array.from({ length: copy.outOf }, (_, i) => (
        <Star key={`${key}-${i}`} data-on={i < Math.round(value) ? "" : undefined} className="cn-block-proof-star" />
      ))}
    </span>
  )
  return (
    <section ref={ref} id={id} data-block="social-proof-rating-summary" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div className="cn-block-proof-rating">
        <div data-enter className="cn-block-proof-rating-side">
          <h2 id={`${id}-title`} className="cn-block-proof-rating-title font-heading">
            {copy.title}
          </h2>
          {copy.lead ? <p className="cn-block-lead">{copy.lead}</p> : null}
          <p className="cn-block-proof-score">
            <span data-numeric data-count-up className="cn-block-proof-score-value font-heading">
              {copy.score.toFixed(1)}
            </span>
            <span data-numeric className="cn-block-proof-score-of">
              / {copy.outOf}
            </span>
          </p>
          {stars(copy.score, "avg")}
          <p className="cn-block-proof-count">{copy.countTemplate.replace("{n}", fmt(total))}</p>
          <dl className="cn-block-proof-bars">
            {copy.distribution.map((n, i) => {
              const label = `${copy.outOf - i}${copy.scoreUnit}`
              return (
                <div key={i} className="cn-block-proof-bar">
                  <dt data-numeric className="cn-block-proof-bar-label">
                    {label}
                  </dt>
                  <dd className="cn-block-proof-bar-value">
                    <Progress value={pct(n)} aria-label={`${label} ${pct(n)}%`} className="cn-block-proof-bar-track" />
                    <span data-numeric className="cn-block-proof-bar-pct">
                      {pct(n)}%
                    </span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
        <ul className="cn-block-proof-reviews">
          {copy.reviews.map((r, i) => (
            <li key={i} data-enter>
              <Card className="cn-block-proof-review">
                <p className="cn-block-proof-review-rating">
                  {stars(r.rating, `r${i}`)}
                  <span data-numeric>
                    {r.rating}
                    {copy.scoreUnit}
                  </span>
                </p>
                <p className="cn-block-proof-review-text">{r.text}</p>
                <p className="cn-block-proof-review-by">
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
