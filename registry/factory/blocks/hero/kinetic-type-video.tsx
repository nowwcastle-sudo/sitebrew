"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kenBurns, kineticType, lowerThird, pointerDepth, punchIn, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { ACCENT_DELAY } from "@/registry/factory/motion/motion-scale"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge, MediaVideo } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"
import { LowerThird, type LowerThirdItem } from "../_shared/lower-third"
import { SoundToggle, useSoundToggle } from "../_shared/sound-toggle"

// 히어로 — 실사 영상 배경 + 키네틱 제목 + 로어 서드(P3-5 MOTKIT). 첫 화면 위 78%가 무대: 실사 영상(media — 소리 없는 반복, 포스터가 첫 칠·LCP)이
// 칸을 채우고 아래에서 올라오는 짙은 막(글자색의 반대 토큰 — --foreground)이 큰 제목을 받친다. 제목 아래 이름표 띠(로어 서드 — 촬영 장소·장면 이름)가 붙고,
// 무대 아래 띠에 한 문단 + 버튼 둘. 영상이 없으면 무대는 muted 면이다(같은 배치).
// 모션(움직임 키트 MOTKIT — 동작 줄이기·M0 은 정지, 화면 밖은 멈춤):
//   등장  영상 층이 크게 확대된 컷에서 제자리로 「펀치 인」 → 제목이 글자마다 칸 안에서 기울었다 서며 올라온다(키네틱) → 이름표 막대가 펼쳐지고 이름·역할이 올라온다 → 띠 문단·버튼.
//         (서버 렌더 첫 화면은 이 등장을 끝 상태로 둔다 — 제목·영상·이름표가 첫 칠부터 보인다, data-enter="keep".)
//   강조  등장 끝 + 1.6초에 제목 글자가 물결처럼 떴다 앉고(웨이브), 물결이 끝난 뒤(1.2초 뒤) 마지막 낱말이 「쿵」 한 번(펀치). 마우스면 제목·낱말에 올릴 때 다시.
//   반복  이름표가 둘 이상이면 차례로 바뀐다(이즈 인 0.55s · 머무름 4.5s · 이즈 아웃 0.35s). 영상·이름표 순환은 정지 단추로 멈춘다(WCAG 2.2.2).
//   스크롤 영상 층이 앞으로 밀려 들어오고(카메라 푸시) 제목 자간이 벌어지며 떠오른다. 포인터 영상 층이 포인터 쪽으로(깊이).
export type HeroKineticTypeVideoCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  // 이름표 띠(로어 서드) — 영상의 장소·장면·사람 이름. 둘 이상이면 차례로 바뀐다.
  captions: LowerThirdItem[]
  captionsLabel: string
  pauseLabel: string
  // 소리 켜기 단추 이름(FV1 5.7) — 영상에 소리가 있을 때만 적는다. 있고 영상이면 단추가 붙는다(기본 음소거, 사용자가 누른 뒤에만 소리).
  soundLabel?: string
}
export type HeroKineticTypeVideoProps = BlockBase<HeroKineticTypeVideoCopy> & HeroCommon & HeroDisplay & { media?: VideoSlot | ImageSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "punch-in", "lower-third"]

// 마지막 낱말(강조 펀치 대상)과 그 앞.
const splitLast = (t: string) => {
  const i = t.trimEnd().lastIndexOf(" ")
  return i < 0 ? ["", t] : [t.slice(0, i + 1), t.slice(i + 1)]
}

