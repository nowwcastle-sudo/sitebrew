// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/stepped-crop-figure(r4 A)를 레시피 사본(.tmp/blocks/r4-evidence)으로 그린다.
// 틀이 맡는 것: 머리(공지 띠 + 내비 — 블록 뿌리 안 header 칸) · 선택지의 기법 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroSteppedCropFigure } from "@/.tmp/blocks/r4-evidence/hero/stepped-crop-figure"
import { fixture } from "@/registry/factory/blocks/hero/stepped-crop-figure.fixture"

import { HeroFrame, Face, NavLinks, NextHint, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function SteppedCropFigure({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <Face k={k} fallback="bg-muted" className="flex min-h-9 items-center justify-center px-4 text-sm">
        <p>예시 — 답마다 근거 문장과 출처를 함께 붙입니다</p>
      </Face>
      <header className="border-b bg-background">
        <div className="flex h-16 items-center gap-6 px-6 md:px-10">
          <p className="font-heading text-[1.4rem]">근거노트</p>
          <nav aria-label="주 메뉴" className="hidden md:block">
            <NavLinks items={["읽는 방식", "보고서 서가", "쓰는 곳", "요금"]} className="text-sm" linkClass="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground" />
          </nav>
          <Button size="sm" variant="outline" className="ms-auto">
            로그인
          </Button>
        </div>
      </header>
    </div>
  )
  return (
    <HeroFrame>
      <HeroSteppedCropFigure {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="근거 방식"
        title="모든 답은 문장 하나에서 시작합니다"
        body="답을 만들기 전에 보고서에서 근거 문장을 먼저 찾습니다. 찾은 문장은 답 옆에 그대로 붙고, 누르면 원문의 그 줄로 넘어갑니다. 근거가 둘 이상이면 서로 다른 점도 적습니다(예시)."
        cols={[{ k: "근거 문장", v: "답마다 최대 3개" }, { k: "원문 이동", v: "한 번 누르기" }, { k: "없으면", v: "없다고 답함" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
