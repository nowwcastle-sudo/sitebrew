"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, countUp, rise, scrubTimeline, splitReveal, svgDraw, tilt3d } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"

import { DarkZone, Face, FACE_TEXT, faceAt, HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 가운데 제목 + 접힘선을 넘는 증거 패널(P3-1 r4 B 구성 승격). 짙은 구역(DarkZone) 가운데 제목(h1) · 설명 · 알약 버튼 둘, 그 아래
// 접힘선을 넘어 올라오는 카드 패널: 머리(제목 · 배지) → KPI 넷 → 추세 선 + 근거 목록(첫 줄은 면 색 칩 위).
// 모션(기본 기법 clip-reveal·svg-draw — M1 세 겹):
//   등장  제목 줄이 올라오고 설명 → 패널이 아래에서 기울어진 채 들려 올라와 앉는다 → 배지가 튀고 KPI 숫자가 센다 → 추세 선을 긋고 → 첫 근거 줄이
//         왼쪽에서 칠해지고 나머지 줄이 올라온다 → 버튼 둘이 마지막.
//   스크롤 패널이 들려 올라온다. 포인터 패널이 포인터를 따라 기운다(감쇠).
export type HeroCenteredProofPanelCopy = {
  label: string
  title: string
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  panelTitle: string
  badges: string[]
  kpis: { term: string; value: string }[]
  trendLabel: string
  // 첫 줄은 면 색 칩 위에 강조, 나머지는 보조 글자.
  proof: { lead: string; rest: string[] }
}
export type HeroCenteredProofPanelProps = BlockBase<HeroCenteredProofPanelCopy> & HeroCommon & HeroDisplay

const DEFAULT_TECHNIQUES = ["clip-reveal", "svg-draw"]

export function HeroCenteredProofPanel({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, darkScope, header, texture, display: Display }: HeroCenteredProofPanelProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M1: 약 2.0초) ──
    splitReveal(s, "h1", { type: "lines", at: 0, stagger: 0.1 })
    rise(s, ".lede", { at: 0.3, y: 12 })
    s.tl.from(q(".panel"), { y: 140 * s.scale.distance, rotationX: 14, transformPerspective: 1400, transformOrigin: "50% 0%", autoAlpha: 0, duration: s.t.enter * 3, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.3)
    s.tl.from(s.q(".panel [data-slot='badge']"), { scale: 0.85, autoAlpha: 0, duration: s.t.enter, ease: "back.out(2)", stagger: 0.06, clearProps: "transform,opacity,visibility" }, 0.7)
    countUp(s, s.q(".kpi dd"), { at: 0.65, duration: s.t.enter * 3, stagger: 0.07 })
    if (techniques.includes("svg-draw")) svgDraw(s, q(".trend polyline"), { at: 0.75, duration: s.t.enter * 3.2 })
    if (techniques.includes("clip-reveal")) clipReveal(s, ".proof-row", { from: "left", at: 1.05, duration: s.t.enter * 1.6, ease: "power3.inOut" })
    rise(s, s.q(".proof-rest"), { at: 1.15, y: 8, stagger: 0.06 })
    rise(s, s.q(".ctas > *"), { at: 1.3, y: 12, stagger: 0.08 })

    // ── 스크롤: 패널이 들려 올라온다 ──
    scrubTimeline(s).to(q(".panel-lift"), { y: -44 * s.scale.distance, scale: 1 + 0.04 * s.scale.distance, transformOrigin: "50% 0%" }, 0)

    // ── 포인터: 패널이 포인터를 따라 기운다 ──
    tilt3d(s, q(".panel-lift"), q(".panel-tilt"), { max: 6, perspective: 1400, damping: 0.7 })
  })
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <SplitSource label={copy.title}>{copy.title}</SplitSource>
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-centered-proof-panel" data-hero="centered-proof-panel" className={cn("cn-block-hero-root cn-block-hero-centered-proof-panel", className)}>
      <HeroTexture texture={texture} />
      {header}
      <DarkZone scope={darkScope} as="section" label={copy.label} className="cn-block-hero-centered-proof-panel-zone">
        {Display ? (
          <Display as="h1" className="cn-block-hero-centered-proof-panel-display">
            {titleBody}
          </Display>
        ) : (
          <h1 className="cn-block-hero-centered-proof-panel-title font-heading">
            {titleBody}
          </h1>
        )}
        {copy.lede ? (
          <p data-enter="keep" className="cn-block-hero-centered-proof-panel-lede lede">
            {copy.lede}
          </p>
        ) : null}
        <div data-enter="keep" className="cn-block-hero-centered-proof-panel-ctas ctas">
          <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-centered-proof-panel-button-2">
            {copy.primaryCta.label}
          </Button>
          {copy.secondaryCta ? (
            <Button size="lg" variant="secondary" nativeButton={false} render={<a href={copy.secondaryCta.href} />} className="cn-block-hero-centered-proof-panel-button-3">
              {copy.secondaryCta.label}
            </Button>
          ) : null}
        </div>
        <div data-wf-art="" className="cn-block-hero-centered-proof-panel-panel-lift panel-lift">
          <div className="panel-tilt">
            <div data-enter="keep" className="cn-block-hero-centered-proof-panel-panel panel">
              <div className="cn-block-hero-centered-proof-panel-box-3">
                <p className="cn-block-hero-centered-proof-panel-text-2">{copy.panelTitle}</p>
                <div className="cn-block-hero-centered-proof-panel-box-4">
                  {copy.badges.map((b) => (
                    <Badge key={b} variant="outline">
                      {b}
                    </Badge>
                  ))}
                </div>
              </div>
              <dl className="cn-block-hero-centered-proof-panel-dl">
                {copy.kpis.map((x) => (
                  <div key={x.term} className="cn-block-hero-centered-proof-panel-kpi kpi">
                    <dt className="cn-block-hero-centered-proof-panel-dt">{x.term}</dt>
                    <dd className="cn-block-hero-centered-proof-panel-dd font-heading">{x.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="cn-block-hero-centered-proof-panel-box-5">
                <svg viewBox="0 0 300 90" className="cn-block-hero-centered-proof-panel-trend trend" role="img" aria-label={copy.trendLabel}>
                  <polyline pathLength={1} fill="none" stroke="currentColor" strokeWidth="2" points="0,70 40,64 80,66 120,44 160,48 200,30 240,34 300,16" />
                </svg>
                <ul className="cn-block-hero-centered-proof-panel-list-2">
                  <li className="cn-block-hero-centered-proof-panel-proof-row proof-row">
                    <Face k={k} fallback="bg-muted" as="span" className="cn-block-hero-centered-proof-panel-face-2" />
                    <span data-face={k} className={cn("cn-block-hero-centered-proof-panel-span", k && FACE_TEXT[k])}>{copy.proof.lead}</span>
                  </li>
                  {copy.proof.rest.map((p) => (
                    <li key={p} className="cn-block-hero-centered-proof-panel-proof-rest proof-rest">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DarkZone>
    </div>
  )
}
