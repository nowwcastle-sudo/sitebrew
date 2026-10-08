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
    <section ref={ref} id={id} data-block="review-list-distribution-filter" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <h2 id={`${id}-title`} data-enter className="cn-block-rlf-title font-heading-ko">
        {copy.title}
      </h2>
      <p data-enter data-review-subject="" className="cn-block-rlf-subject">
        {subject.name}
      </p>
      {summary.count === 0 ? (
        <FirstReviewAsk id={id} copy={copy.first} />
      ) : (
        <div className="cn-block-rlf-grid">
          <div data-enter className="cn-block-rlf-side">
            <RatingLine summary={summary} copy={copy.kit} size="lg" className="cn-block-rlf-line" />
            {showBars ? (
              <fieldset data-distribution="" className="cn-block-rlf-bars">
                <legend className="cn-block-rlf-legend">{copy.filterLegend}</legend>
                <label className="cn-block-rlf-bar">
                  <input type="radio" name={`${id}-filter`} value="all" checked={filter === "all"} onChange={() => pick("all")} className="cn-block-rlf-radio" />
                  <span className="cn-block-rlf-bar-label">{copy.all}</span>
                  <span aria-hidden="true" className="cn-block-rlf-bar-track" />
                  <span data-numeric className="cn-block-rlf-bar-count">
                    {summary.count.toLocaleString("ko-KR")}
                  </span>
                </label>
                {RATINGS.map((n) => (
                  <label key={n} data-star={n} className="cn-block-rlf-bar">
                    <input type="radio" name={`${id}-filter`} value={n} checked={filter === n} onChange={() => pick(n)} className="cn-block-rlf-radio" />
                    <span className="cn-block-rlf-bar-label">{fillText(copy.starOption, { n })}</span>
                    <span aria-hidden="true" className="cn-block-rlf-bar-track">
                      <span style={{ width: `${Math.round((summary.distribution[n] / max) * 100)}%` }} className="cn-block-rlf-bar-fill" />
                    </span>
                    <span data-numeric className="cn-block-rlf-bar-count">
                      {summary.distribution[n].toLocaleString("ko-KR")}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="cn-block-rlf-write">
              <a href={copy.write.href} className="cn-block-rlf-write-link">
                {copy.write.label}
              </a>
              <p data-reward-after="" className="cn-block-rlf-reward">
                {copy.write.reward}
              </p>
            </div>
          </div>
          <div data-enter className="cn-block-rlf-main">
            <p role="status" data-result-count={list.length} className="cn-block-rlf-result">
              {fillText(copy.resultLine, { label, count: list.length })}
            </p>
            {list.length ? (
              <ul className="cn-block-rlf-list">
                {list.slice(0, shown).map((r) => (
                  <li key={r.id}>
                    <ReviewCard review={r} copy={copy.kit} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cn-block-rlf-empty">{copy.emptyFilter}</p>
            )}
            {list.length > shown ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setShown((v) => v + pageSize)} className="cn-block-rlf-more">
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
