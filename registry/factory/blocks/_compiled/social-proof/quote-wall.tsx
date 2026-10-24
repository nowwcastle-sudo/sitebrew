"use client"

import * as React from "react"

import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Avatar, AvatarFallback, AvatarImage } from "@/registry/factory/ui/avatar"
import { Card } from "@/registry/factory/ui/card"

import { BlockHeading } from "../_shared/block-heading"

// 사회적 증거 — 크기가 다른 후기 카드 벽. 후기 길이대로 높이가 달라지는 카드를 넓은 화면에서 2~3단 기둥(columns)으로 흘린다.
// 첫 후기는 크게(대표 후기). 후기마다 실명·직함·소속과 구체 결과 한 줄(saas testimonials 와 같은 칸). 사진이 없으면 이름 첫 글자.
export type SocialProofQuoteWallCopy = {
  title: string
  lead?: string
  quotes: { quote: string; name: string; title: string; company: string; result?: string; photo?: ImageSlot }[]
}
export type SocialProofQuoteWallProps = BlockBase<SocialProofQuoteWallCopy>

export function SocialProofQuoteWall({ copy, id = "social-proof", className }: SocialProofQuoteWallProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  return (
    <section ref={ref} id={id} data-block="social-proof-quote-wall" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="columns-1 gap-6 md:columns-2 lg:columns-3 md:data-[count=1]:columns-1 lg:data-[count=1]:columns-1 lg:data-[count=2]:columns-2" data-count={copy.quotes.length}>
        {copy.quotes.map((q, i) => (
          <li key={i} data-enter className="mb-6 break-inside-avoid">
            <Card className="px-(--card-spacing)">
              <figure className="group/quote flex flex-col gap-4" data-featured={i === 0 && copy.quotes.length > 2 ? "" : undefined}>
                <blockquote className="text-base leading-[1.7] group-data-[featured]/quote:text-[1.375rem] group-data-[featured]/quote:leading-[1.55]">
                  <p>{q.quote}</p>
                </blockquote>
                {q.result ? <p className="border-s border-primary ps-3 text-base leading-[1.5] font-medium">{q.result}</p> : null}
                <figcaption className="flex items-center gap-3 pt-1">
                  <Avatar>
                    {q.photo ? <AvatarImage src={q.photo.src} alt="" /> : null}
                    <AvatarFallback>{q.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base leading-[1.4] font-medium">{q.name}</span>
                    <span className="text-base leading-[1.4]">
                      {q.title} · {q.company}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
