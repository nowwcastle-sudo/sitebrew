"use client"

import * as React from "react"

import { FieldMessage, FormAlert, FormField, SubmitButton, fieldAria, usePortForm } from "@/components/blocks/_shared/port-form"
import type { ActionResult } from "@/components/contract/block-contract"
import { BookingReceipt, type BookingReceiptData } from "@/components/product/booking-receipt"
import { SlotPicker, useBookingSlots, type SlotsLoader } from "@/components/product/booking-slots"
import { FormKeys } from "@/components/product/form-keys"
import { takeTokenWhenReady, useTurnstileWidget } from "@/components/product/turnstile"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { submitNotices } from "@/content/copy.en"
import { bookCopy as copy } from "@/content/copy.ux.en"
import { formatKrw, formatLead } from "@/lib/booking-client"

// 예약 폼(/book). contact-form 과 같은 공유 폼 조각(port-form)·멱등 키(FormKeys)·봇 확인(Turnstile) 위에 얹은 한 쪽 폼이다.
//   · 시간 읽기는 booking-slots(useBookingSlots·SlotPicker), 접수 영수증은 booking-receipt — 이 파일은 칸·제출만 맡는다.
//   · 서비스를 바꾸면 고른 시간을 비우고 그 서비스의 슬롯을 다시 읽는다. 고른 시간이 그 사이 찼으면(slot_taken) 목록을 다시 읽어 알린다.
//   · 입력은 비제어(FormData)라 오류 뒤에도 남는다. 시간 라디오만 제어 입력이다(서비스·재읽기 때 비워야 해서).
export interface BookingServiceOption {
  id: string
  name: string
  durationMin: number
  partyMax: number
  /** 예약금이 있는 서비스(설정의 deposit > 0) — 금액·대기 시간·환불 규정은 서버 설정 값을 그대로 보여 준다 */
  deposit?: { amount: number; holdMinutes: number; fullRefundBeforeMinutes: number; laterRefundPercent: number }
}

