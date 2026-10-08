"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, VideoSlot, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, magneticCta, parallax, pointerDepth, rise, variableAxis } from "@/registry/factory/motion/gsap-techniques"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { Media } from "../_shared/hero-media"

// 히어로 — 불투명 머리 띠 아래 전폭 영상 + 좌상단 한 줄(P3-1 r5 A 구성 승격). 첫 화면을 면(faces[0], 없으면 muted)이 채우고, 넓은 화면에서는
// 칸의 오른쪽 70%·좁은 화면에서는 아래 38%를 영상(media, 선택)이 채운다. 영상 왼쪽 끝은 면에서 번지는 가림막(면 토큰)이 받친다.
// 좌상단 한 줄 제목(h1) → 12칸 격자의 3번째 칸에서 시작하는 짧은 문단들 + 직사각형 버튼 둘(채움·외곽선, 폭 216px).
// 모션(기본 기법 tilt-3d·clip-reveal·variable-axis — M3 세 겹):
//   등장  칸이 아래에서 열리고 영상 층이 크게 시작해 가라앉는다 → 한 줄 제목이 칸 안에서 올라오며 굵기 축이 600 → 400 으로 굳는다 →
//         문단이 차례로 → 버튼 둘이 마지막.
//   스크롤 영상 층이 칸보다 느리게 떠오른다. 포인터 영상 층이 포인터 쪽으로(깊이), 주 버튼이 끌린다(자석 — M3).
export type HeroBandedFullBleedCopy = {
  label: string
  title: string
  paragraphs: string[]
  primaryCta: Cta
  secondaryCta?: Cta
}
export type HeroBandedFullBleedProps = BlockBase<HeroBandedFullBleedCopy> & HeroCommon & HeroDisplay & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["tilt-3d", "clip-reveal", "variable-axis"]

export function HeroBandedFullBleed({ copy, locale, id = "hero", className, media, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroBandedFullBleedProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M3: 약 2.5초) ──
    if (techniques.includes("clip-reveal")) clipReveal(s, ".art", { from: "bottom", at: 0, duration: s.t.enter * 1.7, ease: s.t.ease.standard })
    // 영상 층: 열리는 칸 안에서 크게 시작해 아래 기준으로 가라앉는다.
    s.tl.from(q(".band-rise"), { scale: 1.12, yPercent: 4 * s.scale.distance, transformOrigin: "60% 100%", duration: s.t.enter * 2.4, ease: s.t.ease.emphasized }, 0.1)
    s.tl.from(q(".title-in"), { yPercent: 105, duration: s.t.enter * 1.6, ease: s.t.ease.emphasized, clearProps: "transform" }, 0.35)
    if (techniques.includes("variable-axis")) variableAxis(s, q(".title"), { axis: "wght", from: 600, to: 400, at: 0.35, duration: s.t.enter * 1.9 })
    rise(s, s.q(".copy > p"), { at: 0.75, y: 18, stagger: 0.1 })
    // 버튼 자신이 떠오른다 — 자석은 감싼 요소(.magnet)가 맡아 transform 이 겹치지 않는다.
    rise(s, s.q(".ctas [data-slot='button']"), { at: 1.25, y: 16, stagger: 0.1 })

    // ── 스크롤: 영상 층이 칸보다 느리게 떠오른다 ──
    parallax(s, [{ el: q(".band-s"), y: -24 }])

    // ── 포인터: 영상 층이 포인터 쪽으로(깊이) + 자석 CTA ──
    if (techniques.includes("tilt-3d")) pointerDepth(s, q(".first"), [{ el: q(".band-p"), x: 12, y: 6 }], { damping: 0.8 })
    magneticCta(s, q(".magnet"), { strength: 0.25, radius: 90, maxPx: 8 })
  })
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <span className="hero-mask">
        <span className="inline-block title-in">{copy.title}</span>
      </span>
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-banded-full-bleed" data-hero="banded-full-bleed" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:5.75rem] [&_.band-rise_[data-wf-media]]:[transform:scale(1.06)] [&_.band-scrim]:[background:linear-gradient(to_bottom,var(--band-scrim-color,var(--muted))_0_62%,transparent_72%)] [&_[data-face]]:[--band-scrim-color:var(--field-1)] lg:[&_.band-scrim]:[background:linear-gradient(90deg,var(--band-scrim-color,var(--muted))_0_40%,transparent_60%)] [&_.title]:[font-variation-settings:'wght'_400] [&_.title]:[transition:font-variation-settings_var(--duration-hover)_var(--ease-standard)] [&_.title:hover]:[font-variation-settings:'wght'_500]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <Face k={k} fallback="bg-muted" as="section" label={copy.label} className="relative isolate overflow-hidden first hero-first">
        <div aria-hidden="true" data-enter="keep" className="absolute inset-0 art">
          {/* 좁은 화면: 아래 38% 띠(글 칸 아래). 넓은 화면: 칸의 오른쪽 70%. 스크롤 시차로 떠올라도 아래 끝이 비지 않게 2rem 더 내려 깐다(칸이 자른다). */}
          <div className="absolute inset-x-0 -bottom-8 h-[calc(38%+2rem)] lg:start-[30%] lg:top-0 lg:h-auto band-s">
            <div className="size-full band-p">
              <div className="size-full band-rise">{media ? <Media locale={locale} m={media} sizes="(min-width: 1024px) 70vw, 100vw" priority /> : null}</div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 band-scrim" />
        </div>
        {/* 제목은 왼쪽 끝 한 줄, 문단 칸은 12칸 격자의 3번째 칸에서 시작(3칸 폭). */}
        <div className="relative z-10 grid content-start gap-6 p-5 lg:grid-cols-12">
          {Display ? (
            <Display as="h1" data-enter="keep" className="lg:col-span-12 title">
              {titleBody}
            </Display>
          ) : (
            <h1 data-enter="keep" className="text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.05] tracking-[-0.01em] lg:col-span-12 title font-heading">
              {titleBody}
            </h1>
          )}
          <div data-enter="keep" className="flex max-w-[22rem] flex-col gap-4 lg:col-span-3 lg:col-start-3 lg:max-w-none copy">
            {copy.paragraphs.map((p, i) => (
              <p key={i} className="leading-[1.7]">
                {p}
              </p>
            ))}
            <div className="flex flex-col gap-3 pt-2 ctas">
              <span className="inline-flex self-start magnet">
                <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="w-[216px] rounded-none">
                  {copy.primaryCta.label}
                </Button>
              </span>
              {copy.secondaryCta ? (
                <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />} className="w-[216px] rounded-none">
                  {copy.secondaryCta.label}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Face>
    </div>
  )
}
