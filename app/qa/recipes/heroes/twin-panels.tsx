// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/twin-panels(r3 B)를 레시피 사본(.tmp/blocks/r3-woodblock)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 상품 사진 두 장(public/media) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroTwinPanels } from "@/.tmp/blocks/r3-woodblock/hero/twin-panels"
import { fixture } from "@/registry/factory/blocks/hero/twin-panels.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, NavLinks, NextHint } from "./parts"
import type { HeroProps } from "./types"

export default function TwinPanels({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <header className="sticky top-0 z-30 bg-background">
      <div className="grid h-16 grid-cols-12 items-center gap-2 px-2">
        <p className="font-heading col-span-5 text-[1.375rem] md:col-span-3">솔숲 인쇄소</p>
        <nav aria-label="주 메뉴" className="col-span-6 hidden md:block">
          <NavLinks items={["새로 찍은 것", "달력", "엽서", "장날"]} className="text-sm" linkClass="hover:underline underline-offset-4 aria-[current=page]:font-bold" />
        </nav>
        <Button size="sm" variant="outline" className="col-span-7 justify-self-end md:col-span-3">
          장바구니 0
        </Button>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroTwinPanels {...fixture} header={header} media={[MEDIA.r3Left, MEDIA.r3Right]} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r3-woodblock", "panel-left"], ["r3-woodblock", "panel-right"]]} />
      <NextHint
        label="이번 주 새로 찍은 것"
        title="판 하나, 종이 여섯 가지"
        body="같은 판도 종이가 바뀌면 색이 달라집니다. 이번 주에는 모래·산호·하늘·자두 네 가지 잉크로 여섯 가지 종이에 찍었습니다. 모두 수량이 적어 장날 오후면 대개 끝납니다(예시)."
        cols={[{ k: "새 판", v: "6종" }, { k: "잉크", v: "4색" }, { k: "배송", v: "장날 다음 날" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
