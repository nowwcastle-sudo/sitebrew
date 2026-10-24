"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { ArrowRight, Plus } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

// 상태 화면 — 빈 상태 안내 + 행동. 넓으면 두 단: 왼쪽 「아직 없어요」 제목·까닭 한 줄·주 행동 하나(+ 보조 링크) | 오른쪽 시작 단계(번호 목록).
// 좁으면 위아래. 빈 틀·가짜 숫자를 그리지 않는다 — 무엇이 없는지, 무엇을 하면 채워지는지만 말한다.
export type StateScreenEmptyGuideCopy = {
  title: string
  body: string
  primary: Cta
  secondary?: Cta
  stepsTitle?: string
  steps?: { title: string; body?: string }[]
}
export type StateScreenEmptyGuideProps = BlockBase<StateScreenEmptyGuideCopy>

export function StateScreenEmptyGuide({ copy, id = "empty", className }: StateScreenEmptyGuideProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.06 })
  })
  return (
    <section ref={ref} id={id} data-block="state-screen-empty-guide" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid gap-12 border px-6 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16 md:px-12 md:py-16">
        <div data-enter className="flex flex-col items-start gap-4">
          <span aria-hidden="true" className="flex size-14 items-center justify-center border-2 border-dashed border-foreground">
            <Plus className="size-6" />
          </span>
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
            {copy.title}
          </h2>
          <p className="max-w-prose text-base leading-[1.7]">{copy.body}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <Button size="lg" nativeButton={false} render={<a href={copy.primary.href} />}>
              {copy.primary.label}
            </Button>
            {copy.secondary ? (
              <a href={copy.secondary.href} className="relative inline-flex min-h-11 items-center gap-1 text-base underline underline-offset-4">
                {copy.secondary.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
        {copy.steps?.length ? (
          <div data-enter className="flex flex-col gap-5 md:border-s md:ps-12">
            {copy.stepsTitle ? <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.stepsTitle}</h3> : null}
            <ol className="flex flex-col gap-5">
              {copy.steps.map((st, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
                  <span data-numeric aria-hidden="true" className="flex size-10 items-center justify-center border text-[1.125rem] font-heading">
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1 pt-1.5">
                    <span className="text-base leading-[1.5] font-heading">{st.title}</span>
                    {st.body ? <span className="text-base leading-[1.6]">{st.body}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  )
}
