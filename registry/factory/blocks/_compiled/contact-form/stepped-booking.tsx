"use client"

import * as React from "react"

import type {
  AgentToolMeta,
  BlockBase,
} from "@/registry/factory/contract/block-contract"
import { agentFormAttrs } from "@/registry/factory/ax/agent-form-attrs"
import { Check, ChevronLeft, ChevronRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { isComposingEnter } from "../_shared/ime-guard"
import { useLeaveGuard } from "../_shared/leave-guard"
import { ReviewSummary, type ReviewSummaryCopy } from "../_shared/review-summary"
import { useStepHistory } from "../_shared/step-history"
import {
  FieldMessage,
  FormAlert,
  FormDone,
  SubmitButton,
  TextField,
  fieldAria,
  useFormFlow,
  type ContactSubmit,
  type FormFlowCopy,
} from "../_shared/form-flow"

// 예약 폼 — 날짜 → 시간 → 정보 → 확인 네 단계. 위에 단계 줄(현재 단계 aria-current="step", 지난 단계는 체크), 아래 한 단계씩.
// 날짜·시간은 칩 격자(진짜 라디오 — 키보드 화살표로 고른다, 마감 시간은 비활성 + 「마감」). 모든 단계를 한 폼 안에 두고 지금 단계만 보인다
// (hidden) — 앞 단계로 돌아가도, 서버 오류가 나도 고른 값이 남는다. 「다음」은 그 단계 필수 칸만 본다. 서버 필드 오류가 앞 단계 칸이면
// 그 단계를 열고 첫 오류 칸에 포커스를 옮긴다. 에이전트 속성은 agent-form-attrs(자동 제출 없음 — 사람이 [예약 요청]을 누른다).
// 확인 단계(대장 A63): 고른 때·이름·연락처·요청을 dl 로 다시 보이고 항목마다 [고치기] → 그 단계로 갔다가 「다음」이면 확인 화면으로 바로 돌아온다.
//   [예약 요청]과 [돌아가기]는 같은 크기의 두 버튼(대등). 정보 단계에서 Enter 는 「다음」이다(한글 조합 중 Enter 는 글자 확정이라 무시 — isComposingEnter).
// 뒤로 가기(대장 A102): 단계가 바뀔 때마다 history 항목을 쌓아 브라우저 뒤로 가기가 이전 단계로 간다(값 유지). 입력이 남은 채 떠나면 beforeunload(대장 A49).
export type BookingOption = { value: string; label: string; full?: boolean }
export type ContactFormSteppedBookingCopy = {
  title: string
  lead?: string
  steps: [string, string, string, string]
  // 단계 줄 읽기 틀(「{n}단계 중 {total}단계」가 아니라 「{total}단계 중 {n}단계」)
  stepTemplate: string
  dateLegend: string
  timeLegend: string
  fullLabel: string
  labels: { name: string; phone: string; request: string }
  summaryLabel: string
  next: string
  back: string
  // 확인 단계(대장 A63): 제목·안내와 항목 이름(이름·연락처·요청은 labels 를 그대로 쓴다)
  review: ReviewSummaryCopy & { title: string; lead?: string; dateLabel: string; timeLabel: string }
  form: FormFlowCopy
}
export type ContactFormSteppedBookingProps =
  BlockBase<ContactFormSteppedBookingCopy> & {
    submit: ContactSubmit
    tool?: AgentToolMeta
    dates: BookingOption[]
    times: BookingOption[]
  }

const STEP_OF: Record<string, number> = {
  date: 0,
  time: 1,
  name: 2,
  phone: 2,
  request: 2,
}

export function ContactFormSteppedBooking({
  copy,
  submit,
  tool,
  dates,
  times,
  id = "booking",
  className,
}: ContactFormSteppedBookingProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [step, go] = useStepHistory<number>(id, 0)
  const [picked, setPicked] = React.useState<{ date?: string; time?: string }>(
    {}
  )
  const [dirty, setDirty] = React.useState(false)
  // 확인 단계의 [고치기]로 앞 단계에 간 사람은 「다음」으로 확인 화면에 바로 돌아온다
  const [backToReview, setBackToReview] = React.useState(false)
  const flow = useFormFlow(submit, {
    id,
    required: ["date", "time", "name", "phone"],
    requiredMessage: copy.form.required,
    notices: copy.form.notices,
    onFieldErrors: (names) => {
      const first = Math.min(...names.map((n) => STEP_OF[n] ?? 2))
      if (Number.isFinite(first)) go(first)
    },
  })
  const agent = tool ? agentFormAttrs(tool) : {}
  const headRef = React.useRef<HTMLParagraphElement>(null)
  useLeaveGuard(dirty && flow.phase !== "done", ref)
  // 단계가 바뀌면(다음·이전·뒤로 가기) 단계 머리에 포커스 — 첫 그림에서는 하지 않는다
  const firstStep = React.useRef(true)
  React.useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    // 서버가 칸 오류로 앞 단계에 돌려보냈으면 단계 머리가 아니라 그 오류 칸으로 간다
    const f = requestAnimationFrame(() => {
      const bad = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
      ;(bad ?? headRef.current)?.focus()
    })
    return () => cancelAnimationFrame(f)
  }, [step])
  const CHECK: string[][] = [["date"], ["time"], ["name", "phone"]]
  const next = () => {
    if (!flow.check(CHECK[step])) return
    setBackToReview(false)
    go(backToReview ? 3 : step + 1)
  }
  const edit = (to: number) => {
    setBackToReview(true)
    go(to)
  }
  const onInfoKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 정보 단계에서 Enter 는 「다음」(한 줄 칸에서만 — 여러 줄 칸의 줄바꿈·버튼의 누르기는 그대로). 한글 조합 중 Enter 는 글자를 확정하는 키라 넘긴다.
    if (e.key === "Enter" && !isComposingEnter(e) && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      next()
    }
  }
  const values = step === 3 ? flow.read() : {}
  const label = (list: BookingOption[], v?: string) =>
    list.find((o) => o.value === v)?.label ?? ""
  const chips = (
    name: "date" | "time",
    legend: string,
    list: BookingOption[]
  ) => {
    const aria = fieldAria(flow, id, name)
    const items = list.map((o) => (
      <label
        key={o.value}
        data-full={o.full ? "" : undefined}
        className="relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 border bg-background px-3 py-2 text-center has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring has-[[aria-invalid=true]]:border-destructive data-[full]:cursor-not-allowed data-[full]:border-dashed"
      >
        <input
          type="radio"
          name={name}
          value={o.value}
          disabled={o.full}
          onChange={() => {
            setPicked((p) => ({ ...p, [name]: o.value }))
            setDirty(true)
          }}
          className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
          {...aria}
        />
        <span className="text-base leading-[1.4] in-data-[full]:line-through" data-numeric>
          {o.label}
        </span>
        {o.full ? (
          <span className="text-base leading-[1.3]">{copy.fullLabel}</span>
        ) : null}
      </label>
    ))
    // 격자 훅은 JSX 글자로 둔다 — 스타일 컴파일은 삼항식 안의 훅 이름을 바꾸지 않는다
    return (
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-4 text-[1.25rem] leading-[1.35] font-heading">
          {legend}
        </legend>
        {name === "date" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{items}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{items}</div>
        )}
        <FieldMessage flow={flow} id={id} name={name} />
      </fieldset>
    )
  }
  return (
    <section
      ref={ref}
      id={id}
      data-block="contact-form-stepped-booking"
      aria-labelledby={`${id}-title`}
      className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}
    >
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="flex max-w-4xl flex-col gap-8">
        {flow.phase === "done" ? (
          <FormDone flow={flow} copy={copy.form} />
        ) : (
          <>
            <ol className="grid grid-cols-3 border-b">
              {copy.steps.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === step ? "step" : undefined}
                  data-done={i < step ? "" : undefined}
                  className="flex min-w-0 flex-col items-start gap-2 border-b-2 border-transparent pb-4 sm:flex-row sm:items-center sm:gap-3 aria-[current=step]:border-foreground"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center border text-base in-aria-[current=step]:bg-primary in-aria-[current=step]:text-primary-foreground in-data-[done]:bg-muted"
                    data-numeric
                    aria-hidden="true"
                  >
                    {i < step ? (
                      <Check className="size-4" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="text-base leading-[1.4] in-aria-[current=step]:font-medium">{s}</span>
                </li>
              ))}
            </ol>
            <form
              method="post"
              id={flow.formId}
              noValidate
              aria-labelledby={`${id}-title`}
              aria-busy={flow.pending || undefined}
              onSubmit={flow.onSubmit}
              onInput={() => setDirty(true)}
              className="flex flex-col gap-6"
              {...agent}
            >
              <p ref={headRef} tabIndex={-1} className="text-base leading-[1.5] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                {copy.stepTemplate
                  .replace("{n}", String(step + 1))
                  .replace("{total}", String(copy.steps.length))}{" "}
                · {copy.steps[step]}
              </p>
              <FormAlert flow={flow} copy={copy.form} />
              <div hidden={step !== 0}>
                {chips("date", copy.dateLegend, dates)}
              </div>
              <div hidden={step !== 1}>
                {chips("time", copy.timeLegend, times)}
              </div>
              <div hidden={step !== 2} onKeyDown={onInfoKeyDown} className="flex flex-col gap-6">
                {picked.date || picked.time ? (
                  <p className="flex flex-wrap items-baseline gap-x-3 border-s-2 border-foreground ps-4 text-[1.125rem] leading-[1.5]">
                    <span className="text-base font-medium">
                      {copy.summaryLabel}
                    </span>
                    <span data-numeric>
                      {label(dates, picked.date)} {label(times, picked.time)}
                    </span>
                  </p>
                ) : null}
                <div className="grid gap-6 sm:grid-cols-2">
                  <TextField
                    flow={flow}
                    id={id}
                    name="name"
                    label={copy.labels.name}
                    autoComplete="name"
                    required
                  />
                  <TextField
                    flow={flow}
                    id={id}
                    name="phone"
                    label={copy.labels.phone}
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    format="phone"
                    required
                  />
                </div>
                <TextField
                  flow={flow}
                  id={id}
                  name="request"
                  label={copy.labels.request}
                  multiline
                />
              </div>
              <div hidden={step !== 3} className="flex flex-col gap-4">
                <h3 className="text-[1.25rem] leading-[1.3] font-heading">{copy.review.title}</h3>
                {copy.review.lead ? <p className="text-base leading-[1.6]">{copy.review.lead}</p> : null}
                <ReviewSummary
                  copy={copy.review}
                  rows={[
                    { key: "date", label: copy.review.dateLabel, value: label(dates, picked.date), numeric: true, onEdit: () => edit(0) },
                    { key: "time", label: copy.review.timeLabel, value: label(times, picked.time), numeric: true, onEdit: () => edit(1) },
                    { key: "name", label: copy.labels.name, value: values.name ?? "", onEdit: () => edit(2) },
                    { key: "phone", label: copy.labels.phone, value: values.phone ?? "", numeric: true, onEdit: () => edit(2) },
                    { key: "request", label: copy.labels.request, value: values.request ?? "", onEdit: () => edit(2) },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-6">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => go(step - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                    {copy.back}
                  </Button>
                ) : null}
                {step < 3 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={next}
                    className="ms-auto"
                  >
                    {copy.next}
                    <ChevronRight aria-hidden="true" />
                  </Button>
                ) : (
                  <SubmitButton
                    flow={flow}
                    copy={copy.form}
                    className="ms-auto"
                  />
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
