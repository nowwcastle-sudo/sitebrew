"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ChevronRight, Download, File, Home, Search, Settings, Share, Star } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { countUp, parallax, pointerDepth, rise, splitReveal, svgDraw, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { DarkZone, Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 수치 칩 + 세리프 세 줄 + 오른쪽 아래로 새는 앱 패널(P3-1 r7 A 구성 승격). 짙은 구역 첫 화면 = 면(faces[0], 없으면 바탕) 위에 곡선 다발 두 묶음,
// 왼쪽 위에 수치 칩(링크) → 세 줄 제목(h1) → 설명(굵은 낱말) → 버튼 둘, 오른쪽 아래로 화면 밖까지 새는 앱 패널(카드 값 — 목차 · 탭 · 네 단계 카드).
// 모션(기본 기법 view-transition·sticky-stack — M2 세 겹):
//   등장  곡선 다발을 긋는다 → 칩이 올라오고 숫자를 센다 → 제목 낱말이 올라온다 → 설명 → 패널이 기울어진 채 들려 올라와 앉는다 → 목차가 정착 →
//         카드가 한 장씩 내려앉고 다음 장이 올 때 앞 장이 0.97 로 한 번 물러났다 돌아온다(sticky-stack 결) → 버튼.
//   스크롤 패널이 들려 올라오고 두 다발이 반대로 흐른다. 포인터 패널 기울임 + 다발 깊이. 유휴(M2) 다발이 아주 느리게 떠돈다.
type IconName = "star" | "home" | "settings" | "search" | "file" | "share" | "download" | "chevron"
const ICONS = { star: Star, home: Home, settings: Settings, search: Search, file: File, share: Share, download: Download, chevron: ChevronRight } as const
export type HeroLeakingAppPanelCopy = {
  label: string
  chip: { label: string; count: string; href: string }
  title: string
  // 설명 — bold 조각은 전경색으로 굵게.
  sub: { text: string; bold?: boolean }[]
  primaryCta: Cta
  secondaryCta?: Cta
  panel: {
    label: string
    book: string
    side: { label: string; icon: IconName }[]
    activeSide?: number
    tabs: string[]
    search: string
    section: string
    heading: string
    intro: string
    cards: { title: string; text: string; icon: IconName }[]
  }
}
export type HeroLeakingAppPanelProps = BlockBase<HeroLeakingAppPanelCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["view-transition", "sticky-stack"]
// 곡선 다발: 왼쪽 아래에서 오른쪽 위로 휘는 선 n 개(한 다발은 패널 뒤, 한 다발은 제목 오른쪽 위). 선마다 끝점만 조금씩 벌린다.
const bundle = (n: number, x0: number, y0: number, x1: number, y1: number, spread: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const d = (t - 0.5) * spread
    return `M${x0} ${y0 + d * 0.4} C ${x0 + (x1 - x0) * 0.45} ${y0 - 40 + d}, ${x0 + (x1 - x0) * 0.6} ${y1 + 60 - d * 0.6}, ${x1} ${y1 + d * 0.8}`
  })
const LOW = bundle(18, -40, 900, 900, 520, 220)
const HIGH = bundle(16, 560, 520, 1480, 150, 180)
// 곡선 다발 색: 면 위에서 면 글자색을 세 단(30·55·80%)으로 섞은 선. 면 스코프 밖(골격 레시피)에서도 같은 식이 선을 그린다.
const TONES = [30, 55, 80].map((p) => `color-mix(in oklch, var(--field-1-foreground, var(--foreground)) ${p}%, var(--field-1, var(--background)))`)

// 표장: 모서리가 접힌 종이 한 장 + 글줄 둘(설명서 한 장).
function Mark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 3h10l4 4v14H5z M15 3v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// 곡선 다발 한 묶음: 겹 g(-s 스크롤 · -p 포인터 · -i 유휴)가 transform 을 나눠 쓴다. 선은 긋기(stroke-dash)만.
function Bundle({ name, paths, offset }: { name: string; paths: string[]; offset: number }) {
  return (
    <g className={`${name}-s`}>
      <g className={`${name}-p`}>
        <g className={`${name}-i`}>
          {paths.map((d, i) => (
            <path key={i} d={d} stroke={TONES[(i + offset) % 3]} strokeOpacity={0.55 + ((i + offset) % 4) * 0.12} />
          ))}
        </g>
      </g>
    </g>
  )
}

