"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { CheckCircle, ChevronRight, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Progress } from "@/registry/factory/ui/progress"

import { fillText } from "../_shared/billing-format"
import { useDismissMemory } from "../_shared/dismiss-memory"

// 시작 체크리스트 판(마케팅 규칙 O5·O6·O11 — factory-rules.md §22-3). 할 일 3~5개를 가치 순서(copy.items 순서 그대로)로 두고 진행률 막대를 단다.
// 미리 체크하는 것은 실제로 끝낸 단계뿐이다 — completed(제품이 아는 끝낸 단계 id)만 끝냄으로 그리고, 이 판에서 손으로 체크하지 않는다.
// 다음 할 일 하나만 주 버튼이고 나머지는 글 링크다. 닫을 수 있고(이 브라우저에 기억), 닫으면 한 줄 「다시 열기」가 남는다.
// 모두 끝내면 작은 축하 한 줄(O11 — 크기는 빈도에 비례, 한 번뿐인 일이라 판 안 한 줄). 온보딩 중에는 평점·리뷰를 묻지 않는다(V4).
// 계측(선택): 할 일 링크를 누르면 cta_click(id = 할 일 id).
export type OnboardingChecklistPanelCopy = {
  title: string
  lead?: string
  // 「{done}/{total} 끝냈어요」
  progress: string
  progressLabel: string
  doneLabel: string
  todoLabel: string
  items: { id: string; title: string; body?: string; action?: { label: string; href: string } }[]
  dismiss: string
  // 닫힌 한 줄: 「시작 체크리스트 {done}/{total}」 + 다시 열기
  closedLine: string
  reopen: string
  celebrate: { title: string; body: string }
}
export type OnboardingChecklistPanelProps = BlockBase<OnboardingChecklistPanelCopy> & {
  // 실제로 끝낸 단계 id(제품이 안다) — 이것만 미리 체크한다
  completed: string[]
  track?: AnalyticsPort["track"]
}

export function OnboardingChecklistPanel({ copy, completed, track, id = "onboarding-checklist", className }: OnboardingChecklistPanelProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const { dismissed, set } = useDismissMemory(`wf-onboarding-checklist:${id}`)
  const [closedNow, setClosedNow] = React.useState<boolean | null>(null)
  const closed = closedNow ?? dismissed === true
  const items = copy.items.slice(0, 5)
  const done = new Set(completed.filter((c) => items.some((it) => it.id === c)))
  const total = items.length
  const count = done.size
  const next = items.find((it) => !done.has(it.id))
  const vars = { done: count, total }
  const close = (on: boolean) => {
    setClosedNow(on)
    set(on)
  }
  return (
    <section ref={ref} id={id} data-block="onboarding-checklist-panel" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      {closed ? (
        <div data-enter data-checklist-closed="" className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border px-5 py-3">
          <h2 id={`${id}-title`} className="text-base leading-[1.5] tabular-nums">
            {fillText(copy.closedLine, vars)}
          </h2>
          <Button type="button" variant="outline" size="lg" onClick={() => close(false)} aria-controls={`${id}-panel`}>
            {copy.reopen}
          </Button>
        </div>
      ) : (
        <div id={`${id}-panel`} data-enter className="flex w-full max-w-3xl flex-col gap-5 rounded-lg border bg-card px-5 py-6 text-card-foreground md:px-8 md:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading-ko">
                {copy.title}
              </h2>
              {copy.lead ? <p className="text-base leading-[1.7]">{copy.lead}</p> : null}
            </div>
            <Button type="button" variant="ghost" size="icon-lg" aria-label={copy.dismiss} onClick={() => close(true)} className="-me-2 -mt-1 shrink-0">
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p data-numeric className="text-base leading-[1.5] tabular-nums">
              {fillText(copy.progress, vars)}
            </p>
            <Progress value={total ? Math.round((count / total) * 100) : 0} aria-label={copy.progressLabel} getAriaValueText={() => fillText(copy.progress, vars)} className="w-full" />
          </div>
          {next ? null : (
            <div role="status" data-celebrate="" className="flex items-start gap-3 border-s-4 border-primary bg-muted px-4 py-3">
              <CheckCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-base leading-[1.6]">
                <span className="text-base font-heading-ko">{copy.celebrate.title}</span> {copy.celebrate.body}
              </p>
            </div>
          )}
          <ol className="flex flex-col border-t">
            {items.map((it, i) => {
              const isDone = done.has(it.id)
              const isNext = next?.id === it.id
              const action = it.action
              return (
                <li key={it.id} data-step-id={it.id} data-done={isDone ? "" : undefined} data-next={isNext ? "" : undefined} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 border-b py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  {isDone ? (
                    <CheckCircle aria-hidden="true" className="size-7 text-primary" />
                  ) : (
                    <span aria-hidden="true" data-numeric className="flex size-7 items-center justify-center rounded-full border-2 text-base leading-none tabular-nums">
                      {i + 1}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">
                      {it.title}
                      <span className="sr-only"> — {isDone ? copy.doneLabel : copy.todoLabel}</span>
                    </h3>
                    {it.body ? <p className="text-base leading-[1.6]">{it.body}</p> : null}
                  </div>
                  {isDone ? (
                    <span className="col-start-2 text-base leading-[1.5] sm:col-start-auto">{copy.doneLabel}</span>
                  ) : !action ? null : isNext ? (
                    <Button size="lg" nativeButton={false} role="link" render={<a href={action.href} />} onClick={() => track?.("cta_click", { id: it.id, label: action.label, section: id })} className="col-start-2 w-full sm:col-start-auto sm:w-auto max-sm:h-auto max-sm:min-h-12 max-sm:max-w-full max-sm:min-w-0 max-sm:shrink max-sm:py-2 max-sm:text-center max-sm:whitespace-normal">
                      {action.label}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  ) : (
                    <a href={action.href} onClick={() => track?.("cta_click", { id: it.id, label: action.label, section: id })} className="relative col-start-2 inline-flex min-h-11 items-center text-base underline underline-offset-4 sm:col-start-auto">
                      {action.label}
                    </a>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
