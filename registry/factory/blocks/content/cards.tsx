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
    <section ref={ref} id={id} data-block="content-cards" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ul data-pictured={pictured ? "" : undefined} data-cols={gridCols(items.length)} className="cn-block-content-cards">
        {items.map((it, i) => (
          <li key={i} className="cn-block-content-card-slot">
            <Card className="cn-block-content-card">
              {it.image ? <ContentFigure img={it.image} units={copy.units} eager={first && i < 2} className="cn-block-content-card-figure" /> : null}
              <div className="cn-block-content-card-body">
                <h3 className={cn("cn-block-content-card-title", headingFont(locale))}>
                  {it.href ? (
                    <a href={it.href} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="cn-block-content-link">
                      {it.title}
                      {it.external ? <ExternalLink aria-hidden="true" className="cn-block-content-link-icon" /> : <ArrowRight aria-hidden="true" className="cn-block-content-link-icon" />}
                      {it.external && copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
                    </a>
                  ) : (
                    it.title
                  )}
                </h3>
                {it.meta?.length ? (
                  <p className="cn-block-content-card-meta">
                    {it.meta.map((m, j) => (
                      <ContentValueText key={j} v={m} units={copy.units} locale={locale} className="cn-block-content-meta-item" />
                    ))}
                  </p>
                ) : null}
                {it.summary ? <p className="cn-block-content-card-summary">{it.summary}</p> : null}
                {it.points?.length ? (
                  <ul className="cn-block-content-card-points">
                    {it.points.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                ) : null}
                {it.tags?.length ? <p className="cn-block-content-card-tags">{it.tags.join(" · ")}</p> : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
