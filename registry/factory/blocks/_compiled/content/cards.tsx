"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, ExternalLink } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Card } from "@/registry/factory/ui/card"

import { gridCols } from "../_shared/grid-cols"
import { type ContentCopy, ContentFigure, ContentHead, type ContentImage, type ContentValue, ContentValueText, enterOf, headingFont } from "../_shared/content-kit"

// 카드 격자(대장 C70 — 작업 격자·리더십·의료진·정책 카드). 카드 = 사진(있는 칸만, 비율 고정) → 제목 → 값 줄(의뢰인·연도·직함) → 설명 →
// 항목(약력)·분야 낱말. 사진 칸이 있는 카드는 사진이 위계를 맡아 제목을 한 크기로 두고, 사진 없는 카드는 칸 위쪽 선으로 묶는다.
// 카드 모양(반경·테두리·그림자)은 레시피 Card 부품이 준다.
export type ContentCardItem = { title: string; href?: string; external?: boolean; summary?: string; meta?: ContentValue[]; points?: string[]; tags?: string[]; image?: ContentImage }
export type ContentCardsProps = BlockBase<ContentCopy> & { items: ContentCardItem[]; first?: boolean }

export function ContentCards({ copy, items, first, locale, id = "cards", className }: ContentCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.06 })
  })
  const enter = enterOf(first)
  const pictured = items.some((it) => it.image)
  return (
    <section ref={ref} id={id} data-block="content-cards" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ul data-pictured={pictured ? "" : undefined} data-cols={gridCols(items.length)} className="flex flex-wrap justify-center gap-(--cards-gap) [--cards-gap:1.5rem] [--cols:1] sm:[--cols:2] md:[--cards-gap:2rem] sm:data-[cols=1]:[--cols:1] lg:data-[cols=3]:[--cols:3] lg:data-[cols=4]:[--cols:4] data-[pictured]:[--cols:2] data-[pictured]:[--cards-gap:0.75rem] md:data-[pictured]:[--cards-gap:2rem]">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 shrink-0 grow-0 basis-[calc((100%_-_(var(--cols)_-_1)_*_var(--cards-gap))_/_var(--cols))]">
            <Card className="flex w-full flex-col gap-0 overflow-hidden p-0">
              {it.image ? <ContentFigure img={it.image} units={copy.units} eager={first && i < 2} className="rounded-none" /> : null}
              <div className="flex flex-col gap-2 p-5 md:p-6 in-data-[pictured]:max-sm:p-3">
                <h3 className={cn("text-[1.25rem] leading-[1.35] break-keep", headingFont(locale))}>
                  {it.href ? (
                    <a href={it.href} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="relative inline-flex items-baseline gap-2 underline decoration-1 underline-offset-[0.3em] transition-[text-decoration-color] after:absolute after:inset-x-[min(0px,calc((100%-44px)/2))] after:inset-y-[min(0px,calc((100%-44px)/2))] hover:decoration-2">
                      {it.title}
                      {it.external ? <ExternalLink aria-hidden="true" className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" /> : <ArrowRight aria-hidden="true" className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />}
                      {it.external && copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
                    </a>
                  ) : (
                    it.title
                  )}
                </h3>
                {it.meta?.length ? (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-base leading-[1.5] text-muted-foreground tabular-nums">
                    {it.meta.map((m, j) => (
                      <ContentValueText key={j} v={m} units={copy.units} locale={locale} className="inline-block" />
                    ))}
                  </p>
                ) : null}
                {it.summary ? <p className="text-base leading-[1.65]">{it.summary}</p> : null}
                {it.points?.length ? (
                  <ul className="flex list-disc flex-col gap-1 ps-5 text-base leading-[1.6]">
                    {it.points.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                ) : null}
                {it.tags?.length ? <p className="text-base leading-[1.5] text-muted-foreground">{it.tags.join(" · ")}</p> : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
