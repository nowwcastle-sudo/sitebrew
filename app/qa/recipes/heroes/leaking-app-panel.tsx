// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/leaking-app-panel(r7 A)을 레시피 사본(.tmp/blocks/r7-docs)으로 그린다.
// 틀이 맡는 것: 머리(새 기능 띠 + 짙은 머리 — 블록 뿌리 안 header 칸) · 선택지의 면·기법·다크 구역 속성 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroLeakingAppPanel } from "@/.tmp/blocks/r7-docs/hero/leaking-app-panel"
import { fixture } from "@/registry/factory/blocks/hero/leaking-app-panel.fixture"

import { DarkZone, Face, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

// 표장: 모서리가 접힌 종이 한 장 + 글줄 둘(설명서 한 장) — 블록 안 표장과 같은 그림.
function Mark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 3h10l4 4v14H5z M15 3v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function LeakingAppPanel({ r, o, zone }: HeroProps) {
  const { Button } = r.ui.button
  const { ChevronDown, ChevronRight } = r.glyphs
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <DarkZone zone={zone} className="bg-background">
        <p className="flex min-h-10 items-center justify-center gap-3 border-b px-4 text-sm">
          <Face k={k} fallback="bg-muted" as="span" className="inline-flex min-h-7 items-center rounded-[4px] px-2 font-bold">
            새 기능
          </Face>
          <span className="font-bold">고친 코드 줄 옆에 설명서 문단이 같이 뜹니다(예시)</span>
          <a href="#top" className={cx("hidden min-h-10 items-center gap-1 text-muted-foreground hover:text-foreground sm:inline-flex", RING)}>
            바뀐 점 보기 <ChevronRight aria-hidden="true" className="size-4" />
          </a>
        </p>
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-[68rem] items-center gap-6 px-6">
            <a href="#top" className={cx("flex min-h-11 items-center gap-2 text-[1.3rem] font-bold", RING)}>
              <Mark className="size-6 text-ring" />
              문서곳
            </a>
            <nav aria-label="주 메뉴" className="ms-auto hidden md:block">
              <ul className="flex gap-1 text-[0.9375rem] font-bold">
                {["쓰는 법", "예시 설명서", "연동", "요금"].map((t, i) => (
                  <li key={t}>
                    <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-1 px-3 hover:text-ring", RING)}>
                      {t}
                      {i < 3 && <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="ms-auto flex gap-2">
              <Button variant="outline" className="hidden sm:inline-flex">
                로그인
              </Button>
              <Button>설명서 만들기</Button>
            </div>
          </div>
        </header>
      </DarkZone>
    </div>
  )
  return (
    <HeroFrame>
      <HeroLeakingAppPanel {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} darkScope={zone} />
      <NextHint
        label="작동 방식"
        title="코드가 바뀐 날, 설명서도 바뀝니다"
        body="병합된 변경마다 관련 문단에 고칠 곳을 표시합니다. 담당자가 확인하면 웹 설명서와 인쇄용 PDF가 함께 바뀌고, 지난 판은 날짜별로 남습니다(예시)."
        cols={[{ k: "갱신", v: "병합마다" }, { k: "확인", v: "문서 담당 한 사람" }, { k: "내보내기", v: "웹 · PDF" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
