"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kineticType, playOnView, punchIn, staggerIn } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

// 마지막 행동 유도 — 키네틱 반전 띠(P3-5 MOTKIT). 화면 폭 반전 띠(바탕 = 레시피 전경색, 글자 = 바탕색 — full-band 와 같은 대비 짝) 위에
// 아주 큰 제목(화면 폭 가까이) + 짧은 한 줄(선택) + 버튼 둘.
// 모션(MOTKIT — 동작 줄이기·M0 정지): 띠가 화면에 들어올 때(한 번) 제목 글자가 칸 안에서 기울었다 서며 연쇄로 올라오고(키네틱, M3 2s 안) → 한 줄·버튼이
// 한 줄기로(스태거) → 주 버튼이 1.2배에서 착지(펀치 인). 스크롤 동안 제목 낱말이 가운데에서 바깥으로 벌어지고 기운다(키네틱 스크럽 — 띠 위끝이 화면 위에
// 닿을 때부터 60%). 강조: 등장 끝 + 1.6초에 글자 물결 한 번(마우스면 올릴 때 다시).
export type FinalCtaKineticBandCopy = {
  title: string
  lead?: string
  primary: Cta
  secondary?: Cta
}
export type FinalCtaKineticBandProps = BlockBase<FinalCtaKineticBandCopy>

export function FinalCtaKineticBand({ copy, id = "final-cta", className }: FinalCtaKineticBandProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    playOnView(s)
    kineticType(s, s.root.querySelector(".kb2-rise"), { mode: "rise", by: "chars", at: 0 })
    staggerIn(s, s.q(".kb2-after"), { at: 0.5, y: 18 })
    punchIn(s, s.root.querySelector(".kb2-primary"), { kind: "text", at: 0.8 })
    kineticType(s, s.root.querySelector(".kb2-rise"), { mode: "wave" })
    kineticType(s, s.root.querySelector(".kb2-scrub"), { mode: "scrub", spread: 0.18, skew: 5 })
  })
  return (
    <section ref={ref} id={id} data-block="final-cta-kinetic-band" aria-labelledby={`${id}-title`} className={cn("overflow-x-clip bg-foreground text-background [--ring:var(--background)]", className)}>
      <div className="mx-auto flex max-w-[90rem] flex-col items-start gap-8 px-4 py-24 md:px-8 md:py-32">
        {/* 스크럽은 제목 묶음(.kb2-scrub — 낱말), 등장·물결은 안쪽 보이는 사본(글자). 같은 요소를 두 번 쪼개지 않는다. */}
        <h2 id={`${id}-title`} data-enter="" className="max-w-full text-[clamp(2.75rem,8vw,8rem)] leading-[0.95] tracking-[-0.03em] text-balance kb2-scrub font-heading">
          <span className="kb2-rise">
            <SplitSource label={copy.title}>{copy.title}</SplitSource>
          </span>
        </h2>
        {copy.lead ? (
          <p data-enter="" className="max-w-[40rem] text-lg leading-[1.6] kb2-after">
            {copy.lead}
          </p>
        ) : null}
        <div data-enter="" className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row kb2-after">
          <span className="inline-flex w-full sm:w-auto kb2-primary">
            <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.primary.href} />} className="w-full border-background bg-background text-foreground hover:bg-background/90 hover:text-foreground sm:w-auto dark:border-background dark:bg-background dark:hover:bg-background/90">
              {copy.primary.label}
            </Button>
          </span>
          {copy.secondary ? (
            <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondary.href} />} className="border-background bg-transparent text-background hover:bg-background/10 hover:text-background dark:border-background dark:bg-transparent dark:hover:bg-background/10">
              {copy.secondary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
