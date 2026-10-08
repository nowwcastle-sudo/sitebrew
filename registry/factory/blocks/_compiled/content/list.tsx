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
    <section ref={ref} id={id} data-block="content-list" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      <ul className="flex flex-col border-b">
        {items.map((it, i) => {
          const [lead, ...rest] = it.meta ?? []
          return (
            <li key={i} data-enter={enter} data-thumb={it.image ? "" : undefined} className="grid grid-cols-1 gap-2 border-t py-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8 md:data-[thumb]:grid-cols-[10rem_minmax(0,1fr)_12rem]">
              <p className="text-base leading-[1.5] text-muted-foreground tabular-nums md:pt-1">{lead ? <ContentValueText v={lead} units={copy.units} locale={locale} /> : null}</p>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className={cn("text-[1.25rem] leading-[1.4] break-keep", headingFont(locale))}>
                  {it.href ? (
                    <a href={it.href} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="relative inline-flex items-baseline gap-2 underline decoration-1 underline-offset-[0.3em] transition-[text-decoration-color] after:absolute after:inset-x-[min(0px,calc((100%-44px)/2))] after:inset-y-[min(0px,calc((100%-44px)/2))] hover:decoration-2">
                      {it.title}
                      {it.external ? (
                        <>
                          <ExternalLink aria-hidden="true" className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
                          {copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
                        </>
                      ) : (
                        <ArrowRight aria-hidden="true" className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
                      )}
                    </a>
                  ) : (
                    it.title
                  )}
                </h3>
                {it.summary ? <p className="max-w-[65ch] text-base leading-[1.6] text-muted-foreground">{it.summary}</p> : null}
                {rest.length ? (
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-base leading-[1.5] text-muted-foreground tabular-nums">
                    {rest.map((m, j) => (
                      <ContentValueText key={j} v={m} units={copy.units} locale={locale} className="inline-block" />
                    ))}
                  </p>
                ) : null}
              </div>
              {it.image ? <ContentFigure img={it.image} units={copy.units} className="max-w-60 md:max-w-none" /> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
