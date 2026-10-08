"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Bell, ChevronDown, Edit, Home, Image, Plus, Search, Share, Star } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { parallax, pointerDepth, rise, splitReveal } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 4칸 두꺼운 제목 + 8칸 앱 창 + 창 위 공지 알약(P3-1 r7 B 구성 승격). 첫 화면 = 면(faces[0], 없으면 바탕). 왼쪽 4칸 네 줄 제목(h1) · 설명 ·
// 버튼 둘, 오른쪽 8칸 공지 알약(링크) 아래 앱 창(카드 값 — 왼쪽 목록 나무 · 점 격자 판 위 자료 카드 넷 · 카드 사이 점선 · 아래 도구 줄).
// 모션(기본 기법 view-transition·sticky-stack — M2 세 겹):
//   등장  제목 줄이 올라온다 → 앱 창이 기울어진 채 들려 올라와 앉는다 → 나무가 정착하고 알약이 내려앉는다 → 카드가 한 장씩 내려앉고 앞 장이
//         0.97 로 한 번 물러났다 돌아온다(sticky-stack 결) → 점선·도구 줄 → 설명·버튼.
//   스크롤 알약·창이 들려 올라오고 카드들은 저마다 다른 깊이로. 포인터 카드들이 깊이만큼 포인터 쪽으로(등장 뒤부터). 유휴(M2) 점선이 흐른다.
export type HeroNarrowTitleWideWindowCopy = {
  label: string
  title: string
  titleLines?: string[]
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  pill: { label: string; href: string }
  window: {
    label: string
    root: string
    // 목록 나무: depth 0|1, on = 고른 항목, count = 개수 칩.
    tree: { label: string; depth: 0 | 1; on?: boolean; count?: number }[]
    board: string
    share: string
    // 판 위 자료 카드(최대 넷 — 자리·깊이는 블록이 정한다).
    nodes: { tag: string; title: string; id: string; status: string }[]
  }
}
export type HeroNarrowTitleWideWindowProps = BlockBase<HeroNarrowTitleWideWindowCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["view-transition", "sticky-stack"]
// 카드 자리(판 기준)와 깊이(px, M2 기준 — 스크롤·포인터).
const NODE_AT = [
  { x: "8%", y: "14%", depth: 18 },
  { x: "46%", y: "34%", depth: 30 },
  { x: "74%", y: "8%", depth: 12 },
  { x: "14%", y: "56%", depth: 24 },
]
const TOOLS = [Plus, Edit, Image, Search, Share]

