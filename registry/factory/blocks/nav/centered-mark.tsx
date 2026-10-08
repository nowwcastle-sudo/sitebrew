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
      <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="cn-block-nav-link">
        {l.label}
      </a>
    </li>
  )
  return (
    <header id={id} data-block="nav-centered-mark" data-sticky-nav="" className={cn("cn-block-nav-bar", className)}>
      <nav aria-label={copy.navLabel} className="cn-block-nav-centered-grid">
        <a href={homeHref} className="cn-block-nav-centered-brand font-heading md:[grid-area:brand]">
          {copy.brand}
        </a>
        <div className="cn-block-nav-centered-links">
          <SiteShellNavList className="cn-block-nav-centered-list md:justify-self-start md:[grid-area:start]">{copy.links.slice(0, half).map(item)}</SiteShellNavList>
          {copy.links.length > half || copy.action ? (
            <SiteShellNavList className="cn-block-nav-centered-list md:justify-end md:justify-self-end md:[grid-area:end]">
              {copy.links.slice(half).map((l, i) => item(l, half + i))}
              {copy.action ? (
                <li className="shrink-0">
                  <Button variant="outline" nativeButton={false} render={<a href={copy.action.href} />} className="cn-block-nav-centered-action">
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
