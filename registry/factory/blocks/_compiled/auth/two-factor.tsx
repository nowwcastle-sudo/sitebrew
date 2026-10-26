"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, AuthPort } from "@/registry/factory/contract/ports"
import { CheckCircle, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/registry/factory/ui/field"

import { BlockHeading } from "../_shared/block-heading"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 2단계 인증 — 넓으면 두 단(왼쪽 제목·무엇을 적는지·도움 링크 | 오른쪽 코드 칸 판), 좁으면 한 열.
// 코드 칸: 인증 앱 6자리(숫자 자판·one-time-code 자동 채움) ↔ 1회용 백업 코드로 바꿔 적기. 「이 기기에서 묻지 않기」는 선택이고 해제로 시작한다.
// 보내기 → verifyTwoFactor({ code, method, trustDevice }). 오류는 코드 칸 아래(떠날 때·보낼 때 검사, 포커스는 그 칸) — O2.
// 계측(선택 track): 인증이 끝나면 login{method:"password"}, 오류마다 form_error.
export type AuthTwoFactorCopy = {
  title: string
  lead?: string
  code: { label: string; marker: string; hint: string }
  backup: { label: string; marker: string; hint: string }
  useBackup: string
  useCode: string
  trust: { label: string; hint?: string }
  errors: { codeRequired: string; codeFormat: string; backupRequired: string }
  submit: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  help?: { label: string; href: string }
  done: { title: string; body: string; label?: string; href?: string }
}
export type AuthTwoFactorProps = BlockBase<AuthTwoFactorCopy> & {
  verifyTwoFactor: AuthPort["verifyTwoFactor"]
  track?: AnalyticsPort["track"]
}

export function AuthTwoFactor({ copy, verifyTwoFactor, track, id = "two-factor", className }: AuthTwoFactorProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [method, setMethod] = React.useState<"totp" | "backup-code">("totp")
  const [trust, setTrust] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: {
      code: (v) => (!v ? copy.errors.codeRequired : /^\d{6}$/.test(v.replace(/\s/g, "")) ? null : copy.errors.codeFormat),
      backup: (v) => (v ? null : copy.errors.backupRequired),
    },
    onError: (e) => track?.("form_error", { form: "two-factor", fields: e.fields, kind: e.kind }),
  })
  const name = method === "totp" ? "code" : "backup"
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate([name])
    if (!v) return
    const r = await form.run(() => verifyTwoFactor({ code: v[name].replace(/\s/g, ""), method, trustDevice: trust }))
    if (!r) return
    track?.("login", { method: "password" })
    setDone(true)
  }
  const swap = () => {
    setMethod((m) => (m === "totp" ? "backup-code" : "totp"))
    form.showErrors({})
  }
  return (
    <section ref={ref} id={id} data-block="auth-two-factor" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start md:gap-16">
        <div className="flex flex-col items-start gap-6">
          <Lock aria-hidden="true" data-enter className="size-12 border p-2.5" />
          <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
          {copy.help ? (
            <a data-enter href={copy.help.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
              {copy.help.label}
            </a>
          ) : null}
        </div>
        <div data-enter className="min-w-0 border bg-muted/40 px-5 py-6 md:px-8 md:py-8">
          {done ? (
            <div role="status" className="flex flex-col items-start gap-3">
              <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
              <h3 ref={doneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {copy.done.title}
              </h3>
              <p className="text-base leading-[1.7]">{copy.done.body}</p>
              {copy.done.href && copy.done.label ? (
                <Button size="lg" nativeButton={false} role="link" render={<a href={copy.done.href} />} className="mt-2">
                  {copy.done.label}
                </Button>
              ) : null}
            </div>
          ) : (
            <form method="post" id={form.formId} noValidate aria-labelledby={`${id}-title`} aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              {method === "totp" ? (
                <FormField key="code" form={form} name="code" label={copy.code.label} marker={copy.code.marker} hint={copy.code.hint} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="[&_input]:h-14 [&_input]:text-center [&_input]:text-[1.563rem] [&_input]:tracking-[0.4em] [&_input]:tabular-nums" />
              ) : (
                <FormField key="backup" form={form} name="backup" label={copy.backup.label} marker={copy.backup.marker} hint={copy.backup.hint} autoComplete="off" className="[&_input]:h-12 [&_input]:text-[1.125rem] [&_input]:tracking-[0.15em]" />
              )}
              <Button type="button" variant="link" onClick={swap} className="relative h-auto min-h-11 self-start px-0 text-base whitespace-normal">
                {method === "totp" ? copy.useBackup : copy.useCode}
              </Button>
              <Field orientation="horizontal" className="items-start gap-3">
                <Checkbox id={`${id}-trust`} name="trust" aria-labelledby={`${id}-trust-label`} checked={trust} onCheckedChange={setTrust} aria-describedby={copy.trust.hint ? `${id}-trust-hint` : undefined} />
                <div className="flex min-w-0 flex-col gap-1">
                  <FieldLabel id={`${id}-trust-label`} htmlFor={`${id}-trust`}>{copy.trust.label}</FieldLabel>
                  {copy.trust.hint ? (
                    <FieldDescription id={`${id}-trust-hint`} className="text-base leading-[1.6] text-foreground">
                      {copy.trust.hint}
                    </FieldDescription>
                  ) : null}
                </div>
              </Field>
              <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="w-full" />
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
