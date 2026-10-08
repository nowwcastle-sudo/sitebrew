"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AuthPort, Session } from "@/registry/factory/contract/ports"
import { CheckCircle, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/registry/factory/ui/field"

import { BlockHeading } from "../_shared/block-heading"
import { fillText } from "../_shared/billing-format"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 로그인 정보 바꾸기(A46) — 이메일 바꾸기 폼 + 비밀번호 바꾸기 폼 두 구역. 마케팅 규칙 O2: 라벨은 늘 보이고 (필수)/(선택), 오류는 칸 아래 「무엇이 잘못됐고 어떻게 고치나」.
//   · 이메일: 새 주소 + 지금 비밀번호 → changeEmail. 확인 메일이 나가고 그 링크를 눌러야 바뀐다(바로 바뀌지 않는다 — 결과 role=status 가 새 주소와 이 안내를 말한다).
//   · 비밀번호: 지금 비밀번호 + 새 비밀번호(8자 이상) + 「다른 기기에서도 로그아웃하기」(선택, 해제로 시작) → changePassword.
//   · 소셜 로그인만 쓰는 계정은 비밀번호가 없다 — 그 계정은 어댑터가 fieldErrors 로 알려 준다(포트 Session 에 비밀번호 유무 칸이 없다).
// 값은 화면에만 있고 계측에 싣지 않는다. 포트: session(지금 이메일 표시)·changeEmail?·changePassword? — 없는 메서드는 그 구역이 나오지 않는다.
export type AccountCredentialsCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  email: {
    title: string
    current: string
    newEmail: { label: string; marker: string; hint: string; required: string; format: string }
    password: { label: string; marker: string; required: string }
    submit: string
    pending: string
    done: { title: string; body: string }
  }
  password: {
    title: string
    current: { label: string; marker: string; required: string }
    next: { label: string; marker: string; hint: string; required: string; short: string }
    revokeOthers: { label: string; marker: string; hint: string }
    submit: string
    pending: string
    done: { title: string; body: string; others: string }
  }
  alert: { field: string; server: string }
  notices: SubmitNotices
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountCredentialsProps = BlockBase<AccountCredentialsCopy> & {
  session: AuthPort["session"]
  changeEmail?: AuthPort["changeEmail"]
  changePassword?: AuthPort["changePassword"]
  initial?: { session?: Session | null }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AccountCredentials({ copy, session, changeEmail, changePassword, initial, id = "credentials", className }: AccountCredentialsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(session, initial?.session)
  const emailForm = usePortForm({
    id: `${id}-email`,
    notices: copy.notices,
    validators: { newEmail: (v) => (!v ? copy.email.newEmail.required : EMAIL.test(v) ? null : copy.email.newEmail.format), currentPassword: (v) => (v ? null : copy.email.password.required) },
  })
  const passwordForm = usePortForm({
    id: `${id}-password`,
    notices: copy.notices,
    validators: { currentPassword: (v) => (v ? null : copy.password.current.required), newPassword: (v) => (!v ? copy.password.next.required : v.length >= 8 ? null : copy.password.next.short) },
  })
  const [revokeOthers, setRevokeOthers] = React.useState(false)
  const [emailDone, setEmailDone] = React.useState<string | null>(null)
  const [passwordDone, setPasswordDone] = React.useState<{ others: boolean } | null>(null)
  const emailDoneRef = React.useRef<HTMLHeadingElement>(null)
  const passwordDoneRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (emailDone) emailDoneRef.current?.focus()
  }, [emailDone])
  React.useEffect(() => {
    if (passwordDone) passwordDoneRef.current?.focus()
  }, [passwordDone])
  const me = read.state.status === "ready" ? read.state.data : null

  const submitEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!changeEmail) return
    const v = emailForm.validate(["newEmail", "currentPassword"])
    if (!v) return
    const r = await emailForm.run(() => changeEmail({ newEmail: v.newEmail, currentPassword: v.currentPassword, confirmed: true }))
    if (r) setEmailDone(v.newEmail)
  }
  const submitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!changePassword) return
    const v = passwordForm.validate(["currentPassword", "newPassword"])
    if (!v) return
    const r = await passwordForm.run(() => changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword, revokeOtherSessions: revokeOthers }))
    if (r) setPasswordDone({ others: r.otherSessionsRevoked })
  }

  return (
    <section ref={ref} id={id} data-block="account-credentials" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="flex max-w-xl flex-col gap-10">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {read.state.status === "empty" || (read.state.status === "ready" && !me) ? (
          <div className="flex flex-col items-start gap-3">
            <Lock aria-hidden="true" className="size-8 shrink-0" />
            <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.empty.title}</h3>
            <p className="text-base leading-[1.7]">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </div>
        ) : null}
        {me ? (
          <>
            {changeEmail ? (
              <div data-credential="email" className="flex flex-col items-start gap-4 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.email.title}</h3>
                {me.email ? (
                  <p className="text-base leading-[1.6] break-all">
                    {copy.email.current} <span data-numeric>{me.email}</span>
                  </p>
                ) : null}
                {emailDone ? (
                  <div role="status" className="flex flex-col items-start gap-3">
                    <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
                    <h4 ref={emailDoneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                      {copy.email.done.title}
                    </h4>
                    <p className="text-base leading-[1.7]">{fillText(copy.email.done.body, { email: emailDone })}</p>
                  </div>
                ) : (
                  <form method="post" id={emailForm.formId} noValidate aria-busy={emailForm.pending || undefined} onSubmit={submitEmail} className="flex w-full flex-col gap-5">
                    <FormAlert form={emailForm} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                    <FormField form={emailForm} name="newEmail" label={copy.email.newEmail.label} marker={copy.email.newEmail.marker} type="email" autoComplete="email" inputMode="email" hint={copy.email.newEmail.hint} />
                    <FormField form={emailForm} name="currentPassword" label={copy.email.password.label} marker={copy.email.password.marker} type="password" autoComplete="current-password" />
                    <SubmitButton form={emailForm} label={copy.email.submit} pendingLabel={copy.email.pending} className="self-start" approval={{ action: "change-email", hint: copy.humanHint }} />
                  </form>
                )}
              </div>
            ) : null}
            {changePassword ? (
              <div data-credential="password" className="flex flex-col items-start gap-4 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.password.title}</h3>
                {passwordDone ? (
                  <div role="status" className="flex flex-col items-start gap-3">
                    <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
                    <h4 ref={passwordDoneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                      {copy.password.done.title}
                    </h4>
                    <p className="text-base leading-[1.7]">
                      {copy.password.done.body}
                      {passwordDone.others ? ` ${copy.password.done.others}` : ""}
                    </p>
                  </div>
                ) : (
                  <form method="post" id={passwordForm.formId} noValidate aria-busy={passwordForm.pending || undefined} onSubmit={submitPassword} className="flex w-full flex-col gap-5">
                    <FormAlert form={passwordForm} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                    <FormField form={passwordForm} name="currentPassword" label={copy.password.current.label} marker={copy.password.current.marker} type="password" autoComplete="current-password" />
                    <FormField form={passwordForm} name="newPassword" label={copy.password.next.label} marker={copy.password.next.marker} type="password" autoComplete="new-password" hint={copy.password.next.hint} />
                    <Field orientation="horizontal" className="items-start gap-3">
                      <Checkbox id={`${id}-revoke-others`} name="revokeOthers" checked={revokeOthers} onCheckedChange={(v) => setRevokeOthers(v === true)} aria-describedby={`${id}-revoke-others-hint`} />
                      <div className="flex min-w-0 flex-col gap-1">
                        <FieldLabel htmlFor={`${id}-revoke-others`}>
                          {copy.password.revokeOthers.label} <span className="ms-1 text-base">{copy.password.revokeOthers.marker}</span>
                        </FieldLabel>
                        <FieldDescription id={`${id}-revoke-others-hint`} className="text-base leading-[1.6] text-foreground">
                          {copy.password.revokeOthers.hint}
                        </FieldDescription>
                      </div>
                    </Field>
                    <SubmitButton form={passwordForm} label={copy.password.submit} pendingLabel={copy.password.pending} className="self-start" approval={{ action: "change-password", hint: copy.humanHint }} />
                  </form>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
