"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, parallax, pointerDepth, rise, splitReveal, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, reseed, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { Media } from "../_shared/hero-media"

// 히어로 — 엇갈린 두 줄 + 가운데 타원 액자(P3-1 r3 A 구성 승격). 제목(h1)을 두 줄로 쪼개 첫 줄은 왼쪽 2/12에서, 둘째 줄은 오른쪽 끝에 맞추고,
// 두 줄 사이 가운데에 이중 테두리 타원 액자(안은 media — 선택, 없으면 면 faces[1]). 좌우 끝에 칸 색 잎 실루엣을 화면 밖으로 잘라 걸친다. 첫 화면 면은 faces[2].
// 모션(기본 기법 grain·clip-reveal — M2 세 겹):
//   등장  첫 줄 낱말이 칸 안에서 올라오고 → 타원이 가운데서 둥글게 열리며 안의 그림이 크게 시작해 가라앉는다 →
//         둘째 줄 → 양쪽 가지가 줄기부터 그어지고 잎이 아래에서 위로 돋는다 → 버튼 둘이 마지막.
//   스크롤 두 가지가 서로 다른 깊이로 올라가고(왼쪽이 가깝다), 타원 안에서 그림이 조금 가라앉는다. 포인터 타원 위에서 그림이 포인터 쪽으로.
//   그레인은 타원 hover 에 씨앗을 한 번 바꾼다(160ms). 유휴(M2) 잎 가지가 밑동을 축으로 아주 느리게 흔들린다(±1.5°).
export type HeroStaggeredOvalFrameCopy = {
  label: string
  // 두 줄 제목 — 읽기 도구는 두 줄을 이어 한 문장으로 읽는다.
  titleLines: [string, string]
  primaryCta: Cta
  secondaryCta?: Cta
}
export type HeroStaggeredOvalFrameProps = BlockBase<HeroStaggeredOvalFrameCopy> & HeroCommon & HeroDisplay & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["grain", "clip-reveal"]
const LEAVES = [
  { y: 560, r: -38 },
  { y: 510, r: 30 },
  { y: 460, r: -44 },
  { y: 410, r: 36 },
  { y: 360, r: -40 },
  { y: 310, r: 28 },
  { y: 260, r: -46 },
  { y: 210, r: 34 },
  { y: 160, r: -38 },
  { y: 110, r: 30 },
  { y: 70, r: -30 },
]

// 가지 = 자리 잡는 div(GSAP 시차·흔들림이 쓴다) + 안의 svg(뒤집기는 svg 가 들고 있다 — GSAP 이 transform 을 합치면 흔들림 회전이 뒤집기를 덮는다).
function Branch({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <div aria-hidden="true" data-enter="" className={className}>
      <svg viewBox="0 0 220 620" className={cn("cn-block-hero-staggered-oval-frame-svg", flip && "-scale-x-100")}>
        <path className="stem" d="M110 620 C 96 470, 124 300, 108 40" fill="none" stroke="currentColor" strokeWidth="6" />
        {LEAVES.map((l) => (
          <g key={l.y} transform={`translate(110 ${l.y}) rotate(${l.r > 0 ? -l.r : 180 + l.r})`}>
            <path className="leaf" d="M0 0 C 34 -26, 84 -26, 118 0 C 84 26, 34 26, 0 0 Z" fill="currentColor" />
          </g>
        ))}
      </svg>
    </div>
  )
}

