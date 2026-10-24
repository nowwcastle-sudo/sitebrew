"use client"

import * as React from "react"

import { JsonLd } from "@/registry/factory/ax/json-ld"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { FirstReviewAsk, type FirstReviewCopy, RATINGS, type Rating, RatingLine, type RatingSummary, type Review, ReviewCard, type ReviewKitCopy, type ReviewSubject, ratingJsonLd } from "../_shared/review-kit"

// 평점 분포 필터(마케팅 규칙 T2·T5·T6·T9·X4 — factory-rules.md §22-5·§22-7). 왼쪽 평균·리뷰 수·기준일(T2)과 별점 막대, 오른쪽 리뷰 목록.
// 막대는 진짜 거르기다 — 라디오(전체 + 5~1점, 하나만 고른다)라서 방향키로 옮기고, 고르면 그 별점 리뷰만 남는다(T5). 리뷰가 5개 이하면 막대를 숨긴다(T5).
// 부정 리뷰를 숨기지 않는다 — 1·2점도 언제나 고를 수 있고 「더 보기」로 끝까지 닿는다. 판매자 답변은 따로 들여 쓴 판(ReviewCard), 인증 구매 표지(T6).
// 리뷰가 0개면 첫 리뷰를 청한다(T6 — 별점 기본값 없음, 보상은 쓴 뒤 T9). 별점 JSON-LD 는 Product 대상에만 같은 props 로(X4).
// 계측(선택): 막대를 고르면 cta_click(id review-filter-<n>).
export type ReviewListDistributionFilterCopy = {
  title: string
  kit: ReviewKitCopy
  filterLegend: string
  all: string
  // 「{n}점」
  starOption: string
  // 「{label} 리뷰 {count}개」
  resultLine: string
  emptyFilter: string
  // 「리뷰 {n}개 더 보기」
  more: string
  write: { label: string; href: string; reward: string }
  first: FirstReviewCopy
}
export type ReviewListDistributionFilterProps = BlockBase<ReviewListDistributionFilterCopy> & {
  summary: RatingSummary
  reviews: Review[]
  subject: ReviewSubject
  pageSize?: number
  track?: AnalyticsPort["track"]
}

export function ReviewListDistributionFilter({ copy, summary, reviews, subject, pageSize = 5, track, id = "reviews", className }: ReviewListDistributionFilterProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [filter, setFilter] = React.useState<Rating | "all">("all")
  const [shown, setShown] = React.useState(pageSize)
  const showBars = summary.count > 5
  const list = [...reviews].sort((a, b) => b.date.localeCompare(a.date)).filter((r) => filter === "all" || r.rating === filter)
  const pick = (next: Rating | "all") => {
    setFilter(next)
    setShown(pageSize)
    const label = next === "all" ? copy.all : fillText(copy.starOption, { n: next })
    track?.("cta_click", { id: `review-filter-${next}`, label, section: id })
  }
  const label = filter === "all" ? copy.all : fillText(copy.starOption, { n: filter })
  // 이 블록은 가격을 그리지 않는다 — 별점 마크업에 가격(Offer)을 싣지 않는다(X4: 화면에 있는 값만)
  const ld = ratingJsonLd(subject.type === "Product" ? { type: "Product", name: subject.name } : subject, summary)
  const max = Math.max(1, ...RATINGS.map((n) => summary.distribution[n]))
  return (
    <section ref={ref} id={id} data-block="review-list-distribution-filter" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <h2 id={`${id}-title`} data-enter className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
        {copy.title}
      </h2>
      <p data-enter data-review-subject="" className="-mt-6 text-base leading-[1.5] md:-mt-8">
        {subject.name}
      </p>
      {summary.count === 0 ? (
        <FirstReviewAsk id={id} copy={copy.first} />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_1fr] lg:gap-12">
          <div data-enter className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <RatingLine summary={summary} copy={copy.kit} size="lg" className="flex-col items-start" />
            {showBars ? (
              <fieldset data-distribution="" className="flex flex-col gap-1">
                <legend className="mb-2 text-base leading-[1.5]">{copy.filterLegend}</legend>
                <label className="grid min-h-11 cursor-pointer grid-cols-[3.5rem_1fr_3rem] items-center gap-3 rounded-md px-2 has-[:checked]:bg-muted has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
                  <input type="radio" name={`${id}-filter`} value="all" checked={filter === "all"} onChange={() => pick("all")} className="sr-only" />
                  <span className="text-base leading-none tabular-nums">{copy.all}</span>
                  <span aria-hidden="true" className="relative block h-2.5 overflow-hidden rounded-full bg-muted" />
                  <span data-numeric className="text-end text-base leading-none tabular-nums">
                    {summary.count.toLocaleString("ko-KR")}
                  </span>
                </label>
                {RATINGS.map((n) => (
                  <label key={n} data-star={n} className="grid min-h-11 cursor-pointer grid-cols-[3.5rem_1fr_3rem] items-center gap-3 rounded-md px-2 has-[:checked]:bg-muted has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
                    <input type="radio" name={`${id}-filter`} value={n} checked={filter === n} onChange={() => pick(n)} className="sr-only" />
                    <span className="text-base leading-none tabular-nums">{fillText(copy.starOption, { n })}</span>
                    <span aria-hidden="true" className="relative block h-2.5 overflow-hidden rounded-full bg-muted">
                      <span style={{ width: `${Math.round((summary.distribution[n] / max) * 100)}%` }} className="absolute inset-y-0 start-0 block rounded-full bg-primary" />
                    </span>
                    <span data-numeric className="text-end text-base leading-none tabular-nums">
                      {summary.distribution[n].toLocaleString("ko-KR")}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="flex flex-col gap-1 border-t pt-4">
              <a href={copy.write.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                {copy.write.label}
              </a>
              <p data-reward-after="" className="text-base leading-[1.6]">
                {copy.write.reward}
              </p>
            </div>
          </div>
          <div data-enter className="flex min-w-0 flex-col gap-2">
            <p role="status" data-result-count={list.length} className="border-b pb-3 text-base leading-[1.5]">
              {fillText(copy.resultLine, { label, count: list.length })}
            </p>
            {list.length ? (
              <ul className="flex flex-col">
                {list.slice(0, shown).map((r) => (
                  <li key={r.id}>
                    <ReviewCard review={r} copy={copy.kit} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-base leading-[1.7]">{copy.emptyFilter}</p>
            )}
            {list.length > shown ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setShown((v) => v + pageSize)} className="mt-4 w-full sm:w-auto sm:self-start">
                {fillText(copy.more, { n: Math.min(pageSize, list.length - shown) })}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {ld ? <JsonLd id={`${id}-jsonld`} data={ld} /> : null}
    </section>
  )
}
