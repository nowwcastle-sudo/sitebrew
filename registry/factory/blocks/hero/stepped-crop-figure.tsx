"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, parallax, pointerDepth, rise, splitReveal, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { HeroTexture, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 계단식으로 물린 오른쪽 그림(P3-1 r4 A 구성 승격). 넓은 화면: 칸 전체를 덮는 평면 풍경(직접 그린 SVG — 해·언덕 셋·등고선)을
// 계단 모양으로 잘라 오른쪽 칸에 물리고, 왼쪽 칸에 머리말 → 제목(h1) → 근거 형광 구절이 섞인 설명 → 버튼 → 함께하는 곳 목록. 좁은 화면은 글 아래 그림.
// 모션(기본 기법 clip-reveal·svg-draw — 세 겹):
//   등장  머리말이 열리고 제목 줄이 올라온다 → 계단 그림이 오른쪽에서 쓸려 열리며 해·언덕이 떠오른다 → 등고선을 긋는다 →
//         설명 속 근거 구절이 줄마다 형광으로 칠해진다 → 함께하는 곳·버튼.
//   스크롤 해는 뜨고 언덕은 깊이만큼 가라앉는다. 포인터 풍경 층이 깊이만큼 포인터 쪽으로.
export type HeroSteppedCropFigureCopy = {
  label: string
  kicker?: string
  title: string
  titleLines?: string[]
  // 설명 — mark 인 조각은 근거 형광(면 색 바탕)으로 칠한다.
  lede: { text: string; mark?: boolean }[]
  primaryCta: Cta
  backersLabel: string
  backers: string[]
}
export type HeroSteppedCropFigureProps = BlockBase<HeroSteppedCropFigureCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["clip-reveal", "svg-draw"]

// 풍경 한 층 = 세 겹 g: 바깥(-p) 포인터 깊이 · 가운데(-s) 스크롤 시차 · 안 등장. 한 요소의 transform 을 한 쪽만 쓴다.
function Layer({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <g className={`${name}-p`}>
      <g className={`${name}-s`}>
        <g className={name}>{children}</g>
      </g>
    </g>
  )
}

function Landscape() {
  return (
    <svg viewBox="0 0 800 700" preserveAspectRatio="xMidYMid slice" className="cn-block-hero-stepped-crop-figure-svg" aria-hidden="true">
      <rect width="800" height="700" className="cn-block-hero-stepped-crop-figure-rect" />
      <Layer name="ls-sun">
        <circle cx="590" cy="190" r="70" className="cn-block-hero-stepped-crop-figure-circle" />
      </Layer>
      <Layer name="ls-hill-1">
        <path d="M-80 360 L0 360 C 120 300, 220 310, 330 350 C 450 280, 600 260, 800 320 L880 320 V760 H-80 Z" className="cn-block-hero-stepped-crop-figure-path" opacity="0.6" />
      </Layer>
      <Layer name="ls-hill-2">
        <path d="M-80 450 L0 450 C 160 390, 300 410, 420 450 C 560 400, 680 390, 800 420 L880 420 V760 H-80 Z" className="cn-block-hero-stepped-crop-figure-path-2" opacity="0.75" />
      </Layer>
      <Layer name="ls-hill-3">
        <path d="M-80 560 L0 560 C 180 520, 360 540, 520 575 C 640 550, 720 545, 800 555 L880 555 V760 H-80 Z" className="cn-block-hero-stepped-crop-figure-path-3" />
        <g fill="none" className="cn-block-hero-stepped-crop-figure-g" strokeWidth="2" opacity="0.8">
          <path className="contour" pathLength={1} d="M40 610 C 200 585, 360 600, 520 628 C 640 610, 720 606, 780 612" />
          <path className="contour" pathLength={1} d="M80 648 C 240 628, 380 640, 520 662 C 620 650, 700 646, 760 650" />
          <path className="contour" pathLength={1} d="M60 500 C 200 468, 320 478, 430 500 C 560 470, 660 464, 760 476" />
        </g>
      </Layer>
    </svg>
  )
}

