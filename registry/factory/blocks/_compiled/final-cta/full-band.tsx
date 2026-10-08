"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

// 마지막 행동 유도 — 화면 폭 가득한 반전 띠(바탕 = 레시피 전경색, 글자 = 바탕색 — 어느 레시피·테마에서도 본문 짝의 대비 그대로) 위에
// 짧은 머리말(선택)·큰 제목 h2·버튼 둘(주: 바탕색 채움, 보조: 테두리만). 띠 안의 포커스 링은 바탕색(--ring 을 띠 안에서 바꾼다).
// 등장: 머리말 → 제목 → 버튼이 차례로 올라온다(rise). 동작 줄이기·M0 은 끝 모양 그대로.
export type FinalCtaFullBandCopy = {
  kicker?: string
  title: string
  primary: Cta
  secondary?: Cta
}
export type FinalCtaFullBandProps = BlockBase<FinalCtaFullBandCopy>

export function FinalCtaFullBand({ copy, id = "final-cta", className }: FinalCtaFullBandProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 20, stagger: 0.1 })
  })
  return (
    <section ref={ref} id={id} data-block="final-cta-full-band" aria-labelledby={`${id}-title`} className={cn("bg-foreground text-background [--ring:var(--background)]", className)}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:items-center md:gap-8 md:px-8 md:py-28 md:text-center">
        {copy.kicker ? (
          <p data-enter="" className="text-base leading-[1.5] tracking-[0.02em]">
            {copy.kicker}
          </p>
        ) : null}
        <h2 id={`${id}-title`} data-enter="" className="max-w-[22ch] text-[2.441rem] leading-[1.1] text-balance md:text-[3.815rem] md:leading-[1.05] font-heading">
          {copy.title}
        </h2>
        <div data-enter="" className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.primary.href} />} className="border-background bg-background text-foreground hover:bg-background/90 hover:text-foreground dark:border-background dark:bg-background dark:hover:bg-background/90">
            {copy.primary.label}
          </Button>
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
