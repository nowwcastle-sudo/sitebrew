"use client"

// /qa/blocks?b=<블록>&r=<레시피>[&theme=light|dark][&fx=default|max|min][&state=…][&submit=…][&delay=…][&sub=…][&auth=…][&consent=…][&frame=1] — 블록 한 벌을 한 레시피로 그린다.
// 블록은 레시피 사본(.tmp/blocks/<레시피>/…, factory/scripts/gen-blocks-gallery.mjs)을 동적 import 한다 — 부품은 그 레시피 컴파일본,
// 색·서체는 [data-recipe] 로 가둔 변수(.tmp/recipes/recipes.css)라 소비자에서 그 레시피를 설치한 모양과 같다.
// 데이터·폼 블록(메타 states)은 states.ts withStates 가 mock 어댑터 stateFromQuery 로 state·submit 을 주입한다 — 메타 상태 → 쿼리는
// factory/scripts/block-states.mjs STATE_QUERY 한 표(&state=loading|empty|error|ready, &submit=ok|field-error|server-error|pending).
// 포트 블록(예시 fixturePorts)은 states.ts withPorts 가 adapter-mock 포트 목을 ?sub=·?auth=·?consent=(+ state·submit·delay)로 만들어 끼운다.
// 쿼리(state·submit·delay·sub·auth·consent)는 페이지가 넘긴다 — 주소만 바뀌는 이동에서도 다시 주입한다(리뷰 M-9 나).
// d·x(P3-2 Task 8, 대장 A20): 히어로의 새 축 부품 — 레시피 머리가 D2·D3 이면 DisplayTitle(메타 titleWidth full 히어로만 — column 히어로에 D2 는 오류로 그리지 않는다),
// X1~X8 이면 Texture 를 props 로 넘긴다(찍어낸 페이지와 같은 규칙, recipe.mjs heroAxisParts). &d=·&x= 는 머리 값을 덮는 시험 값이다.
// frame=1: 검수대 설명 없이 블록만(위 띠 하나 — 관문 ux-gate 의 「위 고정 내비」 규칙을 받는 자리, 사이트 머리 자리와 같다).
import * as React from "react"
import Link from "next/link"

import { cn } from "@/registry/factory/lib/utils"
import { AXIS_PARTS, DISPLAY_TITLE_VALUES, TEXTURE_VALUES } from "@/.tmp/blocks/axis-parts"
import { BLOCKS, BLOCK_RECIPES, type AnyBlock } from "@/.tmp/blocks/gallery"
import { recipeFonts } from "@/.tmp/recipes/fonts"

import { galleryMedia } from "./media"
import { stateParam, withPorts, withStates, type BlockProps } from "./states"

// 모달·토스트·선택 목록은 body 로 포털된다 — 레시피 id·서체 변수 클래스·다크 클래스를 html 요소에도 단다(리뷰 M-9 가: 포털 다크).
function useHtmlScope(active: string | undefined, dark: boolean) {
  React.useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const fonts = (recipeFonts[active] ?? "").split(" ").filter(Boolean)
    html.dataset.recipe = active
    html.classList.add(...fonts)
    html.classList.toggle("dark", dark)
    return () => {
      delete html.dataset.recipe
      html.classList.remove(...fonts)
      html.classList.remove("dark")
    }
  }, [active, dark])
}

type Shown = { C: AnyBlock; props: BlockProps } | { error: string }

