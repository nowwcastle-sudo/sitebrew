"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { blurToSharp, kineticType, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 일러스트 장면(FV1 Task 5.7, 배치로 대담 — boldMode layout). 전폭 큰 제목(D2·D3 를 받는다) 아래에 **전폭 그림 한 장**이 첫 화면을 채우고,
// 문단·버튼은 그림 오른쪽 아래에 얹은 바탕색 카드에 든다(그림 위 글이 아니라 카드 위 글 — 어떤 그림에서도 대비가 같다). 그림 칸은 생성 그림 허용(generated-ok)이라
// 05-media 가 만든 그림(Higgsfield 등)이나 운영자가 준 그림이 들어온다. 그림이 없으면 muted 틀(이미지 준비 중 — 공개 불가 사유는 06 이 남긴다).
// 모션: 등장 제목 낱말이 올라온다 → 그림이 흐림에서 선명으로(흐림은 휩 팬의 1/3, 불투명도 그대로 — 첫 칠부터 보인다) → 카드. 스크롤 그림이 살짝 커진다.
//   동작 줄이기(prefers-reduced-motion)·M0 : 장면(useHeroScene)이 서지 않아 모두 정지 — 그림도 글도 그대로 보인다.
export type HeroIllustrationSceneCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
}
export type HeroIllustrationSceneProps = BlockBase<HeroIllustrationSceneCopy> & HeroCommon & HeroDisplay & { media?: ImageSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "blur-to-sharp"]

export function HeroIllustrationScene({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroIllustrationSceneProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".is-title"), { mode: "rise", by: "words", at: 0 })
    const art = q(".is-art img")
    if (art) blurToSharp(s, art, { at: 0.2 })
    rise(s, q(".is-card"), { at: 0.6, y: 18 })
    // ── 스크롤: 그림이 살짝 커진다 ──
    const tl = scrubTimeline(s)
    tl.to(q(".is-art-k"), { scale: 1 + 0.06 * s.scale.depth }, 0)
  })
  const titleBody = <SplitSource label={copy.title}>{copy.title}</SplitSource>
  return (
    <div ref={ref} id={id} data-block="hero-illustration-scene" data-hero="illustration-scene" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="flex flex-col gap-6 px-5 pt-10 pb-8 md:px-10 md:pt-14 md:pb-10 hero-first">
        {Display ? (
          <Display as="h1" className="text-balance is-title">
            {titleBody}
          </Display>
        ) : (
          <h1 className="text-[clamp(3rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.03em] text-balance is-title font-heading">{titleBody}</h1>
        )}
        <div className="relative flex flex-col md:block">
          {/* 그림(생성 허용 칸): 첫 칠·LCP. 서버 렌더 첫 화면에서는 흐림→선명 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden={media ? undefined : "true"} data-enter="keep" className="relative aspect-[4/5] overflow-clip rounded-xl bg-muted shadow-(--wf-shadow-surface) md:aspect-[21/9] is-art">
            <div className="size-full [&_picture]:block [&_picture]:size-full is-art-k">{media ? <MediaImage locale={locale} m={media} sizes="100vw" priority badge={false} /> : <span className="block size-full bg-muted" />}</div>
          </div>
          <MediaPreviewBadge m={media} />
          <div data-enter="keep" className="order-first mb-4 flex flex-col gap-5 rounded-lg bg-background p-6 text-foreground shadow-(--wf-shadow-surface) md:order-none md:absolute md:end-6 md:bottom-6 md:mb-0 md:max-w-[26rem] is-card">
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
      </section>
    </div>
  )
}
