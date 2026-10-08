// /qa/blocks/ssr?b=<블록>&r=<레시피>[&theme=light|dark][&fx=default|max|min][&control=legacy] — 블록 한 벌을 **서버에서** 그린다(P3-2 Task 1c — 리뷰 I-7).
// 검수대 /qa/blocks 는 블록이 클라이언트에서만 붙어 하이드레이션 경로를 타지 않는다. 이 페이지는 소비자 사이트와 같은 길(서버 컴포넌트 페이지 →
// 클라이언트 블록 SSR → 하이드레이션)로 그리고, 레시피는 html 이 아니라 [data-recipe] 구획에 둔다(히어로 보드·장면 갤러리와 같은 자리).
// 장면이 뿌리의 --wf-motion 을 레이아웃 효과 안에서 읽는지(등장이 한 번만 시작하는지)를 잰다 — 옛 방식 대조는 &control=legacy
// (useRecipeMotion 값을 level 로 넘기는 장면: 하이드레이션 뒤 2 → 레시피 값으로 바뀌어 등장을 다시 세운다).
// 상태가 있는 블록(메타 states)은 함수 props 가 있어 서버에서 넘길 수 없다 — 안내만 그린다(gotcha 「mock 어댑터 submit·retry 는 함수」).
// MotionBoot 는 루트 레이아웃 머리에 있다(/qa/recipes/ssr 와 같다).
import type { Metadata } from "next"

import "@/.tmp/recipes/recipes.css"
import "@/.tmp/recipes/kit-fonts"
import { BLOCKS, BLOCK_RECIPES } from "@/.tmp/blocks/gallery"
import { recipeFonts } from "@/.tmp/recipes/fonts"
import { cn } from "@/registry/factory/lib/utils"

import { galleryMedia } from "../media"
import { LegacyScene } from "./legacy-scene"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "QA · 블록 서버 렌더" }

type Query = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function QaBlocksSsrPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams
  const b = one(q.b) ?? ""
  const r = one(q.r) ?? ""
  const fx = one(q.fx)
  const entry = BLOCKS[b]
  const recipe = BLOCK_RECIPES.find((x) => x.id === r)
  const problem = !entry ? `블록 ${b || "(없음)"} 이 없습니다` : !recipe ? `레시피 ${r || "(없음)"} 이 없습니다` : entry.meta.states.length ? `${b} 는 상태가 있는 블록이라 서버에서 그리지 않습니다(함수 props)` : null
  const dark = one(q.theme) === "dark" || (one(q.theme) !== "light" && recipe?.defaultTheme === "dark")
  let body: React.ReactNode = null
  if (!problem) {
    if (one(q.control) === "legacy") body = <LegacyScene />
    else {
      const [C, f] = await Promise.all([entry.byRecipe[r](), entry.fixtures()])
      body = <C {...(fx === "max" ? f.fixtureMax : fx === "min" ? f.fixtureMin : f.fixture)} {...galleryMedia(b)} />
    }
  }
  return (
    <div className={dark ? "dark" : undefined}>
      <div data-recipe={r} data-qa-block={b} className={cn("min-h-dvh bg-background text-foreground", recipeFonts[r] ?? "")}>
        <main>
          <h1 className="sr-only">블록 서버 렌더 검사 — {b}</h1>
          {problem ? <p role="alert">{problem}</p> : body}
        </main>
      </div>
    </div>
  )
}
