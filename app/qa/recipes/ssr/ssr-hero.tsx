"use client"

// 서버 렌더 검사 페이지(/qa/recipes/ssr)의 히어로 — 검수대와 같은 장면(Scene hero)을 그리되 매개변수를 서버 페이지에서 받는다(첫 HTML 에 히어로가 있다).
import { recipes } from "@/.tmp/recipes/gallery"
import { recipeFonts } from "@/.tmp/recipes/fonts"

import { Scene, parseAlt } from "../scenes"

export function SsrHero({ id, alt, theme }: { id: string | null; alt: string | null; theme: string | null }) {
  const r = recipes.find((x) => x.id === id)
  if (!r) return <p role="alert">레시피 {id ?? "(없음)"} 을 찾지 못했습니다.</p>
  return <Scene r={r} scene="hero" picks={parseAlt(r, alt)} dark={theme === "dark" || (theme !== "light" && r.defaultTheme === "dark")} fontClass={recipeFonts[r.id] ?? ""} />
}
