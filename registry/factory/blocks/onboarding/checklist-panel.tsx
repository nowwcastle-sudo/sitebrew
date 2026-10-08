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
    <section ref={ref} id={id} data-block="onboarding-checklist-panel" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      {closed ? (
        <div data-enter data-checklist-closed="" className="cn-block-obc-closed">
          <h2 id={`${id}-title`} className="cn-block-obc-closed-text">
            {fillText(copy.closedLine, vars)}
          </h2>
          <Button type="button" variant="outline" size="lg" onClick={() => close(false)} aria-controls={`${id}-panel`}>
            {copy.reopen}
          </Button>
        </div>
      ) : (
        <div id={`${id}-panel`} data-enter className="cn-block-obc-panel">
          <div className="cn-block-obc-head">
            <div className="cn-block-obc-head-text">
              <h2 id={`${id}-title`} className="cn-block-obc-title font-heading-ko">
                {copy.title}
              </h2>
              {copy.lead ? <p className="cn-block-obc-lead">{copy.lead}</p> : null}
            </div>
            <Button type="button" variant="ghost" size="icon-lg" aria-label={copy.dismiss} onClick={() => close(true)} className="cn-block-obc-dismiss">
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="cn-block-obc-progress">
            <p data-numeric className="cn-block-obc-progress-text">
              {fillText(copy.progress, vars)}
            </p>
            <Progress value={total ? Math.round((count / total) * 100) : 0} aria-label={copy.progressLabel} getAriaValueText={() => fillText(copy.progress, vars)} className="cn-block-obc-bar" />
          </div>
          {next ? null : (
            <div role="status" data-celebrate="" className="cn-block-obc-celebrate">
              <CheckCircle aria-hidden="true" className="cn-block-obc-celebrate-icon" />
              <p className="cn-block-obc-celebrate-text">
                <span className="cn-block-obc-celebrate-title font-heading-ko">{copy.celebrate.title}</span> {copy.celebrate.body}
              </p>
            </div>
          )}
          <ol className="cn-block-obc-list">
            {items.map((it, i) => {
              const isDone = done.has(it.id)
              const isNext = next?.id === it.id
              const action = it.action
              return (
                <li key={it.id} data-step-id={it.id} data-done={isDone ? "" : undefined} data-next={isNext ? "" : undefined} className="cn-block-obc-item">
                  {isDone ? (
                    <CheckCircle aria-hidden="true" className="cn-block-obc-mark-done" />
                  ) : (
                    <span aria-hidden="true" data-numeric className="cn-block-obc-mark-todo">
                      {i + 1}
                    </span>
                  )}
                  <div className="cn-block-obc-item-text">
                    <h3 className="cn-block-obc-item-title font-heading-ko">
                      {it.title}
                      <span className="sr-only"> — {isDone ? copy.doneLabel : copy.todoLabel}</span>
                    </h3>
                    {it.body ? <p className="cn-block-obc-item-body">{it.body}</p> : null}
                  </div>
                  {isDone ? (
                    <span className="cn-block-obc-item-state">{copy.doneLabel}</span>
                  ) : !action ? null : isNext ? (
                    <Button size="lg" nativeButton={false} role="link" render={<a href={action.href} />} onClick={() => track?.("cta_click", { id: it.id, label: action.label, section: id })} className="cn-block-obc-item-action cn-block-btn-wrap">
                      {action.label}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  ) : (
                    <a href={action.href} onClick={() => track?.("cta_click", { id: it.id, label: action.label, section: id })} className="cn-block-obc-item-link">
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
