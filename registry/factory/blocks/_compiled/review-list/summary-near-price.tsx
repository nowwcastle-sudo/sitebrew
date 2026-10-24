"use client"

import * as React from "react"

import { JsonLd } from "@/registry/factory/ax/json-ld"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Clock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { formatPrice, toMajor } from "../_shared/price-tag"
import { RatingLine, type RatingSummary, type Review, ReviewCard, type ReviewKitCopy, ratingJsonLd } from "../_shared/review-kit"

// 가격 곁 리뷰 요약(마케팅 규칙 A12·T2·L1·X4 — factory-rules.md §22-6). 상세페이지에서 후기를 위로 올린다(A12): 상품 이름 곁에 평점 줄(리뷰 수·기준일 — T2),
// 그 아래 필수 총액(VAT·배송비 포함 — L1)과 구매 버튼, 버튼 바로 아래 배송·반품 한 줄(A12). 오른쪽에 먼저 읽을 리뷰 2~3개 — 가장 낮은 별점 하나를
// 「비판 리뷰」로 꼭 넣는다(부정 리뷰를 숨기지 않는다). 모든 리뷰로 가는 링크. 별점 JSON-LD(Product + Offer)는 화면 가격·평점과 같은 props 에서(X4).
// 계측(선택): 구매 버튼을 누르면 cta_click.
export type ReviewListSummaryNearPriceCopy = {
  kit: ReviewKitCopy
  priceNote: string
  cta: { label: string; href: string }
  shipping: string
  highlightsTitle: string
  critical: string
  // 「리뷰 {count}개 모두 보기」
  all: { label: string; href: string }
}
export type ReviewListSummaryNearPriceProps = BlockBase<ReviewListSummaryNearPriceCopy> & {
  // price: 최소 단위 정수(ports Money.amount — USD·EUR 는 센트). 통화·날짜 로캘은 copy.kit.locale.
  product: { name: string; price: number; currency?: string; url?: string }
  summary: RatingSummary
  // 먼저 보일 리뷰 후보 — 가장 도움이 된 긍정 1~2개 + 가장 낮은 별점 1개를 블록이 고른다
  reviews: Review[]
  track?: AnalyticsPort["track"]
}

/** 먼저 읽을 리뷰: 가장 높은 별점 최신 2개 + 가장 낮은 별점 최신 1개(3점 이하가 있을 때 — 비판 리뷰). 겹치지 않는다 */
export function pickHighlights(reviews: Review[]): { review: Review; critical: boolean }[] {
  const byDate = [...reviews].sort((a, b) => b.date.localeCompare(a.date))
  const low = [...byDate].sort((a, b) => a.rating - b.rating)[0]
  const critical = low && low.rating <= 3 ? low : undefined
  const top = byDate.filter((r) => r !== critical).sort((a, b) => b.rating - a.rating).slice(0, critical ? 2 : 3)
  return [...top.map((review) => ({ review, critical: false })), ...(critical ? [{ review: critical, critical: true }] : [])]
}

export function ReviewListSummaryNearPrice({ copy, product, summary, reviews, track, id = "review-summary", className }: ReviewListSummaryNearPriceProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const picks = pickHighlights(reviews)
  const ld = ratingJsonLd({ type: "Product", name: product.name, price: toMajor(product.price, product.currency), currency: product.currency, url: product.url }, summary)
  return (
    <section ref={ref} id={id} data-block="review-list-summary-near-price" aria-labelledby={`${id}-title`} className={cn("mx-auto w-full max-w-6xl flex-col px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12", className)}>
      <div data-enter data-buy-box="" className="flex min-w-0 flex-col items-start gap-4">
        <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading-ko">
          {product.name}
        </h2>
        {summary.count ? (
          <a href={copy.all.href} className="relative inline-flex min-h-11 items-center rounded-sm underline-offset-4 outline-hidden hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            <RatingLine summary={summary} copy={copy.kit} />
          </a>
        ) : null}
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t pt-4">
          <span data-numeric data-price="billed" className="text-[2.441rem] leading-none tabular-nums font-heading-ko">
            {formatPrice(product.price, product.currency, { minor: true, locale: copy.kit.locale })}
          </span>
          <span data-vat="" className="text-base leading-[1.5]">
            {copy.priceNote}
          </span>
        </p>
        <Button size="lg" nativeButton={false} role="link" render={<a href={copy.cta.href} />} onClick={() => track?.("cta_click", { id: "buy", label: copy.cta.label, section: id })} className="w-full">
          {copy.cta.label}
        </Button>
        <p data-shipping-line="" className="flex items-start gap-2 text-base leading-[1.6]">
          <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          {copy.shipping}
        </p>
      </div>
      {picks.length ? (
        <div data-enter className="flex min-w-0 flex-col gap-2 rounded-lg border px-5 py-5 md:px-6">
          <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.highlightsTitle}</h3>
          <ul className="flex flex-col">
            {picks.map(({ review, critical }) => (
              <li key={review.id} data-critical={critical ? "" : undefined} className="flex flex-col gap-1 pt-3 data-critical:border-t-2 data-critical:border-foreground/40">
                {critical ? <p className="text-base leading-[1.5] font-heading-ko">{copy.critical}</p> : null}
                <ReviewCard review={review} copy={copy.kit} headingLevel={4} photos={false} className="pt-1" />
              </li>
            ))}
          </ul>
          <a href={copy.all.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
            {fillText(copy.all.label, { count: summary.count.toLocaleString("ko-KR") })}
          </a>
        </div>
      ) : null}
      {ld ? <JsonLd id={`${id}-jsonld`} data={ld} /> : null}
    </section>
  )
}
