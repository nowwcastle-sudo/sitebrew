// 검수대 틀 머리(FV1 레인 DRAFTS): 블록 히어로의 header 칸에 넘기는 한 줄 머리 — 로고 글자 · 주 메뉴 · 버튼. 새로 카탈로그에 오른 블록 히어로(map-first ·
// illustration-scene · punch-in-statement · ken-burns-stills · video-montage)의 틀이 같이 쓴다. 모양은 레시피 컴파일 부품(r.ui.*)과 레시피 토큰만 쓴다.
import * as React from "react"

import type { Recipe } from "../specimen"
import { NavLinks, RING, cx } from "./parts"

export function QuickHeader({ r, brand, items, cta }: { r: Recipe; brand: string; items: string[]; cta: string }) {
  const { Button } = r.ui.button
  return (
    <header data-sticky-nav className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-[4.5rem] items-center justify-between gap-4 px-4 md:px-6">
        <a href="#top" className={cx("inline-flex min-h-11 items-center font-heading text-lg", RING)}>
          {brand}
        </a>
        <nav aria-label="주 메뉴" className="hidden md:block">
          <NavLinks items={items} linkClass="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground" />
        </nav>
        <Button size="sm">{cta}</Button>
      </div>
    </header>
  )
}
