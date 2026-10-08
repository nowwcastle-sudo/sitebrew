// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/vertical-title-slides(r8 A)를 레시피 사본(.tmp/blocks/r8-dusk)으로 그린다.
// 틀이 맡는 것: 머리(짙은 머리 — 블록 뿌리 안 header 칸, 블록 장면이 머리의 .vts-book 도 내려앉힌다) · 장면 그림 셋(public/media) ·
// 선택지의 기법·다크 구역 속성 · 출처 · 다음 칸 머리(면 위). 문구는 블록 예시 콘텐츠. 머리 메뉴의 현재 위치 밑줄은 heroes.css(틀 몫).
import { HeroVerticalTitleSlides } from "@/.tmp/blocks/r8-dusk/hero/vertical-title-slides"
import { fixture } from "@/registry/factory/blocks/hero/vertical-title-slides.fixture"

import { MEDIA, MediaCredit } from "./media"
import { DarkZone, FACE_CLASS, Face, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function VerticalTitleSlides({ r, o, zone }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <DarkZone zone={zone} as="header" className="bg-background">
        <div className="flex h-20 items-center gap-6 px-5 md:px-8">
          <a href="#top" className={cx("flex min-h-11 items-center gap-3", RING)}>
            {/* 선화 표장: 굽은 솔가지 하나와 초승달(집 그림이 아니다) */}
            <svg viewBox="0 0 64 40" aria-hidden="true" className="hidden h-9 w-14 text-foreground sm:block">
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 34 C 18 30, 26 22, 34 20 S 50 14, 58 8" />
                <path d="M16 30 l-4 -7 M16 30 l6 -5 M26 24 l-3 -8 M26 24 l7 -4 M38 18 l-2 -7 M38 18 l7 -2 M48 13 l-1 -6 M48 13 l6 0" />
                <path d="M50 30 a6 6 0 1 1 -2 -9 a4.5 4.5 0 1 0 2 9 Z" />
              </g>
            </svg>
            <span className="font-heading text-[1.35rem] leading-[1] tracking-[0.08em] whitespace-nowrap uppercase">
              Solmaru
              <span className="block font-sans text-sm tracking-[0.08em] normal-case">솔마루 스테이 · 예시</span>
            </span>
          </a>
          <nav aria-label="주 메뉴" className="ms-auto hidden lg:block">
            <ul className="font-heading flex gap-1 text-[1.0625rem] tracking-[0.06em] uppercase">
              {["Rooms", "Garden", "Supper", "Seasons", "Letters"].map((t, i) => (
                <li key={t}>
                  <a href="#top" lang="en" aria-current={i === 0 ? "page" : undefined} className={cx("vts-nav inline-flex min-h-11 items-center px-3", RING)}>
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a href="#top" className={cx("ms-auto hidden min-h-11 items-center px-2 text-sm whitespace-nowrap sm:inline-flex lg:ms-0", RING)}>
            선물권
          </a>
          <span data-enter className="vts-book ms-auto inline-flex sm:ms-0">
            <Button variant="outline" className="font-heading tracking-[0.06em] uppercase">
              Book a night
            </Button>
          </span>
        </div>
      </DarkZone>
    </div>
  )
  return (
    <HeroFrame>
      <HeroVerticalTitleSlides {...fixture} header={header} media={MEDIA.r8Slides} faces={o.faces} techniques={[...o.dyn]} darkScope={zone} />
      <MediaCredit items={[["r8-dusk", "slide-0"], ["r8-dusk", "slide-1"], ["r8-dusk", "slide-2"]]} />
      <Face k={k} fallback="bg-muted" as="div">
        {/* 다음 칸 머리도 면 색을 스스로 칠한다 — 투명하면 합성 층에서 글자가 회색조 안티앨리어싱으로 바뀐다(승격 전후 픽셀 대조에서 실측). */}
        <NextHint
          className={k ? FACE_CLASS[k] : "bg-muted"}
          label="머무는 방법"
          title="방은 넷, 마당은 하나"
          body="사랑채와 안채에 방이 둘씩 있고, 마당과 솔밭은 함께 씁니다. 저녁 여섯 시에 마당 등을 켜고, 아침상은 여덟 시에 방으로 들입니다. 예약은 사흘 전까지 받습니다(예시)."
          cols={[{ k: "입실", v: "오후 세 시" }, { k: "퇴실", v: "오전 열한 시" }, { k: "객실", v: "넷" }]}
        />
      </Face>
    </HeroFrame>
  )
}
