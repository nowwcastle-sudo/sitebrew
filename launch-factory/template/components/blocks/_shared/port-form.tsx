"use client"

import * as React from "react"

import type { ActionResult } from "@/components/contract/block-contract"
import { humanApprovalProps, type HumanApprovalAction } from "@/components/contract/human-actions"
import { AlertCircle, Clock, Eye, EyeOff, LoaderCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { usePendingGate } from "@/components/ui/spinner"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"

import { fillText } from "../_shared/billing-format"
import { ApprovalHint } from "../_shared/human-approval"
import { applyInputFormat, type InputFormat } from "../_shared/input-format"
import { ApprovalLines, SUBMIT_TIMEOUT_MS, SubmitExtras, TIMED_OUT, cooldownSeconds, failureKind, noticeAttrs, noticeTitle, safeManageUrl, settleWithin, useCooldown, type Notice, type SubmitNotices } from "../_shared/submit-guard"

// 포트 폼(P3-2 레인 D1 공유 조각 block-shared-port-form — auth·account 폼이 같이 쓴다). 마케팅 규칙 O2(factory-rules.md §22-3):
//   · 라벨은 늘 보이고 필수·선택 표시를 둘 다 한다(label 옆 marker).
//   · 검증은 칸을 떠날 때 한다 — 값이 있거나 이미 오류인 칸만(처음 지나가는 빈 칸을 나무라지 않는다). 떠날 때는 포커스를 옮기지 않는다.
//   · 오류 문구는 「무엇이 잘못됐고 어떻게 고치나」(문구는 블록 copy 가 준다). 입력은 비제어(FormData)라 오류 뒤에도 적은 값이 남는다.
//   · 보낼 때: 모든 칸 검증 → 첫 오류 칸에 포커스. 포트가 fieldErrors 를 주면 같은 자리에, formError 만 주면 폼 위 알림(role=alert)에 포커스.
//   · 보내는 중: 폼 aria-busy, 보내기 버튼은 aria-disabled(포커스가 버튼에 남는다 — disabled 는 포커스를 body 로 떨어뜨린다).
//   · 제출 보호(Task 10d, submit-guard): 15초 안에 답이 없으면 「응답이 늦어요」 + [다시 시도](입력 그대로), 실패 code rate_limited 는 보내기 버튼이 남은 초를
//     보이며 잠기고, provider_unsupported 는 manageUrl 링크를 보인다. notices(블록 copy)가 있을 때만 켜진다.

// 포인터를 누르고 있는 동안의 칸 검사는 뗀 뒤로 미룬다(REL11 — launch-factory LFADB 발견: 진짜 마우스로 보내기 단추를 누르면 제출도 포커스 이동도 안 일어났다).
// 원인: 단추를 누르는 순간(mousedown) 칸이 포커스를 잃어 칸 검사(blur)가 오류 문구를 그리고, 문구가 단추를 아래로 밀어 버려 손을 뗄 때(mouseup)
// 포인터가 단추 밖에 있다 — click 이 안 나가 제출(첫 오류 칸 포커스)이 일어나지 않고 포커스는 눌린 단추에 남는다. JS `.click()` 은 mousedown 이 없어 가렸다.
// 그래서 누르는 중에 온 칸 검사는 뗀 직후(click 이 지난 뒤)로 미룬다 — 제출이 일어나면 제출 검사가 모든 칸을 보고, 아니면 그때 오류가 그려진다. 키보드 이동은 영향이 없다.
const subscribeNever = () => () => {}
let pointerPressed = false
let pressListeners = 0
const afterPress = new Set<() => void>()
const onPressDown = (e: PointerEvent) => {
  if (e.isPrimary && e.button === 0) pointerPressed = true
}
const onPressEnd = () => {
  if (!pointerPressed) return
  pointerPressed = false
  // click 은 pointerup 바로 뒤에 나간다 — 한 틱 뒤에 돌려야 click(제출)이 먼저다
  setTimeout(() => {
    const run = [...afterPress]
    afterPress.clear()
    for (const fn of run) fn()
  }, 0)
}
function usePressTracking() {
  React.useEffect(() => {
    if (pressListeners++ === 0) {
      document.addEventListener("pointerdown", onPressDown, true)
      document.addEventListener("pointerup", onPressEnd, true)
      document.addEventListener("pointercancel", onPressEnd, true)
    }
    return () => {
      if (--pressListeners === 0) {
        document.removeEventListener("pointerdown", onPressDown, true)
        document.removeEventListener("pointerup", onPressEnd, true)
        document.removeEventListener("pointercancel", onPressEnd, true)
        pointerPressed = false
        afterPress.clear()
      }
    }
  }, [])
}
/** 포인터를 누르는 중이면 뗀 뒤로 미루고, 아니면 바로 한다 */
function runAfterPress(fn: () => void) {
  if (pointerPressed) afterPress.add(fn)
  else fn()
}

export type FieldErrors = Partial<Record<string, string[]>>
/** 칸 검사 — 문제가 있으면 문구, 없으면 null */
export type Validate = (value: string) => string | null

/**
 * onError: 오류가 날 때마다(칸 검사·포트 결과) — 블록이 계측(form_error — 칸 이름만, 값은 싣지 않는다)에 쓴다.
 * notices: 제출 보호 문구(submit-guard) — 주면 시간 초과·요청 제한·지원 안 함 갈래가 켜진다. timeoutMs 는 시험용(기본 15초).
 */
export function usePortForm({
  id,
  validators = {},
  onError,
  notices,
  timeoutMs = SUBMIT_TIMEOUT_MS,
}: {
  id: string
  validators?: Record<string, Validate>
  onError?: (e: { kind: "field" | "server"; fields: string[] }) => void
  notices?: SubmitNotices
  timeoutMs?: number
}) {
  const formId = `${id}-form`
  const alertId = `${id}-alert`
  const [pending, setPending] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  // 오류 요약(UX H06): 보내기가 칸 오류로 막힌 뒤에만 폼 맨 위에 모아 보인다 — 칸을 떠날 때의 검사(blur)는 요약을 켜지 않는다. 오류가 다 지워지면 스스로 사라진다.
  const [summaryOn, setSummaryOn] = React.useState(false)
  const [rawError, setFormError] = React.useState<Notice | null>(null)
  const cooldown = useCooldown()
  usePressTracking()
  // 요청 제한 알림은 남은 초가 끝나면 스스로 사라진다(그때부터 다시 보낼 수 있다)
  const formError = rawError && !(rawError.kind === "rate_limited" && cooldown.seconds === 0) ? rawError : null
  const [focusTick, setFocusTick] = React.useState<{ to: "field" | "alert"; n: number } | null>(null)
  React.useEffect(() => {
    if (!focusTick) return
    if (focusTick.to === "field") document.getElementById(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    else document.getElementById(alertId)?.focus()
  }, [focusTick, formId, alertId])
  const focus = (to: "field" | "alert") => setFocusTick((t) => ({ to, n: (t?.n ?? 0) + 1 }))

  const read = (): Record<string, string> => {
    const out: Record<string, string> = {}
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return out
    for (const [k, v] of new FormData(form)) if (typeof v === "string") out[k] = v.trim()
    return out
  }
  const check = (name: string, value: string) => validators[name]?.(value) ?? null
  // 필수 칸 = 빈 값을 검사기가 거절하는 칸(aria-required 의 근거 — 필수 표시(marker)와 같은 검사기 한 곳에서 나온다)
  // 검사기가 DOM 을 읽을 수 있어(read) 서버·첫 하이드레이션 값이 다를 수 있다 — 붙은 뒤에만 켜서 하이드레이션 불일치를 만들지 않는다.
  const mounted = React.useSyncExternalStore(subscribeNever, () => true, () => false)
  const required = (name: string) => {
    if (!mounted) return false
    try {
      return !!validators[name]?.("")
    } catch {
      return false
    }
  }
  // 제출(칸 검사·포트 쓰기)이 일어날 때마다 올리는 번호(REL12 — launch-factory P1AB 발견: 마우스로 [다음]을 누르면 비밀번호 칸의 이동 검사가
  // setTimeout(0) 뒤에 돌아 방금 제출이 그린 앱의 칸 오류를 「길이 통과」로 지웠다). 누르는 중에 예약된 칸 검사는 예약한 때의 번호가 바뀌었으면
  // (그 사이 제출이 오류를 정했으면) 낡은 결과라 버린다 — 제출 결과가 늘 이긴다. 키보드 이동은 영향이 없다.
  const submitStamp = React.useRef(0)
  /** 칸을 떠날 때(포커스는 그대로) */
  const blur = (name: string) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim()
    if (!value && !fieldErrors[name]?.length) return
    const stamp = submitStamp.current
    runAfterPress(() => {
      if (submitStamp.current !== stamp) return
      const msg = check(name, value)
      setFieldErrors((f) => ({ ...f, [name]: msg ? [msg] : undefined }))
    })
  }
  const clear = (name: string) => setFieldErrors((f) => (f[name] ? { ...f, [name]: undefined } : f))
  /** 칸 이름들을 모두 검사한다. 통과하면 값, 아니면 null(오류를 그리고 첫 오류 칸에 포커스) */
  const validate = (names: string[], values: Record<string, string> = read()): Record<string, string> | null => {
    submitStamp.current++
    const errs: FieldErrors = {}
    for (const n of names) {
      const msg = check(n, values[n] ?? "")
      if (msg) errs[n] = [msg]
    }
    if (!Object.keys(errs).length) return values
    setFieldErrors(errs)
    setSummaryOn(true)
    setFormError(null)
    focus("field")
    onError?.({ kind: "field", fields: Object.keys(errs) })
    return null
  }
  /** 시간 초과 뒤 [다시 시도]: 부른 쪽이 준 retry, 없으면 폼을 다시 보낸다(폼이 없으면 버튼이 없다) */
  const retryRef = React.useRef<(() => void) | null>(null)
  const retry = () => {
    setFormError(null)
    const again = retryRef.current
    if (again) again()
    else (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit?.()
  }
  /**
   * 포트 쓰기 하나를 부른다. 성공이면 data, 실패면 null(오류를 그리고 포커스를 옮긴다). 보내는 중·요청 제한 대기 중에는 다시 부르지 않는다.
   * opts.retry: 시간 초과 뒤 [다시 시도]가 부를 것(폼 제출이 아닌 버튼·소셜 로그인처럼 폼을 다시 보내서는 안 되는 자리).
   */
  const run = async <T,>(action: () => Promise<ActionResult<T>>, opts: { retry?: () => void } = {}): Promise<T | null> => {
    if (pending || cooldown.seconds > 0) return null
    submitStamp.current++
    setPending(true)
    setSummaryOn(false)
    setFormError(null)
    retryRef.current = opts.retry ?? null
    const r = notices ? await settleWithin(action, timeoutMs) : await action()
    submitStamp.current++
    setPending(false)
    if (r === TIMED_OUT) {
      setFieldErrors({})
      setFormError({ kind: "timeout", text: notices?.timeout.body ?? "", canRetry: !!opts.retry || !!document.getElementById(formId), retryable: true })
      focus("alert")
      onError?.({ kind: "server", fields: [] })
      return null
    }
    if (r.ok) {
      setFieldErrors({})
      return r.data
    }
    const gate = notices ? failureKind(r) : "other"
    if (gate === "rate_limited") {
      cooldown.start(cooldownSeconds(r.retryAfter))
      setFieldErrors({})
      setFormError({ kind: "rate_limited", text: r.formError ?? "", code: r.code, retryable: true })
      focus("alert")
      onError?.({ kind: "server", fields: [] })
      return null
    }
    // 확인 입력 칸 오류(탈퇴의 입력한 이메일이 틀림 — fieldErrors.confirmEmail, P3-7 AXC)는 승인 대기 알림이 아니라 그 칸 옆 오류로 그린다(`confirmed` 칸은 알림이 맡는다)
    const ownFieldError = Object.entries(r.fieldErrors ?? {}).some(([k, v]) => k !== "confirmed" && v?.length && document.getElementById(`${id}-${k}`))
    if (gate === "approval" && notices?.approval && !ownFieldError) {
      // 승인 대기는 실패가 아니다(R21) — 입력은 그대로, 다시 시도하지 않고 사람이 직접 확정하도록 알린다
      setFieldErrors({})
      setFormError({ kind: "approval", text: r.formError ?? "", code: r.code, retryable: false })
      focus("alert")
      return null
    }
    if (gate === "unsupported") {
      setFieldErrors({})
      setFormError({ kind: "unsupported", text: r.formError ?? "", manageUrl: safeManageUrl(r.manageUrl), code: r.code, retryable: false })
      focus("alert")
      onError?.({ kind: "server", fields: [] })
      return null
    }
    const fe = r.fieldErrors && Object.values(r.fieldErrors).some((v) => v?.length) ? r.fieldErrors : null
    if (fe && Object.keys(fe).some((k) => document.getElementById(`${id}-${k}`))) {
      setFieldErrors(fe)
      setSummaryOn(true)
      setFormError(r.formError ? { text: r.formError, kind: "field", code: r.code, retryable: r.retryable } : null)
      focus("field")
      onError?.({ kind: "field", fields: Object.keys(fe) })
    } else {
      setFieldErrors({})
      setFormError({ text: [r.formError, ...Object.values(fe ?? {}).flat()].filter(Boolean).join(" "), kind: fe ? "field" : "server", code: r.code, retryable: r.retryable })
      focus("alert")
      onError?.({ kind: fe ? "field" : "server", fields: Object.keys(fe ?? {}) })
    }
    return null
  }
  /** 오류를 그리고 첫 오류 칸에 포커스(단계 폼이 앞 단계로 돌아가며 그 칸 오류를 보일 때) */
  const showErrors = (errs: FieldErrors) => {
    submitStamp.current++
    setFieldErrors(errs)
    setSummaryOn(true)
    setFormError(null)
    focus("field")
  }
  const errorSummary = summaryOn ? Object.entries(fieldErrors).filter(([, v]) => v?.length).map(([name, v]) => ({ name, message: (v ?? []).join(" ") })) : []
  return { id, formId, alertId, pending, fieldErrors, errorSummary, required, formError, blur, clear, validate, run, read, showErrors, notices, cooldown: cooldown.seconds, holdLabel: cooldown.seconds > 0 && notices ? fillText(notices.rateLimited, { seconds: cooldown.seconds }) : undefined, retry }
}
export type PortForm = ReturnType<typeof usePortForm>

const errId = (form: PortForm, name: string) => `${form.id}-${name}-error`
/** 칸 하나에 붙일 오류 속성(aria-invalid · aria-describedby) — 설명(hint) id 도 잇는다 */
export function fieldAria(form: PortForm, name: string, hintId?: string) {
  const bad = !!form.fieldErrors[name]?.length
  const described = [bad ? errId(form, name) : null, hintId].filter(Boolean).join(" ")
  // 필수 칸은 읽기 도구가 필수라고 읽게 한다(UX H06) — 눈에 보이는 「(필수)」 표시와 같은 검사기에서 나온다
  return { "aria-invalid": bad || undefined, "aria-describedby": described || undefined, "aria-required": form.required(name) ? (true as const) : undefined }
}
/** 칸 아래 오류 문구(없으면 그리지 않는다) */
export function FieldMessage({ form, name }: { form: PortForm; name: string }) {
  const errs = form.fieldErrors[name]
  if (!errs?.length) return null
  return <FieldError id={errId(form, name)}>{errs.join(" ")}</FieldError>
}

/** 글 칸 하나: 라벨(+ 필수·선택 표시) · 입력 · 설명 · 오류. 입력 id 는 `${form.id}-${name}` */
export function FormField({
  form,
  name,
  label,
  marker,
  type = "text",
  autoComplete,
  inputMode,
  format,
  showLabel,
  capsLockNote,
  hint,
  maxLength,
  placeholder,
  defaultValue,
  className,
}: {
  form: PortForm
  name: string
  label: string
  marker?: string
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  // 입력 서식(대장 A43) — 전화번호 자동 하이픈·사업자등록번호 3-2-5
  format?: InputFormat
  // 비밀번호 칸(type="password")의 「비밀번호 보기」 토글 이름(대장 A41 — aria-pressed, 이름은 바뀌지 않는다)과 Caps Lock 안내 문구. showLabel 이 있을 때만 토글을 그린다
  showLabel?: string
  capsLockNote?: string
  hint?: string
  maxLength?: number
  placeholder?: string
  defaultValue?: string
  className?: string
}) {
  const inputId = `${form.id}-${name}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const aria = fieldAria(form, name, hintId)
  const [shown, setShown] = React.useState(false)
  const [caps, setCaps] = React.useState(false)
  const toggle = type === "password" && showLabel ? showLabel : null
  const onInput = (e: React.InputEvent<HTMLInputElement>) => {
    form.clear(name)
    if (format) applyInputFormat(e.currentTarget, format, e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing)
  }
  return (
    <Field className={cn("min-w-0", className)} data-invalid={aria["aria-invalid"]}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {marker ? <span className="ms-1 text-base">{marker}</span> : null}
      </FieldLabel>
      {toggle ? (
        <InputGroup className="w-full">
          <InputGroupInput
            id={inputId}
            name={name}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            autoCapitalize="off"
            spellCheck={false}
            inputMode={inputMode}
            maxLength={maxLength}
            placeholder={placeholder}
            defaultValue={defaultValue}
            onBlur={(e) => {
              setCaps(false)
              form.blur(name)(e)
            }}
            onInput={onInput}
            onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
            onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
            {...aria}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" aria-label={toggle} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
              {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Input
          id={inputId}
          name={name}
          type={type}
          autoComplete={autoComplete}
          autoCapitalize={type === "email" ? "off" : undefined}
          spellCheck={type === "email" || type === "password" ? false : undefined}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          defaultValue={defaultValue}
          onBlur={form.blur(name)}
          onInput={onInput}
          {...aria}
        />
      )}
      {toggle && capsLockNote ? (
        <>
          <span role="status" className="sr-only">
            {caps ? capsLockNote : ""}
          </span>
          {caps ? (
            <p aria-hidden="true" data-caps-lock="" className="text-base leading-[1.5] text-foreground">
              {capsLockNote}
            </p>
          ) : null}
        </>
      ) : null}
      {hint ? (
        <FieldDescription id={hintId} className="text-base leading-[1.6] text-foreground">
          {hint}
        </FieldDescription>
      ) : null}
      <FieldMessage form={form} name={name} />
    </Field>
  )
}

/**
 * 폼 위 알림 — 서버 오류(입력 보존)·필드 오류 요약. 포커스를 받는다(tabIndex -1). 비었을 때도 자리(role=alert)는 둔다.
 * 승인 대기(code confirmation_required·옛 이름 approval_required — R21)는 실패가 아니라 role="status" 로 알린다: 오류 색이 아니고 data-state="awaiting-approval", 본문은 attempted → progress → 왜 → next → route.
 */
export function FormAlert({ form, fieldTitle, serverTitle }: { form: PortForm; fieldTitle: string; serverTitle: string }) {
  const e = form.formError
  // 칸 오류 요약(UX H06): 보내기가 칸 오류로 막히면 폼 맨 위 알림(role=alert)에 칸마다 한 줄 — 누르면 그 칸으로 간다. 서버가 따로 알림 글(formError)을 줬으면 그 글 아래에 같이 둔다.
  const summary = form.errorSummary ?? []
  const goTo = (name: string) => (ev: React.MouseEvent) => {
    ev.preventDefault()
    document.getElementById(`${form.id}-${name}`)?.focus()
  }
  const list = summary.length ? (
    <ul data-error-summary="" className="flex list-disc flex-col gap-1 ps-5">
      {summary.map((s) => (
        <li key={s.name}>
          <a href={`#${form.id}-${s.name}`} onClick={goTo(s.name)} className="relative underline underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3">
            {s.message}
          </a>
        </li>
      ))}
    </ul>
  ) : null
  return (
    <>
      <div id={form.alertId} tabIndex={-1} role={e?.kind === "approval" ? "status" : "alert"} className="outline-hidden empty:hidden focus-visible:ring-3 focus-visible:ring-ring">
        {!e && list ? (
          <div className="flex items-start gap-3 border border-destructive px-4 py-3 text-base leading-[1.6] data-[state=awaiting-approval]:border-foreground">
            <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base leading-[1.5] font-heading">{fieldTitle}</p>
              {list}
            </div>
          </div>
        ) : null}
        {e ? (
          <div {...noticeAttrs(e)} className="flex items-start gap-3 border border-destructive px-4 py-3 text-base leading-[1.6] data-[state=awaiting-approval]:border-foreground">
            {e.kind === "approval" ? <Clock aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" data-wait="" /> : <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive data-[wait]:text-foreground" />}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base leading-[1.5] font-heading">{noticeTitle(e, form.notices, { field: fieldTitle, server: serverTitle })}</p>
              {e.kind === "approval" ? <ApprovalLines notice={e} notices={form.notices} /> : e.text ? <p>{e.text}</p> : null}
              {e.kind === "approval" ? null : list}
              <SubmitExtras notice={e} notices={form.notices} cooldown={0} onRetry={form.retry} />
            </div>
          </div>
        ) : null}
      </div>
      {form.cooldown > 0 ? <SubmitExtras notice={null} notices={form.notices} cooldown={form.cooldown} onRetry={form.retry} /> : null}
    </>
  )
}

