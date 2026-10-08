"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, parallax, rise, splitReveal, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { DarkZone, HeroTexture, useHeroScene, type HeroCommon } from "../_shared/hero-parts"
import { MediaImage } from "../_shared/hero-media"

// 히어로 — 바닥선을 공유하는 두 칸(P3-1 r1 B 구성 승격). 위 60%는 짙은 면(DarkZone)에 사진 한 장(media, 선택 — 없으면 짙은 면만)을 바탕색
// 가림막으로 눌러 깔고, 그 위에 치수선 도면(직접 그린 SVG)을 겹친다. 치수 글자는 바탕색 이름표 위에 앉는다(본문 대비).
// 제목 줄들(h1)은 첫 화면 아래 1/3에, 같은 바닥선 오른쪽 4/12 칸에 설명 + 대문자 외곽선 버튼.
// 모션(기본 기법 svg-draw — 세 겹):
//   등장  사진이 아래에서 열리며 가라앉고, 치수 기준선이 가운데서 양끝으로 그어지고 눈금이 가운데부터 솟는다 → 단면을 긋고 빗금이 차례로 →
//         치수 글자가 열린다(이름표 바탕은 첫 프레임부터 온전하고 글자 칸만 clip 으로 열린다 — 열리는 동안에도 글자 밑은 늘 이름표).
//         그 사이 제목 줄이 칸 안에서 올라오고 → 설명 → 버튼이 마지막.
//   스크롤 사진(가장 먼 층)은 내려앉고, 단면은 천천히, 치수 글자(가까운 층)는 조금 더 빨리 올라간다.
//   포인터 도면 위에서 세로 측정선이 포인터를 따라 가장 가까운 눈금에 붙고, 그 눈금이 길어진다(치수 글자는 hover 로 밝아진다).
export type HeroBaselineSplitCopy = {
  // 첫 화면 구역 이름(aria-label).
  label: string
  title: string
  // 보이는 제목 줄바꿈(없으면 title 한 줄). 읽기 도구는 title 한 문장을 읽는다.
  titleLines?: string[]
  lede?: string
  primaryCta: Cta
  // 도면 SVG 의 이름(role=img).
  drawingLabel: string
  dims: { width: string; height: string; section: string }
}
export type HeroBaselineSplitProps = BlockBase<HeroBaselineSplitCopy> & HeroCommon & { media?: ImageSlot }

const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const tickX = (i: number) => 120 + i * 100
const DEFAULT_TECHNIQUES = ["svg-draw"]

