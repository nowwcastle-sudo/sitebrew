"use client"

import * as React from "react"

import type { ActionResult } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps, type HumanApprovalAction } from "@/registry/factory/contract/human-actions"
import { AlertCircle, CheckCircle, Clock, LoaderCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"
import { usePendingGate } from "@/registry/factory/ui/spinner"
import { Field, FieldError, FieldLabel } from "@/registry/factory/ui/field"
import { Input } from "@/registry/factory/ui/input"
import { Textarea } from "@/registry/factory/ui/textarea"

import { fillText } from "../_shared/billing-format"
import { ApprovalHint } from "../_shared/human-approval"
import { applyInputFormat, type InputFormat } from "../_shared/input-format"
import { ApprovalLines, SUBMIT_TIMEOUT_MS, SubmitExtras, TIMED_OUT, cooldownSeconds, failureKind, noticeAttrs, noticeTitle, safeManageUrl, settleWithin, useCooldown, type Notice, type SubmitNotices } from "../_shared/submit-guard"

// 폼 제출 흐름(P3-2 공유 조각 block-shared-form-flow — contact-form 세 변형이 같이 쓴다). DESIGN §7-A·§20-6.
//   · 입력은 비제어(FormData)라 서버 오류·필드 오류 뒤에도 적은 값이 그대로 남는다(다시 그려도 폼을 떼지 않는다).
//   · 보내기 전 필수 칸 검사(비었으면 제출하지 않고 그 칸 오류) → submit(input) → ActionResult.
//   · 필드 오류: 칸마다 aria-invalid + aria-describedby 로 오류 문구를 잇고, 문서 순서로 첫 오류 칸에 포커스를 옮긴다.
//   · 서버 오류(formError): 폼 위 알림(role="alert")으로 알리고 포커스를 알림에 둔다. 입력은 그대로.
//   · 보내는 중: 폼 aria-busy, 보내기 버튼 aria-disabled + 「보내는 중」 — disabled 를 쓰지 않는다(포커스가 body 로 빠져 키보드 사용자가 자리를 잃는다, Task 14c).
//   · 제출 보호(Task 10d, submit-guard): 15초 안에 답이 없으면 「응답이 늦어요」 + [다시 시도](입력 그대로 — 폼을 다시 보낸다), 실패 code rate_limited 는 보내기 버튼이
//     남은 초를 보이며 잠기고, provider_unsupported 는 manageUrl 링크를 보인다. copy.notices 가 있을 때만 켜진다.
//     두 번 보내기는 흐름이 막는다(보내는 동안 ref 로 잠근다 — 같은 틱의 두 번째 submit 도). 성공: 폼 자리에 접수 결과(role="status", 제목에 포커스).

export type ContactFormInput = Record<string, string>
/** 접수 결과 — mock(id·message)·adapter-static(reference·href·nextStep·text·copied)·서버 액션이 모두 이 모양에 맞는다. */
export type ContactReceipt = { id?: string; message?: string; nextStep?: string; href?: string; text?: string; copied?: boolean }
export type ContactSubmit = (input: ContactFormInput) => Promise<ActionResult<ContactReceipt>>

export type FormFlowCopy = {
  required: string // 빈 필수 칸 문구
  submitLabel: string
  pendingLabel: string
  errorTitle: string // 서버 오류 알림 제목
  fieldErrorTitle: string // 필드 오류 알림 제목
  notices: SubmitNotices // 시간 초과·요청 제한·지원 안 함 문구(submit-guard)
  done: { title: string; body: string; idLabel?: string; linkLabel?: string; again?: string }
}

type Phase = "idle" | "pending" | "done"
export type FieldErrors = Partial<Record<string, string[]>>

/** 제출 흐름. required: 비면 안 되는 칸 이름. onFieldErrors: 오류가 난 칸 이름들(단계 폼이 그 단계로 옮길 때). */
export function useFormFlow(
  submit: ContactSubmit,
  {
    id,
    required = [],
    requiredMessage,
    onFieldErrors,
    notices,
    timeoutMs = SUBMIT_TIMEOUT_MS,
  }: { id: string; required?: string[]; requiredMessage: string; onFieldErrors?: (names: string[]) => void; notices?: SubmitNotices; timeoutMs?: number },
) {
  // 폼·알림·접수 제목은 id 로 찾는다(ref 를 흐름 객체에 싣지 않는다 — 렌더에서 흐름 값을 읽는 조각들이 ref 를 건드리지 않게)
  const formId = `${id}-form`
  const alertId = `${id}-alert`
  const doneId = `${id}-done-title`
  const el = (x: string) => document.getElementById(x)
  const [phase, setPhase] = React.useState<Phase>("idle")
  // 두 번 보내기 막기: 상태(phase)는 다시 그린 뒤에야 바뀌므로 같은 틱에 온 두 번째 submit(Enter 연타·버튼 두 번)은 ref 로 막는다.
  const sending = React.useRef(false)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [rawError, setFormError] = React.useState<Notice | null>(null)
  const cooldown = useCooldown()
  // 요청 제한 알림은 남은 초가 끝나면 스스로 사라진다(그때부터 다시 보낼 수 있다)
  const formError = rawError && !(rawError.kind === "rate_limited" && cooldown.seconds === 0) ? rawError : null
  const [receipt, setReceipt] = React.useState<ContactReceipt | null>(null)
  // 포커스는 오류가 화면에 그려진 뒤에 옮긴다(단계 폼은 그 단계를 먼저 연다).
  const [focusTick, setFocusTick] = React.useState<{ to: "field" | "alert" | "done"; n: number } | null>(null)
  React.useEffect(() => {
    if (!focusTick) return
    const find = (x: string) => document.getElementById(x)
    if (focusTick.to === "field") find(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    else find(focusTick.to === "alert" ? alertId : doneId)?.focus()
  }, [focusTick, formId, alertId, doneId])
  const focus = (to: "field" | "alert" | "done") => setFocusTick((t) => ({ to, n: (t?.n ?? 0) + 1 }))

  const read = (): ContactFormInput => {
    const out: ContactFormInput = {}
    const form = el(formId)
    if (!(form instanceof HTMLFormElement)) return out
    for (const [k, v] of new FormData(form)) if (typeof v === "string") out[k] = v.trim()
    return out
  }
  const showFieldErrors = (errs: FieldErrors, text: string | null, code?: string, retryable?: boolean) => {
    setFieldErrors(errs)
    setFormError(text ? { text, kind: "field", code, retryable } : null)
    const names = Object.keys(errs).filter((k) => errs[k]?.length)
    onFieldErrors?.(names)
    focus(names.length ? "field" : "alert")
  }
  /** 필수 칸만 먼저 본다(단계 폼의 「다음」도 쓴다). 문제가 없으면 true. */
  const check = (names: string[]): boolean => {
    const input = read()
    const empty = names.filter((n) => !input[n])
    if (!empty.length) return true
    showFieldErrors(Object.fromEntries(empty.map((n) => [n, [requiredMessage]])), null)
    return false
  }
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending.current || cooldown.seconds > 0) return
    if (!check(required)) return
    const input = read()
    sending.current = true
    setPhase("pending")
    setFormError(null)
    let r: Awaited<ReturnType<typeof settleWithin<ContactReceipt>>>
    try {
      r = notices ? await settleWithin(() => submit(input), timeoutMs) : await submit(input)
    } finally {
      sending.current = false
    }
    if (r === TIMED_OUT) {
      setPhase("idle")
      setFieldErrors({})
      setFormError({ kind: "timeout", text: notices?.timeout.body ?? "", canRetry: true, retryable: true })
      focus("alert")
      return
    }
    if (r.ok) {
      setFieldErrors({})
      setReceipt(r.data)
      setPhase("done")
      focus("done")
      return
    }
    setPhase("idle")
    const gate = notices ? failureKind(r) : "other"
    if (gate === "rate_limited") {
      cooldown.start(cooldownSeconds(r.retryAfter))
      setFieldErrors({})
      setFormError({ kind: "rate_limited", text: r.formError ?? "", code: r.code, retryable: true })
      return focus("alert")
    }
    if (gate === "approval" && notices?.approval) {
      // 승인 대기는 실패가 아니다(R21) — 입력은 그대로, 다시 시도하지 않고 사람이 직접 확정하도록 알린다
      setFieldErrors({})
      setFormError({ kind: "approval", text: r.formError ?? "", code: r.code, retryable: false })
      return focus("alert")
    }
    if (gate === "unsupported") {
      setFieldErrors({})
      setFormError({ kind: "unsupported", text: r.formError ?? "", manageUrl: safeManageUrl(r.manageUrl), code: r.code, retryable: false })
      return focus("alert")
    }
    if (r.fieldErrors && Object.values(r.fieldErrors).some((v) => v?.length)) return showFieldErrors(r.fieldErrors, r.formError ?? null, r.code, r.retryable)
    setFieldErrors({})
    setFormError({ text: r.formError ?? "", kind: "server", code: r.code, retryable: r.retryable })
    focus("alert")
  }
  /** 시간 초과 뒤 [다시 시도] — 입력은 그대로 두고 같은 폼을 다시 보낸다 */
  const retry = () => {
    setFormError(null)
    ;(el(formId) as HTMLFormElement | null)?.requestSubmit?.()
  }
  const reset = () => {
    setReceipt(null)
    setPhase("idle")
    setFieldErrors({})
    setFormError(null)
  }
  // 칸을 고치면 그 칸 오류를 지운다(다시 보낼 때까지 남은 오류가 거짓말이 되지 않게).
  const clear = (name: string) => setFieldErrors((f) => (f[name] ? { ...f, [name]: undefined } : f))
  return { formId, alertId, doneId, read, phase, pending: phase === "pending", fieldErrors, formError, receipt, check, onSubmit, reset, clear, notices, cooldown: cooldown.seconds, retry }
}
export type FormFlow = ReturnType<typeof useFormFlow>

