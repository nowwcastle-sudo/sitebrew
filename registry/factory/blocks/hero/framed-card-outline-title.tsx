"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Heart } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { parallax, rise, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, RING, SplitChars, useHeroScene, type HeroCommon } from "../_shared/hero-parts"
import { Media } from "../_shared/hero-media"

// 히어로 — 여백 액자 속 둥근 카드 + 외곽선·채움 교대 대문자 + 도는 배지(P3-1 r9 A 구성 승격). 뿌리에 여백 액자(padding)를 두고, 그 안 둥근 카드
// (면 faces[0], 없으면 muted — 머리를 header 로 넘기면 머리가 카드 위 5rem 에 겹쳐 앉도록 카드가 위로 5rem 올라간다) 위쪽 58%에 타일 줄눈, 왼쪽 7칸에
// 별점 줄 → 제목 h1(외곽선 줄 · 채움 줄 교대) → 설명 → 둥근 버튼 + 밑줄 링크, 오른쪽 5칸 둥근 그림(media, 선택), 오른쪽 아래 도는 글자 배지.
// 모션(기본 기법 split-text·tilt-3d·clip-reveal — M2 세 겹):
//   등장  카드가 안쪽에서 열리고 타일이 내려앉는다 → 별이 튀고 → 제목 글자가 칸 안에서 올라온다 → 그림 접시가 떠오른다 → 설명 → 배지가 돌며 앉는다 → 버튼.
//   스크롤 그림 접시가 떠오르고 배지가 더 돈다. 포인터 그림 접시가 포인터를 따라 기운다(±6°). 유휴(M2) 배지가 천천히 돈다.
export type HeroFramedCardOutlineTitleCopy = {
  label: string
  rating: string
  // 줄마다 외곽선(outline) 또는 채움. 읽기 도구는 줄을 이어 한 문장으로 읽는다.
  titleLines: { text: string; outline?: boolean }[]
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  // 도는 글자 배지: 둘레 글자와 이름.
  badge: { text: string; label: string }
}
export type HeroFramedCardOutlineTitleProps = BlockBase<HeroFramedCardOutlineTitleCopy> & HeroCommon & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["split-text", "tilt-3d", "clip-reveal"]

