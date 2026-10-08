// /qa/recipes/ssr?r=<id>[&alt=B][&theme=light|dark] — 첫 화면 히어로를 **서버에서 그린다**(Task 11 fix — 모션 키트 SSR 번쩍임 검사).
// 검수대 /qa/recipes 는 ?r= 를 effect 에서 읽어 히어로가 클라이언트에서만 붙는다 — 그래서 「서버 HTML 이 끝 모양으로 먼저 칠해지고 하이드레이션 뒤
// 숨었다가 다시 등장」하는 번쩍임이 거기서는 드러나지 않는다. 이 페이지는 소비자 사이트와 같은 길(서버 컴포넌트 페이지 → 클라이언트 히어로 SSR)로 그린다.
// MotionBoot(motion-gsap)는 문서대로 루트 레이아웃(app/layout.tsx)의 <head> 에 있다(fix 2 — 이 페이지가 설치 방법 그대로를 잰다).
// 양성 대조(가림 없음)는 검사 도구가 파싱 전에 <html data-motion="off"> 를 달아 만든다.
// 검사 도구: factory/board/recipe-board/ssr-flash.mjs(npm run board:ssr-flash).
import { SsrHero } from "./ssr-hero"

export const dynamic = "force-dynamic"

type Params = Record<string, string | string[] | undefined>

export default async function QaRecipesSsrPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams
  const one = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null)
  return (
    <main className="flex flex-col">
      <SsrHero id={one("r")} alt={one("alt")} theme={one("theme")} />
    </main>
  )
}
