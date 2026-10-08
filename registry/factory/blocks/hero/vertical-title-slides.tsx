"use client"

import * as React from "react"

import type { BlockBase, MediaSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, parallax, pointerDepth } from "@/registry/factory/motion/gsap-techniques"

import { DarkZone, HeroTexture, RING, SplitChars, useHeroScene, type HeroCommon } from "../_shared/hero-parts"
import { MediaImage, MediaVideo } from "../_shared/hero-media"

// 히어로 — 전폭 저녁 그림 + 세로쓰기 한 줄 + 슬라이드 눈금(P3-1 r8 A 구성 승격). 짙은 구역(DarkZone) 첫 화면을 장면 그림 여럿(media — 겹쳐 두고 고른 것만,
// 영상은 보이는 장면일 때만 돈다)이 채우고, 가운데 세로쓰기 제목(h1) 뒤에 바탕색 안개 띠. 아래 가운데 장면 이름(aria-live)과 눈금 단추(aria-pressed).
// 모션(기본 기법 split-text·clip-reveal — M3 세 겹):
//   등장  그림이 위에서 아래로 걷히며 크게 시작해 가라앉는다 → 세로 제목 글자가 칸 안에서 차례로 → 눈금이 벌어진다(머리를 header 로 넘기면 머리의
//         .vts-book 도 내려앉는다). 장면을 바꾸면 교차 페이드(CSS).
//   스크롤 장면 층이 느리게 내려앉는다. 포인터 장면 층이 포인터 쪽으로 조금(감쇠).
export type HeroVerticalTitleSlidesCopy = {
  label: string
  title: string
  slides: string[]
  // 장면 단추 묶음 이름과 단추 이름 틀({n} = 번호, {name} = 장면 이름).
  slidesLabel: string
  slideButtonLabel: string
  defaultSlide?: number
}
export type HeroVerticalTitleSlidesProps = BlockBase<HeroVerticalTitleSlidesCopy> & HeroCommon & { media?: MediaSlot[] }

const DEFAULT_TECHNIQUES = ["split-text", "clip-reveal", "sticky-stack"]

export function HeroVerticalTitleSlides({ copy, locale, id = "hero", className, media = [], techniques = DEFAULT_TECHNIQUES, darkScope, header, texture }: HeroVerticalTitleSlidesProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [slide, setSlide] = React.useState(copy.defaultSlide ?? 0)
  const split = techniques.includes("split-text")
  const clip = techniques.includes("clip-reveal")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<Element>(sel)
    // ── 등장(M3: 약 2.4초) ──
    if (clip) clipReveal(s, ".vts-art", { from: "top", at: 0, duration: s.t.enter * 1.7, ease: s.t.ease.standard })
    s.tl.from(q(".vts-media-e"), { scale: 1.12, yPercent: -4 * s.scale.distance, transformOrigin: "50% 0%", duration: s.t.enter * 2.4, ease: s.t.ease.standard, clearProps: "transform" }, 0.05)
    if (split) s.tl.from(s.q(".vts-title .hero-ch"), { xPercent: -105, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.04, clearProps: "transform" }, 0.42)
    s.tl.from(s.q(".vts-tick > span"), { scaleX: 0, transformOrigin: "50% 50%", duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.06, clearProps: "transform" }, 1.15)
    // 머리(header)의 예약 칸이 있으면 같은 장면으로 내려앉는다.
    if (q(".vts-book")) s.tl.from(q(".vts-book"), { y: -10 * s.scale.distance, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 1.3)

    // ── 스크롤: 장면 층이 느리게 내려앉는다 ──
    parallax(s, [{ el: q(".vts-media-s"), y: 40 }])

    // ── 포인터: 장면 층이 깊이만큼 포인터 쪽으로 ──
    pointerDepth(s, q(".vts-stage"), [{ el: q(".vts-media-p"), x: 12, y: 6 }], { damping: 1 })
  })
  return (
    <div ref={ref} id={id} data-block="hero-vertical-title-slides" data-hero="vertical-title-slides" className={cn("cn-block-hero-root cn-block-hero-vertical-title-slides", className)}>
      <HeroTexture texture={texture} />
      {header}
      <DarkZone scope={darkScope} as="section" label={copy.label} className="cn-block-hero-vertical-title-slides-vts-stage vts-stage hero-first">
        {/* 장면 층: -s(스크롤 시차 — 위아래 2rem 더 깐다) → -p(포인터) → -e(등장). 장면들은 겹쳐 두고 고른 것만 보인다. */}
        <div aria-hidden="true" data-wf-art="" data-slide={slide} data-enter={clip ? "keep" : undefined} className="cn-block-hero-vertical-title-slides-vts-art vts-art">
          <div className="cn-block-hero-vertical-title-slides-vts-media-s vts-media-s">
            <div className="cn-block-hero-vertical-title-slides-vts-media-p vts-media-p">
              <div className="cn-block-hero-vertical-title-slides-vts-media-e vts-media-e">
                {media.map((m, i) => (
                  <div key={i} data-on={slide === i ? "" : undefined} className="cn-block-hero-vertical-title-slides-vts-slide vts-slide">
                    {m.kind === "video" ? <MediaVideo locale={locale} m={m} sizes="(min-width: 1024px) 130vw, 100vw" priority={i === (copy.defaultSlide ?? 0)} paused={slide !== i} /> : <MediaImage locale={locale} m={m} sizes="(min-width: 1024px) 130vw, 100vw" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="cn-block-hero-vertical-title-slides-vts-scrim vts-scrim" />
        </div>

        <h1 data-enter={split ? "keep" : undefined} className="cn-block-hero-vertical-title-slides-vts-title vts-title font-heading">
          <SplitChars text={copy.title} on={split} />
        </h1>
        <p className="cn-block-hero-vertical-title-slides-text" aria-live="polite">
          {copy.slides[slide]}
        </p>
        <div role="group" aria-label={copy.slidesLabel} data-enter="keep" className="cn-block-hero-vertical-title-slides-box-3">
          {copy.slides.map((t, i) => (
            <button key={t} type="button" aria-label={copy.slideButtonLabel.replace("{n}", String(i + 1)).replace("{name}", t)} aria-pressed={slide === i} onClick={() => setSlide(i)} className={cn("cn-block-hero-vertical-title-slides-vts-tick vts-tick", RING)}>
              <span className={cn("cn-block-hero-vertical-title-slides-span-3", slide === i ? "bg-foreground" : "bg-muted-foreground")} />
            </button>
          ))}
        </div>
      </DarkZone>
    </div>
  )
}
