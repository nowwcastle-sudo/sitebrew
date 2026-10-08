"use client"

import * as React from "react"

import type { ImageSlot } from "@/registry/factory/content/content-core"
import type { IsoDate } from "@/registry/factory/contract/ports"
import { CheckCircle, Image as ImageIcon } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { fill, fillText, formatFrom } from "../_shared/billing-format"

// 리뷰 목록 공유 조각(P3-2 레인 D2 block-shared-review-kit — review-list 세 변형이 같이 쓴다). factory-rules.md §22-5·§22-7.
//   · 평점은 늘 리뷰 수와 기준일을 함께 적는다(T2) — RatingLine.
//   · 인증 구매 표지(T6)·판매자 답변은 모양을 따로(T5 — data-seller-reply, 들여 쓴 판)·사진 리뷰 칸(T7)은 ReviewCard.
//   · 리뷰가 0개면 첫 리뷰를 먼저 청한다(T6). 별점은 기본값 없이 받고(T9 — 아무것도 고르지 않은 라디오), 보상은 쓴 뒤에 준다고 적는다 — FirstReviewAsk.
//   · 별점 JSON-LD(X4)는 화면과 같은 props 에서 만들고 **Product 에만** 단다. 자체 후기(Organization·LocalBusiness)에는 null — ratingJsonLd.

export type Rating = 1 | 2 | 3 | 4 | 5
export type Review = {
  id: string
  rating: Rating
  title?: string
  body: string
  // 가린 이름(예: 「김**」) — 실명·연락처를 싣지 않는다
  author: string
  date: IsoDate
  // 실제로 산 사람의 리뷰(구매 기록과 잇는 것은 어댑터 몫)
  verified?: boolean
  option?: string
  photos?: ImageSlot[]
  reply?: { author: string; body: string; date: IsoDate }
}
export type RatingSummary = {
  avg: number
  count: number
  // 이 숫자의 기준일(T2)
  asOf: IsoDate
  // 별점별 리뷰 수 — 합이 count 와 같다
  distribution: Record<Rating, number>
}
// 리뷰가 달린 대상. Product 만 별점 마크업을 받는다(X4 — 가게·회사 자체 후기에는 달지 않는다)
export type ReviewSubject = { type: "Product"; name: string; price?: number; currency?: string; url?: string } | { type: "Organization" | "LocalBusiness"; name: string }
export type ReviewKitCopy = {
  // 「5점 만점에 {avg}점」
  starsLabel: string
  // 「리뷰 {count}개 · {date} 기준」
  countLine: string
  verified: string
  reply: string
  // 「{rating}점」
  ratingShort: string
  photoSlot: string
  // 날짜 로캘(선택 — 영어 사이트는 en-US). 없으면 ko-KR.
  locale?: string
}
export type FirstReviewCopy = {
  title: string
  body: string
  legend: string
  // 「{n}점」
  option: string
  reward: string
  write: { label: string; href: string }
}

export const RATINGS: readonly Rating[] = [5, 4, 3, 2, 1]
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

/** 별 다섯(장식) — 값은 곁의 글자(sr 포함)로 읽는다. 아이콘이 아니라 꽉 찬 ★ 글자에 색으로 켜고 끈다(레시피 아이콘 라이브러리의 별은 채울 수 없는 윤곽선일 수 있다) */
export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center text-[1.125rem] leading-none tracking-[0.05em]", className)}>
      {[1, 2, 3, 4, 5].map((i) => (i <= full ? <span key={i} className="text-primary">★</span> : <span key={i} className="text-foreground/25">★</span>))}
    </span>
  )
}

/** 평균 · 리뷰 수 · 기준일 한 묶음(T2). 평균 글자는 JSON-LD ratingValue 와 같은 값이다(X4) */
export function RatingLine({ summary, copy, className, size = "md" }: { summary: RatingSummary; copy: ReviewKitCopy; className?: string; size?: "md" | "lg" }) {
  return (
    <p data-rating-line="" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-[1.5]", className)}>
      {size === "lg" ? (
        <span data-numeric data-rating-avg="" className="text-[2.441rem] leading-none tabular-nums font-heading">
          {one(summary.avg)}
        </span>
      ) : (
        <span data-numeric data-rating-avg="" className="text-[1.25rem] leading-none tabular-nums font-heading">
          {one(summary.avg)}
        </span>
      )}
      <Stars value={summary.avg} />
      <span className="sr-only">{fillText(copy.starsLabel, { avg: one(summary.avg) })}</span>
      <span data-rating-count="" className="text-base leading-[1.5]">
        {fill(copy.countLine, {
          count: <span data-numeric>{summary.count.toLocaleString("ko-KR")}</span>,
          date: (
            <time data-numeric dateTime={summary.asOf}>
              {formatFrom(summary.asOf, copy.locale)}
            </time>
          ),
        })}
      </span>
    </p>
  )
}

