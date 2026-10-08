// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/layered-landscape-logotype(r9 B)을 레시피 사본(.tmp/blocks/r9-clay)으로 그린다.
// 틀이 맡는 것: 머리(면 머리 — 블록 뿌리 안 header 칸, 블록 장면이 머리의 .llc-cta 도 내려앉힌다) · 선택지의 면·기법 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroLayeredLandscapeLogotype } from "@/.tmp/blocks/r9-clay/hero/layered-landscape-logotype"
import { fixture } from "@/registry/factory/blocks/hero/layered-landscape-logotype.fixture"

import { Face, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function LayeredLandscapeLogotype({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <Face k={k} fallback="bg-muted" as="header">
        <div className="flex h-[5.5rem] items-center gap-6 px-5 md:px-12">
          <a href="#top" aria-label="작은 점토 숲 처음으로" className={cx("inline-flex min-h-11 items-center", RING)}>
            {/* 표장: 불꽃 하나를 인 점토 항아리(글자 없는 그림 — 잎·모노그램이 아니다) */}
            <svg viewBox="0 0 64 56" aria-hidden="true" className="h-12 w-14">
              <path d="M14 53 C 9 41, 13 27, 23 23 L41 23 C 51 27, 55 41, 50 53 Z" fill="var(--block-3)" />
              <path d="M21 23 C 21 17, 43 17, 43 23" fill="none" stroke="var(--block-3)" strokeWidth="4" strokeLinecap="round" />
              <path d="M32 3 C 39 9, 37 14, 32 16 C 27 14, 25 9, 32 3 Z" fill="var(--block-3)" />
              <path d="M22 39 H42" stroke="var(--block-3-foreground)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </a>
          <nav aria-label="주 메뉴" className="ms-auto hidden lg:block">
            <ul className="flex text-[0.9375rem] font-bold tracking-[0.04em]">
              {["하루 일정", "준비물", "숲 지도", "사진첩", "보호자 안내"].map((t, i) => (
                <li key={t}>
                  <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline aria-[current=page]:underline", RING)}>
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <span data-face-reset data-enter className="llc-cta ms-auto lg:ms-0">
            <Button size="lg" className="rounded-full px-7 font-bold">
              빈자리 보기
            </Button>
          </span>
        </div>
      </Face>
    </div>
  )
  return (
    <HeroFrame>
      <HeroLayeredLandscapeLogotype {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="캠프 하루"
        title="오전엔 빚고, 오후엔 숲으로"
        body="아침에는 흙을 반죽해 숲에서 주운 것을 찍어 넣고, 점심 뒤에는 개울가를 걷습니다. 구운 작품은 두 주 뒤 집으로 보냅니다. 한 반은 여덟 명입니다(예시)."
        cols={[{ k: "나이", v: "일곱 살부터 열두 살" }, { k: "시간", v: "10:00 – 16:00" }, { k: "한 반", v: "여덟 명" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
