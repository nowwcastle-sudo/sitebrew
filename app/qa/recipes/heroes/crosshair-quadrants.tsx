// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/crosshair-quadrants(r6 대안)를 레시피 사본(.tmp/blocks/r6-civic)으로 그린다.
// 틀이 맡는 것: 건너뛰기 링크 + 머리(§21-8 순서 — 건너뛰기 → 로고 → 유틸리티(글자 크기) → 검색 → 메인 메뉴, 블록 뿌리 안 header 칸 — 머리의 세로 기준선
// .cq-vline 도 블록 장면이 함께 긋는다) · 선택지의 면·기법 · 다음 칸 머리. 문구·단계·서비스 칸은 블록 예시 콘텐츠.
// 머리 격자(1280 아래 로고·검색·메뉴 / 글자 크기 / 메뉴, 1280 이상 오른쪽 절반 두 줄)는 heroes.css 의 머리 규칙이 맡는다.
import * as React from "react"

import { HeroCrosshairQuadrants } from "@/.tmp/blocks/r6-civic/hero/crosshair-quadrants"
import { fixture } from "@/registry/factory/blocks/hero/crosshair-quadrants.fixture"

import { HeroFrame, NextHint, RING, cx, useRootScale } from "./parts"
import type { HeroProps } from "./types"

const MENU = ["민원 신청", "정보 공개", "알림·소식", "기관 소개", "참여"]
const SIZES = ["90", "100", "110", "130"]

export default function CrosshairQuadrants({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const { ToggleGroup, ToggleGroupItem } = r.ui["toggle-group"]
  const { Search, ArrowRight, Menu, X } = r.glyphs
  const [size, setSize] = React.useState<string[]>(["100"])
  const [menu, setMenu] = React.useState(false)
  useRootScale(size[0])
  const header = (
    <>
      <a href="#hero-main" className={cx("sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2", RING)}>
        본문 바로가기
      </a>
      <header data-sticky-nav className="sticky top-0 z-30 bg-background">
        <div className="cq-head relative gap-x-4 gap-y-2 px-6 pt-4 pb-3">
          <span aria-hidden="true" data-enter className="cq-vline absolute inset-y-0 start-1/2 hidden w-px bg-border lg:block" />
          <a href="#top" className={cx("cq-logo flex min-h-11 items-center gap-3 self-start", RING)}>
            {/* 표장: 네모 칸을 십자 기준선이 넷으로 나누고, 오른쪽 위 칸 하나만 채운다(이 첫 화면의 4분면 구성에서 가져온 모양). */}
            <svg viewBox="0 0 40 40" className="size-9 text-primary" aria-hidden="true">
              <rect x="4" y="4" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="3" />
              <path d="M20 4V36M4 20H36" stroke="currentColor" strokeWidth="3" />
              <rect x="22" y="6" width="12" height="12" fill="currentColor" />
            </svg>
            <span className="text-[1.0625rem] leading-[1.2] font-bold">
              한빛시 민원센터
              <span className="block text-sm font-normal text-muted-foreground">예시 누리집</span>
            </span>
          </a>
          <div className="cq-right xl:gap-x-6 xl:gap-y-2 xl:ps-4">
            <div className="cq-util flex items-center gap-2">
              <span id="cq-size" className="text-sm text-muted-foreground">
                글자 크기
              </span>
              <ToggleGroup value={size} onValueChange={(v) => { if ((v as string[]).length) setSize(v as string[]) }} aria-labelledby="cq-size">
                {SIZES.map((s) => (
                  <ToggleGroupItem key={s} value={s} aria-label={`글자 크기 ${s}%`} className="min-w-11 px-2 text-sm tabular-nums">
                    {s}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <a href="#top" className={cx("cq-search inline-flex min-h-11 items-center gap-1 px-2 text-sm", RING)}>
              <Search aria-hidden="true" className="size-4" />
              검색
            </a>
            <button type="button" aria-expanded={menu} aria-controls="cq-menu" onClick={() => setMenu((v) => !v)} className={cx("cq-menu-btn inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-bold xl:hidden", RING)}>
              {menu ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
              메뉴
            </button>
            <nav id="cq-menu" aria-label="주 메뉴" className={cx("cq-nav xl:block", menu ? "block" : "hidden")}>
              <ul className="grid gap-x-10 border-t py-2 xl:grid-flow-col xl:grid-rows-2 xl:border-t-0 xl:py-0">
                {MENU.map((t, i) => (
                  <li key={t}>
                    <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center text-[0.9375rem] leading-[1.5] hover:underline hover:underline-offset-4 aria-[current=page]:font-bold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-4 xl:min-h-8", RING)}>
                      {t}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <Button className="cq-cta hidden rounded-none xl:inline-flex">
              민원 신청
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
    </>
  )
  return (
    <HeroFrame>
      <HeroCrosshairQuadrants {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="알림·소식"
        title="이번 주 새 공지 세 건"
        body="공지마다 올린 날짜와 담당 부서를 붙입니다. 기한이 있는 안내는 제목 옆에 마감일을 먼저 보이고, 끝난 공지는 기간이 지나면 내립니다(예시)."
        cols={[{ k: "2026. 9. 26.", v: "민원실 운영 시간 변경 — 민원여권과" }, { k: "2026. 9. 25.", v: "주차장 공사 안내 — 회계과" }, { k: "2026. 9. 24.", v: "추석 연휴 당직 — 총무과" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