export function HeroBaselineSplit({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, darkScope, header, texture }: HeroBaselineSplitProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const draw = techniques.includes("svg-draw")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<SVGElement>(sel)
    // ── 등장(M1: 약 1.8초) ──
    clipReveal(s, ".field-media", { from: "bottom", at: 0, duration: s.t.enter * 1.8, ease: s.t.ease.standard })
    s.tl.from(s.root.querySelector(".field-media-e"), { scale: 1.1, transformOrigin: "50% 100%", duration: s.t.enter * 2.2, ease: s.t.ease.standard, clearProps: "transform" }, 0)
    if (draw) {
      s.tl.from(q(".base-line"), { scaleX: 0, transformOrigin: "50% 50%", duration: s.t.enter * 2, ease: s.t.ease.inScreen, clearProps: "transform" }, 0)
      // 눈금은 높이 속성으로 솟는다 — 눈금의 transform 은 hover 강조(CSS)가 쓴다.
      s.tl.from(s.q(".ticks rect"), { attr: { y: 388, height: 0 }, duration: s.t.enter, ease: s.t.ease.standard, stagger: { each: 0.035, from: "center" } }, 0.25)
      svgDraw(s, s.q(".plan > path:not(.hatch)"), { at: 0.3, duration: s.t.enter * 2.6, stagger: 0.1 })
      s.tl.from(s.q(".hatch-line"), { autoAlpha: 0, duration: s.t.enter, stagger: 0.03, clearProps: "opacity,visibility" }, 0.8)
      // 치수 글자: 이름표(p — 바탕색)는 그대로 두고 안쪽 글자 칸만 연다(P3-2 Task 3 — 열리는 중간 프레임에도 글자 밑이 이름표라 본문 대비가 떨어지지 않는다).
      clipReveal(s, s.q(".dim-text"), { from: "left", at: 0.95, duration: s.t.enter * 1.4, stagger: 0.09, ease: s.t.ease.standard })
    }
    splitReveal(s, "h1", { type: "lines", at: 0.2, stagger: 0.1 })
    rise(s, ".lede", { at: 0.5, y: 14 })
    rise(s, ".cta", { at: 0.85, y: 12 })

    // ── 스크롤: 먼 층(단면)은 느리게, 가까운 층(치수 글자)은 빠르게 ──
    parallax(s, [{ el: s.root.querySelector(".field-media-s"), y: 28 }, { el: q(".plan"), y: -22 }, { el: s.q(".dim-label"), y: -46 }])

    // ── 포인터: 세로 측정선이 가까운 눈금에 붙는다(마우스일 때만) ──
    const field = s.root.querySelector<HTMLElement>(".field")
    const cursor = q(".cursor")
    if (!field || !cursor) return
    s.pointer((ps) => {
      const p = { x: tickX(6) }
      const place = () => cursor.setAttribute("transform", `translate(${p.x.toFixed(1)} 0)`)
      const qx = gsap.quickTo(p, "x", { duration: 0.45, ease: "power3.out", onUpdate: place })
      const ticks = ps.q(".ticks rect")
      let on = -1
      const move = (e: PointerEvent) => {
        const b = field.getBoundingClientRect()
        const vx = ((e.clientX - b.left) / b.width) * 1440
        const i = Math.max(0, Math.min(12, Math.round((vx - 120) / 100)))
        qx(tickX(i))
        if (i !== on) {
          ticks[on]?.classList.remove("on")
          ticks[i]?.classList.add("on")
          on = i
        }
      }
      const enter = () => ps.add(() => gsap.to(cursor, { autoAlpha: 1, duration: ps.t.hover }))
      const leave = () => {
        ps.add(() => gsap.to(cursor, { autoAlpha: 0, duration: ps.t.hover }))
        ticks[on]?.classList.remove("on")
        on = -1
      }
      listen(ps, field, { pointermove: move, pointerenter: enter, pointerleave: leave })
      ps.onCleanup(() => {
        ticks[on]?.classList.remove("on")
        cursor.setAttribute("transform", `translate(${tickX(6)} 0)`)
      })
    })
  })
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  const dimEnter = draw ? "" : undefined // 도면 선·눈금(svg)은 그려 들어온다 — 치수 글자(p)는 LCP 후보라 첫 칠부터 보인다(data-enter="keep", 대장 C173)
  return (
    <div ref={ref} id={id} data-block="hero-baseline-split" data-hero="baseline-split" className={cn("cn-block-hero-root cn-block-hero-baseline-split", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-baseline-split-first hero-first">
        <DarkZone scope={darkScope} className="cn-block-hero-baseline-split-field field">
          {/* 사진 층: -s(스크롤 시차 — 위아래 2rem 더 깐다) → -e(등장). 가림막(바탕 60%)이 사진을 눌러 도면 선이 선다. */}
          <div aria-hidden="true" data-enter="keep" className="cn-block-hero-baseline-split-field-media field-media">
            <div className="cn-block-hero-baseline-split-field-media-s field-media-s">
              <div className="cn-block-hero-baseline-split-field-media-e field-media-e">{media ? <MediaImage locale={locale} m={media} sizes="100vw" priority /> : null}</div>
            </div>
            <div className="cn-block-hero-baseline-split-field-scrim field-scrim" />
          </div>
          <svg data-wf-art="" viewBox="0 0 1440 480" preserveAspectRatio="none" className="cn-block-hero-baseline-split-drawing" role="img" aria-label={copy.drawingLabel}>
            <g data-enter={dimEnter} className="plan" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <path pathLength={1} d="M240 120 H1200 V300 H240 Z" />
              <path pathLength={1} d="M240 120 L1200 300 M1200 120 L240 300" />
              <path pathLength={1} d="M1260 120 V300 M1245 120 H1275 M1245 300 H1275" />
              <path pathLength={1} d="M480 120 V300 M720 120 V300 M960 120 V300" />
              <g className="hatch" opacity="0.6">
                {["M240 150 L270 120", "M240 190 L310 120", "M240 230 L350 120", "M240 270 L390 120", "M250 300 L430 120", "M290 300 L470 120", "M330 300 L480 150", "M370 300 L480 190", "M410 300 L480 230"].map((d) => (
                  <path key={d} className="hatch-line" d={d} />
                ))}
              </g>
            </g>
            <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <path data-enter={dimEnter} className="base-line" d="M120 380 H1320" />
              <path d="M120 360 V400 M1320 360 V400" />
            </g>
            <g data-enter={dimEnter} className="cn-block-hero-baseline-split-ticks ticks" fill="currentColor">
              {TICKS.map((i) => (
                <rect key={i} x={tickX(i) - 0.5} y={372} width={1} height={16} />
              ))}
            </g>
            <g className="cn-block-hero-baseline-split-cursor cursor" transform={`translate(${tickX(6)} 0)`} opacity="0" aria-hidden="true">
              <path d="M0 96 V372" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            </g>
          </svg>
          <p data-enter={draw ? "keep" : undefined} className="cn-block-hero-baseline-split-dim-w dim-label font-heading">
            <span className="dim-text">{copy.dims.width}</span>
          </p>
          <p data-enter={draw ? "keep" : undefined} className="cn-block-hero-baseline-split-dim-h dim-label dim-label-v font-heading">
            <span className="dim-text">{copy.dims.height}</span>
          </p>
          <p data-enter={draw ? "keep" : undefined} className="cn-block-hero-baseline-split-dim-s dim-label font-heading">
            <span className="dim-text">{copy.dims.section}</span>
          </p>
        </DarkZone>
        <div className="cn-block-hero-baseline-split-base">
          <h1 className="cn-block-hero-baseline-split-title font-heading">
            <SplitSource label={copy.title}>
              {lines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {l}
                </React.Fragment>
              ))}
            </SplitSource>
          </h1>
          <div className="cn-block-hero-baseline-split-side">
            {copy.lede ? (
              <p data-enter="keep" className="cn-block-hero-baseline-split-lede lede">
                {copy.lede}
              </p>
            ) : null}
            <span data-enter="keep" className="cn-block-hero-baseline-split-cta cta">
              <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-baseline-split-button font-heading">
                {copy.primaryCta.label}
              </Button>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
