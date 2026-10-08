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
    <section ref={ref} id={id} data-block="content-gallery" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <figure className="cn-block-content-gallery">
        <ul data-count={Math.min(images.length, 3)} data-mode={mode} className="cn-block-content-gallery-list">
          {images.map((img, i) => (
            <li key={i} className="cn-block-content-gallery-item">
              <ContentFigure img={img} units={copy.units} eager={first && i === 0} className="cn-block-content-gallery-figure" />
            </li>
          ))}
        </ul>
        {caption ? <figcaption className="cn-block-content-gallery-caption">{caption}</figcaption> : null}
      </figure>
    </section>
  )
}
