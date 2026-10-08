"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, oversizeCrop, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { MediaImage } from "../_shared/hero-media"

// 히어로 — 문장 속 칩 + 대괄호 캡션 대칭(P3-1 r2 B 구성 승격). 주사선 바탕 위 가운데 판(면 faces[0], 없으면 선)에 픽셀 송신탑(위·아래 거울),
// 대괄호 캡션 두 줄 사이에 세 줄 제목(h1): 첫 줄 낱말 사이에 사진 칩(media, 선택 — 없으면 주색 칩), 둘째 줄 낱말 사이에 별표. 판 아래 버튼 둘,
// 바닥에 크게 잘린 한 낱말(기법 oversize-crop).
// 모션(기본 기법 split-text·oversize-crop — M1 세 겹):
//   등장  판이 가운데서 좌우로 열리고 송신탑 칸이 위에서부터 켜진다 → 캡션이 열리고 낱말이 칸 안에서 올라온다 → 칩이 옆으로 늘어나고 별표가 돌아 앉는다 →
//         잘린 낱말이 올라오고 버튼이 마지막.
//   스크롤 잘린 낱말이 흐르고 두 탑이 벌어진다, 칩 사진 초점이 옆으로 흐른다. 포인터 별표가 포인터 쪽으로 돌고 칩 사진이 포인터를 따라간다.
export type HeroInlineChipTitleCopy = {
  label: string
  captionTop: string
  captionBottom: string
  // 읽기 도구가 읽는 제목 한 문장.
  title: string
  // 보이는 세 줄: [chipBefore 칩 chipAfter] / [starBefore ★ starAfter] / [last]
  lines: { chipBefore: string; chipAfter: string; starBefore: string; starAfter: string; last: string }
  primaryCta: Cta
  secondaryCta?: Cta
  // 바닥에 크게 잘린 장식 낱말(oversize-crop 일 때만).
  cropWord?: string
}
export type HeroInlineChipTitleProps = BlockBase<HeroInlineChipTitleCopy> & HeroCommon & HeroDisplay & { media?: ImageSlot }

const DEFAULT_TECHNIQUES = ["split-text", "oversize-crop"]
// 픽셀 장식(직접 그림 — 송신탑과 전파). 제목 위에 하나, 아래에 거울로 하나. 색은 레시피 원래 주색(면 스코프를 되돌린 칸).
const PIX = ["......X......", "..X...X...X..", ".X...XXX...X.", "X...X.X.X...X", ".X..X.X.X..X.", "....X.X.X....", "...XXXXXXX..."]
function Pixels({ flip = false }: { flip?: boolean }) {
  return (
    <span data-face-reset="" className={cn("cn-block-hero-inline-chip-title-span", flip ? "tower-b" : "tower-a")}>
      <svg viewBox="0 0 13 7" className={cn("cn-block-hero-inline-chip-title-svg", flip && "-scale-y-100")} aria-hidden="true">
        {PIX.flatMap((row, y) => [...row].map((c, x) => (c === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="currentColor" /> : null)))}
      </svg>
    </span>
  )
}

// 낱말 하나 = 자르는 칸(.hero-mask) 안의 조각. 읽기 도구는 h1 의 sr-only 원문을 읽는다.
function Word({ w }: { w: string }) {
  return (
    <span aria-hidden="true" className="hero-mask">
      <span className="cn-block-hero-inline-chip-title-word word">{w}</span>
    </span>
  )
}

