// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/banded-full-bleed(r5 A)를 레시피 사본(.tmp/blocks/r5-celadon)으로 그린다.
// 틀이 맡는 것: 머리(공지 띠 + 내비 — 블록 뿌리 안 header 칸) · 실사 영상(public/media) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroBandedFullBleed } from "@/.tmp/blocks/r5-celadon/hero/banded-full-bleed"
import { fixture } from "@/registry/factory/blocks/hero/banded-full-bleed.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, Face, NavLinks, NextHint, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function BandedFullBleed({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <Face k={k} fallback="bg-muted" className="flex min-h-7 items-center justify-center px-4 text-sm">
        <p>예시 — 가을 가마 전시, 10월 한 달 작업실에서 엽니다</p>
      </Face>
      <header className="border-b bg-background">
        <div className="flex h-16 items-center gap-6 px-5">
          <p className="font-heading text-[1.5rem]">고요 도예</p>
          <nav aria-label="주 메뉴" className="mx-auto hidden md:block">
            <NavLinks items={["작업", "전시", "공방", "주문"]} className="text-sm" linkClass="hover:underline underline-offset-4 aria-[current=page]:font-bold" />
          </nav>
          <Button size="sm" variant="outline" className="ms-auto md:ms-0">
            장바구니
          </Button>
        </div>
      </header>
    </div>
  )
  return (
    <HeroFrame>
      <HeroBandedFullBleed {...fixture} header={header} media={MEDIA.r5Band} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r5-celadon", "band"]]} />
      <NextHint
        label="작업 노트"
        title="비색 한 점, 여백 한 칸"
        body="유약을 세 번 입혀 비색이 깊습니다. 한 점씩 손으로 빚어 높이가 조금씩 다르고, 상자에 굽는 날짜를 적어 보냅니다. 한 달에 여섯 점만 내놓습니다(예시)."
        cols={[{ k: "굽는 횟수", v: "서른 번" }, { k: "한 가마", v: "여섯 점" }, { k: "전시", v: "10월 한 달" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
