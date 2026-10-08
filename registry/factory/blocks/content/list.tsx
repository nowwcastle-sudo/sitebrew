"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, ExternalLink } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentFigure, ContentHead, type ContentImage, type ContentValue, ContentValueText, enterOf, headingFont } from "../_shared/content-kit"

// 날짜 붙은 목록(대장 C70 — 소식·보도자료·공지·변경 기록·보고서). 줄마다 왼쪽 칸에 첫 값(날짜·연도), 가운데에 제목(링크)·한 줄 설명·나머지 값,
// 오른쪽에 작은 썸네일(있을 때). 좁은 화면에서는 날짜가 제목 위로 온다. 링크가 바깥 사이트면 아이콘과 읽기 도구용 글자로 알린다.
export type ContentListItem = { title: string; href?: string; external?: boolean; summary?: string; meta?: ContentValue[]; image?: ContentImage }
export type ContentListProps = BlockBase<ContentCopy> & { items: ContentListItem[]; first?: boolean }

export function ContentList({ copy, items, first, locale, id = "list", className }: ContentListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  const enter = enterOf(first)
  return (
    <section ref={ref} id={id} data-block="content-list" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ul className="cn-block-content-rows">
        {items.map((it, i) => {
          const [lead, ...rest] = it.meta ?? []
          return (
            <li key={i} data-enter={enter} data-thumb={it.image ? "" : undefined} className="cn-block-content-row">
              <p className="cn-block-content-row-when">{lead ? <ContentValueText v={lead} units={copy.units} locale={locale} /> : null}</p>
              <div className="cn-block-content-row-main">
                <h3 className={cn("cn-block-content-row-title", headingFont(locale))}>
                  {it.href ? (
                    <a href={it.href} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="cn-block-content-link">
                      {it.title}
                      {it.external ? (
                        <>
                          <ExternalLink aria-hidden="true" className="cn-block-content-link-icon" />
                          {copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
                        </>
                      ) : (
                        <ArrowRight aria-hidden="true" className="cn-block-content-link-icon" />
                      )}
                    </a>
                  ) : (
                    it.title
                  )}
                </h3>
                {it.summary ? <p className="cn-block-content-row-summary">{it.summary}</p> : null}
                {rest.length ? (
                  <p className="cn-block-content-row-meta">
                    {rest.map((m, j) => (
                      <ContentValueText key={j} v={m} units={copy.units} locale={locale} className="cn-block-content-meta-item" />
                    ))}
                  </p>
                ) : null}
              </div>
              {it.image ? <ContentFigure img={it.image} units={copy.units} className="cn-block-content-row-thumb" /> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
