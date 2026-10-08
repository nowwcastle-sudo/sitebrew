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
    <section ref={ref} id={id} data-block="onboarding-setup-wizard" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 items-center", className)}>
      <div data-enter className="flex w-full max-w-2xl flex-col gap-3 text-center">
        <p data-numeric className="text-base leading-[1.5] tabular-nums">
          {fillText(copy.stepLabel, { step, total })}
        </p>
        <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? <p className="text-base leading-[1.7]">{copy.lead}</p> : null}
      </div>
      <div data-enter data-flow="onboarding" data-steps={total} data-step={step} className="w-full max-w-2xl rounded-lg border bg-card px-5 py-6 text-card-foreground md:px-8 md:py-8">
        {step === 1 ? (
          <form
            method="post"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              goNext()
            }}
            className="flex flex-col gap-6"
          >
            <fieldset className="flex min-w-0 flex-col gap-4">
              <legend id={`${id}-step-title`} tabIndex={-1} className="mb-4 text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading-ko">
                {copy.question.legend}
              </legend>
              <div role="radiogroup" aria-labelledby={`${id}-step-title`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-q-error` : undefined} className="flex flex-col gap-3">
                {copy.question.options.map((o) => (
                  <label key={o.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
                    <input
                      type="radio"
                      name={`${id}-answer`}
                      value={o.id}
                      checked={answer === o.id}
                      onChange={() => {
                        setAnswer(o.id)
                        setInvalid(false)
                      }}
                      className="mt-1 size-5 shrink-0 accent-primary outline-hidden"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-[1.125rem] leading-[1.4]">{o.label}</span>
                      {o.hint ? <span className="text-base leading-[1.6]">{o.hint}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
              {invalid ? (
                <p id={`${id}-q-error`} role="alert" className="flex items-start gap-2 text-base leading-[1.6] [color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                  <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {copy.required}
                </p>
              ) : null}
            </fieldset>
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a href={copy.skip.href} className="relative inline-flex min-h-11 items-center justify-center text-base underline underline-offset-4">
                {copy.skip.label}
              </a>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                {copy.next}
              </Button>
            </div>
          </form>
        ) : branch ? (
          <div data-branch={answer ?? ""} className="flex flex-col gap-4">
            <h3 id={`${id}-step-title`} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading-ko">
              {branch.title}
            </h3>
            <p className="text-base leading-[1.7]">{branch.body}</p>
            {branch.permission ? (
              <div data-permission={perm} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 rounded-md border px-4 py-4">
                <Bell aria-hidden="true" className="mt-1 size-5 text-primary" />
                <p className="text-base leading-[1.6]">{branch.permission.reason}</p>
                <Button type="button" variant="outline" size="lg" onClick={ask} className="col-span-2 w-full sm:col-span-1 sm:col-start-2 sm:w-auto sm:justify-self-start">
                  {branch.permission.label}
                </Button>
                <p role="status" className="col-span-2 text-base leading-[1.5] empty:hidden sm:col-span-1 sm:col-start-2">
                  {perm === "granted" ? branch.permission.granted : perm === "denied" ? branch.permission.denied : perm === "unsupported" ? branch.permission.unsupported : ""}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" size="lg" onClick={goBack} className="w-full sm:w-auto">
                <ChevronLeft aria-hidden="true" />
                {copy.back}
              </Button>
              <Button size="lg" nativeButton={false} role="link" render={<a href={branch.action.href} />} onClick={() => track?.("cta_click", { id: "setup-first-action", label: branch.action.label, section: id })} className="w-full sm:w-auto">
                {branch.action.label}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
