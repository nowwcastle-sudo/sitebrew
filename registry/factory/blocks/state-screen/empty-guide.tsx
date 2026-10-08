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
    <section ref={ref} id={id} data-block="state-screen-empty-guide" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div className="cn-block-sempty">
        <div data-enter className="cn-block-sempty-main">
          <span aria-hidden="true" className="cn-block-sempty-mark">
            <Plus className="cn-block-sempty-mark-icon" />
          </span>
          <h2 id={`${id}-title`} className="cn-block-sempty-title font-heading">
            {copy.title}
          </h2>
          <p className="cn-block-sempty-body">{copy.body}</p>
          <div className="cn-block-sempty-actions">
            <Button size="lg" nativeButton={false} render={<a href={copy.primary.href} />}>
              {copy.primary.label}
            </Button>
            {copy.secondary ? (
              <a href={copy.secondary.href} className="cn-block-sempty-link">
                {copy.secondary.label}
                <ArrowRight aria-hidden="true" className="cn-block-sempty-link-icon" />
              </a>
            ) : null}
          </div>
        </div>
        {copy.steps?.length ? (
          <div data-enter className="cn-block-sempty-steps">
            {copy.stepsTitle ? <h3 className="cn-block-sempty-steps-title font-heading">{copy.stepsTitle}</h3> : null}
            <ol className="cn-block-sempty-list">
              {copy.steps.map((st, i) => (
                <li key={i} className="cn-block-sempty-step">
                  <span data-numeric aria-hidden="true" className="cn-block-sempty-num font-heading">
                    {i + 1}
                  </span>
                  <span className="cn-block-sempty-step-text">
                    <span className="cn-block-sempty-step-title font-heading">{st.title}</span>
                    {st.body ? <span className="cn-block-sempty-step-body">{st.body}</span> : null}
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
