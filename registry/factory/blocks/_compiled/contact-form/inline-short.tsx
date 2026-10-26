"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Clock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Field, FieldLabel } from "@/registry/factory/ui/field"

import { BlockHeading } from "../_shared/block-heading"
import { FieldMessage, FormAlert, FormDone, SubmitButton, TextField, fieldAria, useFormFlow, type ContactSubmit, type FormFlowCopy } from "../_shared/form-flow"

// 문의 폼 — 이름·연락처·내용 짧은 폼. 넓으면 두 단(왼쪽 제목·답변 안내 | 오른쪽 폼 칸), 좁으면 한 열.
// 칸: 이름 · 연락처(한 줄에 둘) · 문의 내용 · 개인정보 수집 동의. 제출 흐름은 _shared/form-flow(필드 오류 → 첫 오류 칸 포커스,
// 서버 오류 → 폼 위 알림 + 입력 보존, 보내는 중 → aria-busy·버튼 aria-disabled, 포커스 유지). 에이전트 속성(WebMCP toolname)은 달지 않는다 — 필수 개인정보 동의 칸이 든 폼이라 에이전트가 사람 대신 동의를 누를 수 있다(P3-7 AXWF, 운영자 결정 2026-10-04, G11a).
export type ContactFormInlineShortCopy = {
  title: string
  lead?: string
  // 답변 안내 줄(예: 「평일 하루 안에 답합니다」)
  notes?: string[]
  labels: { name: string; phone: string; message: string }
  placeholders?: { message?: string }
  consent: { label: string; detail?: string }
  form: FormFlowCopy
}
export type ContactFormInlineShortProps = BlockBase<ContactFormInlineShortCopy> & { submit: ContactSubmit }

export function ContactFormInlineShort({ copy, submit, id = "contact", className }: ContactFormInlineShortProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const flow = useFormFlow(submit, { id, required: ["name", "phone", "message", "consent"], requiredMessage: copy.form.required, notices: copy.form.notices })
  const consent = fieldAria(flow, id, "consent", copy.consent.detail ? `${id}-consent-detail` : undefined)
  return (
    <section ref={ref} id={id} data-block="contact-form-inline-short" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div className="flex flex-col gap-8">
          <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
          {copy.notes?.length ? (
            <ul data-enter className="flex flex-col gap-3 border-t pt-6">
              {copy.notes.map((n) => (
                <li key={n} className="flex items-start gap-3 text-base leading-[1.6]">
                  <Clock aria-hidden="true" className="mt-1 size-5 shrink-0" />
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div data-enter className="min-w-0">
          {flow.phase === "done" ? (
            <FormDone flow={flow} copy={copy.form} />
          ) : (
            <form method="post" id={flow.formId} noValidate aria-labelledby={`${id}-title`} aria-busy={flow.pending || undefined} onSubmit={flow.onSubmit} className="flex flex-col gap-6 border px-5 py-6 md:px-8 md:py-8">
              <FormAlert flow={flow} copy={copy.form} />
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField flow={flow} id={id} name="name" label={copy.labels.name} autoComplete="name" required />
                <TextField flow={flow} id={id} name="phone" label={copy.labels.phone} type="tel" autoComplete="tel" inputMode="tel" format="phone" required />
              </div>
              <TextField flow={flow} id={id} name="message" label={copy.labels.message} placeholder={copy.placeholders?.message} multiline required />
              <Field orientation="horizontal" className="items-start gap-3">
                <Checkbox id={`${id}-consent`} name="consent" value="yes" aria-required="true" aria-labelledby={`${id}-consent-label`} aria-invalid={consent["aria-invalid"]} aria-describedby={consent["aria-describedby"]} onCheckedChange={() => flow.clear("consent")} />
                <div className="flex min-w-0 flex-col gap-1">
                  <FieldLabel id={`${id}-consent-label`} htmlFor={`${id}-consent`}>{copy.consent.label}</FieldLabel>
                  {copy.consent.detail ? (
                    <p id={`${id}-consent-detail`} className="text-base leading-[1.6]">
                      {copy.consent.detail}
                    </p>
                  ) : null}
                  <FieldMessage flow={flow} id={id} name="consent" />
                </div>
              </Field>
              <div className="flex justify-end">
                <SubmitButton flow={flow} copy={copy.form} />
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
