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
    <section ref={ref} id={id} data-block="social-proof-quote-wall" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="cn-block-proof-wall" data-count={copy.quotes.length}>
        {copy.quotes.map((q, i) => (
          <li key={i} data-enter className="cn-block-proof-wall-item">
            <Card className="cn-block-proof-wall-card">
              <figure className="cn-block-proof-wall-figure" data-featured={i === 0 && copy.quotes.length > 2 ? "" : undefined}>
                <blockquote className="cn-block-proof-wall-quote">
                  <p>{q.quote}</p>
                </blockquote>
                {q.result ? <p className="cn-block-proof-wall-result">{q.result}</p> : null}
                <figcaption className="cn-block-proof-wall-person">
                  <Avatar>
                    {q.photo ? <AvatarImage src={q.photo.src} alt="" /> : null}
                    <AvatarFallback>{q.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="cn-block-proof-wall-who">
                    <span className="cn-block-proof-wall-name">{q.name}</span>
                    <span className="cn-block-proof-wall-role">
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
