// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/identity-strip-banner(r6 머리 구성)를 레시피 사본(.tmp/blocks/r6-civic)으로 그린다.
// 틀이 맡는 것: 건너뛰기 링크 · 맨 위 32px 기관 식별 띠(가상 기관 — 공식 전자정부 배너가 아니다, 머리 밖·고정 안 함) · 두 줄 머리(로고 · 유틸리티
// (English · 글자 크기) · 통합검색 / 메가메뉴 7개(펼침 단추)) — 블록 뿌리 안 header 칸 · 선택지의 면·기법 · 다음 칸 머리. 문구·서비스 칸은 블록 예시 콘텐츠.
// 머리 격자와 메뉴 밑줄 hover 는 heroes.css 의 머리 규칙이 맡는다.
import * as React from "react"

import { HeroIdentityStripBanner } from "@/.tmp/blocks/r6-civic/hero/identity-strip-banner"
import { fixture } from "@/registry/factory/blocks/hero/identity-strip-banner.fixture"

import { HeroFrame, NextHint, RING, cx, useRootScale } from "./parts"
import type { HeroProps } from "./types"

const MENU = ["민원 안내", "증명서 발급", "시설 예약", "정보 공개", "시정 소식", "시민 참여", "찾아오시는 길"]
// 메가메뉴 판(펼침 단추가 여는 하위 링크 — 모두 예시).
const SUB: Record<string, string[]> = {
  "민원 안내": ["처리 기간 안내", "수수료 안내", "대리 신청"],
  "증명서 발급": ["주민 등본", "가족관계 증명", "건축물 대장"],
  "시설 예약": ["회의실", "체육관", "주민 쉼터"],
  "정보 공개": ["사전 공개 목록", "공개 청구", "예산 보고"],
  "시정 소식": ["공지", "보도 자료", "채용"],
  "시민 참여": ["제안 접수", "설문", "자원봉사"],
  "찾아오시는 길": ["본청", "민원실 주차", "버스 노선"],
}
const SIZES = ["90", "100", "110", "130"]

export default function IdentityStripBanner({ r, o }: HeroProps) {
  const { ToggleGroup, ToggleGroupItem } = r.ui["toggle-group"]
  const { Search, Info, ChevronDown, Menu, X } = r.glyphs
  const [menu, setMenu] = React.useState(false)
  const [mega, setMega] = React.useState<string | null>(null)
  const [size, setSize] = React.useState<string[]>(["100"])
  useRootScale(size[0])
  const header = (
    <>
      <a href="#hero-main" className={cx("sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2", RING)}>
        본문 바로가기
      </a>
      <div className="bg-muted">
        <p className="mx-auto flex min-h-8 max-w-[75rem] items-center gap-2 px-4 text-sm md:px-6">
          <Info aria-hidden="true" className="size-4 text-primary" />
          예시 — 가상의 시 민원센터 누리집입니다. 공식 전자정부 누리집이 아닙니다.
        </p>
      </div>
      {/* 머리(§21-8): DOM 순서 = 로고 → 유틸리티(English · 글자 크기) → 통합검색 → 메뉴(좁은 화면은 메뉴 단추). 식별 띠는 머리 밖이라 고정되지 않는다.
          메가메뉴는 실제 펼침 단추다 — 누르면 그 메뉴의 하위 링크 판이 열리고, Esc·다시 누름으로 닫힌다. */}
      <header data-sticky-nav className="sticky top-0 z-30 border-b bg-background" onKeyDown={(e) => { if (e.key === "Escape") { setMega(null); setMenu(false) } }}>
        <div className="isb-head mx-auto max-w-[75rem] gap-x-3 px-4 py-2 md:px-6">
          <a href="#top" className={cx("isb-logo flex min-h-11 items-center gap-3", RING)}>
            {/* 표장: 둥근 칸 안 계단 셋(서류가 쌓여 줄어드는 모양) — 원천 누리집의 표장과 무관한 새 모양. */}
            <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10">
              <rect x="4" y="4" width="32" height="32" rx="8" fill="var(--field-1)" />
              <path d="M11 29 H29 V24 H24 V19 H19 V14 H11 Z" fill="var(--field-1-foreground)" />
            </svg>
            <span className="text-[1.3125rem] leading-[1.2] font-bold">
              한빛시 민원센터
              <span className="font-heading block text-sm font-normal tracking-[0.04em] text-muted-foreground">HANBIT CIVIC · 예시</span>
            </span>
          </a>
          <div className="isb-util flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
            <a href="#top" lang="en" className={cx("inline-flex min-h-11 items-center px-1", RING)}>
              English
            </a>
            <span aria-hidden="true" className="h-4 w-px bg-border" />
            <span id="isb-size" className="text-muted-foreground">
              글자 크기
            </span>
            <ToggleGroup value={size} onValueChange={(v) => { if ((v as string[]).length) setSize(v as string[]) }} aria-labelledby="isb-size">
              {SIZES.map((s) => (
                <ToggleGroupItem key={s} value={s} aria-label={`글자 크기 ${s}%`} className="min-w-11 px-2 text-sm tabular-nums">
                  {s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <a href="#top" className={cx("isb-search inline-flex min-h-11 flex-col items-center justify-center px-2 text-sm font-bold", RING)}>
            <Search aria-hidden="true" className="size-5" />
            통합검색
          </a>
          <button type="button" aria-expanded={menu} aria-controls="isb-menu" onClick={() => setMenu((v) => !v)} className={cx("isb-menu-btn inline-flex min-h-11 flex-col items-center justify-center px-2 text-sm font-bold lg:hidden", RING)}>
            {menu ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            메뉴
          </button>
          <nav id="isb-menu" aria-label="주 메뉴" className={cx("isb-nav border-t lg:block", menu ? "block" : "hidden")}>
            <ul className="flex flex-col lg:flex-row lg:justify-between">
              {MENU.map((t) => (
                <li key={t}>
                  <button type="button" aria-expanded={mega === t} aria-controls="isb-mega" onClick={() => setMega((m) => (m === t ? null : t))} className={cx("isb-menu inline-flex min-h-12 w-full items-center gap-1.5 px-4 text-[1.0625rem] font-bold lg:min-h-14 lg:w-auto", RING)}>
                    {t}
                    <ChevronDown aria-hidden="true" className={cx("size-4 text-muted-foreground", mega === t && "rotate-180")} />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div id="isb-mega" hidden={!mega} className="isb-mega border-t py-4">
            {mega && (
              <ul aria-label={`${mega} 하위 메뉴`} className="grid gap-x-8 sm:grid-cols-3">
                {SUB[mega].map((s) => (
                  <li key={s}>
                    <a href="#top" className={cx("inline-flex min-h-11 items-center text-[1.0625rem] hover:underline hover:underline-offset-4", RING)}>
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>
    </>
  )
  return (
    <HeroFrame>
      <HeroIdentityStripBanner {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="알림·소식"
        title="이번 주 새 공지 세 건"
        body="공지마다 올린 날짜와 담당 부서를 붙입니다. 기한이 있는 안내는 제목 옆에 마감일을 먼저 보이고, 끝난 공지는 기간이 지나면 내립니다(예시)."
        cols={[{ k: "2026. 9. 26.", v: "민원실 운영 시간 변경 — 민원여권과" }, { k: "2026. 9. 25.", v: "주차장 공사 안내 — 회계과" }, { k: "2026. 9. 24.", v: "추석 연휴 당직 — 총무과" }]}
        className="mx-auto w-full max-w-[75rem] border-t bg-background"
      />
    </HeroFrame>
  )
}
