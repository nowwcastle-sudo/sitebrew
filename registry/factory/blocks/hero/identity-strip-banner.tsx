"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Calendar, Download, File, Home, MapPin, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, parallax, rise, splitReveal, svgDraw, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 폭 1200px 안쪽 둥근 배너 카드 + 자주 찾는 서비스(P3-1 r6-civic 머리 구성 승격, 공공 원형). 식별 띠·두 줄 머리는 header 칸이 맡는다.
// 배너 = 면(faces[0], 없으면 짙은 바탕) 한 장: 맨 위 전폭 줄에 고정폭 머리 한 줄 · 제목(h1, 두 줄 — D2·D3 를 받는다, 배치로 대담 · boldMode layout),
// 그 아래 왼쪽 6칸 부제 · 높이 64px 버튼, 오른쪽 6칸 직접 그린 아이소메트릭 서류 더미와 확인 도장(1024 이상). 배너 바로 아래 「자주 찾는 서비스」 여섯 칸(§21-8 — 첫 화면 안).
// 모션(기본 기법 view-transition·svg-draw — M1, 공공 원형이라 차분하고 빠르게 약 1.2초):
//   누르는 것(주 버튼·바로가기 칸)은 첫 프레임부터 보이고 눌린다: 배너는 자르지 않고 가운데서 조금 커지며 앉고, 버튼·칸은 보이는 자리에서 내려앉기만
//   한다(transform 만, data-enter="keep").
//   등장  배너 면이 가운데서 커지며 앉고 → 고정폭 머리 줄이 열리며 제목 두 줄이 칸 안에서 올라온다 → 바닥 선을 긋고 서류 세 장이 아래 장부터 위에서
//         내려와 쌓인다 → 맨 위 장의 테두리·글줄을 긋는다 → 확인 도장 원을 긋고 체크를 찍는다(도장이 살짝 눌린다) → 부제·바로가기 칸이 짧게 정착 →
//         주 버튼이 마지막.
//   스크롤 바닥 선은 멀리(느리게), 서류 더미는 가깝게, 도장은 더 가깝게 들리며 살짝 돈다. 포인터 그림이 포인터를 따라 살짝 기운다(감쇠).
type IconName = "file" | "home" | "calendar" | "user" | "map" | "download"
const ICONS = { file: File, home: Home, calendar: Calendar, user: User, map: MapPin, download: Download } as const
export type HeroIdentityStripBannerCopy = {
  label: string
  // 배너 구획 이름(스크린리더 — 「대표 안내」).
  bannerLabel: string
  eyebrow?: string
  title: string
  titleLines?: string[]
  lede?: string
  primaryCta: Cta
  // 그림 설명(figure 이름 · svg 대체 글).
  figureLabel: string
  figureAlt: string
  // 자주 찾는 서비스 — 선택(대장 C299): 찍어낸 사이트는 콘텐츠 바로가기(quickLinks)로만 채우고, 바로가기가 없으면 이 칸을 그리지 않는다(예시의 서비스 이름을 싣지 않는다).
  services?: { label: string; items: { label: string; href: string; icon: IconName }[] }
}
export type HeroIdentityStripBannerProps = BlockBase<HeroIdentityStripBannerCopy> & HeroCommon & HeroDisplay

const DEFAULT_TECHNIQUES = ["view-transition", "svg-draw"]

