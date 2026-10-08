"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, kenBurns, kineticType, lowerThird, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"
import { LowerThird, type LowerThirdItem } from "../_shared/lower-third"

// 히어로 — 실사 사진 3~5장 켄 번스 몽타주(P3-5 MOTKIT). 첫 화면 전체가 사진 무대: 사진이 느리게 확대·축소·팬하며(장마다 방향을 번갈아) 7초마다
// 1.2초 교차해 바뀌고, 왼쪽 아래 큰 제목(짙은 막 위), 그 아래 이름표 띠(로어 서드)가 사진이 바뀔 때 함께 바뀐다(사진마다 장소·장면 이름).
// 오른쪽 아래 판(바탕색 면) 하나에 한 문단 + 버튼 둘, 판 위 끝에 사진 수만큼 눈금(장식 — 첫 눈금만 주색). 사진이 없으면 muted 면 무대(같은 배치).
// 첫 장만 서버 HTML 에 그림으로 싣는다(첫 칠·LCP — 우선 받기). 나머지 장은 첫 칠 뒤 한가할 때 붙인다(LCP 대역폭을 나누지 않는다).
// 모션(MOTKIT — 동작 줄이기·M0 정지, M1 은 첫 장 정지(유휴 반복 없음), 화면 밖·숨은 탭·정지 단추에서 멈춤):
//   등장  무대가 가운데에서 좌우로 열린다 → 제목이 낱말마다 칸 안에서 올라온다 → 이름표 → 판이 떠오른다(서버 렌더 첫 화면은 끝 상태 — keep).
//   반복  등장 끝 + 1.6초부터 켄 번스(장 7s · 교차 1.2s · 확대 1.12 · 팬 3%) — 교차 시각에 이름표가 이즈 아웃 → 이즈 인으로 바뀐다. 마지막 장이 걷히며 첫 장으로 이음매 없이.
//   강조  등장 끝 + 1.6초에 제목 글자 물결(웨이브). 스크롤 무대가 천천히 가라앉고 제목이 떠오른다.
export type HeroKenBurnsStillsCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  captions: LowerThirdItem[]
  captionsLabel: string
  pauseLabel: string
}
export type HeroKenBurnsStillsProps = BlockBase<HeroKenBurnsStillsCopy> & HeroCommon & HeroDisplay & { stills?: ImageSlot[] }

const DEFAULT_TECHNIQUES = ["ken-burns", "kinetic-type", "lower-third"]
const MAX_STILLS = 5