export function HeroInlineChipTitle({ copy, locale, id = "hero", className, media, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroInlineChipTitleProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const split = techniques.includes("split-text")
  const words = (s: string) =>
    s.split(" ").map((w, i) => (
      <React.Fragment key={i}>
        {i > 0 && " "}
        <Word w={w} />
      </React.Fragment>
    ))
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M1: 약 1.6초) ──
    clipReveal(s, ".panel", { from: "center-x", at: 0, duration: s.t.enter * 1.8 })
    s.tl.from(s.q(".tower-a rect"), { autoAlpha: 0, duration: 0.12, stagger: { each: 0.018, from: "end" }, ease: "none", clearProps: "opacity,visibility" }, 0.2)
    s.tl.from(s.q(".tower-b rect"), { autoAlpha: 0, duration: 0.12, stagger: { each: 0.018, from: "end" }, ease: "none", clearProps: "opacity,visibility" }, 0.2)
    clipReveal(s, s.q(".caption"), { from: "left", at: 0.3, duration: s.t.enter * 1.6, stagger: 0.1, ease: s.t.ease.standard })
    if (split) s.tl.from(s.q(".word"), { yPercent: 110, duration: s.t.enter * 1.4, ease: s.t.ease.emphasized, stagger: 0.06 * s.scale.stagger, clearProps: "transform" }, 0.3)
    s.tl.from(q(".chip"), { scaleX: 0.12, transformOrigin: "0% 50%", duration: s.t.enter * 1.6, ease: s.t.ease.emphasized, clearProps: "transform" }, 0.45)
    s.tl.from(q(".star"), { rotation: -140, scale: 0.5, autoAlpha: 0, transformOrigin: "50% 50%", duration: s.t.enter * 2, ease: s.t.ease.standard, clearProps: "opacity,visibility" }, 0.6)
    rise(s, ".crop-word", { at: 0.55, y: 60, duration: s.t.enter * 2.4 })
    rise(s, s.q(".ctas > *"), { at: 0.9, y: 14, stagger: 0.08 })

    // ── 스크롤: 잘린 낱말이 흐르고 두 탑이 벌어진다 ──
    const crop = q(".crop-text")
    if (crop) oversizeCrop(s, crop, { from: 0, to: -14 })
    const sc = scrubTimeline(s)
    sc.to(q(".tower-a"), { y: -14 * s.scale.distance }, 0).to(q(".tower-b"), { y: 14 * s.scale.distance }, 0)
    const chip = q(".chip")
    const stripe = { x: 0 }
    const point = { v: 0 }
    const paintStripe = () => chip && chip.style.setProperty("--chip-x", `${stripe.x.toFixed(1)}px`)
    const band = { v: 0 }
    sc.fromTo(band, { v: 0 }, { v: 36, onUpdate: () => { stripe.x = band.v + point.v; paintStripe() } }, 0)

    // ── 포인터: 별표가 포인터 쪽으로 돌고, 사진 초점이 포인터를 따라간다 ──
    s.onCleanup(() => { if (chip) chip.style.removeProperty("--chip-x") })
    const panel = q(".panel")
    const star = q(".star")
    if (!panel || !star) return
    s.pointer((ps) => {
      const rot = gsap.quickTo(star, "rotation", { duration: 0.6, ease: "power3.out" })
      const px = gsap.quickTo(point, "v", { duration: 0.6, ease: "power3.out", onUpdate: () => { stripe.x = band.v + point.v; paintStripe() } })
      const move = (e: PointerEvent) => {
        const b = star.getBoundingClientRect()
        const p = panel.getBoundingClientRect()
        rot((Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI + 90)
        px(((e.clientX - p.left) / p.width - 0.5) * 48)
      }
      listen(ps, panel, { pointermove: move, pointerleave: () => { rot(0); px(0) } })
      ps.onCleanup(() => { point.v = 0; stripe.x = band.v; paintStripe() })
    })
  })
  const l = copy.lines
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <span className="cn-block-hero-inline-chip-title-span-2">{copy.title}</span>
      {words(l.chipBefore)}{" "}
      <span data-face-reset="" className="cn-block-hero-inline-chip-title-chip chip" aria-hidden="true">
        {media ? <MediaImage locale={locale} m={media} sizes="8rem" /> : null}
      </span>{" "}
      {words(l.chipAfter)}
      <br />
      {words(l.starBefore)}{" "}
      <svg viewBox="0 0 24 24" className="cn-block-hero-inline-chip-title-star star" aria-hidden="true">
        <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill="currentColor" />
      </svg>{" "}
      {words(l.starAfter)}
      <br />
      {words(l.last)}
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-inline-chip-title" data-hero="inline-chip-title" className={cn("cn-block-hero-root cn-block-hero-inline-chip-title scanlines", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-inline-chip-title-h-first hero-first">
        <Face k={k} fallback="" enter="keep" className="cn-block-hero-inline-chip-title-panel panel">
          <Pixels />
          <p className="cn-block-hero-inline-chip-title-caption caption">{copy.captionTop}</p>
          {Display ? (
            <Display as="h1" data-wf-art="" className="cn-block-hero-inline-chip-title-display">
              {titleBody}
            </Display>
          ) : (
            <h1 data-wf-art="" className="cn-block-hero-inline-chip-title-title font-heading">
              {titleBody}
            </h1>
          )}
          <p className="cn-block-hero-inline-chip-title-caption-2 caption">{copy.captionBottom}</p>
          <Pixels flip />
        </Face>
        <div data-enter="keep" className="cn-block-hero-inline-chip-title-ctas ctas">
          <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
            {copy.primaryCta.label}
          </Button>
          {copy.secondaryCta ? (
            <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />}>
              {copy.secondaryCta.label}
            </Button>
          ) : null}
        </div>
        {techniques.includes("oversize-crop") && copy.cropWord ? (
          <div aria-hidden="true" data-enter="keep" className="cn-block-hero-inline-chip-title-crop-word crop-word">
            <span className="cn-block-hero-inline-chip-title-span-3 crop-text font-heading">{copy.cropWord}</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}
