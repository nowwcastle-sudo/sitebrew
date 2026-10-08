import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"
import { SiteShellNavList } from "@/registry/factory/ui/site-shell-nav"

// 상단 내비 — 왼쪽 워드마크(홈 링크) · 링크 한 줄 · 행동 버튼 하나. 모든 폭에서 위에 붙는다(data-sticky-nav — factory-base 가 건너뛰기 목적지를
// 헤더 아래로 내린다). 375 에서는 워드마크가 첫 줄, 둘째 줄은 가로로 스크롤하는 링크 + 행동 버튼이다(포커스한 링크는 SiteShellNavList 가 보이게 굴린다).
// 등장 모션이 없다 — 머리는 처음부터 누를 수 있어야 한다.
export type NavInlineLinksCopy = {
  brand: string
  // 주 메뉴 이름(aria-label) — 화면에는 안 보이지만 읽기 도구가 읽는다.
  navLabel: string
  links: Cta[]
  action?: Cta
}
export type NavInlineLinksProps = BlockBase<NavInlineLinksCopy> & {
  homeHref?: string
  // 지금 페이지 주소 — 같은 href 의 링크에 aria-current="page".
  currentHref?: string
}

export function NavInlineLinks({ copy, id = "site-nav", className, homeHref = "/", currentHref }: NavInlineLinksProps) {
  return (
    <header id={id} data-block="nav-inline-links" data-sticky-nav="" className={cn("sticky top-0 z-30 border-b bg-background text-foreground", className)}>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-1.5 [grid-template-areas:'brand_brand'_'nav_action'] md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-6 md:px-8 md:py-2.5 md:[grid-template-areas:'brand_nav_action']">
        <a href={homeHref} className="inline-flex min-h-11 items-center text-[1.25rem] leading-[1.2] md:text-[1.375rem] font-heading [grid-area:brand]">
          {copy.brand}
        </a>
        <nav aria-label={copy.navLabel} className="min-w-0 [grid-area:nav] -mx-1 md:mx-0 md:max-w-full md:justify-self-end">
          <SiteShellNavList className="flex flex-nowrap items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {copy.links.map((l, i) => (
              <li key={i} className="shrink-0">
                <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-base whitespace-nowrap hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-6">
                  {l.label}
                </a>
              </li>
            ))}
          </SiteShellNavList>
        </nav>
        {copy.action ? (
          <Button nativeButton={false} render={<a href={copy.action.href} />} className="[grid-area:action]">
            {copy.action.label}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