const errId = (id: string, name: string) => `${id}-${name}-error`
/** 칸 하나에 붙일 오류 속성(aria-invalid · aria-describedby). hint 가 있으면 그 id 도 잇는다. */
export function fieldAria(flow: FormFlow, id: string, name: string, hintId?: string) {
  const bad = !!flow.fieldErrors[name]?.length
  const described = [bad ? errId(id, name) : null, hintId].filter(Boolean).join(" ")
  return { "aria-invalid": bad || undefined, "aria-describedby": described || undefined, onInput: () => flow.clear(name) }
}
/** 칸 아래 오류 문구(없으면 그리지 않는다). */
export function FieldMessage({ flow, id, name }: { flow: FormFlow; id: string; name: string }) {
  const errs = flow.fieldErrors[name]
  if (!errs?.length) return null
  return <FieldError id={errId(id, name)}>{errs.join(" ")}</FieldError>
}

/** 글 칸 하나(라벨 · 입력 · 오류). multiline 이면 여러 줄. */
export function TextField({
  flow,
  id,
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  format,
  placeholder,
  multiline = false,
  required = false,
  className,
}: {
  flow: FormFlow
  id: string
  name: string
  label: string
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  // 입력 서식(대장 A43) — 전화번호 자동 하이픈·사업자등록번호 3-2-5
  format?: InputFormat
  placeholder?: string
  multiline?: boolean
  required?: boolean
  className?: string
}) {
  const inputId = `${id}-${name}`
  const aria = fieldAria(flow, id, name)
  return (
    <Field className={cn("min-w-0", className)} data-invalid={aria["aria-invalid"]}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={inputId} name={name} placeholder={placeholder} aria-required={required || undefined} className="min-h-32" {...aria} />
      ) : (
        <Input id={inputId} name={name} type={type} autoComplete={autoComplete} autoCapitalize={type === "email" ? "off" : undefined} spellCheck={type === "email" || type === "password" ? false : undefined} inputMode={inputMode} placeholder={placeholder} aria-required={required || undefined} {...aria} onInput={(e) => { aria.onInput(); if (format) applyInputFormat(e.currentTarget, format, e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing) }} />
      )}
      <FieldMessage flow={flow} id={id} name={name} />
    </Field>
  )
}

