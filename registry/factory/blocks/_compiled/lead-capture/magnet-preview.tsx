"use client"

import * as React from "react"

import type { ImageSlot } from "@/registry/factory/content/content-core"
import type { ActionResult, BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { CheckCircle, Clock, File } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Label } from "@/registry/factory/ui/label"

import { fillText } from "../_shared/billing-format"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReviewPhoto } from "../_shared/review-kit"

// 자료 미리 보기 + 이메일(마케팅 규칙 A4·A7·L2·O2 — factory-rules.md §22-6). 받을 것을 먼저 보여 주고(표지·목차·형식과 분량 — A7), 페이지 안 짧은 폼(A4)에서 이메일 하나만 받는다
// (이름은 선택). 언제 도착하는지 버튼 곁에 적는다(A7). 새 소식 수신은 따로 고르는 선택 동의 — 체크하지 않은 채로 시작한다(L2 · data-consent="optional").
// 칸 검사는 떠날 때, 보낼 때 첫 오류 칸에 포커스(O2 — port-form). 폼 블록: submit({ email, name?, marketing }) → ActionResult.
// 계측(선택): form_start(처음 입력할 때)·form_submit·form_error(칸 이름만) — 이메일 값은 싣지 않는다.
export type LeadCaptureMagnetPreviewCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead: string
  // meta: 형식·분량(예: 「PDF 12쪽」) — 사실이 없으면 비운다(줄을 그리지 않는다)
  preview: { cover: ImageSlot; name: string; meta?: string; contentsTitle: string; contents: string[] }
  email: { label: string; marker: string; placeholder?: string; required: string; invalid: string }
  name?: { label: string; marker: string }
  consent: string
  privacy: string
  submit: string
  pending: string
  arrival: string
  fieldErrorTitle: string
  serverErrorTitle: string
  notices: SubmitNotices
  // 「{email}로 1분 안에 보냈어요」
  done: { title: string; body: string }
}
export type LeadCaptureMagnetPreviewProps = BlockBase<LeadCaptureMagnetPreviewCopy> & {
  submit: (input: { email: string; name?: string; marketing: boolean }) => Promise<ActionResult<unknown>>
  track?: AnalyticsPort["track"]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LeadCaptureMagnetPreview({ copy, submit, track, id = "lead-magnet", className }: LeadCaptureMagnetPreviewProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [started, setStarted] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: { email: (v) => (!v ? copy.email.required : EMAIL.test(v) ? null : copy.email.invalid) },
    onError: (e) => track?.("form_error", { form: id, fields: e.fields, kind: e.kind }),
  })
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["email"])
    if (!v) return
    track?.("form_submit", { form: id })
    const r = await form.run(() => submit({ email: v.email, ...(v.name ? { name: v.name } : {}), marketing }))
    if (r !== null) setSentTo(v.email)
  }
  const start = () => {
    if (started) return
    setStarted(true)
    track?.("form_start", { form: id })
  }
  return (
    <section ref={ref} id={id} data-block="lead-capture-magnet-preview" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start md:gap-12">
        <div data-enter data-magnet-preview="" className="flex flex-col gap-4 rounded-lg border bg-muted px-5 py-5">
          <ReviewPhoto photo={copy.preview.cover} className="mx-auto max-w-56 bg-background" />
          <div className="flex flex-col gap-2">
            <p className="flex items-start gap-2 text-[1.125rem] leading-[1.4] font-heading-ko">
              <File aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              {copy.preview.name}
            </p>
            {copy.preview.meta ? (
              <p data-numeric className="text-base leading-[1.5] tabular-nums">
                {copy.preview.meta}
              </p>
            ) : null}
            <h3 className="mt-2 text-base leading-[1.5] font-heading-ko">{copy.preview.contentsTitle}</h3>
            <ol className="flex list-decimal flex-col gap-1 ps-5 text-base leading-[1.6]">
              {copy.preview.contents.map((c, i) => (
                <li key={i} className="ps-1">
                  {c}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div data-enter className="flex min-w-0 flex-col gap-4">
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
            {copy.title}
          </h2>
          <p className="text-base leading-[1.7]">{copy.lead}</p>
          {sentTo ? (
            <div role="status" data-lead-done="" className="flex max-w-md items-start gap-3 border-s-4 border-primary bg-muted px-4 py-4 text-base leading-[1.6]">
              <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.done.title}</p>
                <p>{fillText(copy.done.body, { email: sentTo })}</p>
              </div>
            </div>
          ) : (
            <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={onSubmit} onFocus={start} className="flex max-w-md flex-col gap-4">
              <FormAlert form={form} fieldTitle={copy.fieldErrorTitle} serverTitle={copy.serverErrorTitle} />
              <FormField form={form} name="email" type="email" autoComplete="email" inputMode="email" label={copy.email.label} marker={copy.email.marker} placeholder={copy.email.placeholder} />
              {copy.name ? <FormField form={form} name="name" autoComplete="given-name" label={copy.name.label} marker={copy.name.marker} /> : null}
              <div data-consent="optional" className="flex items-start gap-3">
                <Checkbox id={`${id}-marketing`} aria-labelledby={`${id}-marketing-label`} checked={marketing} onCheckedChange={(c) => setMarketing(c === true)} />
                <Label id={`${id}-marketing-label`} htmlFor={`${id}-marketing`} className="text-base leading-[1.5]">
                  {copy.consent}
                </Label>
              </div>
              <p className="text-base leading-[1.6]">{copy.privacy}</p>
              <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="w-full" approval={{ action: "provide-personal-data", hint: copy.humanHint }} />
              <p data-arrival="" className="flex items-center gap-2 text-base leading-[1.5]">
                <Clock aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {copy.arrival}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
