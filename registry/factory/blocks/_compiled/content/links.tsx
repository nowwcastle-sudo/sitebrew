"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, ExternalLink } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type ContentCopy, ContentHead, enterOf } from "../_shared/content-kit"

// 링크 묶음(대장 C70 — 자주 찾는 서비스·채용 목록·도움말과 약관·다음 작업, part 의 왼쪽 하위 메뉴).
// tiles: 넓은 누르는 칸(전체가 링크 — 44px 넘는 높이, 이름 + 화살표). menu: <nav> 안 세로 목록, 지금 쪽은 aria-current.
// 링크 글자·주소는 콘텐츠($ref)거나 사이트 경로·쪽 이름표다. 바깥 사이트·전화·메일은 아이콘과 읽기 도구 글자로 알린다.
export type ContentLink = { label: string; href: string; external?: boolean; current?: boolean }
export type ContentLinksProps = BlockBase<ContentCopy> & { links: ContentLink[]; mode?: "tiles" | "menu"; first?: boolean }

const isOut = (l: ContentLink) => l.external ?? /^https?:\/\//i.test(l.href)

export function ContentLinks({ copy, links, mode = "tiles", first, locale, id = "links", className }: ContentLinksProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  const enter = enterOf(first)
  const item = (l: ContentLink, i: number) => {
    const out = isOut(l)
    return (
      <li key={i} data-enter={enter} className={mode === "menu" ? cn("flex") : cn("flex min-w-0")}>
        <a
          href={l.href}
          aria-current={l.current ? "page" : undefined}
          {...(out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={mode === "menu" ? cn("-ms-px flex min-h-11 w-full items-center justify-between gap-3 border-s-2 border-transparent px-4 py-2 text-[1.0625rem] leading-[1.4] hover:border-border aria-[current=page]:border-foreground aria-[current=page]:font-heading-ko") : cn("flex min-h-16 w-full items-center justify-between gap-4 rounded-md border bg-card px-5 py-4 text-[1.0625rem] leading-[1.4] text-card-foreground transition-[border-color,background-color] hover:border-foreground focus-visible:border-foreground")}
        >
          <span className="min-w-0 break-keep">{l.label}</span>
          {out ? <ExternalLink aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /> : <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
          {out && copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
        </a>
      </li>
    )
  }
  return (
    <section ref={ref} id={id} data-block="content-links" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 md:px-8 gap-8 py-12 md:gap-10 md:py-16 in-data-[archetype=dashboard]:gap-4 in-data-[archetype=dashboard]:py-4 md:in-data-[archetype=dashboard]:gap-4 md:in-data-[archetype=dashboard]:py-6", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      {mode === "menu" ? (
        <nav aria-labelledby={`${id}-title`} className="max-w-sm">
          <ul className="flex flex-col border-s">{links.map(item)}</ul>
        </nav>
      ) : (
        <ul data-count={Math.min(links.length, 4)} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:data-[count=3]:grid-cols-3 lg:data-[count=4]:grid-cols-4">
          {links.map(item)}
        </ul>
      )}
    </section>
  )
}