export function HeroKenBurnsStills({ copy, locale, id = "hero", className, stills = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroKenBurnsStillsProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { paused, toggle, rootProps } = useLoopPause()
  const list = stills.slice(0, MAX_STILLS)
  // 둘째 장부터는 첫 칠 뒤 한가할 때 붙인다(서버 HTML 에는 첫 장 그림만).
  const [more, setMore] = React.useState(false)
  React.useEffect(() => {
    if (list.length < 2) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void }
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setMore(true), { timeout: 2500 })
      return () => w.cancelIdleCallback?.(h)
    }
    const t = window.setTimeout(() => setMore(true), 1200)
    return () => window.clearTimeout(t)
  }, [list.length])
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    clipReveal(s, q(".kb-stage-in"), { from: "center-x", at: 0, duration: s.t.enter * 1.6 })
    kineticType(s, q(".kb-title"), { mode: "rise", by: "words", at: 0.25 })
    lowerThird(s, q("[data-lt]"), { at: 0.7, loop: false })
    rise(s, q(".kb-card"), { at: 0.8, y: 24 })
    if (techniques.includes("ken-burns")) kenBurns(s, q(".kb-stage-in"), { captions: q("[data-lt]") })
    kineticType(s, q(".kb-title"), { mode: "wave" })
    const tl = scrubTimeline(s)
    tl.to(q(".kb-stage-s"), { yPercent: 6 * s.scale.depth, scale: 1.04 }, 0)
    tl.to(q(".kb-title"), { yPercent: -20 * s.scale.distance }, 0)
  })
  const n = Math.max(1, list.length)
  return (
    <div ref={ref} id={id} data-block="hero-ken-burns-stills" data-hero="ken-burns-stills" {...rootProps} className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="relative isolate flex flex-col justify-end overflow-clip px-5 pt-24 pb-8 md:px-10 md:pb-10 hero-first">
        {/* 사진 무대(장식) — 장마다 .kb-img 층이 움직이고 [data-kb-slide] 가 교차한다. 서버 렌더 첫 화면에서는 여는 등장을 끝 상태로 둔다(keep). */}
        <div aria-hidden="true" data-enter="keep" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 kb-stage-s">
            <div className="relative size-full overflow-clip kb-stage-in">
              {list.length ? (
                list.map((m, i) => (
                  <div key={i} data-kb-slide="" className="absolute inset-0 overflow-clip [&:not(:first-child)]:invisible [&:not(:first-child)]:opacity-0">
                    <div className="size-full kb-img">{i === 0 || more ? <MediaImage locale={locale} m={m} sizes="100vw" priority={i === 0} badge={false} /> : null}</div>
                  </div>
                ))
              ) : (
                <div data-kb-slide="" className="absolute inset-0 overflow-clip [&:not(:first-child)]:invisible [&:not(:first-child)]:opacity-0">
                  <div className="size-full bg-muted kb-img" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background:linear-gradient(to_top,color-mix(in_oklch,var(--foreground)_92%,transparent)_0%,color-mix(in_oklch,var(--foreground)_80%,transparent)_55%,color-mix(in_oklch,var(--foreground)_35%,transparent)_80%,transparent_100%)] lg:[background:linear-gradient(to_top_right,color-mix(in_oklch,var(--foreground)_92%,transparent)_0%,color-mix(in_oklch,var(--foreground)_70%,transparent)_45%,transparent_78%)]" />
        {/* 미리보기 전용 표지 — 켄 번스로 확대·이동하는 사진 층 밖(히어로 상자 기준)에 한 번만. 공개본에는 값이 없어 그려지지 않는다. */}
        <MediaPreviewBadge m={list.find((m) => m.previewLabel)} />
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="relative isolate flex flex-col items-start gap-5 before:pointer-events-none before:absolute before:-inset-x-6 before:-top-12 before:-bottom-4 before:-z-10 before:bg-[color-mix(in_oklch,var(--foreground)_86%,transparent)] before:[mask-image:linear-gradient(to_top,var(--foreground)_0%,var(--foreground)_calc(100%-3rem),transparent_100%)] lg:col-span-7">
            {Display ? (
              <Display as="h1" className="text-background kb-title">
                <SplitSource label={copy.title}>{copy.title}</SplitSource>
              </Display>
            ) : (
              <h1 className="max-w-[14ch] text-[clamp(2.5rem,7.5vw,7rem)] leading-[0.95] tracking-[-0.025em] text-balance text-background kb-title font-heading">
                <SplitSource label={copy.title}>{copy.title}</SplitSource>
              </h1>
            )}
            <LowerThird items={copy.captions} label={copy.captionsLabel} keep />
          </div>
          <div data-enter="keep" className="flex flex-col gap-5 rounded-lg bg-background p-6 text-foreground shadow-(--wf-shadow-surface) lg:col-span-4 lg:col-start-9 kb-card">
            <div aria-hidden="true" className="flex gap-1.5">
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className="h-1 flex-1 bg-border first:bg-primary" />
              ))}
            </div>
            <p className="leading-[1.6]">{copy.lede}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
                {copy.primaryCta.label}
              </Button>
              {copy.secondaryCta ? (
                <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />}>
                  {copy.secondaryCta.label}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {list.length > 1 ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="absolute end-4 top-4 md:end-8 md:top-8" /> : null}
      </section>
    </div>
  )
}