export function HeroFramedCardOutlineTitle({ copy, locale, id = "hero", className, media, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroFramedCardOutlineTitleProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const split = techniques.includes("split-text")
  const ringId = `${id}-badge-ring`
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<Element>(sel)
    // ── 등장(M2: 약 1.9초) ──
    if (techniques.includes("clip-reveal")) s.tl.fromTo(q(".fco-card"), { clipPath: "inset(5% 5% 5% 5% round 22px)" }, { clipPath: "inset(0% 0% 0% 0% round 22px)", duration: s.t.enter * 1.4, ease: s.t.ease.standard, clearProps: "clipPath" }, 0)
    s.tl.from(q(".fco-tiles"), { y: -23, autoAlpha: 0, duration: s.t.enter * 2, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.1)
    s.tl.from(s.q(".fco-star"), { scale: 0.6, autoAlpha: 0, transformOrigin: "50% 60%", duration: s.t.enter, ease: "back.out(2.2)", stagger: 0.05, clearProps: "transform,opacity,visibility" }, 0.25)
    rise(s, ".fco-rating-text", { at: 0.35, y: 8 })
    if (split) s.tl.from(s.q(".fco-title .hero-ch"), { yPercent: 105, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.024, clearProps: "transform" }, 0.3)
    s.tl.from(q(".fco-media-e"), { y: 80 * s.scale.distance, scale: 0.92, transformOrigin: "50% 100%", duration: s.t.enter * 1.8, ease: s.t.ease.standard, clearProps: "transform" }, 0.35)
    if (q(".fco-lede")) rise(s, ".fco-lede", { at: 0.85, y: 12 })
    s.tl.from(q(".fco-badge-e"), { rotation: -120, scale: 0.8, autoAlpha: 0, transformOrigin: "50% 50%", duration: s.t.enter * 2, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 1.0)
    rise(s, s.q(".fco-ctas > *"), { at: 1.15, y: 12, stagger: 0.08 })

    // ── 스크롤: 그림 접시가 떠오르고, 배지가 더 돈다 ──
    parallax(s, [{ el: q(".fco-media-s"), y: -24 }, { el: q(".fco-badge-s"), rotate: 120 }])

    // ── 포인터: 그림 접시가 포인터를 따라 기운다(±6° · perspective 800) ──
    if (techniques.includes("tilt-3d")) tilt3d(s, q(".fco-still"), q(".fco-tilt"), { max: 6, perspective: 800, damping: 0.5 })

    // ── 유휴(M2): 배지 회전 ──
    s.loop(() => gsap.to(q(".fco-spin"), { rotation: 360, transformOrigin: "50% 50%", duration: 18, ease: "none", repeat: -1, delay: 1.6 }))
  })
  return (
    <div ref={ref} id={id} data-block="hero-framed-card-outline-title" data-hero="framed-card-outline-title" className={cn("cn-block-hero-root cn-block-hero-framed-card-outline-title", className)}>
      <HeroTexture texture={texture} />
      {header}
      <Face k={k} fallback="bg-muted" as="section" label={copy.label} enter={techniques.includes("clip-reveal") ? "keep" : undefined} className="cn-block-hero-framed-card-outline-title-fco-card fco-card">
        <span aria-hidden="true" data-enter="" className="cn-block-hero-framed-card-outline-title-fco-tiles fco-tiles" />
        <div className="cn-block-hero-framed-card-outline-title-box">
          <p data-enter="keep" className="cn-block-hero-framed-card-outline-title-text">
            <span aria-hidden="true" className="cn-block-hero-framed-card-outline-title-span">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="cn-block-hero-framed-card-outline-title-fco-star fco-star">
                  ★
                </span>
              ))}
            </span>
            <span className="fco-rating-text">{copy.rating}</span>
          </p>
          <h1 data-enter={split ? "keep" : undefined} className="cn-block-hero-framed-card-outline-title-fco-title fco-title font-heading">
            {copy.titleLines.map((l, i) =>
              l.outline ? (
                <span key={i} className="cn-block-hero-framed-card-outline-title-fco-outline fco-outline">
                  <SplitChars text={l.text} on={split} />
                </span>
              ) : (
                <span key={i} className="cn-block-hero-framed-card-outline-title-span-2">
                  <SplitChars text={l.text} on={split} />
                </span>
              ),
            )}
          </h1>
          {copy.lede ? (
            <p data-enter="keep" className="cn-block-hero-framed-card-outline-title-fco-lede fco-lede">
              {copy.lede}
            </p>
          ) : null}
          <div data-enter="keep" className="cn-block-hero-framed-card-outline-title-fco-ctas fco-ctas">
            <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-framed-card-outline-title-fco-cta fco-cta">
              {copy.primaryCta.label}
              <ArrowRight aria-hidden="true" className="fco-arrow" />
            </Button>
            {copy.secondaryCta ? (
              <a href={copy.secondaryCta.href} className={cn("cn-block-hero-framed-card-outline-title-link-3", RING)}>
                {copy.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>

        {/* 그림 겹: .fco-still(포인터 면) → .fco-tilt(기울임) → .fco-media-s(스크롤) → .fco-media-e(등장) → 둥근 그림(정사각 칸 — 자리를 미리 잡는다). */}
        <div data-wf-art="" aria-hidden="true" data-enter="keep" className="cn-block-hero-framed-card-outline-title-fco-still fco-still">
          <div className="cn-block-hero-framed-card-outline-title-fco-tilt fco-tilt">
            <div className="cn-block-hero-framed-card-outline-title-fco-media-s fco-media-s">
              <div className="cn-block-hero-framed-card-outline-title-fco-media-e fco-media-e">{media ? <Media locale={locale} m={media} sizes="(min-width: 1024px) min(32rem, 36vw), 1px" priority /> : null}</div>
            </div>
          </div>
        </div>

        <div data-enter="" className="cn-block-hero-framed-card-outline-title-box-2">
          <div className="cn-block-hero-framed-card-outline-title-fco-badge-s fco-badge-s">
            <div className="cn-block-hero-framed-card-outline-title-fco-badge-e fco-badge-e">
              <svg viewBox="0 0 112 112" role="img" aria-label={copy.badge.label} className="cn-block-hero-framed-card-outline-title-fco-spin fco-spin">
                <defs>
                  <path id={ringId} d="M56 56 m-42 0 a42 42 0 1 1 84 0 a42 42 0 1 1 -84 0" />
                </defs>
                <text fill="var(--foreground)" fontSize="14" fontWeight="700" letterSpacing="2">
                  <textPath href={`#${ringId}`}>{copy.badge.text}</textPath>
                </text>
              </svg>
              <Heart aria-hidden="true" className="cn-block-hero-framed-card-outline-title-heart" />
            </div>
          </div>
        </div>
      </Face>
    </div>
  )
}
