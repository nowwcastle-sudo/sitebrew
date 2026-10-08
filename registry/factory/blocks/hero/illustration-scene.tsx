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
    <div ref={ref} id={id} data-block="hero-illustration-scene" data-hero="illustration-scene" className={cn("cn-block-hero-root cn-block-hero-illustration-scene", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-illustration-scene-first hero-first">
        {Display ? (
          <Display as="h1" className="cn-block-hero-illustration-scene-display is-title">
            {titleBody}
          </Display>
        ) : (
          <h1 className="cn-block-hero-illustration-scene-title is-title font-heading">{titleBody}</h1>
        )}
        <div className="cn-block-hero-illustration-scene-stage">
          {/* 그림(생성 허용 칸): 첫 칠·LCP. 서버 렌더 첫 화면에서는 흐림→선명 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden={media ? undefined : "true"} data-enter="keep" className="cn-block-hero-illustration-scene-art is-art">
            <div className="cn-block-hero-illustration-scene-art-k is-art-k">{media ? <MediaImage locale={locale} m={media} sizes="100vw" priority badge={false} /> : <span className="cn-block-hero-illustration-scene-fallback" />}</div>
          </div>
          <MediaPreviewBadge m={media} />
          <div data-enter="keep" className="cn-block-hero-illustration-scene-card is-card">
            <p className="cn-block-hero-illustration-scene-lede">{copy.lede}</p>
            <div className="cn-block-hero-illustration-scene-ctas">
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