export function HeroSteppedCropFigure({ copy, id = "hero", className, techniques = DEFAULT_TECHNIQUES, header, texture }: HeroSteppedCropFigureProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reveal = techniques.includes("clip-reveal")
  const draw = techniques.includes("svg-draw")
  useHeroScene(ref, techniques, (s) => {
    // ── 등장(M1: 약 1.9초) ──
    clipReveal(s, ".kicker", { from: "left", at: 0, duration: s.t.enter * 1.4, ease: s.t.ease.standard })
    splitReveal(s, "h1", { type: "lines", at: 0.05, stagger: 0.1 })
    if (reveal) clipReveal(s, s.q(".stepped"), { from: "right", at: 0.1, duration: s.t.enter * 2.4 })
    s.tl.from(s.q(".ls-sun"), { y: 70 * s.scale.distance, duration: s.t.enter * 2.6, ease: s.t.ease.standard }, 0.25)
    s.tl.from(s.q(".ls-hill-1, .ls-hill-2, .ls-hill-3"), { y: 80 * s.scale.distance, duration: s.t.enter * 2.2, ease: s.t.ease.standard, stagger: 0.09 }, 0.3)
    if (draw) svgDraw(s, s.q(".contour"), { at: 0.65, duration: s.t.enter * 3, stagger: 0.1 })
    rise(s, ".lede", { at: 0.3, y: 12 })
    if (reveal) s.tl.from(s.q(".evidence"), { backgroundSize: "0% 100%", duration: s.t.enter, ease: "power3.inOut", stagger: 0.08, clearProps: "backgroundSize" }, 0.75)
    rise(s, s.q(".backers > li"), { at: 0.9, y: 8, stagger: 0.05 })
    rise(s, ".cta", { at: 1.1, y: 12 })

    // ── 스크롤: 해는 뜨고 언덕은 깊이만큼 가라앉는다 ──
    parallax(s, [
      { el: s.q(".ls-sun-s"), y: -40 },
      { el: s.q(".ls-hill-1-s"), y: 8 },
      { el: s.q(".ls-hill-2-s"), y: 18 },
      { el: s.q(".ls-hill-3-s"), y: 30 },
    ])

    // ── 포인터: 풍경 층이 깊이만큼 ──
    const layers = (sel: string, x: number, y: number) => s.q(sel).map((el) => ({ el, x, y }))
    pointerDepth(s, s.root.querySelector(".first"), [...layers(".ls-sun-p", 6, 4), ...layers(".ls-hill-1-p", 8, 2), ...layers(".ls-hill-2-p", 14, 3), ...layers(".ls-hill-3-p", 22, 4)])
  })
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  return (
    <div ref={ref} id={id} data-block="hero-stepped-crop-figure" data-hero="stepped-crop-figure" className={cn("cn-block-hero-root cn-block-hero-stepped-crop-figure", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section data-wf-art="" aria-label={copy.label} className="cn-block-hero-stepped-crop-figure-first first hero-first">
        <div aria-hidden="true" data-enter="" className="cn-block-hero-stepped-crop-figure-stepped stepped">
          <div className="cn-block-hero-stepped-crop-figure-stepped-clip stepped-clip">
            <Landscape />
          </div>
        </div>
        <div className="cn-block-hero-stepped-crop-figure-box-3">
          {copy.kicker ? (
            <p data-enter="keep" className="cn-block-hero-stepped-crop-figure-kicker kicker">
              {copy.kicker}
            </p>
          ) : null}
          <h1 className="cn-block-hero-stepped-crop-figure-title font-heading">
            <SplitSource label={copy.title}>
              {lines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {l}
                </React.Fragment>
              ))}
            </SplitSource>
          </h1>
          <p data-enter="keep" className="cn-block-hero-stepped-crop-figure-lede lede">
            {copy.lede.map((c, i) =>
              c.mark ? (
                <mark key={i} className="cn-block-hero-stepped-crop-figure-evidence evidence">
                  {c.text}
                </mark>
              ) : (
                <React.Fragment key={i}>{c.text}</React.Fragment>
              ),
            )}
          </p>
          <span data-enter="keep" className="cn-block-hero-stepped-crop-figure-cta cta">
            <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-stepped-crop-figure-button-2">
              {copy.primaryCta.label}
              <span aria-hidden="true" className="arrow">
                →
              </span>
            </Button>
          </span>
          {copy.backers.length ? (
            <ul data-enter="keep" className="cn-block-hero-stepped-crop-figure-backers backers" aria-label={copy.backersLabel}>
              {copy.backers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div aria-hidden="true" data-enter="" className="cn-block-hero-stepped-crop-figure-stepped-2 stepped">
          <div className="cn-block-hero-stepped-crop-figure-stepped-clip-2 stepped-clip">
            <Landscape />
          </div>
        </div>
      </section>
    </div>
  )
}