export function HeroKineticTypeVideo({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroKineticTypeVideoProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { paused, toggle, rootProps } = useLoopPause()
  const sound = useSoundToggle(ref)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    if (techniques.includes("punch-in")) punchIn(s, q(".kt-media-k"), { kind: "media", at: 0 })
    kineticType(s, q(".kt-title"), { mode: "rise", by: "chars", at: 0.12 })
    if (techniques.includes("lower-third")) lowerThird(s, q("[data-lt]"), { at: 0.75 })
    kenBurns(s, q(".kt-media-k"))
    rise(s, s.q(".kt-band > *"), { at: 0.55, y: 16, stagger: 0.08 })
    // ── 강조(등장 뒤 — 글을 숨기지 않는다) ──
    kineticType(s, q(".kt-title"), { mode: "wave" })
    if (techniques.includes("punch-in")) punchIn(s, ".kt-title .kw", { mode: "accent", delay: ACCENT_DELAY + 1.2 }) // 물결(최대 약 1.1초)이 끝나 쪼갠 것을 되돌린 뒤 — 같은 낱말 요소를 두 기법이 함께 쥐지 않는다
    // ── 스크롤: 카메라 푸시 + 제목 자간 ──
    const tl = scrubTimeline(s)
    tl.to(q(".kt-media-s"), { scale: 1 + 0.1 * s.scale.depth, yPercent: 5 * s.scale.depth }, 0)
    tl.to(q(".kt-title"), { letterSpacing: `${0.04 * s.scale.distance}em`, yPercent: -14 * s.scale.distance }, 0)
    // ── 포인터: 영상 층 깊이 ──
    pointerDepth(s, q(".kt-stage"), [{ el: q(".kt-media-p"), x: 14, y: 8 }], { damping: 0.9 })
  })
  const [head, last] = splitLast(copy.title)
  const titleBody = (
    <SplitSource label={copy.title}>
      {head}
      <span className="kw">{last}</span>
    </SplitSource>
  )
  const moving = !!media || copy.captions.length > 1 // 영상·한 장 켄 번스·이름표 순환 — 5초 넘게 스스로 움직이는 것이 있으면 정지 단추
  return (
    <div ref={ref} id={id} data-block="hero-kinetic-type-video" data-hero="kinetic-type-video" {...rootProps} className={cn("cn-block-hero-root cn-block-hero-kinetic-type-video", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-kinetic-type-video-first hero-first">
        <div className="cn-block-hero-kinetic-type-video-stage kt-stage">
          {/* 무대 그림(장식 — 영상 속 글자는 없다). 첫 칠·LCP 는 포스터. 서버 렌더 첫 화면에서는 펀치 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden="true" data-enter="keep" className="cn-block-hero-kinetic-type-video-media">
            <div className="cn-block-hero-kinetic-type-video-media-s kt-media-s">
              <div className="cn-block-hero-kinetic-type-video-media-p kt-media-p">
                <div className="cn-block-hero-kinetic-type-video-media-k kt-media-k">
                  {media?.kind === "video" ? (
                    <MediaVideo locale={locale} m={media} sizes="100vw" priority paused={paused} badge={false} />
                  ) : media ? (
                    // 사진만 받았으면 한 장 켄 번스(느린 확대·팬 왕복 — 유휴 반복이라 M2~M3·정지 단추)로 무대를 살린다.
                    <div data-kb-slide="" className="cn-block-hero-kinetic-type-video-kb">
                      <div className="cn-block-hero-kinetic-type-video-kb-img kb-img">
                        <MediaImage locale={locale} m={media} sizes="100vw" priority badge={false} />
                      </div>
                    </div>
                  ) : (
                    <span className="cn-block-hero-kinetic-type-video-fallback" />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="cn-block-hero-kinetic-type-video-scrim" />
          {/* 미리보기 전용 표지 — 확대·이동하는 영상 층 밖(무대 기준)에 둔다(층 안이면 같이 커져 잘린다). 공개본에는 값이 없어 그려지지 않는다. */}
          <MediaPreviewBadge m={media} />
          {Display ? (
            <Display as="h1" className="cn-block-hero-kinetic-type-video-display kt-title">
              {titleBody}
            </Display>
          ) : (
            <h1 className="cn-block-hero-kinetic-type-video-title kt-title font-heading">{titleBody}</h1>
          )}
          <LowerThird items={copy.captions} label={copy.captionsLabel} keep className="cn-block-hero-kinetic-type-video-lower" />
          {moving ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="cn-block-hero-kinetic-type-video-pause" /> : null}
          {media?.kind === "video" && copy.soundLabel ? <SoundToggle on={sound.on} onToggle={sound.toggle} label={copy.soundLabel} className="cn-block-hero-kinetic-type-video-sound" /> : null}
        </div>
        <div data-enter="keep" className="cn-block-hero-kinetic-type-video-band kt-band">
          <p className="cn-block-hero-kinetic-type-video-lede">{copy.lede}</p>
          <div className="cn-block-hero-kinetic-type-video-ctas">
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
      </section>
    </div>
  )
}