/** 폼 위 알림 — 서버 오류(입력 보존)·필드 오류 요약. 포커스를 받을 수 있다(tabIndex -1). 비었을 때도 자리(role=alert)는 둔다. */
export function FormAlert({ flow, copy }: { flow: FormFlow; copy: FormFlowCopy }) {
  const e = flow.formError
  // 칸 오류 요약(UX H06): 보내기가 칸 오류로 막히면 폼 맨 위 알림(role=alert)에 칸마다 한 줄 — 누르면 그 칸으로 간다. 칸을 고치면 그 줄이 사라진다.
  const base = (flow.formId ?? "").replace(/-form$/, "")
  const summary = Object.entries(flow.fieldErrors ?? {}).filter(([, v]) => v?.length).map(([name, v]) => ({ name, message: (v ?? []).join(" ") }))
  const goTo = (name: string) => (ev: React.MouseEvent) => {
    ev.preventDefault()
    document.getElementById(`${base}-${name}`)?.focus()
  }
  const list = summary.length ? (
    <ul data-error-summary="" className="flex list-disc flex-col gap-1 ps-5">
      {summary.map((s) => (
        <li key={s.name}>
          <a href={`#${base}-${s.name}`} onClick={goTo(s.name)} className="relative underline underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3">
            {s.message}
          </a>
        </li>
      ))}
    </ul>
  ) : null
  return (
    <>
      <div id={flow.alertId} tabIndex={-1} role={e?.kind === "approval" ? "status" : "alert"} className="outline-hidden empty:hidden focus-visible:ring-3 focus-visible:ring-ring">
        {!e && list ? (
          <div className="flex items-start gap-3 border border-destructive px-4 py-3 text-base leading-[1.6] data-[state=awaiting-approval]:border-foreground">
            <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" />
            <div className="flex flex-col gap-1">
              <p className="text-base leading-[1.5] font-heading">{copy.fieldErrorTitle}</p>
              {list}
            </div>
          </div>
        ) : null}
        {e ? (
          <div {...noticeAttrs(e)} className="flex items-start gap-3 border border-destructive px-4 py-3 text-base leading-[1.6] data-[state=awaiting-approval]:border-foreground">
            {e.kind === "approval" ? <Clock aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" data-wait="" /> : <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" />}
            <div className="flex flex-col gap-1">
              <p className="text-base leading-[1.5] font-heading">{noticeTitle(e, flow.notices, { field: copy.fieldErrorTitle, server: copy.errorTitle })}</p>
              {e.kind === "approval" ? <ApprovalLines notice={e} notices={flow.notices} /> : e.text ? <p>{e.text}</p> : null}
              {e.kind === "approval" ? null : list}
              <SubmitExtras notice={e} notices={flow.notices} cooldown={0} onRetry={flow.retry} />
            </div>
          </div>
        ) : null}
      </div>
      {flow.cooldown > 0 ? <SubmitExtras notice={null} notices={flow.notices} cooldown={flow.cooldown} onRetry={flow.retry} /> : null}
    </>
  )
}