export function BlockView({ b, r, theme, fx, query, frame, d, x }: { b: string; r: string; theme?: string; fx?: string; query: string; frame: boolean; d?: string; x?: string }) {
  const entry = BLOCKS[b]
  const recipe = BLOCK_RECIPES.find((row) => row.id === r)
  const hero = entry?.meta.kind === "hero"
  const dv = d ?? recipe?.display ?? ""
  const xv = x ?? recipe?.texture ?? ""
  // 새 축 배선을 받는 블록: 히어로 + 히어로 옆 띠(메타 titleWidth 가 있는 블록 — 질감만, DisplayTitle 은 full 인 히어로만).
  const axisBlock = entry?.meta.titleWidth !== undefined
  const displayOn = hero && DISPLAY_TITLE_VALUES.includes(dv) && entry?.meta.titleWidth === "full"
  const textureOn = axisBlock && TEXTURE_VALUES.includes(xv)
  const problem = !entry
    ? `블록 ${b} 이 없습니다`
    : !recipe || !entry.byRecipe[r]
      ? `레시피 ${r} 이 없습니다`
      : hero && dv === "D2" && entry.meta.titleWidth !== "full"
        ? `D2(초대형 제목)는 제목이 전폭인 히어로에서만 씁니다 — ${b} 는 titleWidth ${entry.meta.titleWidth ?? "없음"}`
        : null
  const [shown, setShown] = React.useState<Shown | null>(null)
  const dark = theme === "dark" || (theme !== "light" && recipe?.defaultTheme === "dark")
  useHtmlScope(problem ? undefined : r, dark)
  React.useEffect(() => {
    if (problem) return
    let alive = true
    const none = () => Promise.resolve(undefined)
    Promise.all([entry.byRecipe[r](), entry.fixtures(), displayOn ? AXIS_PARTS[dv]() : none(), textureOn ? AXIS_PARTS[xv]() : none()])
      .then(([C, f, display, texture]) => {
        const base = (fx === "max" ? f.fixtureMax : fx === "min" ? f.fixtureMin : f.fixture) as BlockProps
        // 히어로 새 축 부품(Task 8 A20) → 포트 블록(예시가 fixturePorts 를 낸다)은 포트 목을, 나머지 데이터·폼 블록은 state·submit 주입을 받는다.
        // 포트 블록의 계측은 갤러리가 출처 태그(블록·레시피)로 감싼다(대장 A16 — 조립하는 쪽이 withAttribution).
        const withAxis = { ...base, ...galleryMedia(b, query), ...(display ? { display } : {}), ...(texture ? { texture } : {}) }
        const props = f.fixturePorts
          ? withPorts(withAxis, f.fixturePorts, query, { fx: fx ?? "default", attribution: { blockId: `${entry.meta.kind}-${entry.meta.variant}`, recipeId: r } })
          : withStates(entry.meta.states, withAxis, f.fixtureStates, query)
        if (alive) setShown({ C, props })
      })
      .catch((e: unknown) => {
        if (alive) setShown({ error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      alive = false
    }
  }, [entry, r, fx, query, problem, displayOn, textureOn, dv, xv])
  const error = problem ?? (shown && "error" in shown ? shown.error : null)
  const block = shown && "C" in shown ? <shown.C {...shown.props} /> : null
  return (
    <div className={dark ? "dark" : undefined}>
      <div data-recipe={r} className={cn("min-h-dvh", recipeFonts[r] ?? "")} data-qa-block={b} data-qa-fx={fx ?? "default"} data-qa-display={displayOn ? dv : undefined} data-qa-texture={textureOn ? xv : undefined} data-qa-ready={block ? "" : undefined}>
        <nav data-sticky-nav aria-label="블록 검수대" className="sticky top-0 z-40 border-b bg-background">
          <div className="mx-auto flex min-h-11 max-w-6xl items-center gap-4 px-4 md:px-8">
            <Link href="/qa/blocks" className="inline-flex min-h-11 shrink-0 items-center font-bold whitespace-nowrap">
              블록 검수대
            </Link>
            <span className="truncate">
              {b} · {recipe?.name ?? r}
            </span>
          </div>
        </nav>
        {!frame && (
          <header className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-8 md:px-8">
            <h1 className="text-[1.953rem] leading-[1.2] font-bold">{entry?.meta.title ?? b}</h1>
            {entry && (
              <p className="leading-[1.7]">
                layout {entry.meta.layout} · density {entry.meta.density} · 원형 {entry.meta.archetypes.join(", ")} · 예시 {fx ?? "default"}
              </p>
            )}
            {entry && entry.meta.states.length > 0 && (
              <ul aria-label="상태" className="flex flex-wrap gap-x-4">
                {entry.meta.states.map((s) => (
                  <li key={s}>
                    <Link href={`/qa/blocks?b=${b}&r=${r}${fx ? `&fx=${fx}` : ""}&${stateParam(s)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </header>
        )}
        {error ? (
          <p role="alert" className="mx-auto max-w-6xl px-4 py-8 md:px-8">
            {error}
          </p>
        ) : (
          block
        )}
      </div>
    </div>
  )
}
