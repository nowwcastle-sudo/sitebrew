"use client"

import * as React from "react"

import { FieldMessage, FormAlert, FormField, SubmitButton, fieldAria, usePortForm } from "@/components/blocks/_shared/port-form"
import type { ActionResult } from "@/components/contract/block-contract"
import { FormKeys } from "@/components/product/form-keys"
import { takeTokenWhenReady, useTurnstileWidget } from "@/components/product/turnstile"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { submitNotices } from "@/content/copy.en"
import { contactCopy as copy } from "@/content/copy.ux.en"

// 문의 폼(K05·G01·K06·K10). web-factory contact-form 블록 세 변형은 전화번호 필수·이름 필수·한국 전화 서식이라 영어 제품의 이메일 문의에 맞지 않아
// (docs/qa/ux-audit/apply-lfux2.md 「블록을 쓰지 않은 까닭」) 같은 공유 폼 조각(port-form)으로 만든 한 쪽 폼이다.
//   · 라벨은 늘 보이고 필수·선택 표시를 둔다. 오류는 칸 아래 + 폼 위 알림(role=alert), 입력은 비제어(FormData)라 오류 뒤에도 남는다.
//   · 보내면 서버가 접수 번호(Q-XXXXXXXX)를 준다 — 화면에 남는 글(role=status)로 보이고 포커스를 옮긴다. 메일 확인은 선택이다.
//   · 멱등 키(FormKeys)와 봇 확인 토큰(Turnstile — siteKey 가 있을 때만)은 조립하는 이쪽이 싣는다(inquiry 패키지 규약).
type Receipt = { id: string; message: string }

export function ContactForm({
  submit,
  turnstileSiteKey,
  defaultContact,
  receiptEmail,
}: {
  submit: (input: Record<string, string>) => Promise<ActionResult<Receipt>>
  turnstileSiteKey?: string
  /** 로그인했으면 계정 이메일 — 미리 채운다(바꿀 수 있다) */
  defaultContact?: string
  /** 접수 확인 메일을 보내는 제품인지(SUPPORT.receipt). 보내면 완료 글이 그 사실을 말한다 */
  receiptEmail: boolean
}) {
  const [done, setDone] = React.useState<{ id: string; contact: string } | null>(null)
  const doneRef = React.useRef<HTMLDivElement>(null)
  const widget = useTurnstileWidget(turnstileSiteKey)
  const form = usePortForm({
    id: "contact",
    notices: submitNotices,
    validators: {
      contact: (v) => (v ? null : copy.errors.contactRequired),
      message: (v) => (v ? null : copy.errors.messageRequired),
    },
  })
  React.useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["contact", "message"])
    if (!v) return
    const r = await form.run(async () => {
      const token = widget.enabled ? await takeTokenWhenReady(widget) : undefined
      try {
        return await submit({ ...v, ...(token !== undefined ? { "cf-turnstile-response": token } : {}) })
      } finally {
        widget.reset() // 토큰은 1회용이다 — 실패해도 다음 제출은 새 토큰으로
      }
    })
    if (r) setDone({ id: r.id, contact: v.contact ?? "" })
  }

  // 봇 확인 위젯 칸은 폼이 바뀌어도 늘 붙어 있다 — 「다른 문의 보내기」로 폼이 다시 그려져도 위젯이 이어진다
  const botBox = <div ref={widget.box} className="flex w-full" />
  if (done) {
    return (
      <>
        <div ref={doneRef} tabIndex={-1} role="status" data-testid="contact-done" className="flex flex-col gap-3 border px-4 py-5 outline-hidden focus-visible:ring-3 focus-visible:ring-ring md:px-6">
          <h2 className="font-heading text-[1.25rem] leading-[1.35]">{copy.done.title}</h2>
          <p className="text-base leading-[1.6]">
            {copy.done.reference}:{" "}
            <strong data-testid="contact-reference" data-numeric className="font-heading">
              {done.id}
            </strong>
          </p>
          <p className="text-base leading-[1.7]">{copy.done.body}</p>
          {receiptEmail && done.contact.includes("@") ? <p className="text-base leading-[1.7]">{copy.done.receipt.replace("{contact}", done.contact)}</p> : null}
          <button type="button" onClick={() => setDone(null)} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
            {copy.done.again}
          </button>
        </div>
        {botBox}
      </>
    )
  }

  const topicAria = fieldAria(form, "category")
  const messageHint = `${form.id}-message-hint`
  const messageAria = fieldAria(form, "message", messageHint)
  return (
    <>
      <FormKeys>
      <form id={form.formId} noValidate aria-labelledby="contact-title" aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
        <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
        <FormField form={form} name="name" label={copy.name.label} marker={copy.name.marker} autoComplete="name" maxLength={100} />
        <FormField form={form} name="contact" label={copy.contact.label} marker={copy.contact.marker} autoComplete="email" hint={copy.contact.hint} maxLength={254} defaultValue={defaultContact} />
        <Field data-invalid={topicAria["aria-invalid"]}>
          <FieldLabel htmlFor="contact-category">
            {copy.topic.label}
            <span className="ms-1 text-base">{copy.topic.marker}</span>
          </FieldLabel>
          <NativeSelect id="contact-category" name="category" defaultValue="general" className="w-full sm:max-w-xs" {...topicAria}>
            {copy.topic.options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={messageAria["aria-invalid"]}>
          <FieldLabel htmlFor="contact-message">
            {copy.message.label}
            <span className="ms-1 text-base">{copy.message.marker}</span>
          </FieldLabel>
          <Textarea id="contact-message" name="message" rows={6} maxLength={5000} onBlur={(e) => form.blur("message")(e as never)} onInput={() => form.clear("message")} {...messageAria} />
          <FieldDescription id={messageHint} className="text-base leading-[1.6] text-foreground">
            {copy.message.hint}
          </FieldDescription>
          <FieldMessage form={form} name="message" />
        </Field>
        <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} />
      </form>
      </FormKeys>
      {botBox}
    </>
  )
}