/** 사진 한 칸 — 그림이 없으면 비율을 지킨 빈 자리에 대체 글을 이름으로 단다(깨진 그림 없이) */
export function ReviewPhoto({ photo, className }: { photo: ImageSlot; className?: string }) {
  const m = photo.aspect.match(/^(\d+)[:x](\d+)/)
  const aspectRatio = m ? `${m[1]} / ${m[2]}` : "1 / 1"
  return photo.src ? (
    <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" style={{ aspectRatio }} className={cn("block w-full rounded-md bg-muted object-cover", className)} />
  ) : (
    <span role="img" aria-label={photo.alt} style={{ aspectRatio }} className={cn("flex w-full items-center justify-center rounded-md border border-dashed bg-muted", className)}>
      <ImageIcon aria-hidden="true" className="size-6 text-foreground/60" />
    </span>
  )
}

/** 리뷰 한 건: 별점·가린 이름·날짜·인증 구매 · 제목·본문 · 사진 · 판매자 답변(따로 들여 쓴 판) */
export function ReviewCard({ review: r, copy, headingLevel = 3, photos = true, className }: { review: Review; copy: ReviewKitCopy; headingLevel?: 3 | 4; photos?: boolean; className?: string }) {
  const H = headingLevel === 3 ? "h3" : "h4"
  return (
    <article id={`review-${r.id}`} tabIndex={-1} data-rating={r.rating} className={cn("flex min-w-0 scroll-mt-24 flex-col gap-2 border-b py-5 outline-hidden focus-visible:ring-3 focus-visible:ring-ring", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base leading-[1.5]">
        <Stars value={r.rating} />
        <span className="sr-only">{fillText(copy.ratingShort, { rating: r.rating })}</span>
        <span className="text-base">{r.author}</span>
        <time data-numeric dateTime={r.date} className="text-base tabular-nums">
          {formatFrom(r.date, copy.locale)}
        </time>
        {r.verified ? (
          <span data-verified="" className="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-base leading-[1.4]">
            <CheckCircle aria-hidden="true" className="size-4 text-primary" />
            {copy.verified}
          </span>
        ) : null}
      </div>
      {r.option ? <p className="text-base leading-[1.5]">{r.option}</p> : null}
      {r.title ? <H className="text-[1.125rem] leading-[1.4] font-heading-ko">{r.title}</H> : null}
      <p className="max-w-prose text-base leading-[1.7] break-words">{r.body}</p>
      {photos && r.photos?.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:max-w-md">
          {r.photos.map((p, i) => (
            <li key={i} className="min-w-0">
              <ReviewPhoto photo={p} />
            </li>
          ))}
        </ul>
      ) : null}
      {r.reply ? (
        <div data-seller-reply="" className="ms-4 flex flex-col gap-1 border-s-4 border-primary bg-muted px-4 py-3 sm:ms-8">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base leading-[1.5]">
            <span className="text-base font-heading-ko">{copy.reply}</span>
            <span className="text-base">{r.reply.author}</span>
            <time data-numeric dateTime={r.reply.date} className="text-base tabular-nums">
              {formatFrom(r.reply.date, copy.locale)}
            </time>
          </p>
          <p className="text-base leading-[1.7] break-words">{r.reply.body}</p>
        </div>
      ) : null}
    </article>
  )
}

/** 리뷰 0개 — 첫 리뷰를 청한다(T6). 별점은 아무것도 고르지 않은 채로 시작하고(T9), 고른 별점을 쓰기 화면 주소에 싣는다 */
export function FirstReviewAsk({ id, copy, className }: { id: string; copy: FirstReviewCopy; className?: string }) {
  const [rating, setRating] = React.useState<Rating | null>(null)
  const href = rating ? `${copy.write.href}${copy.write.href.includes("?") ? "&" : "?"}rating=${rating}` : copy.write.href
  return (
    <div data-first-review="" className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-6", className)}>
      <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.title}</h3>
      <p className="text-base leading-[1.7]">{copy.body}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base leading-[1.5]">{copy.legend}</legend>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 has-[:checked]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
              <input type="radio" name={`${id}-first-rating`} value={n} checked={rating === n} onChange={() => setRating(n as Rating)} className="peer sr-only" />
              <span aria-hidden="true" className="text-[1.25rem] leading-none text-foreground/30 peer-checked:text-primary">★</span>
              <span className="text-base leading-none tabular-nums">{fillText(copy.option, { n })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p data-reward-after="" className="text-base leading-[1.6]">
        {copy.reward}
      </p>
      <a href={href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
        {copy.write.label}
      </a>
    </div>
  )
}

/**
 * 별점 JSON-LD(X4). 대상이 Product 이고 리뷰가 있을 때만 Product + AggregateRating(+ 가격이 있으면 Offer)을 돌려준다.
 * Organization·LocalBusiness 자체 후기에는 늘 null — 별점 마크업을 달지 않는다. 값은 화면(RatingLine·가격 글자)과 같은 props 에서 온다.
 */
export function ratingJsonLd(subject: ReviewSubject, summary: RatingSummary): Record<string, unknown> | null {
  if (subject.type !== "Product" || summary.count <= 0) return null
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: subject.name,
    aggregateRating: { "@type": "AggregateRating", ratingValue: Number(one(summary.avg)), reviewCount: summary.count, bestRating: 5, worstRating: 1 },
  }
  if (subject.price !== undefined) out.offers = { "@type": "Offer", price: subject.price, priceCurrency: subject.currency ?? "KRW", ...(subject.url ? { url: subject.url } : {}) }
  return out
}
