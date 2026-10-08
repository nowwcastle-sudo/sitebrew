"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { AlertCircle, Bell, ChevronLeft } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { useLeaveGuard } from "../_shared/leave-guard"
import { useStepHistory } from "../_shared/step-history"

// 설정 마법사(마케팅 규칙 O5·O9·O10 — factory-rules.md §22-3). 두 단계: ① 환영 질문 하나(O9 — 고른 답이 없는 채로 시작) → ② 답에 따라 바뀌는 첫 할 일 하나.
// 첫 가치 전에 프로필을 받지 않는다(O5 — 질문은 하나, 건너뛸 수 있다). 권한(알림 등)은 그 기능을 누른 순간에 이유 한 줄과 함께 청한다(O10) —
// 단계가 저절로 권한 창을 띄우지 않는다. 흐름 표지 data-flow="onboarding"·data-steps·data-step(관문이 단계를 센다). 평점·리뷰 요청은 없다(V4).
// 계측(선택): 질문에 답하면 onboarding_step_complete, 첫 할 일을 누르면 cta_click. 답 자체(사람이 고른 값)는 싣지 않는다 — 단계 이름만.
type Permission = { reason: string; label: string; granted: string; denied: string; unsupported: string }
export type OnboardingSetupWizardCopy = {
  title: string
  lead?: string
  // 「{step}/{total}단계」
  stepLabel: string
  question: { legend: string; options: { id: string; label: string; hint?: string }[] }
  required: string
  next: string
  back: string
  skip: { label: string; href: string }
  branches: Record<string, { title: string; body: string; action: { label: string; href: string }; permission?: Permission }>
}
export type OnboardingSetupWizardProps = BlockBase<OnboardingSetupWizardCopy> & { track?: AnalyticsPort["track"] }

type PermState = "idle" | "granted" | "denied" | "unsupported"

export function OnboardingSetupWizard({ copy, track, id = "setup-wizard", className }: OnboardingSetupWizardProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [step, go] = useStepHistory<1 | 2>(id, 1)
  const [answer, setAnswer] = React.useState<string | null>(null)
  // 고른 답이 있는데 창을 닫으려 하면 확인(beforeunload — 이 블록 안 링크로 나가는 것은 통과, 대장 A49). 단계는 브라우저 뒤로 가기로 오간다(대장 A102)
  useLeaveGuard(answer !== null, ref)
  const [invalid, setInvalid] = React.useState(false)
  const [perm, setPerm] = React.useState<PermState>("idle")
  const [focusTo, setFocusTo] = React.useState<{ to: "step" | "error"; n: number } | null>(null)
  React.useEffect(() => {
    if (!focusTo) return
    if (focusTo.to === "step") document.getElementById(`${id}-step-title`)?.focus()
    else document.getElementById(id)?.querySelector<HTMLInputElement>("input[type=radio]")?.focus()
  }, [focusTo, id])
  // 뒤로 가기(popstate)로 단계가 바뀌어도 단계 제목에 포커스가 간다 — 첫 그림에서는 하지 않는다
  const firstStep = React.useRef(true)
  React.useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    const f = requestAnimationFrame(() => document.getElementById(`${id}-step-title`)?.focus())
    return () => cancelAnimationFrame(f)
  }, [step, id])
  const total = 2
  const branch = answer ? copy.branches[answer] : undefined
  const goNext = () => {
    if (!answer || !copy.branches[answer]) {
      setInvalid(true)
      setFocusTo((f) => ({ to: "error", n: (f?.n ?? 0) + 1 }))
      return
    }
    track?.("onboarding_step_complete", { step: "welcome-question", index: 1, total })
    go(2)
    setPerm("idle")
    setFocusTo((f) => ({ to: "step", n: (f?.n ?? 0) + 1 }))
  }
  const goBack = () => {
    go(1)
    setFocusTo((f) => ({ to: "step", n: (f?.n ?? 0) + 1 }))
  }
  const ask = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return setPerm("unsupported")
    const r = await window.Notification.requestPermission()
    setPerm(r === "granted" ? "granted" : "denied")
  }
  return (
    <section ref={ref} id={id} data-block="onboarding-setup-wizard" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-obw-section", className)}>
      <div data-enter className="cn-block-obw-head">
        <p data-numeric className="cn-block-obw-step-label">
          {fillText(copy.stepLabel, { step, total })}
        </p>
        <h2 id={`${id}-title`} className="cn-block-obw-title font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? <p className="cn-block-obw-lead">{copy.lead}</p> : null}
      </div>
      <div data-enter data-flow="onboarding" data-steps={total} data-step={step} className="cn-block-obw-card">
        {step === 1 ? (
          <form
            method="post"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              goNext()
            }}
            className="cn-block-obw-form"
          >
            <fieldset className="cn-block-obw-fieldset">
              <legend id={`${id}-step-title`} tabIndex={-1} className="cn-block-obw-legend font-heading-ko">
                {copy.question.legend}
              </legend>
              <div role="radiogroup" aria-labelledby={`${id}-step-title`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-q-error` : undefined} className="cn-block-obw-options">
                {copy.question.options.map((o) => (
                  <label key={o.id} className="cn-block-obw-option">
                    <input
                      type="radio"
                      name={`${id}-answer`}
                      value={o.id}
                      checked={answer === o.id}
                      onChange={() => {
                        setAnswer(o.id)
                        setInvalid(false)
                      }}
                      className="cn-block-obw-radio"
                    />
                    <span className="cn-block-obw-option-text">
                      <span className="cn-block-obw-option-label">{o.label}</span>
                      {o.hint ? <span className="cn-block-obw-option-hint">{o.hint}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
              {invalid ? (
                <p id={`${id}-q-error`} role="alert" className="cn-block-obw-error">
                  <AlertCircle aria-hidden="true" className="cn-block-obw-error-icon" />
                  {copy.required}
                </p>
              ) : null}
            </fieldset>
            <div className="cn-block-obw-actions">
              <a href={copy.skip.href} className="cn-block-obw-skip">
                {copy.skip.label}
              </a>
              <Button type="submit" size="lg" className="cn-block-obw-next">
                {copy.next}
              </Button>
            </div>
          </form>
        ) : branch ? (
          <div data-branch={answer ?? ""} className="cn-block-obw-branch">
            <h3 id={`${id}-step-title`} tabIndex={-1} className="cn-block-obw-branch-title font-heading-ko">
              {branch.title}
            </h3>
            <p className="cn-block-obw-branch-body">{branch.body}</p>
            {branch.permission ? (
              <div data-permission={perm} className="cn-block-obw-perm">
                <Bell aria-hidden="true" className="cn-block-obw-perm-icon" />
                <p className="cn-block-obw-perm-reason">{branch.permission.reason}</p>
                <Button type="button" variant="outline" size="lg" onClick={ask} className="cn-block-obw-perm-button">
                  {branch.permission.label}
                </Button>
                <p role="status" className="cn-block-obw-perm-status">
                  {perm === "granted" ? branch.permission.granted : perm === "denied" ? branch.permission.denied : perm === "unsupported" ? branch.permission.unsupported : ""}
                </p>
              </div>
            ) : null}
            <div className="cn-block-obw-actions">
              <Button type="button" variant="ghost" size="lg" onClick={goBack} className="cn-block-obw-back">
                <ChevronLeft aria-hidden="true" />
                {copy.back}
              </Button>
              <Button size="lg" nativeButton={false} role="link" render={<a href={branch.action.href} />} onClick={() => track?.("cta_click", { id: "setup-first-action", label: branch.action.label, section: id })} className="cn-block-obw-next">
                {branch.action.label}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
