"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { parallax, pointerDepth, rise, tilt3d } from "@/registry/factory/motion/gsap-techniques"

import { HeroTexture, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 층층 평면 풍경 + 가운데 기운 낱자 로고타입(P3-1 r9 B 구성 승격). 첫 화면을 직접 그린 평면 풍경(하늘·먼 산·언덕·숲·연못·먹 땅 여섯 층 +
// 구름 · 깃발, 칸 색 block-1~4)이 채우고, 가운데 위에 낱자마다 조금씩 기운 로고타입(h1, 줄마다 작게/크게) 양옆 잎 · 아래 알약 태그라인.
// 모션(기본 기법 split-text·tilt-3d·clip-reveal — M2 세 겹):
//   등장  풍경 층이 먼 층부터 아래에서 올라와 앉고 구름이 흘러든다 → 낱자가 튀어 오르며 선다 → 깃발이 서고 잎이 돌아 앉는다 → 태그라인.
//         (머리를 header 로 넘기면 머리의 .llc-cta 도 같은 장면으로 내려앉는다.)
//   스크롤 먼 층일수록 느리게, 구름은 옆으로. 포인터 로고가 기울고(±6°) 가까운 층일수록 포인터 쪽으로 더. 유휴(M2) 구름 흐름 · 잎 살랑.
export type HeroLayeredLandscapeLogotypeCopy = {
  label: string
  // 읽기 도구용 제목(보이는 것은 낱자 로고타입).
  title: string
  logoLines: { text: string; size: "sm" | "lg" }[]
  tagline?: string
}
export type HeroLayeredLandscapeLogotypeProps = BlockBase<HeroLayeredLandscapeLogotypeCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["split-text", "tilt-3d", "clip-reveal"]
const tree = (x: number, base: number, h: number, w: number) => `M${x} ${base - h} L${x + w / 2} ${base} L${x - w / 2} ${base} Z`
const trees = (from: number, to: number, step: number, base: number, h: number, w: number) => {
  let d = ""
  for (let x = from, i = 0; x <= to; x += step, i++) d += tree(x, base + (i % 3) * 6, h * (0.75 + ((i * 7) % 5) * 0.08), w) + " "
  return d
}
// 층은 시차·포인터로 움직여도 가장자리가 비지 않게 화면 밖까지 채운다. depth: 스크롤 시차(px, M2 기준 — 먼 층이 크다).
const LAYERS: { d: string; fill: string; depth: number }[] = [
  { d: "M-80 900 L-80 330 L0 330 L220 150 L380 300 L560 120 L760 330 L960 170 L1160 320 L1300 190 L1440 300 L1520 300 L1520 900 Z", fill: "color-mix(in oklch, var(--block-2, var(--secondary)) 45%, var(--block-1, var(--muted)))", depth: 50 },
  { d: "M-80 900 L-80 470 L0 470 C 240 400, 420 440, 620 460 S 1040 400, 1440 452 L1520 452 L1520 900 Z", fill: "color-mix(in oklch, var(--block-2, var(--secondary)) 85%, var(--block-1, var(--muted)))", depth: 36 },
  { d: trees(20, 1440, 34, 560, 90, 40) + "M-80 556 L1520 556 L1520 900 L-80 900 Z", fill: "color-mix(in oklch, var(--block-4, var(--primary)) 55%, var(--block-2, var(--secondary)))", depth: 24 },
  { d: "M380 640 C 560 610, 900 612, 1080 640 C 900 668, 560 668, 380 640 Z", fill: "color-mix(in oklch, var(--block-1, var(--muted)) 55%, var(--card))", depth: 14 },
  { d: trees(0, 300, 44, 780, 330, 120) + trees(1150, 1440, 48, 790, 360, 130) + "M-80 900 L-80 700 L0 700 C 300 680, 520 700, 760 690 S 1200 676, 1440 700 L1520 700 L1520 900 Z", fill: "var(--block-4, var(--primary))", depth: 6 },
  { d: "M-80 900 L-80 770 L0 770 C 360 744, 720 760, 1080 748 S 1340 752, 1440 760 L1520 760 L1520 900 Z", fill: "var(--foreground)", depth: 0 },
]
const LEAF = "M40 6 C 58 18, 74 32, 66 54 C 58 74, 30 76, 16 60 C 4 46, 12 22, 40 6 Z M40 14 L38 72"

export function HeroLayeredLandscapeLogotype({ copy, id = "hero", className, techniques = DEFAULT_TECHNIQUES, header, texture }: HeroLayeredLandscapeLogotypeProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reveal = techniques.includes("clip-reveal")
  const split = techniques.includes("split-text")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<Element>(sel)
    const layers = s.q(".llc-layer-e")
    // ── 등장(M2: 약 1.8초) ──
    // 풍경 층: 먼 층부터 아래에서 올라와 앉는다. 가까운 층일수록 멀리서(크게) 올라온다.
    if (reveal) s.tl.from(layers, { y: (i: number) => (90 + i * 34) * s.scale.distance, duration: s.t.enter * 2.6, ease: s.t.ease.emphasized, stagger: 0.1, clearProps: "transform" }, 0)
    s.tl.from(q(".llc-clouds-e"), { x: -40 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 2.4, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.15)
    s.tl.from(q(".llc-flag"), { scaleY: 0.3, autoAlpha: 0, transformOrigin: "50% 100%", duration: s.t.enter, ease: "back.out(2.2)", clearProps: "transform,opacity,visibility" }, 0.75)
    if (split) s.tl.from(s.q(".llc-in"), { yPercent: 60, scale: 0.6, autoAlpha: 0, transformOrigin: "50% 100%", duration: s.t.enter * 1.2, ease: "back.out(1.8)", stagger: 0.045, clearProps: "transform,opacity,visibility" }, 0.45)
    s.tl.from(s.q(".llc-leaf-w"), { rotation: (i: number) => (i ? 40 : -40), scale: 0.7, autoAlpha: 0, transformOrigin: "50% 100%", duration: s.t.enter * 1.6, ease: "back.out(1.6)", stagger: 0.08, clearProps: "transform,opacity,visibility" }, 0.95)
    if (q(".llc-tagline")) rise(s, ".llc-tagline", { at: 1.05, y: 12 })
    // 머리(header)의 행동 버튼 칸이 있으면 같은 장면으로 내려앉는다.
    if (q(".llc-cta")) rise(s, ".llc-cta", { at: 1.2, y: -10 })

    // ── 스크롤: 먼 층일수록 느리게, 구름은 옆으로 ──
    parallax(s, [...s.q(".llc-layer-s").map((el, i) => ({ el, y: LAYERS[i].depth })), { el: q(".llc-clouds-s"), x: -40, y: 20 }])

    // ── 포인터: 로고 기울임(±6° · perspective 800) + 층 깊이(가까운 층일수록 크게, 먹 땅은 제자리) ──
    if (techniques.includes("tilt-3d")) tilt3d(s, q(".llc-stage"), q(".llc-logo"), { max: 6, perspective: 800, damping: 0.5 })
    pointerDepth(s, q(".llc-stage"), s.q(".llc-layer-p").map((el, i) => ({ el, x: i === LAYERS.length - 1 ? 0 : (i + 1) * 2.4, y: i === LAYERS.length - 1 ? 0 : (i + 1) * 1.2 })), { damping: 1 })

    // ── 유휴(M2): 구름 흐름 · 잎 살랑 ──
    s.loop(() => gsap.to(q(".llc-clouds-i"), { x: 60, duration: 24, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.8 }))
    s.loop(() => gsap.to(s.q(".llc-leaf-w"), { rotation: (i: number) => (i ? -3 : 3), transformOrigin: "50% 100%", duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.6 }))
  })
  let n = 0
  return (
    <div ref={ref} id={id} data-block="hero-layered-landscape-logotype" data-hero="layered-landscape-logotype" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:5.5rem] [&_.llc-ch]:[transform:rotate(var(--rot,0deg))] [&_.llc-layer-s]:[will-change:transform]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} data-wf-art="" className="relative isolate overflow-clip llc-stage hero-first">
        {/* 층 겹: -s(스크롤 시차) → -p(포인터 깊이) → -e(등장). 구름은 -s → -i(유휴 흐름) → -e(등장). */}
        <svg aria-hidden="true" viewBox="0 0 1440 830" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 -z-10 h-full w-full">
          <rect width="1440" height="830" fill="var(--block-1, var(--muted))" />
          <g className="llc-clouds-s">
            <g className="llc-clouds-i">
              <g data-enter="" className="llc-clouds-e" fill="var(--card)" fillOpacity="0.8">
                <path d="M120 200 a40 40 0 0 1 70 -20 a50 50 0 0 1 90 10 a34 34 0 0 1 40 30 Z" />
                <path d="M980 150 a36 36 0 0 1 64 -18 a46 46 0 0 1 84 8 a30 30 0 0 1 36 28 Z" />
                <path d="M1180 250 a30 30 0 0 1 52 -14 a38 38 0 0 1 70 6 a26 26 0 0 1 30 22 Z" />
              </g>
            </g>
          </g>
          {LAYERS.map((l, i) => (
            <g key={i} className="llc-layer-s">
              <g className="llc-layer-p">
                <g data-enter={reveal ? "" : undefined} className="llc-layer-e">
                  <path d={l.d} fill={l.fill} />
                </g>
              </g>
            </g>
          ))}
          <g data-enter="" className="llc-flag">
            <path d="M1010 560 L1050 500 L1090 560 Z" fill="var(--block-3, var(--accent))" />
            <path d="M1050 500 L1050 560" stroke="var(--block-3-foreground, var(--accent-foreground))" strokeWidth="3" />
          </g>
        </svg>

        <div className="relative flex h-full flex-col items-center pt-[6vh]">
          <div className="relative flex items-center gap-4 md:gap-8">
            <span data-enter="" className="hidden md:block llc-leaf-w">
              <svg viewBox="0 0 80 80" aria-hidden="true" className="block size-20 -rotate-12">
                <path d={LEAF} fill="var(--block-3, var(--accent))" stroke="var(--block-3-foreground, var(--accent-foreground))" strokeWidth="2" />
              </svg>
            </span>
            <h1 data-enter={split ? "keep" : undefined} className="flex flex-col items-center leading-[0.95] [color:var(--block-1-foreground,var(--foreground))] llc-logo font-heading">
              <span className="sr-only">{copy.title}</span>
              {copy.logoLines.map((l) => (
                <span key={l.text} aria-hidden="true" data-size={l.size} className="block data-[size=sm]:text-[clamp(1.8rem,3.4vw,3.2rem)] data-[size=lg]:text-[clamp(3.6rem,7.6vw,7.4rem)]">
                  {[...l.text].map((c) => {
                    const i = n++
                    return (
                      <span key={i} className="inline-block llc-ch" style={{ ["--rot" as string]: `${((i * 37) % 9) - 4}deg` } as React.CSSProperties}>
                        <span className="inline-block llc-in">{c}</span>
                      </span>
                    )
                  })}
                </span>
              ))}
            </h1>
            <span data-enter="" className="hidden md:block llc-leaf-w">
              <svg viewBox="0 0 80 80" aria-hidden="true" className="block size-20 scale-x-[-1] rotate-12">
                <path d={LEAF} fill="var(--block-3, var(--accent))" stroke="var(--block-3-foreground, var(--accent-foreground))" strokeWidth="2" />
              </svg>
            </span>
          </div>
          {copy.tagline ? (
            <p data-enter="keep" className="mt-5 rounded-full bg-card px-6 py-2.5 text-center text-[1.0625rem] leading-[1.5] text-card-foreground llc-tagline">
              {copy.tagline}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