export function HeroIdentityStripBanner({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroIdentityStripBannerProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const draw = techniques.includes("svg-draw")
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M1: 약 1.2초) ──
    // 배너는 주 버튼을 담는다 — 자르지 않고(보이는 자리에서) 가운데서 조금 커지며 앉는다.
    s.tl.from(q(".isb-banner"), { scale: 0.97, transformOrigin: "50% 50%", duration: s.t.enter * 1.8, ease: s.t.ease.inScreen, clearProps: "transform" }, 0)
    if (q(".isb-eyebrow")) clipReveal(s, ".isb-eyebrow", { from: "left", at: 0.14, duration: s.t.enter * 1.4, ease: s.t.ease.standard })
    splitReveal(s, ".isb-title", { type: "lines", at: 0.12, stagger: 0.1 })
    if (draw) svgDraw(s, s.q(".isb-ground path"), { at: 0.2, duration: s.t.enter * 2, stagger: 0.08 })
    s.tl.from(s.q(".isb-sheets polygon"), { y: -40 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 1.4, ease: s.t.ease.standard, stagger: 0.08, clearProps: "transform,opacity,visibility" }, 0.24)
    if (draw) {
      svgDraw(s, s.q(".isb-lines path"), { at: 0.46, duration: s.t.enter * 2, stagger: 0.05, ease: s.t.ease.inScreen })
      svgDraw(s, q(".isb-ring"), { at: 0.72, duration: s.t.enter * 1.6, ease: s.t.ease.inScreen })
      svgDraw(s, q(".isb-check"), { at: 0.95, duration: s.t.enter, ease: s.t.ease.standard })
    }
    // 도장이 찍힐 때 한 번 눌린다(1.06 → 1, 체크와 같이).
    s.tl.from(q(".isb-stamp"), { scale: 1.06, svgOrigin: "420 108", duration: s.t.enter * 1.2, ease: s.t.ease.standard, clearProps: "transform" }, 0.95)
    if (q(".isb-lede")) rise(s, ".isb-lede", { at: 0.3, y: 10 })
    // 누르는 것: 투명도·visibility 없이 transform 만.
    if (copy.services) s.tl.from(s.q(".isb-tiles > li"), { y: 8 * s.scale.distance, duration: s.t.enter, stagger: 0.03 * s.scale.stagger, clearProps: "transform" }, 0.4)
    s.tl.from(q(".isb-cta"), { y: 10 * s.scale.distance, duration: s.t.enter, clearProps: "transform" }, 0.95)

    // ── 스크롤: 바닥 선은 멀리, 더미는 가깝게, 도장은 더 가깝게 ──
    parallax(s, [{ el: q(".isb-ground-s"), y: 18 }, { el: q(".isb-stack-s"), y: -8 }, { el: q(".isb-stamp-s"), y: -24, rotate: -8 }])

    // ── 포인터: 그림이 포인터를 따라 기운다 ──
    tilt3d(s, q(".isb-figure"), q(".isb-tilt"), { max: 6, perspective: 900, damping: 0.7 })
  })
  const titleBody = (
    <SplitSource label={copy.title}>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {l}
        </React.Fragment>
      ))}
    </SplitSource>
  )
  return (
    <div ref={ref} id={id} data-block="hero-identity-strip-banner" data-hero="identity-strip-banner" className={cn("cn-block-hero-root cn-block-hero-identity-strip-banner", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section id={`${id}-main`} aria-label={copy.label} className="cn-block-hero-identity-strip-banner-first">
        <Face k={k} fallback="bg-foreground text-background" as="section" label={copy.bannerLabel} enter="keep" className="cn-block-hero-identity-strip-banner-isb-banner isb-banner">
          <div className="cn-block-hero-identity-strip-banner-isb-head">
            {copy.eyebrow ? (
              <p data-enter="keep" className="cn-block-hero-identity-strip-banner-isb-eyebrow isb-eyebrow font-heading">
                {copy.eyebrow}
              </p>
            ) : null}
            {Display ? (
              <Display as="h1" className="cn-block-hero-identity-strip-banner-display isb-title">
                {titleBody}
              </Display>
            ) : (
              <h1 className="cn-block-hero-identity-strip-banner-isb-title isb-title font-heading-ko">{titleBody}</h1>
            )}
          </div>
          <div className="cn-block-hero-identity-strip-banner-box-2">
            {copy.lede ? (
              <p data-enter="keep" className="cn-block-hero-identity-strip-banner-isb-lede isb-lede">
                {copy.lede}
              </p>
            ) : null}
            <div data-enter="keep" className="isb-cta">
              <Button nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-identity-strip-banner-button">
                {copy.primaryCta.label}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <figure data-wf-art="" aria-label={copy.figureLabel} data-enter="" className="cn-block-hero-identity-strip-banner-isb-figure isb-figure">
            {/* 겹: .isb-tilt(포인터 기울임) · 그림 안 -s 무리(스크롤 시차) · 안쪽 조각(등장). 칠하는 순서는 그대로(서류 → 선 → 도장 → 바닥 선). */}
            <div className="cn-block-hero-identity-strip-banner-isb-tilt isb-tilt">
              <svg viewBox="0 0 560 400" role="img" aria-label={copy.figureAlt} className="cn-block-hero-identity-strip-banner-svg-2 isb-art">
                <g className="isb-stack-s">
                  <g className="isb-sheets">
                    <polygon points="120,250 280,170 440,250 280,330" fill="color-mix(in oklch, var(--field-1-foreground, var(--foreground)) 8%, var(--field-1, var(--background)))" />
                    <polygon points="120,222 280,142 440,222 280,302" fill="color-mix(in oklch, var(--field-1-foreground, var(--foreground)) 14%, var(--field-1, var(--background)))" />
                    <polygon points="120,194 280,114 440,194 280,274" fill="color-mix(in oklch, var(--field-1-foreground, var(--foreground)) 22%, var(--field-1, var(--background)))" />
                  </g>
                  <g className="isb-lines" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path pathLength={1} d="M120 194 L280 114 L440 194 L280 274 Z" />
                    <path pathLength={1} d="M188 196 L300 140" />
                    <path pathLength={1} d="M212 208 L324 152" />
                    <path pathLength={1} d="M236 220 L316 180" />
                    <path pathLength={1} d="M120 194 V250 L280 330 L440 250 V194" />
                  </g>
                </g>
                <g className="isb-stamp-s">
                  <g className="isb-stamp" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path className="isb-ring" pathLength={1} d="M420 64 a44 44 0 1 0 0.01 0" />
                    <path className="isb-check" pathLength={1} d="M398 108 L414 124 L444 92" strokeWidth="4" />
                  </g>
                </g>
                <g className="isb-ground-s">
                  <g className="isb-ground" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1">
                    <path pathLength={1} d="M40 340 L280 220 L520 340" fill="none" />
                    <path pathLength={1} d="M40 370 L280 250 L520 370" fill="none" />
                  </g>
                </g>
              </svg>
            </div>
          </figure>
        </Face>

        {copy.services ? (
        <section aria-labelledby={`${id}-fav`} className="cn-block-hero-identity-strip-banner-services">
          <h2 id={`${id}-fav`} className="cn-block-hero-identity-strip-banner-heading font-heading-ko">
            {copy.services.label}
          </h2>
          <ul data-enter="keep" className="cn-block-hero-identity-strip-banner-isb-tiles isb-tiles">
            {copy.services.items.map(({ label, href, icon }) => {
              const I = ICONS[icon]
              return (
                <li key={label}>
                  <a href={href} className={cn("cn-block-hero-identity-strip-banner-isb-tile isb-tile", RING)}>
                    <I aria-hidden="true" className="cn-block-hero-identity-strip-banner-i" />
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
        ) : null}
      </section>
    </div>
  )
}
