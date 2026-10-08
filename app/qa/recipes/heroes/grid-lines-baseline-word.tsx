// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/grid-lines-baseline-word(r8 B)를 레시피 사본(.tmp/blocks/r8-dusk)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 영상(public/media) · 선택지의 기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroGridLinesBaselineWord } from "@/.tmp/blocks/r8-dusk/hero/grid-lines-baseline-word"
import { fixture } from "@/registry/factory/blocks/hero/grid-lines-baseline-word.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, NextHint, RING, cx } from "./parts"
import type { HeroProps } from "./types"

export default function GridLinesBaselineWord({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const link = (t: string) => (
    <a key={t} href="#top" className={cx("inline-flex min-h-11 items-center bg-muted px-5 text-sm font-bold hover:bg-accent", RING)}>
      {t}
    </a>
  )
  const header = (
    <header data-sticky-nav className="sticky top-0 z-30 bg-background">
      <div className="grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-5">
        <nav aria-label="주 메뉴" className="hidden gap-1.5 md:flex">
          {["숲길 지도", "차 목록", "방 넷"].map(link)}
        </nav>
        <a href="#top" className={cx("col-start-2 flex min-h-11 flex-col items-center justify-center gap-1", RING)}>
          <svg viewBox="0 0 48 16" aria-hidden="true" className="h-3.5 w-12 text-primary">
            <path d="M2 15 L14 3 L20 9 L26 1 L46 15 Z" fill="currentColor" />
          </svg>
          <span className="font-heading text-[1.125rem] leading-[1.1] tracking-[0.08em]">솔숲 다원</span>
        </a>
        <div className="col-start-3 flex justify-end gap-1.5">
          <span className="hidden md:contents">{link("오시는 길")}</span>
          <Button variant="secondary" className="min-h-11 rounded-none px-5 font-bold">
            저녁 자리 잡기
          </Button>
        </div>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroGridLinesBaselineWord {...fixture} header={header} media={MEDIA.r8Grid} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r8-dusk", "grid"]]} />
      <NextHint
        label="머무는 방법"
        title="하루 네 팀, 해 질 무렵부터"
        body="방은 넷이고, 다실은 오후 다섯 시에 엽니다. 저녁 차는 숲에서 딴 솔잎과 햇차로 우리고, 불은 아홉 시에 낮춥니다. 예약은 전날 저녁 여덟 시까지 받습니다(예시)."
        cols={[{ k: "입실", v: "오후 네 시" }, { k: "다실", v: "17:00 – 21:00" }, { k: "객실", v: "넷" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
