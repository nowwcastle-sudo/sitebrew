"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, parallax, pointerDepth, rise, scrubTimeline, splitReveal, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/registry/factory/ui/toggle-group"

import { HeroTexture, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 단계 띠 3칸 + 궤도 도면(P3-1 r1 A 구성 승격). 왼쪽 5칸: 레일(상태점 · 이름 / 번호) → 제목(h1, 한 낱말 강조) → 설명 → 단계 띠(토글 3칸,
// 고른 칸은 윗선 2px primary + muted 바탕, 좁은 화면은 세로 세 줄) → 버튼 둘. 오른쪽 7칸: 동심원·축선·기울어진 궤도(직접 그린 SVG)와 네 모서리 판독값.
// 모션(기본 기법 svg-draw — 세 겹):
//   등장  레일이 왼쪽에서 열리고 제목 줄이 올라온다 → 동심원·축선을 긋고 궤도를 그리며 위성이 궤도를 따라 제자리로 온다 → 측정점이 튀어나오고
//         판독값이 열린다. 설명·단계 띠·버튼이 차례로. 상태점은 세 번 뛰고 켜진 채로 멈춘다(유휴 반복 없음).
//   스크롤 궤도 고리가 더 돌고 위성이 나아간다. 동심원은 느리게, 측정점은 빠르게. 포인터 축선이 조준선처럼 따라온다(감쇠).
export type HeroStepBandOrbitCopy = {
  label: string
  rail: { name: string; index: string }
  // 제목 = before + highlight + after(highlight 는 주색 한 낱말 — 줄바꿈 없이 뒤 구두점과 붙는다). 읽기 도구는 한 문장.
  title: { before: string; highlight: string; after: string }
  lede?: string
  stepsLabel: string
  steps: { value: string; number: string; name: string; description: string }[]
  // 처음 고른 단계(value).
  defaultStep?: string
  primaryCta: Cta
  secondaryCta?: Cta
  drawingLabel: string
  drawingDescription: string
  readouts: [string, string, string, string]
}
export type HeroStepBandOrbitProps = BlockBase<HeroStepBandOrbitCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["svg-draw"]
// 기울어진 궤도(중심 320,260 · 반지름 260×92 · -24°) 위의 점. 위성의 제자리(238,198)는 이 식으로 역산한 각 SAT0 이다.
const C = { x: 320, y: 260 }
const R = { x: 260, y: 92 }
const TILT = (-24 * Math.PI) / 180
const onOrbit = (a: number) => {
  const vx = R.x * Math.cos(a)
  const vy = R.y * Math.sin(a)
  return { x: C.x + vx * Math.cos(TILT) - vy * Math.sin(TILT), y: C.y + vx * Math.sin(TILT) + vy * Math.cos(TILT) }
}
const SAT0 = (() => {
  const dx = 238 - C.x
  const dy = 198 - C.y
  const ux = dx * Math.cos(-TILT) - dy * Math.sin(-TILT)
  const uy = dx * Math.sin(-TILT) + dy * Math.cos(-TILT)
  return Math.atan2(uy / R.y, ux / R.x)
})()

export function HeroStepBandOrbit({ copy, id = "hero", className, techniques = DEFAULT_TECHNIQUES, header, texture }: HeroStepBandOrbitProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [step, setStep] = React.useState<string[]>([copy.defaultStep ?? copy.steps[0]?.value ?? ""])
  const draw = techniques.includes("svg-draw")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector(sel)
    const sat = q(".sat")
    // 위성 각 = 제자리 + 등장 몫(-2.2 → 0) + 스크롤 몫(0 → +1.1). 두 몫을 따로 두어 등장과 스크롤이 서로의 시작값을 덮지 않는다.
    const enter = { v: 0 }
    const scroll = { v: 0 }
    const placeSat = () => {
      const p = onOrbit(SAT0 + enter.v + scroll.v)
      sat?.setAttribute("cx", p.x.toFixed(2))
      sat?.setAttribute("cy", p.y.toFixed(2))
    }
    s.onCleanup(() => {
      sat?.setAttribute("cx", "238")
      sat?.setAttribute("cy", "198")
    })

    // ── 등장(M1: 약 1.7초) ──
    clipReveal(s, ".rail", { from: "left", at: 0, duration: s.t.enter * 1.4, ease: s.t.ease.standard })
    splitReveal(s, "h1", { type: "lines", at: 0.08, stagger: 0.09 })
    if (draw) {
      svgDraw(s, s.q(".circles path"), { at: 0.1, duration: s.t.enter * 3, stagger: 0.12 })
      svgDraw(s, s.q(".axes path"), { at: 0.15, duration: s.t.enter * 2.4 })
      svgDraw(s, s.q(".orbit-ring path"), { at: 0.45, duration: s.t.enter * 3 })
      s.tl.fromTo(enter, { v: -2.2 }, { v: 0, duration: s.t.enter * 3, ease: s.t.ease.emphasized, onUpdate: placeSat, immediateRender: true }, 0.45)
      placeSat()
    }
    s.tl.from(s.q(".pts > rect"), { autoAlpha: 0, scale: 0.2, transformOrigin: "50% 50%", duration: s.t.enter, ease: "back.out(2)", stagger: 0.07, clearProps: "transform,opacity,visibility" }, 0.9)
    clipReveal(s, s.q(".readout"), { from: "left", at: 0.95, duration: s.t.enter * 1.3, stagger: 0.07, ease: s.t.ease.standard })
    rise(s, ".lede", { at: 0.3, y: 14 })
    rise(s, s.q(".step-band > *"), { at: 0.42, y: 18, stagger: 0.07 })
    rise(s, s.q(".ctas > *"), { at: 0.95, y: 14, stagger: 0.08 })
    // 상태점 맥박(DNA 관측 2800ms): 세 번 뛰고 켜진 채로 멈춘다 — 유휴 반복이 아니다(M1).
    const dot = q(".pulse-dot")
    if (dot) s.add(() => gsap.fromTo(dot, { opacity: 1 }, { opacity: 0.25, duration: 1.4, ease: "none", yoyo: true, repeat: 5 }))

    // ── 스크롤: 궤도가 더 돌고 위성이 나아간다 ──
    const sc = scrubTimeline(s)
    sc.to(q(".orbit-ring"), { rotation: 10 * s.scale.rotate, svgOrigin: "320 260" }, 0)
    sc.fromTo(scroll, { v: 0 }, { v: 1.1 * s.scale.distance, onUpdate: placeSat }, 0)
    parallax(s, [{ el: q(".circles"), y: 14 }, { el: q(".pts"), y: -10 }])

    // ── 포인터: 축선이 조준선처럼 따라온다 ──
    pointerDepth(s, q(".orbit"), [{ el: q(".axes"), x: 40, y: 34 }], { damping: 0.5 })
  })
  const [r1, r2, r3, r4] = copy.readouts
  return (
    <div ref={ref} id={id} data-block="hero-step-band-orbit" data-hero="step-band-orbit" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem] [&_.step-band]:[border:1px_solid_var(--border)] [&_.step-band>[data-slot=toggle-group-item]]:[border-top:2px_solid_transparent] [&_.step-band>[data-slot=toggle-group-item]_+_[data-slot=toggle-group-item]]:[border-inline-start:1px_solid_var(--border)] [&_.step-band>[aria-pressed=true]]:[border-top-color:var(--primary)] [&_.step-band>[aria-pressed=true]]:[background:var(--muted)] [&_.step-band>[aria-pressed=true]]:[--tw-inset-ring-color:transparent] max-sm:[&_.step-band>[data-slot=toggle-group-item]]:[border-top:0] max-sm:[&_.step-band>[data-slot=toggle-group-item]]:[border-inline-start:2px_solid_transparent] max-sm:[&_.step-band>[data-slot=toggle-group-item]_+_[data-slot=toggle-group-item]]:[border-top:1px_solid_var(--border)] max-sm:[&_.step-band>[data-slot=toggle-group-item]_+_[data-slot=toggle-group-item]]:[border-inline-start:2px_solid_transparent] max-sm:[&_.step-band>[data-slot=toggle-group-item][aria-pressed=true]]:[border-inline-start-color:var(--primary)]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="grid items-center gap-10 px-6 py-10 md:px-10 lg:grid-cols-12 lg:gap-6 hero-first">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <p data-enter="keep" className="flex items-center gap-3 text-base tracking-[0.12em] uppercase rail font-heading">
            <span aria-hidden="true" className="size-2 bg-primary pulse-dot" />
            {copy.rail.name} <span className="text-muted-foreground">{copy.rail.index}</span>
          </p>
          <h1 className="text-[clamp(2.25rem,4vw,3.6rem)] leading-[0.98] tracking-[-0.03em] font-heading">
            <SplitSource label={`${copy.title.before}${copy.title.highlight}${copy.title.after}`}>
              {copy.title.before}
              <span className="whitespace-nowrap">
                <span className="text-primary">{copy.title.highlight}</span>
                {copy.title.after.match(/^[^\s]*/)?.[0]}
              </span>
              {copy.title.after.replace(/^[^\s]*/, "")}
            </SplitSource>
          </h1>
          {copy.lede ? (
            <p data-enter="keep" className="max-w-[44ch] leading-[1.7] text-muted-foreground lede">
              {copy.lede}
            </p>
          ) : null}
          <ToggleGroup
            value={step}
            onValueChange={(v) => {
              if ((v as string[]).length) setStep(v as string[])
            }}
            aria-label={copy.stepsLabel}
            data-enter="keep"
            className="grid w-full grid-cols-1 sm:grid-cols-3 step-band"
          >
            {copy.steps.map((st) => (
              <ToggleGroupItem key={st.value} value={st.value} className="h-auto min-h-0 flex-col items-start sm:min-h-28 justify-start gap-1 whitespace-normal px-3 py-3 text-start">
                <span className="text-sm tracking-[0.12em] font-heading">
                  {st.number} · {st.name}
                </span>
                <span className="text-base leading-[1.5] font-normal text-muted-foreground">{st.description}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div data-enter="keep" className="flex flex-wrap gap-3 ctas">
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
        <figure data-wf-art="" className="relative lg:col-span-7 orbit" aria-label={copy.drawingLabel}>
          <svg viewBox="0 0 640 520" className="h-auto w-full text-border" role="img" aria-label={copy.drawingDescription}>
            <g data-enter={draw ? "" : undefined} className="circles" fill="none" stroke="currentColor" strokeWidth="1">
              <path pathLength={1} d="M320 60 a200 200 0 1 0 0.01 0" />
              <path pathLength={1} d="M320 130 a130 130 0 1 0 0.01 0" />
            </g>
            <g data-enter={draw ? "" : undefined} className="axes" fill="none" stroke="currentColor" strokeWidth="1">
              <path pathLength={1} d="M40 260 H600" />
              <path pathLength={1} d="M320 20 V500" />
            </g>
            <g data-enter={draw ? "" : undefined} className="orbit-ring">
              <g transform="rotate(-24 320 260)" fill="none">
                <path pathLength={1} className="text-primary" stroke="currentColor" strokeWidth="1.5" d="M60 260 a260 92 0 1 0 520 0 a260 92 0 1 0 -520 0" />
              </g>
              <circle cx="238" cy="198" r="5" className="text-primary sat" fill="currentColor" />
            </g>
            <g data-enter="" className="text-primary pts" fill="currentColor">
              <rect x="146" y="318" width="8" height="8" />
              <rect x="492" y="176" width="8" height="8" />
              <rect x="316" y="56" width="8" height="8" />
            </g>
          </svg>
          <p data-enter="keep" className="absolute start-0 top-0 text-base tracking-[0.08em] readout font-heading">
            {r1}
          </p>
          <p data-enter="keep" className="absolute end-0 top-0 text-base tracking-[0.08em] readout font-heading">
            {r2}
          </p>
          <p data-enter="keep" className="absolute start-0 bottom-0 text-base tracking-[0.08em] readout font-heading">
            {r3}
          </p>
          <p data-enter="keep" className="absolute end-0 bottom-0 text-base tracking-[0.08em] readout font-heading">
            {r4}
          </p>
        </figure>
      </section>
    </div>
  )
}