export function BookingForm({
  submit,
  load,
  services,
  timeZone,
  turnstileSiteKey,
}: {
  submit: (input: Record<string, string>) => Promise<ActionResult<BookingReceiptData>>
  load: SlotsLoader
  /** 설정의 서비스를 화면용 모양으로 뺀 목록(직렬화 가능) */
  services: readonly BookingServiceOption[]
  /** 설정의 IANA 시간대 — 슬롯 날짜·시각을 이 시간대로 적는다 */
  timeZone: string
  turnstileSiteKey?: string
}) {
  const [serviceId, setServiceId] = React.useState(services[0]?.id ?? "")
  const [selected, setSelected] = React.useState("")
  const [taken, setTaken] = React.useState(false)
  const [done, setDone] = React.useState<BookingReceiptData | null>(null)
  const slots = useBookingSlots({ load, service: serviceId, timeZone })
  const widget = useTurnstileWidget(turnstileSiteKey)
  const service = services.find((s) => s.id === serviceId) ?? services[0]
  const form = usePortForm({
    id: "book",
    notices: submitNotices,
    validators: {
      service: (v) => (v ? null : copy.errors.serviceRequired),
      startsAt: (v) => (v ? null : copy.errors.slotRequired),
      contact: (v) => (v ? null : copy.errors.contactRequired),
    },
  })

  const onService = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setServiceId(e.target.value)
    setSelected("")
    setTaken(false)
    form.clear("service")
  }
  const onSelect = (startsAt: string) => {
    setSelected(startsAt)
    setTaken(false)
    form.clear("startsAt")
  }
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["service", "startsAt", "contact"])
    if (!v) return
    const r = await form.run(async () => {
      const token = widget.enabled ? await takeTokenWhenReady(widget) : undefined
      try {
        const res = await submit({ ...v, ...(token !== undefined ? { "cf-turnstile-response": token } : {}) })
        if (!res.ok && res.code === "slot_taken") {
          // 그 사이 다른 사람이 잡았다 — 고른 시간을 비우고 목록을 새로 읽는다(알림 글은 서버 글 그대로 폼 위에 남는다)
          setSelected("")
          setTaken(true)
          slots.reload()
        }
        return res
      } finally {
        widget.reset() // 토큰은 1회용이다 — 실패해도 다음 제출은 새 토큰으로
      }
    })
    if (r) setDone(r)
  }

  // 봇 확인 위젯 칸은 폼이 바뀌어도 늘 붙어 있다 — 「다른 예약」으로 폼이 다시 그려져도 위젯이 이어진다
  const botBox = <div ref={widget.box} className="flex w-full" />
  if (done) {
    return (
      <>
        <BookingReceipt receipt={done} timeZone={timeZone} onAgain={() => { setDone(null); setSelected(""); setTaken(false); slots.reload() }} />
        {botBox}
      </>
    )
  }

  const serviceAria = fieldAria(form, "service")
  const slotAria = fieldAria(form, "startsAt")
  const partyHint = `${form.id}-partySize-hint`
  const partyAria = fieldAria(form, "partySize", partyHint)
  const noteHint = `${form.id}-note-hint`
  const noteAria = fieldAria(form, "note", noteHint)
  return (
    <>
      <FormKeys>
        <form id={form.formId} noValidate aria-labelledby="book-title" aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
          <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
          <Field data-invalid={serviceAria["aria-invalid"]}>
            <FieldLabel htmlFor="book-service">
              {copy.service.label}
              <span className="ms-1 text-base">{copy.service.marker}</span>
            </FieldLabel>
            <NativeSelect id="book-service" name="service" value={serviceId} onChange={onService} data-testid="book-service" className="w-full sm:max-w-xs" {...serviceAria}>
              {services.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.deposit
                    ? copy.deposit.option.replace("{name}", s.name).replace("{minutes}", String(s.durationMin)).replace("{amount}", formatKrw(s.deposit.amount))
                    : copy.service.option.replace("{name}", s.name).replace("{minutes}", String(s.durationMin))}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldMessage form={form} name="service" />
          </Field>
          <SlotPicker
            id="book-startsAt"
            state={slots.state}
            selected={selected}
            onSelect={onSelect}
            onRetry={slots.reload}
            timeZone={timeZone}
            taken={taken}
            invalid={slotAria["aria-invalid"]}
            required={slotAria["aria-required"]}
            describedBy={slotAria["aria-describedby"]}
          />
          <FieldMessage form={form} name="startsAt" />
          {service && service.partyMax > 1 ? (
            <Field data-invalid={partyAria["aria-invalid"]}>
              <FieldLabel htmlFor="book-partySize">
                {copy.partySize.label}
                <span className="ms-1 text-base">{copy.partySize.marker}</span>
              </FieldLabel>
              <NativeSelect key={service.id} id="book-partySize" name="partySize" defaultValue="1" data-testid="book-party" className="w-full sm:max-w-xs" {...partyAria}>
                {Array.from({ length: service.partyMax }, (_, i) => i + 1).map((n) => (
                  <NativeSelectOption key={n} value={String(n)}>
                    {n}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription id={partyHint} className="text-base leading-[1.6] text-foreground">
                {copy.partySize.hint.replace("{max}", String(service.partyMax))}
              </FieldDescription>
              <FieldMessage form={form} name="partySize" />
            </Field>
          ) : (
            <input type="hidden" name="partySize" value="1" />
          )}
          <FormField form={form} name="name" label={copy.name.label} marker={copy.name.marker} autoComplete="name" maxLength={100} />
          <FormField form={form} name="contact" label={copy.contact.label} marker={copy.contact.marker} autoComplete="email" hint={copy.contact.hint} maxLength={254} />
          <Field data-invalid={noteAria["aria-invalid"]}>
            <FieldLabel htmlFor="book-note">
              {copy.note.label}
              <span className="ms-1 text-base">{copy.note.marker}</span>
            </FieldLabel>
            <Textarea id="book-note" name="note" rows={4} maxLength={1000} onBlur={(e) => form.blur("note")(e as never)} onInput={() => form.clear("note")} {...noteAria} />
            <FieldDescription id={noteHint} className="text-base leading-[1.6] text-foreground">
              {copy.note.hint}
            </FieldDescription>
            <FieldMessage form={form} name="note" />
          </Field>
          {service?.deposit ? <DepositNote deposit={service.deposit} /> : null}
          <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} />
        </form>
      </FormKeys>
      {botBox}
    </>
  )
}

/** 예약금 안내: 금액·결제 대기 시간·환불 규정(서버 설정 값). 접수 전에 알린다 — 결제는 접수 뒤 다음 단계에서 한다 */
function DepositNote({ deposit }: { deposit: NonNullable<BookingServiceOption["deposit"]> }) {
  return (
    <div data-testid="book-deposit-note" className="flex flex-col gap-1 text-base leading-[1.7]">
      <p>{copy.deposit.note.replace("{amount}", formatKrw(deposit.amount)).replace("{minutes}", String(deposit.holdMinutes))}</p>
      <p>
        {copy.deposit.refundFull.replace("{window}", formatLead(deposit.fullRefundBeforeMinutes))}{" "}
        {deposit.laterRefundPercent > 0 ? copy.deposit.refundLater.replace("{percent}", String(deposit.laterRefundPercent)) : copy.deposit.refundNone}
      </p>
    </div>
  )
}
