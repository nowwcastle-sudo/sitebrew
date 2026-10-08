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
      <li key={i} data-enter={enter} className={mode === "menu" ? cn("cn-block-content-menu-item") : cn("cn-block-content-tile-slot")}>
        <a
          href={l.href}
          aria-current={l.current ? "page" : undefined}
          {...(out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={mode === "menu" ? cn("cn-block-content-menu-link") : cn("cn-block-content-tile")}
        >
          <span className="cn-block-content-tile-label">{l.label}</span>
          {out ? <ExternalLink aria-hidden="true" className="cn-block-content-tile-icon" /> : <ArrowRight aria-hidden="true" className="cn-block-content-tile-icon" />}
          {out && copy.units.external ? <span className="sr-only"> ({copy.units.external})</span> : null}
        </a>
      </li>
    )
  }
  return (
    <section ref={ref} id={id} data-block="content-links" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <ContentHead id={`${id}-title`} copy={copy} enter={enter} locale={locale} />
      {mode === "menu" ? (
        <nav aria-labelledby={`${id}-title`} className="cn-block-content-menu">
          <ul className="cn-block-content-menu-list">{links.map(item)}</ul>
        </nav>
      ) : (
        <ul data-count={Math.min(links.length, 4)} className="cn-block-content-tiles">
          {links.map(item)}
        </ul>
      )}
    </section>
  )
}
