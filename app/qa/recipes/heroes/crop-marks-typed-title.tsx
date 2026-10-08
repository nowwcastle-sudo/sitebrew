// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/crop-marks-typed-title(r10 A)을 레시피 사본(.tmp/blocks/r10-console)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸 — 머리의 딱딱한 그림자 버튼 모양 .ct-hard-wrap 은 heroes.css, 틀 몫) · 선택지의 면·기법 · 다음 칸 머리.
// 문구는 블록 예시 콘텐츠.
import { HeroCropMarksTypedTitle } from "@/.tmp/blocks/r10-console/hero/crop-marks-typed-title"
import { fixture } from "@/registry/factory/blocks/hero/crop-marks-typed-title.fixture"

import { HeroFrame, NextHint, RING, cx } from "./parts"
import type { HeroProps } from "./types"

export default function CropMarksTypedTitle({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <header data-sticky-nav className="sticky top-0 z-30 bg-background">
      <div className="flex h-24 items-center gap-6 px-6 md:px-9">
        <a href="#top" className={cx("font-heading flex min-h-11 items-center gap-2.5 text-[1.3rem] tracking-[0.06em]", RING)}>
          <svg viewBox="0 0 28 24" aria-hidden="true" className="h-6 w-7 text-foreground">
            <path d="M2 8 L14 2 L26 8 L14 14 Z M2 14 L14 20 L26 14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
          </svg>
          SINHO·DESK
        </a>
        <nav aria-label="주 메뉴" className="mx-auto hidden rounded-[8px] bg-muted px-3 lg:block">
          <ul className="font-heading flex text-sm">
            {["규칙 예시", "당번 짜기", "연결", "요금", "바뀐 점"].map((t, i) => (
              <li key={t}>
                <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-12 items-center px-4 hover:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4", RING)}>
                  {t}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-4 lg:ms-0">
          <a href="#top" className={cx("font-heading hidden min-h-11 items-center gap-2 text-sm tracking-[0.06em] sm:inline-flex", RING)}>
            <span aria-hidden="true">▸</span>들어가기<span aria-hidden="true">◂</span>
          </a>
          <span className="ct-hard-wrap">
            <Button className="font-heading rounded-[6px] px-5 tracking-[0.06em]">
              <span aria-hidden="true">▸</span> 써 보기
            </Button>
          </span>
        </div>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroCropMarksTypedTitle {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="작동 방식"
        title="규칙 파일 하나, 담당자 두 명부터"
        body="어떤 신호를 누구에게 보낼지 파일 한 장에 적습니다. 새벽에는 깨어 있는 사람만 고르고, 응답이 없으면 다음 사람에게 넘깁니다(예시)."
        cols={[{ k: "연결한 서비스", v: "쉰 곳" }, { k: "첫 설정", v: "파일 한 장" }, { k: "넘김", v: "5분 무응답" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
