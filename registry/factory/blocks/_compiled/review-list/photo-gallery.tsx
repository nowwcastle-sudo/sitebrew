"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { FirstReviewAsk, type FirstReviewCopy, RatingLine, type RatingSummary, type Review, ReviewCard, type ReviewKitCopy, ReviewPhoto, Stars } from "../_shared/review-kit"

// 사진 리뷰 갤러리(마케팅 규칙 T2·T6·T7·T9 — factory-rules.md §22-5). 사진·영상이 있는 리뷰를 텍스트 리뷰 위 격자로 먼저 보이고(T7), 칸을 누르면 그 리뷰로 간다(같은 페이지 앵커).
// 적립 조건은 갤러리 위에 미리 적는다(T7 — 쓴 뒤 지급, T9). 아래 모든 리뷰는 날짜순이고 「더 보기」로 끝까지 닿는다(낮은 별점도 숨기지 않는다).
// 리뷰 0개면 첫 리뷰를 청한다(T6 — 별점 기본값 없음, T9). 평점 줄은 리뷰 수·기준일과 함께(T2). 계측(선택): 사진 칸을 누르면 cta_click(id review-photo-<리뷰>).
export type ReviewListPhotoGalleryCopy = {
  title: string
  kit: ReviewKitCopy
  galleryTitle: string
  // 「{author}님 리뷰의 사진 보기」 — 칸 링크 이름(사진 대체 글과 함께 읽힌다)
  photoLink: string
  reward: string
  listTitle: string
  more: string
  first: FirstReviewCopy
}
export type ReviewListPhotoGalleryProps = BlockBase<ReviewListPhotoGalleryCopy> & {
  summary: RatingSummary
  reviews: Review[]
  pageSize?: number
  maxPhotos?: number
  track?: AnalyticsPort["track"]
}

export function ReviewListPhotoGallery({ copy, summary, reviews, pageSize = 5, maxPhotos = 8, track, id = "photo-reviews", className }: ReviewListPhotoGalleryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [shown, setShown] = React.useState(pageSize)
  const sorted = [...reviews].sort((a, b) => b.date.localeCompare(a.date))
  const tiles = sorted.filter((r) => r.photos?.length).slice(0, maxPhotos)
  // 칸을 누르면 그 리뷰가 목록에 보이도록 넓힌 뒤 앵커로 간다(아직 안 그린 리뷰도 닿는다)
  const [jump, setJump] = React.useState<{ to: string; n: number } | null>(null)
  React.useEffect(() => {
    if (!jump) return
    const el = document.getElementById(`review-${jump.to}`)
    el?.scrollIntoView({ block: "start" })
    el?.focus({ preventScroll: true })
  }, [jump])
  const open = (e: React.MouseEvent, r: Review) => {
    e.preventDefault()
    const at = sorted.findIndex((x) => x.id === r.id)
    if (at >= shown) setShown(Math.ceil((at + 1) / pageSize) * pageSize)
    setJump((j) => ({ to: r.id, n: (j?.n ?? 0) + 1 }))
    track?.("cta_click", { id: `review-photo-${r.id}`, label: copy.galleryTitle, section: id })
  }
  return (
    <section ref={ref} id={id} data-block="review-list-photo-gallery" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
          {copy.title}
        </h2>
        {summary.count ? <RatingLine summary={summary} copy={copy.kit} /> : null}
      </div>
      {summary.count === 0 ? (
        <FirstReviewAsk id={id} copy={copy.first} />
      ) : (
        <>
          {tiles.length ? (
            <div data-enter data-photo-gallery="" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.galleryTitle}</h3>
                <p data-reward-after="" className="text-base leading-[1.6]">
                  {copy.reward}
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {tiles.map((r) => (
                  <li key={r.id} className="min-w-0">
                    <a href={`#review-${r.id}`} aria-label={fillText(copy.photoLink, { author: r.author })} onClick={(e) => open(e, r)} className="relative flex flex-col gap-1 rounded-md outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <ReviewPhoto photo={r.photos?.[0] ?? { id: "review-photo", aspect: "1:1", source: "real-required", alt: "" }} className="w-full" />
                      <span className="flex items-center px-1 pb-1">
                        <Stars value={r.rating} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div data-enter data-review-list="" className="flex flex-col gap-2 border-t pt-6">
            <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.listTitle}</h3>
            <ul className="flex flex-col">
              {sorted.slice(0, shown).map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} copy={copy.kit} headingLevel={4} />
                </li>
              ))}
            </ul>
            {sorted.length > shown ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setShown((v) => v + pageSize)} className="mt-4 w-full sm:w-auto sm:self-start">
                {fillText(copy.more, { n: Math.min(pageSize, sorted.length - shown) })}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
