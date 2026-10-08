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
    <section ref={ref} id={id} data-block="final-cta-full-band" aria-labelledby={`${id}-title`} className={cn("cn-block-cta-band", className)}>
      <div className="cn-block-cta-band-inner">
        {copy.kicker ? (
          <p data-enter="" className="cn-block-cta-band-kicker">
            {copy.kicker}
          </p>
        ) : null}
        <h2 id={`${id}-title`} data-enter="" className="cn-block-cta-band-title font-heading">
          {copy.title}
        </h2>
        <div data-enter="" className="cn-block-cta-band-actions">
          <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.primary.href} />} className="cn-block-cta-band-primary">
            {copy.primary.label}
          </Button>
          {copy.secondary ? (
            <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondary.href} />} className="cn-block-cta-band-secondary">
              {copy.secondary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
