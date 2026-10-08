"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import type { AuthPort, DeviceSession, Session } from "@/registry/factory/contract/ports"
import { CheckCircle, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { formatFrom, fillText } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, FormField, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 계정 보안(A46) — 위: 로그인된 기기 목록(이 기기는 「이 기기」 표시만 — 끊는 버튼이 없다, 다른 기기마다 [로그아웃], 아래 [다른 기기 모두 로그아웃]).
// 아래: 2단계 인증 켜기·끄기 — 켜기는 비밀번호 확인 → 설정 키·백업 코드(이때 한 번만)·첫 코드 확인(verifyTwoFactor) 뒤에야 켜지고, 끄기는 비밀번호 확인 뒤 끈다.
// 포트: session·listSessions·revokeSession·revokeOtherSessions·enableTwoFactor·disableTwoFactor·verifyTwoFactor — 모두 선택 메서드다(계약 판 2 안의 추가).
// 어댑터가 없는 메서드는 props 를 주지 않으면 그 구역이 나오지 않는다(죽은 버튼 없음). 세션 토큰은 포트가 내보내지 않으므로 화면에도 없다.
// QR 코드는 그리지 않는다(QR 라이브러리 없음) — 설정 키 글자와 「인증 앱에서 열기」 링크(otpauth 주소)를 준다.
export type AccountSecurityCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  sessions: {
    title: string
    body: string
    current: string
    lastActive: string
    signedIn: string
    revoke: string
    revokeLabel: string
    revokeOthers: string
    pending: string
    revokedOne: string
    revokedOthers: string
    empty: string
    errorTitle: string
  }
  twoFactor: {
    title: string
    on: string
    off: string
    bodyOn: string
    bodyOff: string
    enable: string
    disable: string
    password: { label: string; marker: string; hint: string; required: string }
    cancel: string
    continueEnable: string
    continueDisable: string
    pending: string
    setupTitle: string
    setupBody: string
    keyLabel: string
    openApp: string
    backupTitle: string
    backupBody: string
    code: { label: string; marker: string; hint: string; required: string; format: string }
    verify: string
    verifying: string
    enabled: string
    disabled: string
    errorTitle: string
  }
  notices: SubmitNotices
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountSecurityProps = BlockBase<AccountSecurityCopy> & {
  session: AuthPort["session"]
  listSessions?: AuthPort["listSessions"]
  revokeSession?: AuthPort["revokeSession"]
  revokeOtherSessions?: AuthPort["revokeOtherSessions"]
  enableTwoFactor?: AuthPort["enableTwoFactor"]
  disableTwoFactor?: AuthPort["disableTwoFactor"]
  verifyTwoFactor?: AuthPort["verifyTwoFactor"]
  initial?: { session?: Session | null; sessions?: DeviceSession[] }
}

type Step = { kind: "idle" } | { kind: "password"; mode: "enable" | "disable" } | { kind: "setup"; uri: string; codes: string[] }

// otpauth 주소의 secret — 인증 앱에 직접 적는 설정 키(주소가 이상하면 빈 글)
const secretOf = (uri: string) => {
  try {
    return new URL(uri).searchParams.get("secret") ?? ""
  } catch {
    return ""
  }
}
const noSessions: () => ReturnType<NonNullable<AuthPort["listSessions"]>> = async () => ({ ok: true, data: [] })

export function AccountSecurity({ copy, locale, timeZone, session, listSessions, revokeSession, revokeOtherSessions, enableTwoFactor, disableTwoFactor, verifyTwoFactor, initial, id = "security", className }: AccountSecurityProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const sessionRead = usePortRead(session, initial?.session)
  const devicesRead = usePortRead(listSessions ?? noSessions, initial?.sessions)
  const sessionsForm = usePortForm({ id: `${id}-sessions`, notices: copy.notices })
  const twoForm = usePortForm({
    id: `${id}-2fa`,
    notices: copy.notices,
    validators: { password: (v) => (v ? null : copy.twoFactor.password.required), code: (v) => (!v ? copy.twoFactor.code.required : /^\d{6}$/.test(v.replace(/\s/g, "")) ? null : copy.twoFactor.code.format) },
  })
  const [step, setStep] = React.useState<Step>({ kind: "idle" })
  const [twoOn, setTwoOn] = React.useState<boolean | null>(null)
  const [sessionsNote, setSessionsNote] = React.useState<string | null>(null)
  const [twoNote, setTwoNote] = React.useState<string | null>(null)
  const sessionsNoteRef = React.useRef<HTMLParagraphElement>(null)
  const twoNoteRef = React.useRef<HTMLParagraphElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const back = React.useRef(false)
  const stepKey = step.kind === "password" ? `password-${step.mode}` : step.kind
  React.useEffect(() => {
    if (stepKey.startsWith("password")) document.getElementById(`${id}-2fa-password`)?.focus()
    else if (stepKey === "setup") document.getElementById(`${id}-2fa-code`)?.focus()
    else if (back.current) triggerRef.current?.focus()
  }, [stepKey, id])
  React.useEffect(() => {
    if (sessionsNote) sessionsNoteRef.current?.focus()
  }, [sessionsNote])
  React.useEffect(() => {
    if (twoNote) twoNoteRef.current?.focus()
  }, [twoNote])

  const me = sessionRead.state.status === "ready" ? sessionRead.state.data : null
  const on = twoOn ?? me?.twoFactor ?? false
  const devices = devicesRead.state.status === "ready" ? devicesRead.state.data : []
  const others = devices.filter((d) => !d.current)
  const canTwo = !!(enableTwoFactor && disableTwoFactor && verifyTwoFactor)

  const revokeOne = async (d: DeviceSession) => {
    if (!revokeSession) return
    const r = await sessionsForm.run(() => revokeSession({ sessionId: d.id }))
    if (!r) return
    devicesRead.set(devices.filter((x) => x.id !== d.id))
    setSessionsNote(fillText(copy.sessions.revokedOne, { device: d.device }))
  }
  const revokeAll = async () => {
    if (!revokeOtherSessions) return
    const n = others.length
    const r = await sessionsForm.run(() => revokeOtherSessions())
    if (!r) return
    devicesRead.set(devices.filter((x) => x.current))
    setSessionsNote(fillText(copy.sessions.revokedOthers, { n }))
  }
  const submitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step.kind !== "password") return
    const v = twoForm.validate(["password"])
    if (!v) return
    if (step.mode === "enable" && enableTwoFactor) {
      const r = await twoForm.run(() => enableTwoFactor({ password: v.password }))
      if (r) setStep({ kind: "setup", uri: r.totpURI, codes: r.backupCodes })
    } else if (step.mode === "disable" && disableTwoFactor) {
      const r = await twoForm.run(() => disableTwoFactor({ password: v.password }))
      if (!r) return
      back.current = true
      setTwoOn(false)
      setStep({ kind: "idle" })
      setTwoNote(copy.twoFactor.disabled)
    }
  }
  const submitCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!verifyTwoFactor) return
    const v = twoForm.validate(["code"])
    if (!v) return
    const r = await twoForm.run(() => verifyTwoFactor({ code: v.code.replace(/\s/g, "") }))
    if (!r) return
    back.current = true
    setTwoOn(true)
    setStep({ kind: "idle" })
    setTwoNote(copy.twoFactor.enabled)
  }
  const cancel = () => {
    back.current = true
    twoForm.showErrors({})
    setStep({ kind: "idle" })
  }

  const signedOut = sessionRead.state.status === "empty" || (sessionRead.state.status === "ready" && !me)
  // 로그인하지 않았으면 기기 목록 읽기 실패(로그인 필요)는 오류가 아니라 로그인 안내로 본다
  const loading = sessionRead.state.status === "loading" || (!signedOut && !!listSessions && devicesRead.state.status === "loading")
  const err = sessionRead.state.status === "error" ? sessionRead.state : !signedOut && listSessions && devicesRead.state.status === "error" ? devicesRead.state : null

  return (
    <section ref={ref} id={id} data-block="account-security" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex max-w-3xl flex-col gap-10">
        {loading ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {!loading && !err && signedOut ? (
          <div className="flex flex-col items-start gap-3">
            <Lock aria-hidden="true" className="size-8 shrink-0" />
            <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.empty.title}</h3>
            <p className="text-base leading-[1.7]">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </div>
        ) : null}
        {!loading && !err && me ? (
          <>
            {listSessions ? (
              <div data-sessions="" className="flex flex-col items-start gap-4 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="flex flex-wrap items-center gap-3 text-[1.25rem] leading-[1.35] font-heading">{copy.sessions.title}</h3>
                <p className="text-base leading-[1.7]">{copy.sessions.body}</p>
                <FormAlert form={sessionsForm} fieldTitle={copy.sessions.errorTitle} serverTitle={copy.sessions.errorTitle} />
                {revokeSession || revokeOtherSessions ? <ApprovalHint id={`${id}-sessions-hint`}>{copy.humanHint}</ApprovalHint> : null}
                {devices.length ? (
                  <ul className="flex w-full flex-col border-y">
                    {devices.map((d) => (
                      <li key={d.id} data-device={d.id} data-current={d.current ? "" : undefined} className="flex flex-col items-start gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="flex flex-wrap items-center gap-2 text-base leading-[1.5] font-medium break-words">
                            {d.device}
                            {d.current ? (
                              <Badge variant="secondary" className="self-center">
                                {copy.sessions.current}
                              </Badge>
                            ) : null}
                          </p>
                          <p className="text-base leading-[1.6] break-words">
                            {fillText(copy.sessions.lastActive, { date: formatFrom(d.lastActiveAt, locale, timeZone) })} · {fillText(copy.sessions.signedIn, { date: formatFrom(d.createdAt, locale, timeZone) })}
                            {d.ip ? (
                              <>
                                {" "}
                                · <span data-numeric>{d.ip}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        {!d.current && revokeSession ? (
                          <Button type="button" variant="outline" disabled={sessionsForm.pending} focusableWhenDisabled onClick={() => revokeOne(d)} aria-label={fillText(copy.sessions.revokeLabel, { device: d.device })} data-revoke={d.id} {...humanApprovalProps("change-security", `${id}-sessions-hint`)}>
                            {copy.sessions.revoke}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base leading-[1.7]">{copy.sessions.empty}</p>
                )}
                {others.length && revokeOtherSessions ? (
                  <div className="flex">
                    <Button type="button" variant="outline" size="lg" disabled={sessionsForm.pending} focusableWhenDisabled onClick={revokeAll} data-revoke-others="" {...humanApprovalProps("change-security", `${id}-sessions-hint`)}>
                      {sessionsForm.pending ? copy.sessions.pending : copy.sessions.revokeOthers}
                    </Button>
                  </div>
                ) : null}
                {sessionsNote ? (
                  <p ref={sessionsNoteRef} tabIndex={-1} role="status" className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                    <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                    {sessionsNote}
                  </p>
                ) : null}
              </div>
            ) : null}
            {canTwo ? (
              <div data-two-factor={on ? "on" : "off"} className="flex flex-col items-start gap-4 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="flex flex-wrap items-center gap-3 text-[1.25rem] leading-[1.35] font-heading">
                  {copy.twoFactor.title}
                  <Badge variant="outline" className="self-center">
                    {on ? copy.twoFactor.on : copy.twoFactor.off}
                  </Badge>
                </h3>
                <p className="text-base leading-[1.7]">{on ? copy.twoFactor.bodyOn : copy.twoFactor.bodyOff}</p>
                <FormAlert form={twoForm} fieldTitle={copy.twoFactor.errorTitle} serverTitle={copy.twoFactor.errorTitle} />
                {step.kind === "idle" ? (
                  <div className="flex">
                    <Button ref={triggerRef} type="button" variant="outline" size="lg" onClick={() => setStep({ kind: "password", mode: on ? "disable" : "enable" })} data-two-factor-trigger="">
                      {on ? copy.twoFactor.disable : copy.twoFactor.enable}
                    </Button>
                  </div>
                ) : null}
                {step.kind === "password" ? (
                  <form method="post" id={twoForm.formId} noValidate aria-busy={twoForm.pending || undefined} onSubmit={submitPassword} className="flex w-full max-w-lg flex-col gap-5">
                    <FormField form={twoForm} name="password" label={copy.twoFactor.password.label} marker={copy.twoFactor.password.marker} type="password" autoComplete="current-password" hint={copy.twoFactor.password.hint} />
                    <ApprovalHint id={`${id}-two-hint`}>{copy.humanHint}</ApprovalHint>
                    <ChoiceRow label={on ? copy.twoFactor.disable : copy.twoFactor.enable}>
                      <ChoiceButton choice="decline" type="button" onClick={cancel}>
                        {copy.twoFactor.cancel}
                      </ChoiceButton>
                      <ChoiceButton choice="primary" type="submit" disabled={twoForm.pending} focusableWhenDisabled {...humanApprovalProps("change-security", `${id}-two-hint`)}>
                        {twoForm.pending ? copy.twoFactor.pending : step.mode === "enable" ? copy.twoFactor.continueEnable : copy.twoFactor.continueDisable}
                      </ChoiceButton>
                    </ChoiceRow>
                  </form>
                ) : null}
                {step.kind === "setup" ? (
                  <div data-two-factor-setup="" className="flex w-full flex-col items-start gap-4 border px-5 py-5">
                    <h4 className="text-[1.125rem] leading-[1.4] font-heading">{copy.twoFactor.setupTitle}</h4>
                    <p className="text-base leading-[1.7]">{copy.twoFactor.setupBody}</p>
                    <p className="flex flex-wrap items-baseline gap-2 text-base leading-[1.6] break-all">
                      <span>{copy.twoFactor.keyLabel}</span> <code data-numeric>{secretOf(step.uri)}</code>
                    </p>
                    <a href={step.uri} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                      {copy.twoFactor.openApp}
                    </a>
                    <h4 className="text-[1.125rem] leading-[1.4] font-heading">{copy.twoFactor.backupTitle}</h4>
                    <p className="text-base leading-[1.7]">{copy.twoFactor.backupBody}</p>
                    <ul data-backup-codes="" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                      {step.codes.map((c) => (
                        <li key={c} data-numeric className="border px-3 py-2 text-center text-base leading-[1.5]">
                          {c}
                        </li>
                      ))}
                    </ul>
                    <form method="post" id={twoForm.formId} noValidate aria-busy={twoForm.pending || undefined} onSubmit={submitCode} className="flex w-full max-w-lg flex-col gap-5">
                      <FormField form={twoForm} name="code" label={copy.twoFactor.code.label} marker={copy.twoFactor.code.marker} inputMode="numeric" autoComplete="one-time-code" maxLength={7} hint={copy.twoFactor.code.hint} />
                      <ApprovalHint id={`${id}-two-verify-hint`}>{copy.humanHint}</ApprovalHint>
                      <ChoiceRow label={copy.twoFactor.verify}>
                        <ChoiceButton choice="decline" type="button" onClick={cancel}>
                          {copy.twoFactor.cancel}
                        </ChoiceButton>
                        <ChoiceButton choice="primary" type="submit" disabled={twoForm.pending} focusableWhenDisabled {...humanApprovalProps("change-security", `${id}-two-verify-hint`)}>
                          {twoForm.pending ? copy.twoFactor.verifying : copy.twoFactor.verify}
                        </ChoiceButton>
                      </ChoiceRow>
                    </form>
                  </div>
                ) : null}
                {twoNote ? (
                  <p ref={twoNoteRef} tabIndex={-1} role="status" className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                    <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                    {twoNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