export function HeroNarrowTitleWideWindow({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroNarrowTitleWideWindowProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const w = copy.window
  const nodes = w.nodes.slice(0, NODE_AT.length)
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M2: 약 1.9초) ──
    splitReveal(s, "h1", { type: "lines", at: 0.05, stagger: 0.08 })
    s.tl.from(q(".nt-window"), { y: 120 * s.scale.distance, rotationX: 12, transformPerspective: 1600, transformOrigin: "50% 0%", autoAlpha: 0, duration: s.t.enter * 2.4, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.15)
    s.tl.from(s.q(".nt-tree > *"), { x: -8 * s.scale.distance, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.025, clearProps: "transform,opacity,visibility" }, 0.5)
    s.tl.from(q(".nt-pill"), { y: -22 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 1.2, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.6)
    // 카드: 한 장씩 내려앉고 앞 장이 0.97 로 한 번 물러났다 돌아온다(크기만, 글자 대비는 그대로).
    const ns = s.q(".nt-node-p")
    ns.forEach((n, i) => {
      const at = 0.75 + i * 0.18
      s.tl.from(n, { y: 24 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 1.2, ease: s.t.ease.standard, clearProps: "opacity,visibility" }, at)
      if (i > 0) s.tl.to(ns[i - 1], { keyframes: [{ scale: 0.97, duration: s.t.enter * 0.4, ease: s.t.ease.standard }, { scale: 1, duration: s.t.enter * 0.8, ease: s.t.ease.standard }], transformOrigin: "50% 0%" }, at + 0.05)
    })
    s.tl.from(s.q(".nt-links path"), { autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.08, clearProps: "opacity,visibility" }, 1.2)
    rise(s, ".nt-tools", { at: 1.15, y: 10 })
    if (q(".nt-lede")) rise(s, ".nt-lede", { at: 0.4, y: 12 })
    rise(s, s.q(".nt-ctas > *"), { at: 1.3, y: 12, stagger: 0.08 })

    // ── 스크롤: 알약·창이 들려 올라오고 카드들은 저마다 다른 깊이로 ──
    parallax(s, [{ el: q(".nt-stage-s"), y: -40 }, ...s.q(".nt-node-s").map((el, i) => ({ el, y: -NODE_AT[i].depth }))])

    // ── 포인터: 카드들이 깊이만큼 포인터 쪽으로 — 등장이 끝난 뒤부터. 가로 이동은 작게(깊이 × 0.4 — 오른쪽 끝 카드가 잘리지 않게). ──
    pointerDepth(s, q(".nt-canvas"), ns.map((el, i) => ({ el, x: NODE_AT[i].depth * 0.4, y: NODE_AT[i].depth * 0.4 })), { damping: 0.8, afterEnter: true })

    // ── 유휴(M2): 점선이 카드 사이를 천천히 흐른다 ──
    s.loop(() => gsap.to(s.q(".nt-links path"), { strokeDashoffset: -12, duration: 2.4, ease: "none", repeat: -1, delay: 2.2 }))
  })
  return (
    <div ref={ref} id={id} data-block="hero-narrow-title-wide-window" data-hero="narrow-title-wide-window" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem] [&_.nt-canvas]:[background-image:radial-gradient(circle,var(--border)_1px,transparent_1.5px)] [&_.nt-canvas]:[background-size:18px_18px] [&_.nt-node]:[transition:transform_var(--duration-hover)_var(--ease-standard),border-color_var(--duration-hover)_var(--ease-standard)] [&_.nt-node:hover]:[border-color:var(--ring)] [&_.nt-arrow]:[transition:transform_var(--duration-hover)_var(--ease-standard)] motion-safe:[&_.nt-node:hover]:[transform:translateY(-3px)] motion-safe:[&_.nt-pill:hover_.nt-arrow]:[transform:translateX(0.3rem)] motion-safe:[&_.nt-pill:focus-visible_.nt-arrow]:[transform:translateX(0.3rem)]", className)}>
      <HeroTexture texture={texture} />
      {header}
      {/* 첫 화면 바탕 = 면. 창과 알약은 제 카드 값으로 돌아간다(data-face-reset) — 면 위에 흰 창 한 장. */}
      <Face k={k} fallback="" as="section" label={copy.label} className="grid items-start gap-10 px-6 pt-8 pb-12 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-10 hero-first">
        <div className="flex flex-col gap-7 lg:col-span-4 lg:pt-10">
          <h1 className="text-[clamp(2.9rem,4.4vw,4.5rem)] leading-[1.0] tracking-[-0.01em] font-heading">
            <SplitSource label={copy.title}>
              {lines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {l}
                </React.Fragment>
              ))}
            </SplitSource>
          </h1>
          {copy.lede ? (
            <p data-enter="keep" className="max-w-[36ch] text-[1.1875rem] leading-[1.55] nt-lede">
              {copy.lede}
            </p>
          ) : null}
          <div data-enter="keep" className="flex flex-wrap gap-3 nt-ctas">
            <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="rounded-sm px-8">
              {copy.primaryCta.label}
            </Button>
            {copy.secondaryCta ? (
              <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />} className="rounded-sm px-6">
                {copy.secondaryCta.label}
              </Button>
            ) : null}
          </div>
        </div>

        {/* 알약 + 앱 창: .nt-stage-s 가 스크롤 들기를 맡고, 안쪽 요소가 등장을 맡는다. */}
        <div className="flex flex-col gap-5 lg:col-span-8 nt-stage-s">
          <a href={copy.pill.href} data-enter="keep" className={cn("block rounded-full nt-pill", RING)}>
            <span data-face-reset="" className="flex min-h-11 items-center gap-3 rounded-full border bg-card px-5 text-[1.0625rem] [font-weight:700] text-card-foreground">
              <Bell aria-hidden="true" className="size-5 text-primary" />
              {copy.pill.label}
              <ArrowRight aria-hidden="true" className="ms-1 size-5 nt-arrow" />
            </span>
          </a>
          <div data-face-reset="" data-wf-art="" data-clip-ok="" aria-label={w.label} role="img" data-enter="keep" className="grid h-[34rem] grid-cols-[minmax(0,1fr)] md:grid-cols-[13rem_minmax(0,1fr)] overflow-hidden rounded-xl border bg-card text-card-foreground nt-window">
            <div className="hidden flex-col gap-0.5 border-e bg-muted p-3 text-sm md:flex nt-tree">
              <p className="flex items-center gap-2 px-2 pb-2 [font-weight:700]">
                <span className="size-4 rounded-sm bg-primary" /> {w.root} <ChevronDown aria-hidden="true" className="size-3.5" />
              </p>
              {w.tree.map((x) =>
                x.on ? (
                  <Face key={x.label} k={k} fallback="bg-background" className="flex items-center gap-2 rounded-sm py-1 ps-6 pe-2 [font-weight:700]">
                    <Edit aria-hidden="true" className="size-3.5" />
                    {x.label}
                  </Face>
                ) : (
                  <p key={x.label} data-depth={x.depth} className="flex items-center gap-2 rounded-sm py-1 ps-2 pe-2 data-[depth=1]:ps-6">
                    {x.depth ? <Star aria-hidden="true" className="size-3.5 text-muted-foreground" /> : <Home aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                    {x.label}
                    {x.count ? <span className="ms-auto text-muted-foreground tabular-nums">{x.count}</span> : null}
                  </p>
                ),
              )}
            </div>
            <div className="relative min-w-0 nt-canvas">
              <p className="flex items-center gap-3 border-b bg-card px-4 py-2 text-sm">
                <span className="text-muted-foreground">{w.board}</span>
                <span className="ms-auto inline-flex items-center gap-1 text-muted-foreground">
                  <Share aria-hidden="true" className="size-3.5" /> {w.share}
                </span>
              </p>
              <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-x-0 top-10 bottom-0 h-[calc(100%-2.5rem)] w-full text-primary">
                <g className="nt-links" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke">
                  <path d="M28 30 C 38 30, 36 44, 46 46" vectorEffect="non-scaling-stroke" />
                  <path d="M28 30 C 50 24, 60 18, 74 16" vectorEffect="non-scaling-stroke" />
                  <path d="M52 54 C 44 60, 34 60, 26 64" vectorEffect="non-scaling-stroke" />
                </g>
              </svg>
              {/* 카드 겹: .nt-node-s(자리·스크롤 깊이) → .nt-node-p(등장·포인터 깊이) → .nt-node(모양·hover 는 CSS). */}
              {nodes.map((n, i) => (
                <div key={n.id} className="absolute nt-node-s" style={{ insetInlineStart: NODE_AT[i].x, top: `calc(2.5rem + ${NODE_AT[i].y})` }}>
                  <div className="nt-node-p">
                    <div className="flex w-[9.5rem] flex-col md:w-[11.5rem] gap-1 rounded-md border bg-card p-3 text-sm nt-node">
                      <Badge variant="secondary" className="self-start">
                        {n.tag}
                      </Badge>
                      <span className="[font-weight:700]">{n.title}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {n.id} · {n.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="absolute start-1/2 bottom-4 flex -translate-x-1/2 items-center gap-4 rounded-lg border bg-card px-4 py-2 text-muted-foreground nt-tools">
                {TOOLS.map((I, i) => (
                  <I key={i} aria-hidden="true" className="size-4" />
                ))}
              </p>
            </div>
          </div>
        </div>
      </Face>
    </div>
  )
}
