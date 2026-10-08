"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { AlertTriangle, Bell, CheckCircle, Clock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { parallax, pointerDepth, rise, scrubTimeline, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { Button } from "@/registry/factory/ui/button"

import { Face, FACE_TEXT, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 재단 표시 + 타자로 써지는 제목 + 딱딱한 그림자 버튼(P3-1 r10 A 구성 승격). 첫 화면 가운데 교정지 한 장(면 faces[0], 없으면 muted) 모서리 바깥에
// 재단 표시 넷, 뒤에 와이어프레임 구, 네 곳에 아이콘 칩. 가운데 세 줄 대문자 제목(h1) — 셋째 줄 끝 낱말은 타자로 써지고 커서가 따라간다. 설명 · 딱딱한
// 그림자 버튼(면 색을 어둡게 한 그림자) + ▸ 링크, 접힘선을 넘는 터미널 창.
// 모션(기본 기법 view-transition·svg-draw — M1 세 겹):
//   등장  재단 표시가 바깥에서 모서리로 들어오고 교정지가 가운데서 좌우로 열린다 → 구 선을 긋고 제목 줄이 올라온다 → 터미널이 올라오고 줄이 찍힌다 →
//         끝 낱말이 한 글자씩 타자로 써진다(커서는 등장 뒤 세 번 깜박이고 켠 채로 멈춘다) → 칩·설명·버튼.
//   스크롤 구가 돌며 커지고, 칩은 깊이만큼, 터미널은 들린다. 포인터 구는 포인터 쪽으로, 칩은 깊이만큼(등장이 끝난 뒤부터).
export type HeroCropMarksTypedTitleCopy = {
  label: string
  // 읽기 도구용 제목 한 문장. 보이는 것은 lines 두 줄 + 타자 낱말.
  title: string
  lines: [string, string]
  typed: string
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  terminal: { label: string; lines: string[] }
}
export type HeroCropMarksTypedTitleProps = BlockBase<HeroCropMarksTypedTitleCopy> & HeroCommon & HeroDisplay

const DEFAULT_TECHNIQUES = ["view-transition", "svg-draw"]
// 와이어프레임 구: 위도 타원 넷 + 경도 타원 넷(가운데 세로 원 포함). 경로마다 pathLength=1(svg-draw 가 대시로 긋는다).
const LAT = [60, 150, 240, 320].map((ry) => `M40 400 a360 ${ry} 0 1 0 720 0 a360 ${ry} 0 1 0 -720 0`)
const LON = [80, 180, 280, 360].map((rx) => `M400 40 a${rx} 360 0 1 0 0 720 a${rx} 360 0 1 0 0 -720`)
// 재단 표시(시작·위 · 끝·위 · 시작·아래 · 끝·아래) — 등장 때 이 방향 바깥에서 모서리로 들어온다. 자리·선 방향은 훅이 data-pos 로 정한다.
const MARKS = [
  { pos: "ts", x: -1, y: -1 },
  { pos: "te", x: 1, y: -1 },
  { pos: "bs", x: -1, y: 1 },
  { pos: "be", x: 1, y: 1 },
]
// 칩 자리(자리만 — 모양은 훅)와 깊이(px, M2 기준 — 스크롤·포인터).
const CHIP_AT = ["start-[13%] top-[48%]", "end-[13%] top-[44%]", "start-[15%] top-[76%]", "end-[15%] top-[70%]"]
const DEPTH = [14, 22, 10, 26]
const CHIPS = [Bell, Clock, AlertTriangle, CheckCircle]

export function HeroCropMarksTypedTitle({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroCropMarksTypedTitleProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const draw = techniques.includes("svg-draw")
  const typedText = copy.typed
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M1: 약 1.5초) ──
    s.q(".ct-mark").forEach((m, i) => s.tl.from(m, { x: MARKS[i].x * 14 * s.scale.distance, y: MARKS[i].y * 14 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 1.4, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.02 * i))
    s.tl.fromTo(q(".ct-sheet"), { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: s.t.enter * 1.8, ease: s.t.ease.inScreen, clearProps: "clipPath" }, 0.1)
    if (draw) svgDraw(s, s.q(".ct-globe path"), { at: 0.15, duration: s.t.enter * 4, stagger: 0.05, ease: s.t.ease.inScreen })
    s.tl.from(s.q(".ct-line-in"), { yPercent: 120, duration: s.t.enter * 1.4, ease: s.t.ease.emphasized, stagger: 0.08, clearProps: "transform" }, 0.15)
    s.tl.from(q(".ct-term"), { y: 40 * s.scale.distance, autoAlpha: 0, duration: s.t.enter * 2, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.35)
    s.tl.from(s.q(".ct-term pre > span"), { autoAlpha: 0, duration: s.t.press, ease: "none", stagger: 0.08, clearProps: "opacity,visibility" }, 0.6)
    // 타자: 칸을 글자 수만큼 계단으로 열고(clip-path), 커서가 같은 계단으로 칸 폭만큼 따라간다(transform — 줄 배치는 그대로).
    const typed = q(".ct-typed")
    const cursor = q(".ct-cursor")
    if (typed && cursor) {
      const w = typed.getBoundingClientRect().width
      const steps = `steps(${typedText.length})`
      s.tl.fromTo(typed, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: s.t.enter * 3, ease: steps, clearProps: "clipPath" }, 0.5)
      s.tl.fromTo(cursor, { x: -w }, { x: 0, duration: s.t.enter * 3, ease: steps, clearProps: "transform" }, 0.5)
      // 커서: 등장이 끝나면 세 번 깜박이고 켠 채로 멈춘다(등장 한 줄 밖 — 등장 끝 시각을 늘리지 않는다).
      const caret = q(".ct-caret")
      if (caret) s.afterEnter(() => gsap.to(caret, { opacity: 0, duration: 0.5, ease: "steps(1)", repeat: 5, yoyo: true, clearProps: "opacity" }))
    }
    rise(s, s.q(".ct-chip"), { at: 0.8, y: 12, stagger: 0.06 })
    if (q(".ct-lede")) rise(s, ".ct-lede", { at: 0.6, y: 10 })
    rise(s, s.q(".ct-ctas > *"), { at: 0.95, y: 10, stagger: 0.06 })

    // ── 스크롤: 구가 돌며 커지고, 칩은 깊이만큼, 터미널은 들린다 ──
    scrubTimeline(s).to(q(".ct-globe"), { rotation: 16, scale: 1 + 0.05 * s.scale.distance, transformOrigin: "50% 50%" }, 0)
    parallax(s, [...s.q(".ct-chip-s").map((el, i) => ({ el, y: -DEPTH[i] })), { el: q(".ct-term-s"), y: -30 }])

    // ── 포인터: 구는 포인터 쪽으로, 칩은 깊이만큼(칩은 등장이 끝난 뒤부터) ──
    const stage = q(".ct-stage")
    pointerDepth(s, stage, [{ el: q(".ct-globe-p"), x: 18, y: 12 }], { damping: 1 })
    pointerDepth(s, stage, s.q(".ct-chip").map((el, i) => ({ el, x: DEPTH[i] * 0.8, y: DEPTH[i] * 0.6 })), { damping: 0.8, afterEnter: true })
  })
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <span className="sr-only">{copy.title}</span>
      {/* 앞 두 줄: 칸(overflow-clip)이 자르고 안쪽 줄이 올라온다. 글자 머리·꼬리 여유는 overflow-clip-margin 으로(여백을 쓰면 음수 margin 이 겹친다). */}
      <span aria-hidden="true" className="block overflow-clip [overflow-clip-margin:0.12em]">
        <span className="block ct-line-in">{copy.lines[0]}</span>
      </span>
      <span aria-hidden="true" className="block overflow-clip [overflow-clip-margin:0.12em]">
        <span className="block ct-line-in">{copy.lines[1]}</span>
      </span>
      <span aria-hidden="true" className="block">
        <span className="inline-block align-bottom ct-typed" style={{ ["--chars" as string]: typedText.length } as React.CSSProperties}>
          {typedText}
        </span>
        <span className="inline-block ct-cursor">
          <span className="ms-[0.06em] inline-block h-[0.82em] w-[0.1em] bg-foreground align-[-0.02em] ct-caret" />
        </span>
      </span>
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-crop-marks-typed-title" data-hero="crop-marks-typed-title" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:6rem] [--ct-hard-shadow:0_4px_0_oklch(from_var(--field-1)_calc(l_*_0.55)_c_h)] [&_.ct-hard>[data-slot=button]]:[transition:transform_var(--duration-press)_var(--ease-standard)] motion-safe:[&_.ct-hard:hover>[data-slot=button]]:[transform:translateY(2px)] motion-safe:[&_.ct-hard:active>[data-slot=button]]:[transform:translateY(4px)] [&_.ct-typed]:[width:calc(var(--chars,6)_*_1ch)] [&_.ct-typed]:[overflow:clip] [&_.ct-typed]:[white-space:nowrap]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} data-wf-art="" className="relative isolate overflow-clip ct-stage hero-first">
        {/* 재단 표시 안의 교정지 한 장 = 면. 표시는 교정지 모서리 바깥에 선다. 글자는 바탕 토큰 그대로 면 위에 놓인다. */}
        <Face k={k} fallback="bg-muted" enter className="absolute inset-x-[calc(4%+1.25rem)] top-[calc(4%+1.25rem)] bottom-[calc(8%+1.25rem)] -z-20 md:inset-x-[calc(12%+1.25rem)] ct-sheet" />
        {/* 구 겹: .ct-globe-p(포인터) → .ct-globe(자리·스크롤 회전 — 선은 등장에서 긋는다). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-clip ct-globe-p">
          <svg viewBox="0 0 800 800" data-enter={draw ? "" : undefined} className="absolute start-1/2 top-[6%] h-[130%] w-auto -translate-x-1/2 text-foreground/25 ct-globe">
            <g fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke">
              <path pathLength={1} d="M40 400 a360 360 0 1 0 720 0 a360 360 0 1 0 -720 0" />
              {[...LAT, ...LON].map((d, i) => (
                <path key={i} pathLength={1} d={d} />
              ))}
            </g>
          </svg>
        </div>
        {MARKS.map((m) => (
          <span key={m.pos} aria-hidden="true" data-enter="" data-pos={m.pos} className="absolute size-4 border-muted-foreground data-[pos=ts]:start-[4%] data-[pos=ts]:top-[4%] data-[pos=ts]:border-s data-[pos=ts]:border-t md:data-[pos=ts]:start-[12%] data-[pos=te]:end-[4%] data-[pos=te]:top-[4%] data-[pos=te]:border-e data-[pos=te]:border-t md:data-[pos=te]:end-[12%] data-[pos=bs]:start-[4%] data-[pos=bs]:bottom-[8%] data-[pos=bs]:border-s data-[pos=bs]:border-b md:data-[pos=bs]:start-[12%] data-[pos=be]:end-[4%] data-[pos=be]:bottom-[8%] data-[pos=be]:border-e data-[pos=be]:border-b md:data-[pos=be]:end-[12%] ct-mark" />
        ))}
        {/* 칩 겹: .ct-chip-s(자리·스크롤 깊이) → .ct-chip(등장, 끝난 뒤 포인터 깊이 · 모양). */}
        {CHIPS.map((I, i) => (
          <span key={i} aria-hidden="true" className={cn("absolute hidden md:block ct-chip-s", CHIP_AT[i])}>
            <span data-enter="" className="flex size-16 items-center justify-center rounded-xl border bg-card ct-chip">
              <I className="size-7 text-primary" />
            </span>
          </span>
        ))}

        {/* 제목·설명·버튼은 교정지 면 위에 놓인다 — 면의 짝 글자색과 면 스코프 토큰을 받는다(면이 어두운 레시피에서 어두운 글자가 되지 않게) */}
        <div data-face={k} className={cn("flex flex-col items-center px-[calc(4%+2rem)] pt-[10vh] text-center md:px-6", k && FACE_TEXT[k])}>
          {Display ? (
            <Display as="h1" data-enter="keep" className="uppercase">
              {titleBody}
            </Display>
          ) : (
            <h1 data-enter="keep" className="text-[clamp(2.2rem,4.4vw,4.25rem)] leading-[1.02] uppercase font-heading">
              {titleBody}
            </h1>
          )}
          {copy.lede ? (
            <p data-enter="keep" className="mt-7 max-w-[46ch] text-[1.1875rem] leading-[1.55] ct-lede">
              {copy.lede}
            </p>
          ) : null}
          <div data-enter="keep" className="mt-9 flex flex-wrap items-center justify-center gap-8 ct-ctas">
            <span className="inline-flex rounded-sm shadow-(--ct-hard-shadow) ct-hard">
              <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="rounded-sm px-6 tracking-[0.06em] font-heading">
                <span aria-hidden="true">▸</span> {copy.primaryCta.label}
              </Button>
            </span>
            {copy.secondaryCta ? (
              <a href={copy.secondaryCta.href} className={cn("inline-flex min-h-11 items-center gap-2 tracking-[0.06em] font-heading", RING)}>
                <span aria-hidden="true">▸</span>
                {copy.secondaryCta.label}
                <span aria-hidden="true">◂</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* 터미널 겹: .ct-term-s(자리·스크롤 들기) → .ct-term(등장·모양). */}
        <div className="absolute start-1/2 top-[76%] w-[min(36rem,90%)] -translate-x-1/2 max-md:relative max-md:start-auto max-md:top-auto max-md:mx-auto max-md:mt-10 max-md:mb-8 max-md:translate-x-0 ct-term-s">
          <div aria-label={copy.terminal.label} role="img" data-enter="keep" className="overflow-hidden rounded-md border bg-card text-card-foreground ct-term">
            <div className="flex h-8 items-center gap-2 border-b bg-muted px-3">
              <span className="size-3 rounded-full bg-foreground" />
              <span className="size-3 rounded-full bg-muted-foreground" />
              <span className="size-3 rounded-full border border-foreground" />
            </div>
            <pre data-numeric="" className="px-4 py-3 data-numeric:font-mono text-sm leading-[1.7]">
              {copy.terminal.lines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}
