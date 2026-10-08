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
    <div ref={ref} id={id} data-block="hero-kinetic-type-video" data-hero="kinetic-type-video" {...rootProps} className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem] [&_.kw]:inline-block", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="flex flex-col hero-first">
        <div className="relative isolate flex h-[74svh] min-h-[26rem] flex-col justify-end gap-4 overflow-clip pt-20 pb-6 md:h-[78svh] md:pb-10 kt-stage">
          {/* 무대 그림(장식 — 영상 속 글자는 없다). 첫 칠·LCP 는 포스터. 서버 렌더 첫 화면에서는 펀치 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden="true" data-enter="keep" className="absolute inset-0 -z-10">
            <div className="absolute -inset-[3%] kt-media-s">
              <div className="size-full kt-media-p">
                <div className="size-full kt-media-k">
                  {media?.kind === "video" ? (
                    <MediaVideo locale={locale} m={media} sizes="100vw" priority paused={paused} badge={false} />
                  ) : media ? (
                    // 사진만 받았으면 한 장 켄 번스(느린 확대·팬 왕복 — 유휴 반복이라 M2~M3·정지 단추)로 무대를 살린다.
                    <div data-kb-slide="" className="size-full overflow-clip">
                      <div className="size-full kb-img">
                        <MediaImage locale={locale} m={media} sizes="100vw" priority badge={false} />
                      </div>
                    </div>
                  ) : (
                    <span className="block size-full bg-muted" />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background:linear-gradient(to_top,color-mix(in_oklch,var(--foreground)_92%,transparent)_0%,color-mix(in_oklch,var(--foreground)_78%,transparent)_40%,color-mix(in_oklch,var(--foreground)_22%,transparent)_72%,transparent_90%)]" />
          {/* 미리보기 전용 표지 — 확대·이동하는 영상 층 밖(무대 기준)에 둔다(층 안이면 같이 커져 잘린다). 공개본에는 값이 없어 그려지지 않는다. */}
          <MediaPreviewBadge m={media} />
          {Display ? (
            <Display as="h1" className="px-5 text-background md:px-10 kt-title">
              {titleBody}
            </Display>
          ) : (
            <h1 className="max-w-[16ch] px-5 text-[clamp(2.75rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.03em] text-balance text-background md:px-10 kt-title font-heading">{titleBody}</h1>
          )}
          <LowerThird items={copy.captions} label={copy.captionsLabel} keep className="px-5 md:px-10" />
          {moving ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="absolute end-4 top-4 md:end-8 md:top-8" /> : null}
          {media?.kind === "video" && copy.soundLabel ? <SoundToggle on={sound.on} onToggle={sound.toggle} label={copy.soundLabel} className="absolute end-17 top-4 md:end-21 md:top-8" /> : null}
        </div>
        <div data-enter="keep" className="grid gap-6 bg-background px-5 py-8 text-foreground md:grid-cols-12 md:items-end md:px-10 md:py-10 kt-band">
          <p className="max-w-[40rem] text-lg leading-[1.6] md:col-span-7">{copy.lede}</p>
          <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
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
