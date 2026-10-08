"use client"

// /qa/recipes — 레시피마다 견본 한 벌(글자 크기·버튼·입력 5상태·카드·표·대화상자·토스트·차트 색·머리).
// 부품은 레시피 컴파일본 r/<id>/ui 그대로(.tmp/recipes/gallery.tsx 가 목록만 만든다 — factory/scripts/gen-recipes-gallery.mjs,
// npm run qa:recipes, prebuild·predev·pretypecheck 에서 자동). 색·서체는 [data-recipe] 로 가둔 변수(.tmp/recipes/recipes.css)와
// 레시피 YAML 서체의 next/font 로더(.tmp/recipes/fonts.ts)라 레시피가 늘어도 나란히 선다.
// 검수대 틀(목록 내비·칸 제목·구분)은 중립이다 — 선 구획 같은 모양은 레시피 부품에서만 온다(M12).
// ?r=<id> 로 한 벌만 본다. 동작 검사 표식(confirm-open·toast-trigger·filter)은 레시피마다 있고, 검사 도구는 첫 벌을 쓴다.
import * as React from "react"

import { recipes } from "@/.tmp/recipes/gallery"
import { recipeFonts, missingFonts } from "@/.tmp/recipes/fonts"
import { Specimen } from "./specimen"
import { Scene, parseAlt } from "./scenes"

// 모달·토스트는 body 로 포털된다 — 마지막으로 만진 레시피를 html 요소의 data-recipe 에 달아 포털도 그 레시피 변수를 받게 한다.
// 그 레시피의 서체 변수 클래스도 같은 까닭으로 html 요소에 붙인다.
function useHtmlScope(active: string | undefined) {
  React.useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const fonts = (recipeFonts[active] ?? "").split(" ").filter(Boolean)
    html.dataset.recipe = active
    html.classList.add(...fonts)
    return () => {
      delete html.dataset.recipe
      html.classList.remove(...fonts)
    }
  }, [active])
}

export default function QaRecipesPage() {
  // ?r= 는 정적 렌더 뒤에 읽는다(useSearchParams 는 이 페이지를 클라이언트 렌더로 떨어뜨린다).
  const [only, setOnly] = React.useState<string | null>(null)
  // 대표 장면(Task 8): &scene=<장면>[&alt=B|축+축][&theme=light|dark] — 한 벌·한 장면만 그린다(레시피 보드 스크린샷·장면 관문).
  // &frame=1(Task 10f): 어느 장면이든 검수대 틀 없이 장면 칸만 화면 폭으로 — 보드 v2 영상·정지 화면이 실제 사이트 첫 화면처럼 보이게.
  const [q, setQ] = React.useState<{ scene: string | null; alt: string | null; theme: string | null; frame: boolean }>({ scene: null, alt: null, theme: null, frame: false })
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setOnly(p.get("r"))
    setQ({ scene: p.get("scene"), alt: p.get("alt"), theme: p.get("theme"), frame: p.get("frame") === "1" })
  }, [])
  const shown = only ? recipes.filter((r) => r.id === only) : recipes
  const [picked, setActive] = React.useState<string | undefined>()
  const active = picked ?? shown[0]?.id
  useHtmlScope(active)
  // 첫 화면 히어로(Task 10d)는 제 머리 띠를 가진 첫 화면 한 장이다 — 검수대 틀(레시피 목록 내비·여백)을 걷어 1440×900 에 그 화면만 보인다.
  const bare = !!q.scene && (q.scene === "hero" || q.frame) && shown.length === 1
  return (
    <>
      {!bare && <nav data-sticky-nav aria-label="레시피 목록" className="sticky top-0 z-40 border-b bg-background px-4 py-2">
        <ul className="flex gap-1 overflow-x-auto text-sm whitespace-nowrap">
          {recipes.map((r) => (
            <li key={r.id}>
              <a href={`#${r.id}`} className="inline-flex min-h-11 items-center px-3 text-muted-foreground hover:bg-muted hover:text-foreground">
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>}
      <main className={bare ? "flex flex-col" : "mx-auto flex max-w-[1440px] flex-col gap-16 px-4 py-8 md:px-8"}>
        {/* 히어로 한 장(bare)은 제 h1 을 가진 첫 화면이다 — 검수대 머리(h1)를 빼 페이지의 h1 이 하나가 되게 한다(Task 10d 리뷰 b1 M1). */}
        {!bare && (
          <header className={q.scene ? "sr-only" : "flex max-w-3xl flex-col gap-2"}>
            <h1 className="text-[1.953rem] leading-[1.2] font-bold">레시피 검수대</h1>
            <p className="leading-[1.7] text-muted-foreground">
              레시피마다 컴파일한 부품과 색·서체를 그 칸 안에만 얹었습니다. 규칙(히트 영역·포커스·대비)은 부품에 있어 레시피가 바뀌어도 그대로입니다.
            </p>
          </header>
        )}
        {shown.length === 0 && <p>보여 줄 레시피가 없습니다. registry/factory/recipes/ 아래 DESIGN.md를 확인해 주세요.</p>}
        {q.scene && shown.length === 1 ? (
          <Scene
            r={shown[0]}
            scene={q.scene}
            picks={parseAlt(shown[0], q.alt)}
            // 다크 기본 레시피는 theme 이 없으면 다크로 먼저 그린다. theme=dark 는 시스템과 상관없이 다크로.
            dark={q.theme === "dark" || (q.theme !== "light" && shown[0].defaultTheme === "dark")}
            fontClass={recipeFonts[shown[0].id] ?? ""}
          />
        ) : shown.map((r) => (
          <Specimen key={r.id} r={r} fontClass={recipeFonts[r.id] ?? ""} missingFonts={missingFonts[r.id] ?? []} onActive={setActive} />
        ))}
      </main>
    </>
  )
}
