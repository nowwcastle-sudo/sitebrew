"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, parallax, pointerDepth, rise } from "@/registry/factory/motion/gsap-techniques"

import { HeroTexture, RING, SplitChars, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { Media } from "../_shared/hero-media"
import { titleFit } from "../_shared/title-fit"

// 히어로 — 보이는 12칸 세로선 + 바닥에 걸친 응축 한 낱말(P3-1 r8 B 구성 승격). 전폭 그림(media, 선택 — 저녁 숲 영상 등) 위에 12칸 격자 세로선을 그대로 보인다.
// 한 낱말 제목(h1, 응축 대문자 17.8vw)은 가운데 정렬로 화면 아래 끝에 걸친다 — 면(field-1)에서 번지는 아래 가림막이 받친다. 왼쪽 캡션 두 줄,
// 오른쪽 위아래 1px 선 사이 링크 하나(▶) — 둘 다 가운데 높이의 바탕색 안개 띠 위에 앉아 그림이 어느 프레임이어도 본문 대비를 지킨다.
// 배치(대장 C296): 위 칸(gw-top — 세로선·캡션·링크)과 제목이 세로로 쌓인다(흐름 안). 제목이 길어 줄이 늘면 첫 화면이 그만큼 커질 뿐 캡션과 겹치지 않는다.
// 제목이 설계 폭(DESIGN_VW)에 한 줄로 안 들어가면 글자 크기를 줄이고(최대 3줄까지 나눈다 — _shared/title-fit) 낱말은 가운데서 끊지 않는다. 짧은 낱말은 설계 크기 그대로.
// 이 블록의 제목 길이 상한(titleMaxUnits 메타)을 넘는 제목은 찍어내기가 같은 섹션의 다른 변형으로 바꾼다(06-pages 폴백) — 줄여 맞추기는 그 뒤의 안전망이다.
// 모션(기본 기법 split-text·clip-reveal — M3 세 겹):
//   등장  그림이 아래에서 위로 걷히고 그 안에서 크게 시작해 가라앉는다 → 12칸 세로선이 가운데부터 위에서 내려온다 →
//         한 낱말을 글자로 쪼개 마스크 안에서 한 자씩 올린다 → 캡션이 왼쪽에서 열리고 → 링크가 마지막.
//   스크롤 그림 층이 느리게 내려앉고, 캡션·링크는 조금 먼저 올라간다. 포인터 그림 층이 포인터 쪽으로 조금(깊이, 감쇠).
export type HeroGridLinesBaselineWordCopy = {
  label: string
  // 한 낱말 제목(짧을수록 좋다 — 17.8vw 한 줄).
  title: string
  captionLines: string[]
  // 선 사이 링크(▶) — P3-1 의 죽은 버튼 「숲 소리 듣기」를 실제 링크로 바꿨다.
  filmCta: Cta
}
export type HeroGridLinesBaselineWordProps = BlockBase<HeroGridLinesBaselineWordCopy> & HeroCommon & HeroDisplay & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["split-text", "clip-reveal", "sticky-stack"]
// 제목 설계 크기(vw) — base.css 의 gw-word 훅 text-[17.8vw] 와 같은 값이다(블록 메타 titleMaxUnits 가 여기서 나온다 — maxTitleUnits(17.8) = 5.3).
const DESIGN_VW = 17.8

export function HeroGridLinesBaselineWord({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroGridLinesBaselineWordProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const split = techniques.includes("split-text")
  const clip = techniques.includes("clip-reveal")
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<Element>(sel)
    // ── 등장(M3: 약 2.3초) ──
    // 그림 걷기는 빠르게 시작하는 곡선 — 글자가 올라올 때(0.45초~) 그 높이의 숲(면)이 이미 드러나 있어야 글자 대비가 선다.
    if (clip) clipReveal(s, ".gw-art", { from: "bottom", at: 0, duration: s.t.enter * 1.7, ease: s.t.ease.standard })
    s.tl.from(q(".gw-media-e"), { scale: 1.12, yPercent: 5 * s.scale.distance, transformOrigin: "50% 100%", duration: s.t.enter * 2.2, ease: s.t.ease.standard, clearProps: "transform" }, 0.05)
    s.tl.from(s.q(".gw-cols > span"), { scaleY: 0, transformOrigin: "50% 0%", duration: s.t.enter * 1.2, ease: s.t.ease.inScreen, stagger: { each: 0.03, from: "center" }, clearProps: "transform" }, 0.2)
    // 시작 135%: 행간 0.8 이라 글자가 줄 칸 위로 넘치고 마스크 여유(0.12em)도 있어, 105%에서는 글자 머리가 칸 아래로 비쳐 보였다.
    if (split) s.tl.from(s.q(".gw-word .hero-ch"), { yPercent: 135, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.04, clearProps: "transform" }, 0.45)
    clipReveal(s, ".gw-caption", { from: "left", at: 0.9, duration: s.t.enter * 1.4, ease: s.t.ease.standard })
    rise(s, ".gw-film", { at: 1.2, y: 14 })

    // ── 스크롤: 먼 층일수록 느리게 — 숲에 깊이 ──
    parallax(s, [{ el: q(".gw-media-s"), y: 40 }, { el: q(".gw-caption-s"), y: -20 }, { el: q(".gw-film-s"), y: -28 }])

    // ── 포인터: 그림 층이 깊이만큼 포인터 쪽으로 ──
    pointerDepth(s, q(".gw"), [{ el: q(".gw-media-p"), x: 14, y: 6 }], { damping: 1 })
  })
  // 안전망: 어림(titleFit)이 서체와 어긋나 가장 긴 낱말(글자 쪼개기 낱말 칸 — inline-block nowrap)이 글 칸 폭을 넘으면 글자 크기를 그만큼 줄인다.
  // D2·D3(display) 제목도 같다. 크기를 바꾸는 것은 이 칸의 인라인 font-size 하나이고, 칸 폭이 바뀌면(리사이즈·서체 로드) 처음부터 다시 잰다.
  React.useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(".gw-word")
    if (!el) return
    const guard = () => {
      el.style.removeProperty("font-size")
      const cs = getComputedStyle(el)
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      let widest = 0
      el.querySelectorAll<HTMLElement>("span.inline-block").forEach((w) => {
        widest = Math.max(widest, w.offsetWidth)
      })
      if (room > 0 && widest > room + 1) el.style.fontSize = `${(parseFloat(cs.fontSize) * room) / widest}px`
    }
    guard()
    // 칸 폭이 바뀔 때(리사이즈)와 낱말 칸 폭이 바뀔 때(서체가 늦게 도착해 글자 폭이 달라질 때)마다 다시 잰다 — 같은 값이면 더 바꾸지 않아 끝난다.
    const ro = new ResizeObserver(guard)
    ro.observe(el)
    el.querySelectorAll<HTMLElement>("span.inline-block").forEach((w) => ro.observe(w))
    void document.fonts?.ready.then(guard)
    return () => ro.disconnect()
  }, [copy.title, split, Display])
  // 제목 크기 맞추기: 설계 폭에 안 들어가는 긴 제목만 줄인다(인라인 변수 --gw-size — 훅의 font-size 가 이 값과 설계 크기 중 작은 쪽).
  const fit = titleFit(copy.title, DESIGN_VW)
  // 두 줄 이상이면 행간을 0.8 에서 1 로 벌린다(한글 글자 높이가 0.8em 을 넘어 윗줄·아랫줄 글자가 맞물린다). 한 줄(설계 의도)은 0.8 그대로.
  const fitStyle = { "--gw-size": `${fit.vw}vw`, "--gw-lead": fit.lines > 1 ? "1" : "0.8" } as React.CSSProperties
  // 제목 내용 — D2·D3 레시피면 조립하는 쪽이 넘긴 DisplayTitle 이 h1 이 된다(크기·행간·자간은 D 값, 자리·색은 -display 훅).
  const titleBody = (
    <>
      <SplitChars text={copy.title} on={split} />
    </>
  )
  return (
    <div ref={ref} id={id} data-block="hero-grid-lines-baseline-word" data-hero="grid-lines-baseline-word" className={cn("cn-block-hero-root cn-block-hero-grid-lines-baseline-word", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} data-wf-art="" className="cn-block-hero-grid-lines-baseline-word-gw gw hero-first">
        {/* 그림 층: -s(스크롤 시차 — 위아래 2rem 더 깐다) → -p(포인터) → -e(등장). 가림막은 그림 위, 글자 아래. */}
        <div aria-hidden="true" data-enter={clip ? "keep" : undefined} className="cn-block-hero-grid-lines-baseline-word-gw-art gw-art">
          <div className="cn-block-hero-grid-lines-baseline-word-gw-media-s gw-media-s">
            <div className="cn-block-hero-grid-lines-baseline-word-gw-media-p gw-media-p">
              <div className="cn-block-hero-grid-lines-baseline-word-gw-media-e gw-media-e">{media ? <Media locale={locale} m={media} sizes="100vw" priority /> : null}</div>
            </div>
          </div>
          <div className="cn-block-hero-grid-lines-baseline-word-gw-scrim gw-scrim" />
        </div>
        {/* 위 칸: 세로선은 이 칸 안에서 위에서 내려와 제목의 윗줄에 내려앉는다(글자 칸을 가로지르지 않는다). 캡션·링크는 이 칸 안에 흐름대로 앉아 제목과 겹치지 않는다. */}
        <div className="cn-block-hero-grid-lines-baseline-word-gw-top gw-top">
          <div aria-hidden="true" data-enter="keep" className="cn-block-hero-grid-lines-baseline-word-gw-cols gw-cols">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={cn("cn-block-hero-grid-lines-baseline-word-col", i >= 8 && "hidden md:block")} />
            ))}
          </div>

          <div className="cn-block-hero-grid-lines-baseline-word-gw-caption-s gw-caption-s">
            <p data-enter="keep" className="cn-block-hero-grid-lines-baseline-word-gw-caption gw-caption font-heading">
              {copy.captionLines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {l}
                </React.Fragment>
              ))}
            </p>
          </div>
          <div className="cn-block-hero-grid-lines-baseline-word-gw-film-s gw-film-s">
            <div data-enter="keep" className="cn-block-hero-grid-lines-baseline-word-gw-film gw-film">
              <a href={copy.filmCta.href} className={cn("cn-block-hero-grid-lines-baseline-word-btn", RING)}>
                {copy.filmCta.label}
                <svg viewBox="0 0 10 12" aria-hidden="true" className="cn-block-hero-grid-lines-baseline-word-gw-play gw-play">
                  <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {Display ? (
          <Display as="h1" data-enter={split ? "keep" : undefined} className="cn-block-hero-grid-lines-baseline-word-display gw-word">
            {titleBody}
          </Display>
        ) : (
          <h1 data-enter={split ? "keep" : undefined} data-fit-lines={fit.lines} style={fitStyle} className="cn-block-hero-grid-lines-baseline-word-gw-word gw-word font-heading">
            {titleBody}
          </h1>
        )}
      </section>
    </div>
  )
}