export function HeroStaggeredOvalFrame({ copy, locale, id = "hero", className, media, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroStaggeredOvalFrameProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const grain = techniques.includes("grain")
  const clip = techniques.includes("clip-reveal")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M2: 약 2.3초) ──
    splitReveal(s, ".line-1", { type: "words", at: 0, stagger: 0.07 })
    if (clip) clipReveal(s, ".oval", { from: "ellipse", at: 0.15, duration: s.t.enter * 1.8, ease: s.t.ease.standard })
    s.tl.from(q(".oval-media-e"), { scale: 1.18, duration: s.t.enter * 2.2, ease: s.t.ease.standard, clearProps: "transform" }, 0.2)
    splitReveal(s, ".line-2", { type: "words", at: 0.45, stagger: 0.07 })
    for (const [n, b] of s.q(".branch").entries()) {
      svgDraw(s, b.querySelector(".stem"), { at: 0.5 + n * 0.12, duration: s.t.enter * 1.6, ease: s.t.ease.standard })
      s.tl.from(b.querySelectorAll(".leaf"), { scale: 0.4, autoAlpha: 0, transformOrigin: "0% 50%", duration: s.t.enter, ease: "back.out(1.6)", stagger: { each: 0.045, from: "start" }, clearProps: "transform,opacity,visibility" }, 0.6 + n * 0.12)
    }
    rise(s, s.q(".ctas > *"), { at: 1.25, y: 16, stagger: 0.08 })

    // ── 스크롤: 목판 층 사이 시차 ──
    parallax(s, [
      { el: q(".branch-l"), y: -70 },
      { el: q(".branch-r"), y: -34 },
      { el: q(".oval-media-s"), y: 18 },
      { el: q(".line-1"), x: -18 },
      { el: q(".line-2"), x: 18 },
    ])

    // ── 포인터: 그림이 포인터 쪽으로 + 그레인 다시 찍힘 ──
    pointerDepth(s, q(".oval-wrap"), [{ el: q(".oval-media-p"), x: 14, y: 6 }])
    const wrap = q(".oval-wrap")
    const first = q(".first")
    if (grain && wrap && first) s.pointer((ps) => listen(ps, wrap, { pointerenter: () => void reseed(first) }))

    // ── 유휴(M2~M3): 가지 흔들림 ──
    s.q(".branch").forEach((b, i) =>
      s.loop(() => gsap.fromTo(b, { rotation: -1.5 * s.scale.rotate }, { rotation: 1.5 * s.scale.rotate, transformOrigin: "50% 100%", duration: 3.2 + i * 0.7, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.4 })),
    )
  })
  const [l1, l2] = copy.titleLines
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <span className="cn-block-hero-staggered-oval-frame-line-1 line-1">
        <SplitSource label={l1}>{l1}</SplitSource>
      </span>
      <span className="cn-block-hero-staggered-oval-frame-span"> </span>
      <span aria-hidden="true" data-wf-art="" className="cn-block-hero-staggered-oval-frame-oval-wrap oval-wrap">
        <Face k={faceAt(faces, 1)} fallback="bg-accent" as="span" enter="keep" className="cn-block-hero-staggered-oval-frame-oval oval">
          {/* 그림 겹: -s(스크롤) → -p(포인터) → -e(등장). 그림은 타원보다 조금 크게 깔려 움직여도 가장자리가 비지 않는다. */}
          <span className="cn-block-hero-staggered-oval-frame-oval-media-s oval-media-s">
            <span className="cn-block-hero-staggered-oval-frame-oval-media-p oval-media-p">
              <span className="cn-block-hero-staggered-oval-frame-oval-media-e oval-media-e">{media ? <Media locale={locale} m={media} sizes="(max-width: 767px) 80vw, 45vw" priority /> : null}</span>
            </span>
          </span>
        </Face>
      </span>
      <span className="cn-block-hero-staggered-oval-frame-line-2 line-2">
        <SplitSource label={l2}>{l2}</SplitSource>
      </span>
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-staggered-oval-frame" data-hero="staggered-oval-frame" className={cn("cn-block-hero-root cn-block-hero-staggered-oval-frame", className)}>
      <HeroTexture texture={texture} />
      {header}
      <Face k={faceAt(faces, 2)} fallback="bg-muted" as="section" label={copy.label} grain={grain} className="cn-block-hero-staggered-oval-frame-h-first cn-block-hero-grain first hero-first">
        <Branch className="cn-block-hero-staggered-oval-frame-branch branch branch-l" />
        <Branch className="cn-block-hero-staggered-oval-frame-branch-2 branch branch-r" flip />
        {Display ? (
          <Display as="h1" className="cn-block-hero-staggered-oval-frame-display">
            {titleBody}
          </Display>
        ) : (
          <h1 className="cn-block-hero-staggered-oval-frame-title font-heading">
            {titleBody}
          </h1>
        )}
        <div data-enter="keep" className="cn-block-hero-staggered-oval-frame-ctas ctas">
          <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
            {copy.primaryCta.label}
          </Button>
          {copy.secondaryCta ? (
            <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />}>
              {copy.secondaryCta.label}
            </Button>
          ) : null}
        </div>
      </Face>
    </div>
  )
}
