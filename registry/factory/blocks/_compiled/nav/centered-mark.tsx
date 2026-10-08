import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"
import { SiteShellNavList } from "@/registry/factory/ui/site-shell-nav"

// 상단 내비 — 가운데 큰 워드마크, 양옆에 링크(앞 절반은 왼쪽, 뒤 절반과 행동 링크는 오른쪽). 브랜드·포트폴리오의 잡지형 머리.
// DOM 순서는 워드마크(홈) → 링크 → 행동이다(모든 폭에서 같은 읽기 순서). 넓은 화면의 좌·중·우 자리는 격자 영역이 정한다.
// 375 에서는 워드마크가 가운데 첫 줄, 링크 전부가 둘째 줄 가운데에서 가로로 스크롤한다(넘치면 왼쪽부터 — safe center). 등장 모션 없음.
export type NavCenteredMarkCopy = {
  brand: string
  navLabel: string
  links: Cta[]
  action?: Cta
}
export type NavCenteredMarkProps = BlockBase<NavCenteredMarkCopy> & {
  homeHref?: string
  currentHref?: string
}

export function NavCenteredMark({ copy, id = "site-nav", className, homeHref = "/", currentHref }: NavCenteredMarkProps) {
  const half = Math.ceil(copy.links.length / 2)
  const item = (l: Cta, i: number) => (
    <li key={i} className="shrink-0">
      <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-base whitespace-nowrap hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-6">
        {l.label}
      </a>
    </li>
  )
  return (
    <header id={id} data-block="nav-centered-mark" data-sticky-nav="" className={cn("sticky top-0 z-30 border-b bg-background text-foreground", className)}>
      <nav aria-label={copy.navLabel} className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 pt-3 pb-1 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-x-8 md:px-8 md:py-4 md:[grid-template-areas:'start_brand_end']">
        <a href={homeHref} className="inline-flex min-h-11 items-center text-center text-[1.75rem] leading-[1.1] tracking-[0.04em] md:text-[2.25rem] font-heading md:[grid-area:brand]">
          {copy.brand}
        </a>
        <div className="flex w-full min-w-0 justify-center-safe overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:contents">
          <SiteShellNavList className="flex shrink-0 flex-nowrap items-center gap-x-1 md:flex-wrap md:justify-self-start md:[grid-area:start]">{copy.links.slice(0, half).map(item)}</SiteShellNavList>
          {copy.links.length > half || copy.action ? (
            <SiteShellNavList className="flex shrink-0 flex-nowrap items-center gap-x-1 md:flex-wrap md:justify-end md:justify-self-end md:[grid-area:end]">
              {copy.links.slice(half).map((l, i) => item(l, half + i))}
              {copy.action ? (
                <li className="shrink-0">
                  <Button variant="outline" nativeButton={false} render={<a href={copy.action.href} />} className="ms-2">
                    {copy.action.label}
                  </Button>
                </li>
              ) : null}
            </SiteShellNavList>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
