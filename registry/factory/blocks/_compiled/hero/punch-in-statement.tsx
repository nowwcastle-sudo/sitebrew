"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, kineticType, punchIn, scrubTimeline, staggerIn, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge, MediaVideo } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"

// 히어로 — 펀치 인 한 문장(P3-5 MOTKIT). 바탕색 위 아주 큰 한 문장 제목, 마지막 낱말은 주색 면 위에 얹혀 강조된다(키워드 블록).
// 오른쪽(좁은 화면은 아래) 틀 하나에 실사 사진·영상·제품 화면(media — 선택, 없으면 muted 틀)이 확대 컷으로 들어오고, 제목 아래 한 문단 + 버튼 둘.
// 모션(MOTKIT — 동작 줄이기·M0 정지, 화면 밖 멈춤):
//   등장  제목 낱말이 칸 안에서 올라온다(키네틱) → 키워드 면이 1.2배에서 착지하며 튄다(펀치 인 — 오버슈트) → 틀이 가운데에서 열리며 그림이 1.6배 확대 컷에서
//         제자리로(펀치 인) → 문단·버튼이 한 줄기로(스태거). 서버 렌더 첫 화면은 끝 상태(keep).
//   강조  등장 끝 + 1.6초에 키워드가 「쿵」(1 → 1.06 → 1), 0.5초 뒤 틀도 한 번 — 마우스면 올릴 때 다시. 틀은 포인터를 따라 기운다(3D 기울임, 마우스만).
//   스크롤 틀이 가라앉으며 작아지고 제목이 떠오른다.
export type HeroPunchInStatementCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  pauseLabel: string
}
export type HeroPunchInStatementProps = BlockBase<HeroPunchInStatementCopy> & HeroCommon & HeroDisplay & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["punch-in", "kinetic-type", "tilt-3d"]

const splitLast = (t: string) => {
  const i = t.trimEnd().lastIndexOf(" ")
  return i < 0 ? ["", t] : [t.slice(0, i + 1), t.slice(i + 1)]
}

export function HeroPunchInStatement({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroPunchInStatementProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { paused, toggle, rootProps } = useLoopPause()
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".pi-title"), { mode: "rise", by: "words", at: 0 })
    punchIn(s, q(".pi-kw-box"), { kind: "text", at: 0.45 })
    clipReveal(s, q(".pi-frame"), { from: "center-x", at: 0.3, duration: s.t.enter * 1.2 })
    punchIn(s, q(".pi-frame-k"), { kind: "media", at: 0.3 })
    staggerIn(s, s.q(".pi-copy > *"), { at: 0.7, firstScreen: true, y: 16 })
    // ── 강조 ──
    punchIn(s, ".pi-kw-box", { mode: "accent" })
    punchIn(s, ".pi-frame-k", { mode: "accent", kind: "media", delay: 2.1 })
    if (techniques.includes("tilt-3d")) tilt3d(s, q(".pi-frame-wrap"), q(".pi-frame"), { max: 5, afterEnter: true })
    // ── 스크롤 ──
    const tl = scrubTimeline(s)
    tl.to(q(".pi-frame-s"), { yPercent: 8 * s.scale.depth, scale: 0.94 }, 0)
    tl.to(q(".pi-title"), { yPercent: -10 * s.scale.distance }, 0)
  })
  const [head, last] = splitLast(copy.title)
  const titleBody = (
    <SplitSource label={copy.title}>
      {head}
      <span className="inline-block bg-primary px-[0.12em] text-primary-foreground pi-kw-box">
        <span className="pi-kw">{last}</span>
      </span>
    </SplitSource>
  )
  return (
    <div ref={ref} id={id} data-block="hero-punch-in-statement" data-hero="punch-in-statement" {...rootProps} className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="grid content-center gap-10 px-5 py-12 md:px-10 lg:grid-cols-12 lg:items-center lg:gap-8 hero-first">
        <div className="flex flex-col gap-8 lg:col-span-7">
          {Display ? (
            <Display as="h1" className="text-balance pi-title">
              {titleBody}
            </Display>
          ) : (
            <h1 className="text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.98] tracking-[-0.03em] text-balance pi-title font-heading">{titleBody}</h1>
          )}
          <div data-enter="keep" className="flex max-w-[36rem] flex-col gap-6 pi-copy">
            <p className="text-lg leading-[1.6]">{copy.lede}</p>
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
        <div className="relative [perspective:1000px] lg:col-span-5 pi-frame-wrap">
          <div className="size-full pi-frame-s">
            {/* 틀(장식 그림 — 영상·사진). 서버 렌더 첫 화면에서는 여는·펀치 등장을 끝 상태로 둔다(keep). */}
            <div aria-hidden={media ? undefined : "true"} data-enter="keep" className="relative aspect-[16/10] overflow-clip rounded-xl bg-muted shadow-(--wf-shadow-surface) lg:aspect-[4/5] pi-frame">
              <div className="size-full pi-frame-k">
                {media?.kind === "video" ? (
                  <MediaVideo locale={locale} m={media} sizes="(min-width: 1024px) 40vw, 100vw" priority paused={paused} badge={false} />
                ) : media ? (
                  <MediaImage locale={locale} m={media} sizes="(min-width: 1024px) 40vw, 100vw" priority badge={false} />
                ) : (
                  <span className="block size-full bg-muted" />
                )}
              </div>
            </div>
          </div>
          {/* 미리보기 전용 표지 — 펀치 인으로 확대되는 틀 층 밖(틀 자리 기준)에 둔다. 공개본에는 값이 없어 그려지지 않는다. */}
          <MediaPreviewBadge m={media} />
          {media?.kind === "video" ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="absolute end-3 top-3" /> : null}
        </div>
      </section>
    </div>
  )
}
