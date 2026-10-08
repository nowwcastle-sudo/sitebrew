"use client"

import * as React from "react"

import type { ActionResult, BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { CheckCircle, Mail } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { FieldError } from "@/registry/factory/ui/field"
import { Label } from "@/registry/factory/ui/label"

import { fillText } from "../_shared/billing-format"
import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, FormField, SubmitButton, approvalHintId, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 한 줄 소식지 구독(마케팅 규칙 A4·A7·L2 — factory-rules.md §22-6). 글 사이·페이지 끝에 두는 짧은 폼: 무엇을·언제 받는지(주기·요일·시각)와 지난 호 링크를 먼저 적고(A7),
// 이메일 한 칸 + 구독 버튼 한 줄(A4). 광고성 정보 수신 동의는 따로 체크하는 칸이고 체크하지 않은 채로 시작한다(L2 — 이 폼의 목적이라 필수, 미리 체크 금지).
// 언제든 끊을 수 있다고 적는다. 폼 블록: submit({ email, consent }) → ActionResult. 계측(선택): form_start·form_submit·form_error(칸 이름만).
export type LeadCaptureInlineNewsletterCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  what: string
  when: string
  // 지난 호 링크(선택) — 보낸 적 없는 소식(첫 신청 폼)은 비운다
  sample?: { label: string; href: string }
  email: { label: string; marker: string; placeholder?: string; required: string; invalid: string }
  consent: { label: string; required: string }
  // 구독 해지 안내 한 줄(선택, FINAL-WF4 EN8) — 해지 수단이 있는 사업만 준다. 없으면 이 줄을 그리지 않는다(없는 해지 길을 약속하지 않는다).
  unsubscribe?: string
  submit: string
  pending: string
  fieldErrorTitle: string
  serverErrorTitle: string
  notices: SubmitNotices
  // 「{email}로 확인 메일을 보냈어요」
  done: { title: string; body: string }
}
export type LeadCaptureInlineNewsletterProps = BlockBase<LeadCaptureInlineNewsletterCopy> & {
  submit: (input: { email: string; consent: true }) => Promise<ActionResult<unknown>>
  track?: AnalyticsPort["track"]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LeadCaptureInlineNewsletter({ copy, submit, track, id = "newsletter", className }: LeadCaptureInlineNewsletterProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 8 })
  })
  const [started, setStarted] = React.useState(false)
  const [agreed, setAgreed] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: { email: (v) => (!v ? copy.email.required : EMAIL.test(v) ? null : copy.email.invalid), consent: (v) => (v === "on" ? null : copy.consent.required) },
    onError: (e) => track?.("form_error", { form: id, fields: e.fields, kind: e.kind }),
  })
  const consentBad = !!form.fieldErrors.consent?.length
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["email", "consent"], { ...form.read(), consent: agreed ? "on" : "" })
    if (!v) return
    track?.("form_submit", { form: id })
    const r = await form.run(() => submit({ email: v.email, consent: true }))
    if (r !== null) setSentTo(v.email)
  }
  const start = () => {
    if (started) return
    setStarted(true)
    track?.("form_start", { form: id })
  }
  return (
    <section ref={ref} id={id} data-block="lead-capture-inline-newsletter" aria-labelledby={`${id}-title`} className={cn("mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-12", className)}>
      <div data-enter className="grid grid-cols-1 gap-6 rounded-lg bg-muted px-5 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-10 md:px-8 md:py-8">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id={`${id}-title`} className="flex items-start gap-2 text-[1.563rem] leading-[1.25] font-heading-ko">
            <Mail aria-hidden="true" className="mt-1.5 size-6 shrink-0 text-primary" />
            {copy.title}
          </h2>
          <p className="text-base leading-[1.7]">{copy.what}</p>
          <p data-arrival="" className="text-base leading-[1.7]">
            {copy.when}
            {copy.sample ? (
              <>
                {" "}
                <a href={copy.sample.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
                  {copy.sample.label}
                </a>
              </>
            ) : null}
          </p>
        </div>
        {sentTo ? (
          <div role="status" data-lead-done="" className="flex items-start gap-3 border-s-4 border-primary bg-background px-4 py-4 text-base leading-[1.6]">
            <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.done.title}</p>
              <p>{fillText(copy.done.body, { email: sentTo })}</p>
            </div>
          </div>
        ) : (
          <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={onSubmit} onFocus={start} className="flex min-w-0 flex-col gap-4">
            <FormAlert form={form} fieldTitle={copy.fieldErrorTitle} serverTitle={copy.serverErrorTitle} />
            <FormField form={form} name="email" type="email" autoComplete="email" inputMode="email" label={copy.email.label} marker={copy.email.marker} placeholder={copy.email.placeholder} className="w-full min-w-[min(15rem,100%)] flex-1" />
            <div data-consent="required" className="flex items-start gap-3">
              <Checkbox
                id={`${id}-consent`}
                checked={agreed}
                onCheckedChange={(c) => {
                  setAgreed(c === true)
                  form.clear("consent")
                }}
                aria-required="true"
                aria-labelledby={`${id}-consent-label`}
                aria-invalid={consentBad || undefined}
                aria-describedby={consentBad ? `${id}-consent-error` : undefined}
              />
              <Label id={`${id}-consent-label`} htmlFor={`${id}-consent`} className="text-base leading-[1.5]">
                {copy.consent.label}
              </Label>
            </div>
            {consentBad ? (
              <FieldError id={`${id}-consent-error`} className="text-base">
                {form.fieldErrors.consent?.join(" ")}
              </FieldError>
            ) : null}
            {copy.unsubscribe ? <p className="text-base leading-[1.6]">{copy.unsubscribe}</p> : null}
            {/* 안내 글은 입력 줄 밖 별도 줄 — 가로 줄 안에 두면 입력칸을 눌러 찌그러뜨린다. 쪽 순서는 이메일 → 필수 동의 → 제출(초점 순서와 보이는 순서가 같다) */}
            <ApprovalHint id={approvalHintId(form)}>{copy.humanHint}</ApprovalHint>
            <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="w-full shrink-0 sm:w-auto sm:self-start" approval={{ action: "marketing-consent", hint: copy.humanHint, outside: true }} />
          </form>
        )}
      </div>
    </section>
  )
}
