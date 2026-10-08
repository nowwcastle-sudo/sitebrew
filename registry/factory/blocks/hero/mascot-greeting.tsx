"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { ambientDrift, kineticType, punchIn, rise } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { HeroTexture, useHeroScene, type HeroCommon } from "../_shared/hero-parts"
import { LoopPause, useLoopPause } from "../_shared/loop-pause"

// 히어로 — 캐릭터 인사(FV1 Task 5.7). 캐릭터 그림(media — 생성 허용 칸, 배경이 투명한 그림이 어울린다)이 오른쪽에 서고, 그 캐릭터가 건네는 **말풍선이 제목(h1)** 이다.
// 말풍선 아래에 문단·버튼, 맨 아래에 **상표·저작권 확인 문구**(rightsLabel + rightsNote)를 눈에 보이게 둔다 — 캐릭터의 권리가 확인된 그림인지 사이트가 스스로 밝히는 칸이다.
// 이 문구는 사실이라 블록이 지어내지 않는다: 값이 없으면 찍어내기 06 이 이 블록을 쓰지 않는다.
// 모션: 등장 캐릭터가 확대 컷에서 제자리로 튀어 들어온다(펀치 인) → 말풍선이 살짝 부풀었다 앉는다(크기만 — 글은 숨기지 않는다) → 문단·버튼. 유휴 캐릭터가 천천히 위아래로 떠다닌다(M2~M3 — 5초 넘게 돌아 정지 단추).
//   동작 줄이기(prefers-reduced-motion)·M0 : 장면(useHeroScene)이 서지 않아 모두 정지 — 캐릭터도 말풍선도 그대로 보인다(정지 단추도 숨는다).
export type HeroMascotGreetingCopy = {
  label: string
  title: string // 말풍선 — 캐릭터가 하는 인사 한 문장
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  rightsLabel: string // 「그림 권리」 같은 머리말
  rightsNote: string // 캐릭터 상표·저작권 확인 문구 — 사실이다
  pauseLabel: string
}
export type HeroMascotGreetingProps = BlockBase<HeroMascotGreetingCopy> & HeroCommon & { media?: ImageSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "punch-in", "ambient-drift"]

export function HeroMascotGreeting({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture }: HeroMascotGreetingProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { paused, toggle, rootProps } = useLoopPause()
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    punchIn(s, q(".mg-char-k"), { kind: "media", at: 0 })
    kineticType(s, q(".mg-title"), { mode: "rise", by: "words", at: 0.25 })
    // 말풍선은 크기만 부푼다(불투명도는 그대로 — 글이 숨지 않는다).
    s.tl.from(q(".mg-bubble"), { scale: 0.88, transformOrigin: "85% 100%", duration: s.t.enter * 1.2, ease: "back.out(1.6)", clearProps: "transform" }, 0.2)
    rise(s, s.q(".mg-copy > *"), { at: 0.6, y: 14, stagger: 0.08 })
    // ── 유휴(M2~M3): 캐릭터가 천천히 떠다닌다 ──
    ambientDrift(s, q(".mg-char-p"), { y: -8, rotate: 1.2, duration: 2.4 })
  })
  return (
    <div ref={ref} id={id} data-block="hero-mascot-greeting" data-hero="mascot-greeting" {...rootProps} className={cn("cn-block-hero-root cn-block-hero-mascot-greeting", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-mascot-greeting-first hero-first">
        <div className="cn-block-hero-mascot-greeting-talk">
          <div data-bubble="" data-enter="keep" className="cn-block-hero-mascot-greeting-bubble mg-bubble">
            <h1 className="cn-block-hero-mascot-greeting-title mg-title font-heading">
              <SplitSource label={copy.title}>{copy.title}</SplitSource>
            </h1>
          </div>
          <div data-enter="keep" className="cn-block-hero-mascot-greeting-copy mg-copy">
            <p className="cn-block-hero-mascot-greeting-lede">{copy.lede}</p>
            <div className="cn-block-hero-mascot-greeting-ctas">
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
        </div>
        <div className="cn-block-hero-mascot-greeting-stage">
          {/* 캐릭터 그림: 첫 칠·LCP. 서버 렌더 첫 화면에서는 펀치 등장을 끝 상태로 둔다(keep). */}
          <div aria-hidden={media ? undefined : "true"} data-enter="keep" className="cn-block-hero-mascot-greeting-char mg-char">
            <div className="cn-block-hero-mascot-greeting-char-p mg-char-p">
              <div className="cn-block-hero-mascot-greeting-char-k mg-char-k">{media ? <MediaImage locale={locale} m={media} sizes="(min-width: 1024px) 38vw, 80vw" priority badge={false} /> : <span className="cn-block-hero-mascot-greeting-fallback" />}</div>
            </div>
          </div>
          <MediaPreviewBadge m={media} />
          {media ? <LoopPause paused={paused} onToggle={toggle} label={copy.pauseLabel} className="cn-block-hero-mascot-greeting-pause" /> : null}
        </div>
        <p data-rights="" className="cn-block-hero-mascot-greeting-rights">
          <span className="cn-block-hero-mascot-greeting-rights-label">{copy.rightsLabel}</span> {copy.rightsNote}
        </p>
      </section>
    </div>
  )
}
