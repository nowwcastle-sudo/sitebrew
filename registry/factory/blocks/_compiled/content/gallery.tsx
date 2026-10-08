"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentFigure, ContentHead, type ContentImage, enterOf } from "../_shared/content-kit"

// 사진 모음(대장 C70 — 공간·음식 사진, 상세 이미지 조각, 사용 장면). grid: 비율을 지킨 칸 격자(넓으면 3열), stack: 상세 조각을 860px 열에
// 틈 없이 세로로 잇는다(한국 상세 표준 — 조각마다 alt 에 그 글자). src 가 없는 칸은 「실제 사진 필요」 틀이다 — 스톡으로 대신하지 않는다.
export type ContentGalleryProps = BlockBase<ContentCopy> & { images: ContentImage[]; caption?: string; mode?: "grid" | "stack"; first?: boolean }

export function ContentGallery({ copy, images, caption, mode = "grid", first, locale, id = "gallery", className }: ContentGalleryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const enter = enterOf(first)
  return (
    <section ref={ref} id={id} data-block="content-gallery" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <figure className="flex flex-col gap-3">
        <ul data-count={Math.min(images.length, 3)} data-mode={mode} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:data-[count=3]:grid-cols-3 data-[mode=stack]:mx-auto data-[mode=stack]:w-full data-[mode=stack]:max-w-[860px] data-[mode=stack]:gap-0 data-[mode=stack]:sm:grid-cols-1 data-[mode=stack]:lg:grid-cols-1">
          {images.map((img, i) => (
            <li key={i} className="min-w-0">
              <ContentFigure img={img} units={copy.units} eager={first && i === 0} className="in-data-[mode=stack]:rounded-none" />
            </li>
          ))}
        </ul>
        {caption ? <figcaption className="max-w-[65ch] text-base leading-[1.6] text-muted-foreground">{caption}</figcaption> : null}
      </figure>
    </section>
  )
}