/**
 * 보내기 버튼 — 보내는 중이면 aria-disabled(포커스 유지) + 돌아가는 표시 + pendingLabel, 요청 제한 대기 중이면 남은 초(notices.rateLimited).
 * approval: 사람 승인 행동의 제출이면 {행동, 안내 글} — 버튼 앞에 짧은 안내 글(ApprovalHint)을 그리고 버튼에 data-requires-human·aria-describedby 를 단다(R18, P3-7 AXWF).
 *   outside: true 면 안내 글을 여기서 그리지 않는다 — 버튼 곁이 가로 줄(flex 행)인 블록이 안내 글을 줄 밖 별도 줄에 직접 그린다(`approvalHintId(form)` 이 가리킬 id, FINAL-WF3 —
 *   안내 글이 행 안에 들어가 입력칸을 찌그러뜨렸다).
 */
export const approvalHintId = (form: Pick<PortForm, "formId">) => `${form.formId}-approval-hint`
export function SubmitButton({ form, label, pendingLabel, className, approval }: { form: PortForm; label: string; pendingLabel: string; className?: string; approval?: { action: HumanApprovalAction; hint: string; outside?: boolean } }) {
  const hintId = approvalHintId(form)
  const held = form.cooldown > 0 && form.notices ? fillText(form.notices.rateLimited, { seconds: form.cooldown }) : null
  const spin = usePendingGate(form.pending)
  const button = (
    <Button type="submit" size="lg" /* icon-label: 글자(label·pendingLabel·남은 초)가 늘 보인다 */ disabled={form.pending || held !== null} focusableWhenDisabled className={cn("w-full sm:w-auto", className)} {...(approval ? humanApprovalProps(approval.action, hintId) : {})}>
      {spin ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
      {form.pending ? pendingLabel : (held ?? label)}
    </Button>
  )
  return approval && !approval.outside ? (
    <>
      <ApprovalHint id={hintId}>{approval.hint}</ApprovalHint>
      {button}
    </>
  ) : (
    button
  )
}

/** 포트가 준 redirectUrl 로 간다(공급자 로그인·호스팅 결제창·결제수단 변경). onRedirect 를 주면 그것이 간다(앱 라우터·새 창 등) */
export function goTo(url: string, onRedirect?: (url: string) => void) {
  if (onRedirect) onRedirect(url)
  else window.location.assign(url)
}
