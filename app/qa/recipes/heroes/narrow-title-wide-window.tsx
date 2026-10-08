// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/narrow-title-wide-window(r7 B)를 레시피 사본(.tmp/blocks/r7-docs)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 선택지의 면·기법 · 다음 칸 머리. 문구·목록 나무·카드는 블록 예시 콘텐츠.
import { HeroNarrowTitleWideWindow } from "@/.tmp/blocks/r7-docs/hero/narrow-title-wide-window"
import { fixture } from "@/registry/factory/blocks/hero/narrow-title-wide-window.fixture"

import { HeroFrame, NextHint, RING, cx } from "./parts"
import type { HeroProps } from "./types"

export default function NarrowTitleWideWindow({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const { ChevronDown } = r.glyphs
  const header = (
    <header data-sticky-nav className="sticky top-0 z-30 bg-background">
      <div className="flex h-[4.5rem] items-center gap-5 px-6 md:px-8">
        <a href="#top" className={cx("flex min-h-11 items-center gap-2 text-[1.35rem] font-bold", RING)}>
          {/* 표장: 책갈피 한 장(아래가 파인 띠) + 점 하나 */}
          <svg viewBox="0 0 28 28" aria-hidden="true" className="size-7 text-primary">
            <path d="M7 2h14v24l-7-6-7 6z" fill="currentColor" />
            <circle cx="14" cy="10" r="3" fill="var(--background)" />
          </svg>
          갈피
        </a>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
        <nav aria-label="주 메뉴" className="hidden md:block">
          <ul className="flex text-[1.0625rem]">
            {["둘러보기", "쓰는 법", "요금", "소식"].map((t, i) => (
              <li key={t}>
                <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-1 px-3", RING)}>
                  {t}
                  {i < 2 && <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-3">
          <a href="#top" className={cx("hidden min-h-11 items-center px-2 text-[1.0625rem] lg:inline-flex", RING)}>
            사용 예 보기
          </a>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border lg:block" />
          <Button variant="secondary" className="hidden sm:inline-flex">
            로그인
          </Button>
          <Button>빈 판 열기</Button>
        </div>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroNarrowTitleWideWindow {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="쓰는 법"
        title="조사 하나에 판 하나"
        body="질문을 먼저 적고, 모은 자료를 그 아래 붙입니다. 선으로 이은 자료는 결론 초안에 근거로 따라 들어가, 누가 읽어도 어디서 나온 말인지 보입니다(예시)."
        cols={[{ k: "판 하나에", v: "질문 하나" }, { k: "붙이는 것", v: "메모 · 사진 · 녹음" }, { k: "결론", v: "선을 따라 초안" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
