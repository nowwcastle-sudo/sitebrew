// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/baseline-news-app-window(r10 B)를 레시피 사본(.tmp/blocks/r10-console)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 선택지의 면·기법 · 다음 칸 머리. 문구·알림 행은 블록 예시 콘텐츠.
import { HeroBaselineNewsAppWindow } from "@/.tmp/blocks/r10-console/hero/baseline-news-app-window"
import { fixture } from "@/registry/factory/blocks/hero/baseline-news-app-window.fixture"

import { HeroFrame, NextHint, RING, cx } from "./parts"
import type { HeroProps } from "./types"

export default function BaselineNewsAppWindow({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <header data-sticky-nav className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center gap-6 px-6 md:px-[5.5%]">
        <a href="#top" className={cx("flex min-h-11 items-center gap-2.5 text-[1.3rem] font-bold", RING)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
            <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--primary)" />
            <path d="M6 16 L12 7 L18 16" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          자홍 콘솔
        </a>
        <nav aria-label="주 메뉴" className="ms-auto hidden lg:block">
          <ul className="flex text-[0.9375rem] text-muted-foreground">
            {["알림 묶기", "당번표", "연결 목록", "요금", "바뀐 점"].map((t, i) => (
              <li key={t}>
                <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center px-3 hover:text-foreground aria-[current=page]:text-foreground", RING)}>
                  {t}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span aria-hidden="true" className="hidden h-5 w-px bg-border lg:block" />
        <a href="#top" className={cx("ms-auto inline-flex min-h-11 items-center px-2 text-[0.9375rem] text-muted-foreground hover:text-foreground lg:ms-0", RING)}>
          로그인
        </a>
        <Button size="sm" className="rounded-full px-4">
          30일 써 보기
        </Button>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroBaselineNewsAppWindow {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="운영 흐름"
        title="신호가 오면, 한 사람이 맡을 때까지"
        body="같은 원인의 알림은 한 줄로 묶이고, 규칙이 맡을 사람을 고릅니다. 맡은 뒤 5분 안에 움직임이 없으면 다음 사람에게 넘어갑니다(예시)."
        cols={[{ k: "묶는 기준", v: "원인·서비스" }, { k: "넘김", v: "5분 무응답" }, { k: "기록", v: "90일 보관" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
