// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/staggered-oval-frame(r3 A)을 레시피 사본(.tmp/blocks/r3-woodblock)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 타원 안 영상(public/media) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroStaggeredOvalFrame } from "@/.tmp/blocks/r3-woodblock/hero/staggered-oval-frame"
import { fixture } from "@/registry/factory/blocks/hero/staggered-oval-frame.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, NavLinks, NextHint } from "./parts"
import type { HeroProps } from "./types"

export default function StaggeredOvalFrame({ o }: HeroProps) {
  const header = (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4 md:px-8">
        <p className="text-sm font-bold tracking-[0.16em] uppercase">솔숲 목판 장터</p>
        <nav aria-label="주 메뉴" className="mx-auto hidden md:block">
          <NavLinks items={["차림", "장날", "찍는 곳", "주문"]} className="text-sm" linkClass="hover:underline underline-offset-4 aria-[current=page]:font-bold" />
        </nav>
        <p className="ms-auto text-sm font-bold tracking-[0.16em] uppercase md:ms-0">을지로 · 토요일</p>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroStaggeredOvalFrame {...fixture} header={header} media={MEDIA.r3Oval} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r3-woodblock", "oval"]]} />
      <NextHint
        label="이번 장"
        title="배나무 판, 두 도수, 마흔 부"
        body="달력과 엽서를 배나무 판에 손으로 찍습니다. 종이는 닥나무 한지이고 한 장씩 결이 달라, 같은 그림이라도 번짐이 조금씩 다릅니다. 장이 서는 토요일에만 보냅니다(예시)."
        cols={[
          { k: "판", v: "배나무" },
          { k: "종이", v: "닥나무 한지" },
          { k: "보내는 날", v: "토요일" },
        ]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
