"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, AuthPort } from "@/registry/factory/contract/ports"
import { Mail } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 비밀번호 재설정 요청 — 위에 무슨 일이 일어나는지 세 칸(① 메일 받기 ② 링크 누르기 ③ 새 비밀번호, 넓으면 가로 한 줄), 아래 이메일 한 칸 + 버튼 한 줄.
// 보내면 폼 자리에 「보냈어요」(계정이 있든 없든 같은 문구 — 포트 requestPasswordReset 이 가입 여부를 드러내지 않는다) + 다시 보내기 + 로그인으로.
// 검사: 이메일 형식을 떠날 때·보낼 때(O2). 계측(선택 track): 오류마다 form_error.
export type AuthPasswordResetCopy = {
  title: string
  lead?: string
  steps: { title: string; body: string }[]
  email: { label: string; marker: string; placeholder?: string }
  errors: { emailRequired: string; emailFormat: string }
  submit: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  sent: { title: string; body: string }
  resend: string
  resent: string
  back: { label: string; href: string }
}
export type AuthPasswordResetProps = BlockBase<AuthPasswordResetCopy> & {
  requestPasswordReset: AuthPort["requestPasswordReset"]
  track?: AnalyticsPort["track"]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthPasswordReset({ copy, requestPasswordReset, track, id = "password-reset", className }: AuthPasswordResetProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [resent, setResent] = React.useState(0)
  const sentRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (sentTo) sentRef.current?.focus()
  }, [sentTo])
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: { email: (v) => (!v ? copy.errors.emailRequired : EMAIL.test(v) ? null : copy.errors.emailFormat) },
    onError: (e) => track?.("form_error", { form: "password-reset", fields: e.fields, kind: e.kind }),
  })
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["email"])
    if (!v) return
    const r = await form.run(() => requestPasswordReset({ email: v.email }))
    if (r) setSentTo(v.email)
  }
  const resend = async () => {
    if (!sentTo) return
    const r = await form.run(() => requestPasswordReset({ email: sentTo }))
    if (r) setResent((n) => n + 1)
  }
  return (
    <section ref={ref} id={id} data-block="auth-password-reset" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ol className="cn-block-reset-steps">
        {copy.steps.map((st, i) => (
          <li key={st.title} data-enter className="cn-block-reset-step">
            <span data-numeric aria-hidden="true" className="cn-block-reset-step-num">
              {i + 1}
            </span>
            <div className="cn-block-reset-step-text">
              <h3 className="cn-block-reset-step-title font-heading">{st.title}</h3>
              <p className="cn-block-reset-step-body">{st.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div data-enter className="cn-block-reset-panel">
        {sentTo ? (
          <div role="status" className="cn-block-reset-sent">
            <Mail aria-hidden="true" className="cn-block-auth-result-icon" />
            <div className="cn-block-reset-sent-text">
              <h3 ref={sentRef} tabIndex={-1} className="cn-block-auth-result-title font-heading">
                {copy.sent.title}
              </h3>
              <p className="cn-block-auth-result-body">{copy.sent.body}</p>
              {resent ? <p className="cn-block-auth-result-body">{copy.resent}</p> : null}
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              <div className="cn-block-reset-sent-actions">
                <Button type="button" variant="outline" size="lg" disabled={form.pending} focusableWhenDisabled onClick={resend}>
                  {copy.resend}
                </Button>
                <Button variant="ghost" size="lg" nativeButton={false} role="link" render={<a href={copy.back.href} />}>
                  {copy.back.label}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form method="post" id={form.formId} noValidate aria-labelledby={`${id}-title`} aria-busy={form.pending || undefined} onSubmit={onSubmit} className="cn-block-reset-form">
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <div className="cn-block-reset-row">
              <FormField form={form} name="email" label={copy.email.label} marker={copy.email.marker} type="email" autoComplete="email" inputMode="email" placeholder={copy.email.placeholder} className="cn-block-reset-email" />
              <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="cn-block-reset-submit" />
            </div>
            <a href={copy.back.href} className="cn-block-auth-link">
              {copy.back.label}
            </a>
          </form>
        )}
      </div>
    </section>
  )
}
