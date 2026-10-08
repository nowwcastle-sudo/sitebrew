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
    <header id={id} data-block="nav-inline-links" data-sticky-nav="" className={cn("cn-block-nav-bar", className)}>
      <div className="cn-block-nav-inline-row">
        <a href={homeHref} className="cn-block-nav-brand font-heading [grid-area:brand]">
          {copy.brand}
        </a>
        <nav aria-label={copy.navLabel} className="cn-block-nav-inline-nav">
          <SiteShellNavList className="cn-block-nav-list">
            {copy.links.map((l, i) => (
              <li key={i} className="shrink-0">
                <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="cn-block-nav-link">
                  {l.label}
                </a>
              </li>
            ))}
          </SiteShellNavList>
        </nav>
        {copy.action ? (
          <Button nativeButton={false} render={<a href={copy.action.href} />} className="cn-block-nav-inline-action">
            {copy.action.label}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
