"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kineticType, rise, scrubTimeline, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 제품 화면 창(FV1 Task 5.7, 배치로 대담 — boldMode layout). narrow-title-wide-window 의 모양(큰 제목 + 넓은 창)에서 **가상 앱 글을 뺀** 짝이다:
// 창 안은 블록이 그린 글이 아니라 **실제 제품 화면 이미지 한 장**(media — real-required 칸)이다. 전폭 큰 제목(D2·D3 를 받는다) 아래 문단·버튼, 그 아래 넓은 창 틀(점 셋 + 빈 주소 줄)에 화면이 든다.
// 화면 이미지가 아직 없으면 창은 「실제 화면 필요」 틀로 그려진다(emptyLabel — 앱 화면을 지어내지 않는다). 이 칸이 비면 05 가 「실제 사진 필요」 자리를 남기고 06 이 입력 대기 사유(공개 불가)를 낸다.
// 모션: 등장 제목 낱말이 올라온다 → 창이 기울어진 채 들려 올라와 앉는다(크기·기울기만 — 글·화면은 숨기지 않는다) → 문단·버튼. 스크롤 창이 가라앉는다. 마우스에서는 창이 포인터를 따라 아주 조금 기운다.
//   동작 줄이기(prefers-reduced-motion)·M0 : 장면(useHeroScene)이 서지 않아 모두 정지 — 창은 평평하게 그대로 보인다.
export type HeroScreenshotWindowCopy = {
  label: string
  title: string
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  frameLabel: string // 창 틀의 이름(읽기 도구) — 화면 이미지가 있으면 그 이미지의 alt 가 내용을 말한다
  emptyLabel: string // 화면 이미지가 없을 때 틀 안에 보이는 안내(「실제 화면 필요」)
}
export type HeroScreenshotWindowProps = BlockBase<HeroScreenshotWindowCopy> & HeroCommon & HeroDisplay & { media?: ImageSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "tilt-3d"]

export function HeroScreenshotWindow({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroScreenshotWindowProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".sw-title"), { mode: "rise", by: "words", at: 0 })
    rise(s, s.q(".sw-intro > *"), { at: 0.35, y: 14, stagger: 0.08 })
    s.tl.from(q(".sw-frame"), { y: 90 * s.scale.distance, rotationX: 10, transformPerspective: 1600, transformOrigin: "50% 0%", duration: s.t.enter * 2.2, ease: s.t.ease.standard, clearProps: "transform" }, 0.2)
    // ── 스크롤: 창이 가라앉는다 ──
    const tl = scrubTimeline(s)
    tl.to(q(".sw-frame-s"), { yPercent: 6 * s.scale.depth }, 0)
    // ── 포인터: 창이 포인터를 따라 아주 조금 기운다(마우스만, 등장이 끝난 뒤) ──
    tilt3d(s, q(".sw-frame-wrap"), q(".sw-frame"), { max: 3, afterEnter: true })
  })
  const titleBody = <SplitSource label={copy.title}>{copy.title}</SplitSource>
  return (
    <div ref={ref} id={id} data-block="hero-screenshot-window" data-hero="screenshot-window" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="flex flex-col gap-8 px-5 py-12 md:px-10 md:py-16 hero-first">
        {Display ? (
          <Display as="h1" className="text-balance sw-title">
            {titleBody}
          </Display>
        ) : (
          <h1 className="text-[clamp(2.75rem,8vw,7.5rem)] leading-[0.95] tracking-[-0.03em] text-balance sw-title font-heading">{titleBody}</h1>
        )}
        <div data-enter="keep" className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between sw-intro">
          {copy.lede ? <p className="max-w-[36rem] text-lg leading-[1.6]">{copy.lede}</p> : null}
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
        <div className="relative [perspective:1200px] sw-frame-wrap">
          <div className="relative size-full sw-frame-s">
            {/* 창 틀: 점 셋 + 빈 주소 줄(장식, 글자 없음) 아래에 실제 제품 화면. 서버 렌더 첫 화면에서는 들어 올리는 등장을 끝 상태로 둔다(keep). */}
            <figure aria-label={copy.frameLabel} data-enter="keep" data-source={media?.source} className="m-0 overflow-clip rounded-xl border border-border bg-background shadow-(--wf-shadow-surface) sw-frame">
              <div aria-hidden="true" className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="ms-3 h-5 max-w-[24rem] flex-1 rounded-full bg-background" />
              </div>
              <div className="bg-muted [&_picture]:block">
                {media ? (
                  <MediaImage locale={locale} m={media} sizes="(min-width: 1280px) 1200px, 100vw" priority badge={false} />
                ) : (
                  <div data-state="empty" data-real-required="" className="flex aspect-[16/10] items-center justify-center border-2 border-dashed border-border p-6 text-center text-lg text-foreground">
                    <p>{copy.emptyLabel}</p>
                  </div>
                )}
              </div>
            </figure>
            <MediaPreviewBadge m={media} />
          </div>
        </div>
      </section>
    </div>
  )
}
