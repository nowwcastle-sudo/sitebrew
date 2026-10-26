"use client"

import * as React from "react"

import type { ActionResult, BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, Money } from "@/registry/factory/contract/ports"
import { CheckCircle, Info, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { MoneyText, fillText, formatMoney, vatLabel } from "../_shared/billing-format"
import { InAppEscape, type InAppEscapeCopy } from "../_shared/inapp-escape"
import { FormAlert, SubmitButton, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 결제 신뢰 판(마케팅 규칙 T1·T4·L1·L10 — factory-rules.md §22-1·§22-5). 결제 입력부를 색을 입힌 판으로 감싸고 자물쇠와 결제대행 표지 1~2개(글자 — 그림 씰 없음)를 둔다(T4).
// 필수 총액(VAT·배송비 포함)을 결제 버튼 앞에 가장 크게 보인다(L1 — data-price="billed"). 선불 결제에서 에스크로(결제대금예치)를 고를 수 있다고
// 결제 수단 바로 곁에 알린다(L10). 결제 수단은 아무것도 고르지 않은 채로 시작하고, 고르지 않고 누르면 그 자리 오류로 포커스를 옮긴다.
// 폼 블록: submit({ method }) → ActionResult<{ redirectUrl? }>(호스팅 결제창이면 그 주소로 간다). 계측(선택): 결제를 시작하면 checkout_start(orderId).
export type TrustPaymentTrustPanelCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  secure: { title: string; body: string }
  // 결제대행 표지 1~2개(가상 이름 — 실제로 쓰는 공급자 이름만)
  marks: string[]
  marksLabel: string
  summaryTitle: string
  rows: { label: string; money: Money }[]
  totalLabel: string
  vatIncluded: string
  vatExcluded: string
  methods: { legend: string; options: { id: string; label: string; hint?: string; escrow?: boolean }[] }
  escrow: { title: string; body: string; link: { label: string; href: string } }
  // 「{amount} 결제하기」
  // 앱 안 브라우저(카카오톡·네이버·인스타그램 등)로 열렸을 때만 보이는 「기본 브라우저로 열어 주세요」 안내(대장 A61). 없으면 그리지 않는다
  inApp?: InAppEscapeCopy
  pay: string
  pending: string
  required: string
  fieldErrorTitle: string
  serverErrorTitle: string
  notices: SubmitNotices
  done: { title: string; body: string }
}
export type PaymentReceipt = { redirectUrl?: string }
export type TrustPaymentTrustPanelProps = BlockBase<TrustPaymentTrustPanelCopy> & {
  orderId: string
  total: Money
  submit: (input: { method: string }) => Promise<ActionResult<PaymentReceipt>>
  onRedirect?: (url: string) => void
  track?: AnalyticsPort["track"]
}

export function TrustPaymentTrustPanel({ copy, orderId, total, submit, onRedirect, track, id = "payment", className }: TrustPaymentTrustPanelProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [method, setMethod] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const form = usePortForm({ id, notices: copy.notices, validators: { method: (v) => (v ? null : copy.required) } })
  const bad = !!form.fieldErrors.method?.length
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.validate(["method"], { method: method ?? "" })) return
    track?.("checkout_start", { planId: orderId })
    const r = await form.run(() => submit({ method: method ?? "" }))
    if (!r) return
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    setDone(true)
  }
  const amount = formatMoney(total)
  return (
    <section ref={ref} id={id} data-block="trust-payment-trust-panel" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 max-w-3xl", className)}>
      <h2 id={`${id}-title`} data-enter className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading-ko">
        {copy.title}
      </h2>
      <div data-enter data-trust-panel="" className="flex flex-col gap-6 rounded-lg border bg-muted px-5 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 border-b pb-5 md:grid-cols-[auto_1fr_auto]">
          <Lock aria-hidden="true" className="mt-1 size-6 text-primary" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.secure.title}</p>
            <p className="text-base leading-[1.6]">{copy.secure.body}</p>
          </div>
          <ul aria-label={copy.marksLabel} className="col-span-2 flex flex-wrap gap-2 md:col-span-1">
            {copy.marks.slice(0, 2).map((m) => (
              <li key={m} data-pg-mark="" className="rounded-sm border border-foreground/40 bg-background px-2 py-1 text-base leading-[1.4]">
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.summaryTitle}</h3>
          <dl className="flex flex-col gap-2 text-base leading-[1.6]">
            {copy.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4">
                <dt>{r.label}</dt>
                <dd>
                  <MoneyText money={r.money} price="plain" />
                </dd>
              </div>
            ))}
            <div data-total="" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
              <dt className="text-[1.125rem] leading-[1.4]">{copy.totalLabel}</dt>
              <dd className="flex flex-wrap items-baseline gap-x-2">
                <MoneyText money={total} price="billed" className="text-[2.441rem] leading-none" />
                <span data-vat="" className="text-base leading-[1.5]">
                  {vatLabel(total, { vatIncluded: copy.vatIncluded, vatExcluded: copy.vatExcluded })}
                </span>
              </dd>
            </div>
          </dl>
        </div>
        {done ? (
          <div role="status" data-paid="" className="flex items-start gap-3 border-s-4 border-primary bg-background px-4 py-4 text-base leading-[1.6]">
            <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.done.title}</p>
              <p>{copy.done.body}</p>
            </div>
          </div>
        ) : (
          <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
            <FormAlert form={form} fieldTitle={copy.fieldErrorTitle} serverTitle={copy.serverErrorTitle} />
            <fieldset className="flex min-w-0 flex-col gap-3">
              <legend id={`${id}-methods-legend`} className="mb-3 text-[1.125rem] leading-[1.4] font-heading-ko">
                {copy.methods.legend}
              </legend>
              <div
                id={`${id}-method`}
                role="radiogroup"
                tabIndex={bad ? -1 : undefined}
                aria-labelledby={`${id}-methods-legend`}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? `${id}-method-error` : undefined}
                className="flex flex-col gap-3 outline-hidden focus-visible:ring-3 focus-visible:ring-ring"
              >
                {copy.methods.options.map((o) => (
                  <div key={o.id} className="flex flex-col gap-2">
                    <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border bg-background px-4 py-3 has-[:checked]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
                      <input
                        type="radio"
                        name="method"
                        value={o.id}
                        checked={method === o.id}
                        onChange={() => {
                          setMethod(o.id)
                          form.clear("method")
                        }}
                        className="mt-1 size-5 shrink-0 accent-primary outline-hidden"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-base leading-[1.5]">{o.label}</span>
                        {o.hint ? <span className="text-base leading-[1.5]">{o.hint}</span> : null}
                      </span>
                    </label>
                    {o.escrow ? (
                      <div data-escrow="" className="ms-4 flex items-start gap-2 border-s-2 border-primary ps-3 text-base leading-[1.6]">
                        <Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                        <p className="min-w-0">
                          <span className="text-base font-heading-ko">{copy.escrow.title}</span> {copy.escrow.body}{" "}
                          <a href={copy.escrow.link.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
                            {copy.escrow.link.label}
                          </a>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {bad ? (
                <p id={`${id}-method-error`} className="text-base leading-[1.6] [color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))]">
                  {form.fieldErrors.method?.join(" ")}
                </p>
              ) : null}
            </fieldset>
            {copy.inApp ? <InAppEscape copy={copy.inApp} /> : null}
            <SubmitButton form={form} label={fillText(copy.pay, { amount })} pendingLabel={copy.pending} className="w-full" approval={{ action: "checkout", hint: copy.humanHint }} />
          </form>
        )}
      </div>
    </section>
  )
}
