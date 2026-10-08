"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentHead, enterOf, paragraphsOf } from "../_shared/content-kit"

// 본문 글(대장 C70 — 원형 noBlock content: 미션·회사 요약·사례 본문). 넓은 화면에서는 머리를 왼쪽 좁은 칸, 글을 오른쪽 칸에 두고
// 글 줄 길이는 약 65자로 묶는다. 문단은 콘텐츠 글을 줄바꿈에서 나눈 것이다(문구를 만들지 않는다). 문단이 둘 이상이면 첫 문단을 조금 크게(머리말).
export type ContentProseProps = BlockBase<ContentCopy> & { paragraphs: string[]; first?: boolean }

export function ContentProse({ copy, paragraphs, first, locale, id = "prose", className }: ContentProseProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const enter = enterOf(first)
  const list = paragraphsOf(paragraphs)
  return (
    <section ref={ref} id={id} data-block="content-prose" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <div data-solo={copy.hideTitle ? "" : undefined} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:data-[solo]:grid-cols-1">
        <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
        <div className="flex max-w-[65ch] min-w-0 flex-col gap-5">
          {list.map((p, i) => (
            <p key={i} data-lede={i === 0 && list.length > 1 ? "" : undefined} className="text-[1.0625rem] leading-[1.8] break-keep data-[lede]:text-[1.25rem] data-[lede]:leading-[1.65]">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