export function HeroLeakingAppPanel({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, darkScope, header, texture }: HeroLeakingAppPanelProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const p = copy.panel
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M2: 약 2.1초) ──
    svgDraw(s, s.q(".lap-curves path"), { at: 0, duration: s.t.enter * 2.6, stagger: 0.018 })
    rise(s, ".lap-chip", { at: 0.05, y: 12 })
    countUp(s, s.q(".lap-count"), { at: 0.15, duration: s.t.enter * 2.6 })
    splitReveal(s, ".lap-title", { type: "words", at: 0.12, stagger: 0.05 })
    rise(s, ".lap-sub", { at: 0.4, y: 14 })
    s.tl.from(q(".lap-panel"), { y: 160 * s.scale.distance, rotationX: 10, transformPerspective: 1600, transformOrigin: "50% 0%", autoAlpha: 0, duration: s.t.enter * 2.6, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.35)
    s.tl.from(s.q(".lap-side > *"), { x: -10 * s.scale.distance, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.03, clearProps: "transform,opacity,visibility" }, 0.75)
    // 카드: 한 장씩 내려앉고, 다음 장이 올 때 앞 장이 0.97 로 한 번 물러났다 돌아온다(크기만 — 글자 대비가 흔들리지 않게).
    const cards = s.q(".lap-card-in")
    cards.forEach((c, i) => {
      const at = 0.95 + i * 0.16
      s.tl.from(c, { y: 28 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 1.2, ease: s.t.ease.standard, clearProps: "opacity,visibility" }, at)
      if (i > 0) s.tl.to(cards[i - 1], { keyframes: [{ scale: 0.97, duration: s.t.enter * 0.4, ease: s.t.ease.standard }, { scale: 1, duration: s.t.enter * 0.8, ease: s.t.ease.standard }], transformOrigin: "50% 0%" }, at + 0.05)
    })
    if (cards.length) s.tl.set(cards, { clearProps: "transform" })
    rise(s, s.q(".lap-cta > *"), { at: 1.3, y: 12, stagger: 0.08 })

    // ── 스크롤: 패널이 들려 올라오고, 두 다발이 반대로 흐른다 ──
    parallax(s, [{ el: q(".lap-panel-s"), y: -70 }, { el: q(".lap-high-s"), x: -40, y: -10 }, { el: q(".lap-low-s"), x: 30, y: 12 }])

    // ── 포인터: 패널 기울임 + 곡선 다발 깊이 ──
    tilt3d(s, q(".lap-stage"), q(".lap-panel-t"), { max: 5, perspective: 1600, damping: 0.7 })
    pointerDepth(s, q(".lap-stage"), [{ el: q(".lap-high-p"), x: 18, y: 12 }, { el: q(".lap-low-p"), x: 10, y: 8 }], { damping: 0.9 })

    // ── 유휴(M2): 다발이 아주 느리게 떠돈다 ──
    s.loop(() => gsap.to(q(".lap-high-i"), { y: -8 * s.scale.distance, x: 6 * s.scale.distance, duration: 6.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.4 }))
    s.loop(() => gsap.to(q(".lap-low-i"), { y: 6 * s.scale.distance, x: -8 * s.scale.distance, duration: 8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.4 }))
  })
  const active = p.activeSide ?? 1
  return (
    <div ref={ref} id={id} data-block="hero-leaking-app-panel" data-hero="leaking-app-panel" className={cn("cn-block-hero-root cn-block-hero-leaking-app-panel", className)}>
      <HeroTexture texture={texture} />
      {header}
      <DarkZone scope={darkScope} as="section" label={copy.label} className="cn-block-hero-leaking-app-panel-h-first hero-first">
        {/* 첫 화면 바탕 = 면. 새는 패널은 제 카드 값으로 돌아간다(data-face-reset). */}
        <Face k={k} fallback="bg-background" className="cn-block-hero-leaking-app-panel-lap-stage lap-stage">
          <svg aria-hidden="true" data-enter="" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="cn-block-hero-leaking-app-panel-lap-curves lap-curves">
            <g fill="none" strokeWidth="1">
              <Bundle name="lap-low" paths={LOW} offset={0} />
              <Bundle name="lap-high" paths={HIGH} offset={LOW.length} />
            </g>
          </svg>
          <div className="cn-block-hero-leaking-app-panel-box-4">
            <a href={copy.chip.href} data-enter="keep" className={cn("cn-block-hero-leaking-app-panel-lap-chip lap-chip", RING)}>
              {copy.chip.label}
              <span data-numeric="" className="cn-block-hero-leaking-app-panel-lap-count lap-count">{copy.chip.count}</span>
              <ChevronRight aria-hidden="true" className="cn-block-hero-leaking-app-panel-chevron-right-2" />
            </a>
            <h1 className="cn-block-hero-leaking-app-panel-lap-title lap-title font-heading">
              <SplitSource label={copy.title}>{copy.title}</SplitSource>
            </h1>
            <p data-enter="keep" className="cn-block-hero-leaking-app-panel-lap-sub lap-sub">
              {copy.sub.map((c, i) =>
                c.bold ? (
                  <b key={i} className="cn-block-hero-leaking-app-panel-b">
                    {c.text}
                  </b>
                ) : (
                  <React.Fragment key={i}>{c.text}</React.Fragment>
                ),
              )}
            </p>
            <div data-enter="keep" className="cn-block-hero-leaking-app-panel-lap-cta lap-cta">
              <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
                {copy.primaryCta.label} <ChevronRight aria-hidden="true" />
              </Button>
              {/* 곡선 다발 위에 놓이므로 버튼 줄과 외곽선 버튼이 바탕을 칠한다(좁은 화면 글자 대비 — 선이 비치지 않게). */}
              {copy.secondaryCta ? (
                <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />} className="cn-block-hero-leaking-app-panel-button-2">
                  {copy.secondaryCta.label}
                </Button>
              ) : null}
            </div>
          </div>

          {/* 새는 패널: 겹 요소 .lap-panel-s(자리·스크롤 들기) → .lap-panel-t(포인터 기울임) → .lap-panel(등장 — 그림 역할·카드 값). */}
          <div data-wf-art="" className="cn-block-hero-leaking-app-panel-lap-panel-s lap-panel-s">
            <div className="cn-block-hero-leaking-app-panel-lap-panel-t lap-panel-t">
              <div aria-label={p.label} role="img" data-face-reset="" data-enter="keep" className="cn-block-hero-leaking-app-panel-lap-panel lap-panel">
                <div className="cn-block-hero-leaking-app-panel-lap-side lap-side">
                  <p className="cn-block-hero-leaking-app-panel-text-2">
                    <Mark className="cn-block-hero-leaking-app-panel-mark-2" />
                    {p.book}
                  </p>
                  {p.side.map((t, i) => {
                    const I = ICONS[t.icon]
                    return i === active ? (
                      <Face key={t.label} k={k} fallback="bg-muted" className="cn-block-hero-leaking-app-panel-face-2">
                        <I aria-hidden="true" className="cn-block-hero-leaking-app-panel-i" />
                        {t.label}
                      </Face>
                    ) : (
                      <p key={t.label} className="cn-block-hero-leaking-app-panel-text-3">
                        <I aria-hidden="true" className="cn-block-hero-leaking-app-panel-i" />
                        {t.label}
                      </p>
                    )
                  })}
                </div>
                <div className="cn-block-hero-leaking-app-panel-box-5">
                  <div className="cn-block-hero-leaking-app-panel-box-6">
                    {p.tabs.map((t, i) =>
                      i === 0 ? (
                        <span key={t} className="cn-block-hero-leaking-app-panel-span-2">
                          {t}
                        </span>
                      ) : (
                        <span key={t} className="cn-block-hero-leaking-app-panel-span-3">
                          {t}
                        </span>
                      ),
                    )}
                    <span className="cn-block-hero-leaking-app-panel-span-5">
                      <Search aria-hidden="true" className="cn-block-hero-leaking-app-panel-search" /> {p.search}
                    </span>
                  </div>
                  <p className="cn-block-hero-leaking-app-panel-text-4">{p.section}</p>
                  <p className="cn-block-hero-leaking-app-panel-text-5 font-heading">{p.heading}</p>
                  <p className="cn-block-hero-leaking-app-panel-text-6">{p.intro}</p>
                  <ul className="cn-block-hero-leaking-app-panel-list-2">
                    {p.cards.map((c) => {
                      const I = ICONS[c.icon]
                      return (
                        <li key={c.title} className="lap-card">
                          <div className="cn-block-hero-leaking-app-panel-lap-card-in lap-card-in">
                            <span className="cn-block-hero-leaking-app-panel-span-6">
                              <I aria-hidden="true" className="cn-block-hero-leaking-app-panel-i-3" />
                            </span>
                            <span className="cn-block-hero-leaking-app-panel-span-7">{c.title}</span>
                            <span className="cn-block-hero-leaking-app-panel-span-8">{c.text}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Face>
      </DarkZone>
    </div>
  )
}
