import type { Metadata } from "next"

// 레시피마다 [data-recipe] 로 가둔 색·서체 변수(factory/scripts/gen-recipes-gallery.mjs 생성물, .tmp 는 gitignore).
// 서체 로더는 레시피 YAML 에서 만든 .tmp/recipes/fonts.ts 가 맡는다(페이지가 레시피 칸마다 변수 클래스를 단다).
import "@/.tmp/recipes/recipes.css"
// Google 밖 키트 서체(Pretendard 등)의 패키지 CSS(생성물 .tmp/recipes/kit-fonts.ts, T8-c3) — next/font 로더가 없는 서체를 여기서 싣는다.
import "@/.tmp/recipes/kit-fonts"
// 대표 장면의 역동 기법 클래스(scenes.tsx).
import "./scenes.css"
// 첫 화면 히어로 구성의 CSS(Task 10d) — [data-hero="<id>"] 아래에 가둔다.
import "./heroes/heroes.css"

export const metadata: Metadata = {
  title: "QA · 레시피",
}

export default function QaRecipesLayout({ children }: { children: React.ReactNode }) {
  return children
}