/**
 * 보내기 버튼 — 보내는 중이면 aria-disabled + 「보내는 중」. 포커스는 버튼에 남고, 다시 누르거나 Enter 를 쳐도 흐름(useFormFlow)이 두 번 보내지 않는다.
 * approval: 사람 승인 행동의 제출이면 {행동, 안내 글} — 버튼 앞에 안내 글을 그리고 data-requires-human·aria-describedby 를 단다(R18, P3-7 AXWF). 문의·예약 요청(fill-human-press)에는 쓰지 않는다.
 */
export function SubmitButton({ flow, copy, className, size = "lg", approval }: { flow: FormFlow; copy: FormFlowCopy; className?: string; size?: "default" | "lg"; approval?: { action: HumanApprovalAction; hint: string } }) {
  const hintId = `${flow.formId}-approval-hint`
  const held = flow.cooldown > 0 && flow.notices ? fillText(flow.notices.rateLimited, { seconds: flow.cooldown }) : null
  const spin = usePendingGate(flow.pending)
  const button = (
    <Button type="submit" size={size} /* icon-label: 글자(보내기·보내는 중·남은 초)가 늘 보인다 — size 는 default·lg 뿐 */ aria-disabled={flow.pending || held !== null || undefined} className={className} {...(approval ? humanApprovalProps(approval.action, hintId) : {})}>
      {spin ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {flow.pending ? copy.pendingLabel : (held ?? copy.submitLabel)}
    </Button>
  )
  return approval ? (
    <>
      <ApprovalHint id={hintId}>{approval.hint}</ApprovalHint>
      {button}
    </>
  ) : (
    button
  )
}

/** 접수 결과 — 폼 자리를 대신한다. 제목에 포커스(읽기 도구가 바로 읽는다). 창이 안 열렸을 때 쓸 링크·복사할 글도 그린다. */
export function FormDone({ flow, copy }: { flow: FormFlow; copy: FormFlowCopy }) {
  const r = flow.receipt ?? {}
  return (
    <div role="status" className="flex flex-col items-start gap-3 border px-6 py-8">
      <CheckCircle aria-hidden="true" className="size-8" />
      <h3 tabIndex={-1} id={flow.doneId} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
        {copy.done.title}
      </h3>
      <p className="text-base leading-[1.7]">{r.nextStep ?? r.message ?? copy.done.body}</p>
      {r.id && copy.done.idLabel ? (
        <p className="text-base leading-[1.7]">
          {copy.done.idLabel} <span data-numeric>{r.id}</span>
        </p>
      ) : null}
      {r.text ? <pre className="w-full overflow-x-auto border bg-muted px-4 py-3 text-base leading-[1.6] whitespace-pre-wrap">{r.text}</pre> : null}
      <div className="flex flex-wrap gap-3 pt-2">
        {r.href && copy.done.linkLabel ? (
          <Button variant="outline" nativeButton={false} render={<a href={r.href} />}>
            {copy.done.linkLabel}
          </Button>
        ) : null}
        {copy.done.again ? (
          <Button type="button" variant="ghost" onClick={flow.reset}>
            {copy.done.again}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
