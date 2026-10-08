"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kineticType, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge, MediaVideo } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"
import { SoundToggle, useSoundToggle } from "../_shared/sound-toggle"

// 히어로 — 영상 몽타주(FV1 Task 5.7). 첫 화면 위 78% 무대에서 짧은 컷(영상 클립 또는 사진, 합쳐서 ≤ 3 MB)이 **하드 컷**으로 이어진다(페이드 없이 바로 바뀐다 — 몽타주의 박자).
// 첫 칠(LCP)은 첫 컷의 포스터 그림 하나뿐이다 — 나머지 컷은 다음 차례가 되기 한 컷 앞에서야 포스터를 받고, 영상은 preload none 이라 켜진 컷만 내려받아 돈다. 큰 제목은 글자색의 반대 토큰(--foreground) 막 위에 얹는다.
// 소리: 영상은 늘 음소거(muted)로 시작한다. 클립에 소리가 있으면(copy.soundLabel) 「소리 켜기」 단추가 붙고, 사용자가 누른 뒤에만 켜진 컷의 소리가 난다(_shared/sound-toggle). 컷 전환은 5초 넘게 도는 움직임이라 정지 단추(_shared/loop-pause)가 늘 함께 붙는다.
// 컷 간격 3.2초, 화면 밖에서는 멈춘다. 모션: 등장 제목 낱말이 올라온다 → 띠 문단·버튼. 스크롤 무대가 앞으로 밀려 들어온다.
//   동작 줄이기(prefers-reduced-motion)·M0 : **첫 컷 포스터 그림만** 그린다 — 영상 요소도 컷 전환도 소리·정지 단추도 없다. 글은 숨기지 않는다.
export type HeroVideoMontageCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  pauseLabel: string
  // 소리 켜기 단추 이름 — 클립에 소리가 있을 때만 적는다(05 의 Pexels 영상은 소리가 없다).
  soundLabel?: string
}
type Cut = VideoSlot | ImageSlot
export type HeroVideoMontageProps = BlockBase<HeroVideoMontageCopy> &
  HeroCommon &
  HeroDisplay & {
    clips?: Cut[]
    // 05-media 가 칸 하나에 한 컷을 잇는 길(site-media wireMedia) — clips 가 없을 때 한 컷 몽타주로 읽는다.
    media?: Cut
  }

const DEFAULT_TECHNIQUES = ["kinetic-type"]
const CUT_MS = 3200

const posterOf = (c: Cut): ImageSlot => (c.kind === "video" ? c.poster : c)

export function HeroVideoMontage({ copy, locale, id = "hero", className, clips, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroVideoMontageProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { paused, toggle, rootProps } = useLoopPause()
  const [index, setIndex] = React.useState(0)
  const [inView, setInView] = React.useState(true)
  const cuts = clips?.length ? clips : media ? [media] : []
  const n = cuts.length
  const sound = useSoundToggle(ref, index)
  const hasVideo = cuts.some((c) => c.kind === "video")
  const moving = !reduced && (n > 1 || hasVideo)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".vm-title"), { mode: "rise", by: "words", at: 0.1 })
    rise(s, s.q(".vm-band > *"), { at: 0.5, y: 16, stagger: 0.08 })
    // ── 스크롤: 무대가 앞으로 밀려 들어온다 ──
    const tl = scrubTimeline(s)
    tl.to(q(".vm-stage-s"), { scale: 1 + 0.08 * s.scale.depth }, 0)
  })
  // 컷 전환: 정지 단추·동작 줄이기·화면 밖에서는 멈춘다.
  React.useEffect(() => {
    if (!moving || n < 2 || paused || !inView) return
    const t = window.setInterval(() => setIndex((i) => (i + 1) % n), CUT_MS)
    return () => window.clearInterval(t)
  }, [moving, n, paused, inView])
  React.useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    io.observe(root)
    return () => io.disconnect()
  }, [])
  const active = Math.min(index, Math.max(n - 1, 0))
  const next = n > 1 ? (active + 1) % n : -1
  const titleBody = <SplitSource label={copy.title}>{copy.title}</SplitSource>
  return (
    <div ref={ref} id={id} data-block="hero-video-montage" data-hero="video-montage" {...rootProps} className={cn("cn-block-hero-root cn-block-hero-video-montage", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-video-montage-first hero-first">
        <div className="cn-block-hero-video-montage-stage vm-stage">
          {/* 컷 무대(장식 — 영상 속 글자는 없다). 첫 칠·LCP 는 첫 컷 포스터 하나. 서버 렌더 첫 화면에서는 스크롤 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden="true" data-enter="keep" className="cn-block-hero-video-montage-cuts vm-stage-s">
            {n === 0 ? (
              <span className="cn-block-hero-video-montage-fallback" />
            ) : reduced ? (
              <div className="cn-block-hero-video-montage-cut" data-wf-cut="" data-active="">
                <MediaImage locale={locale} m={posterOf(cuts[0])} sizes="100vw" priority badge={false} />
              </div>
            ) : (
              cuts.map((c, i) => (
                <div key={i} data-wf-cut="" data-active={i === active ? "" : undefined} data-near={i === next ? "" : undefined} className="cn-block-hero-video-montage-cut">
                  {c.kind === "video" ? <MediaVideo locale={locale} m={c} sizes="100vw" priority={i === 0} paused={i !== active || paused} badge={false} /> : <MediaImage locale={locale} m={c} sizes="100vw" priority={i === 0} badge={false} />}
                </div>
              ))
            )}
          </div>
          <div aria-hidden="true" className="cn-block-hero-video-montage-scrim" />
          <MediaPreviewBadge m={cuts[0]} />
          {Display ? (
            <Display as="h1" className="cn-block-hero-video-montage-display vm-title">
              {titleBody}
            </Display>
          ) : (
            <h1 className="cn-block-hero-video-montage-title vm-title font-heading">{titleBody}</h1>
          )}
          {n > 1 && !reduced ? (
            <p aria-hidden="true" className="cn-block-hero-video-montage-ticks">
              {cuts.map((_, i) => (
                <span key={i} data-on={i === active ? "" : undefined} className="cn-block-hero-video-montage-tick" />
              ))}
            </p>
          ) : null}
          {moving ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="cn-block-hero-video-montage-pause" /> : null}
          {!reduced && hasVideo && copy.soundLabel ? <SoundToggle on={sound.on} onToggle={sound.toggle} label={copy.soundLabel} className="cn-block-hero-video-montage-sound" /> : null}
        </div>
        <div data-enter="keep" className="cn-block-hero-video-montage-band vm-band">
          <p className="cn-block-hero-video-montage-lede">{copy.lede}</p>
          <div className="cn-block-hero-video-montage-ctas">
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
