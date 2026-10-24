"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { ChevronDown, Info, Plus } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { blurToSharp, rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/factory/ui/collapsible"

// 첫 빈 화면(마케팅 규칙 O7·O8 — factory-rules.md §22-3). 이 영역이 무엇인지(what), 왜 비었는지(why), 주 행동 하나(action)를 보인다(O7).
// 예시 데이터로 둘러보기는 선택(sample — 글 링크, 주 행동과 무게가 다르다). 첫 실행 투어 대신 이 자리에서 여는 맥락 도움말 하나(O8 — 사용자가 연다).
// 온보딩 중이라 평점·리뷰를 묻지 않는다(V4). 계측(선택): 주 행동·예시 데이터를 누르면 cta_click.
export type OnboardingEmptyFirstActionCopy = {
  title: string
  what: string
  why: string
  action: { label: string; href: string }
  sample?: { label: string; href: string }
  help?: { label: string; body: string }
}
export type OnboardingEmptyFirstActionProps = BlockBase<OnboardingEmptyFirstActionCopy> & { track?: AnalyticsPort["track"] }

export function OnboardingEmptyFirstAction({ copy, track, id = "empty-first-action", className }: OnboardingEmptyFirstActionProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
    blurToSharp(s, s.q("[data-enter]"), { at: 0 }) // 대담 장면(5.17): 판이 흐림에서 선명으로 — 흐림만 걷히고 글은 숨기지 않는다
  })
  return (
    <section ref={ref} id={id} data-block="onboarding-empty-first-action" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter data-empty-state="" className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border-2 border-dashed px-5 py-10 text-center md:px-10 md:py-14">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Plus className="size-7 text-primary" />
        </span>
        <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading-ko">
          {copy.title}
        </h2>
        <p data-empty-what="" className="max-w-prose text-base leading-[1.7]">
          {copy.what}
        </p>
        <p data-empty-why="" className="max-w-prose text-base leading-[1.7]">
          {copy.why}
        </p>
        <div className="flex w-full flex-col items-center gap-2 pt-2">
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.action.href} />} data-primary-action="" onClick={() => track?.("cta_click", { id: "empty-first-action", label: copy.action.label, section: id })} className="w-full sm:w-auto">
            <Plus aria-hidden="true" />
            {copy.action.label}
          </Button>
          {copy.sample ? (
            <a href={copy.sample.href} onClick={() => track?.("cta_click", { id: "empty-sample", label: copy.sample?.label ?? "", section: id })} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
              {copy.sample.label}
            </a>
          ) : null}
        </div>
        {copy.help ? (
          <Collapsible className="flex w-full flex-col items-center gap-2 border-t pt-4">
            <CollapsibleTrigger render={<Button type="button" variant="ghost" size="lg" className="max-w-full whitespace-normal" />}>
              <Info aria-hidden="true" />
              {copy.help.label}
              <ChevronDown aria-hidden="true" className="transition-transform duration-(--duration-hover,150ms) [[data-panel-open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="max-w-prose text-start text-base leading-[1.7]">
              <p>{copy.help.body}</p>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </section>
  )
}
