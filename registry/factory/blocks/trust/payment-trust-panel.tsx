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
    <section ref={ref} id={id} data-block="trust-payment-trust-panel" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-tpp-section", className)}>
      <h2 id={`${id}-title`} data-enter className="cn-block-tpp-title font-heading-ko">
        {copy.title}
      </h2>
      <div data-enter data-trust-panel="" className="cn-block-tpp-panel">
        <div className="cn-block-tpp-secure">
          <Lock aria-hidden="true" className="cn-block-tpp-lock" />
          <div className="cn-block-tpp-secure-text">
            <p className="cn-block-tpp-secure-title font-heading-ko">{copy.secure.title}</p>
            <p className="cn-block-tpp-secure-body">{copy.secure.body}</p>
          </div>
          <ul aria-label={copy.marksLabel} className="cn-block-tpp-marks">
            {copy.marks.slice(0, 2).map((m) => (
              <li key={m} data-pg-mark="" className="cn-block-tpp-mark">
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="cn-block-tpp-summary">
          <h3 className="cn-block-tpp-summary-title font-heading-ko">{copy.summaryTitle}</h3>
          <dl className="cn-block-tpp-rows">
            {copy.rows.map((r) => (
              <div key={r.label} className="cn-block-tpp-row">
                <dt>{r.label}</dt>
                <dd>
                  <MoneyText money={r.money} price="plain" />
                </dd>
              </div>
            ))}
            <div data-total="" className="cn-block-tpp-total">
              <dt className="cn-block-tpp-total-label">{copy.totalLabel}</dt>
              <dd className="cn-block-tpp-total-value">
                <MoneyText money={total} price="billed" className="cn-block-tpp-billed" />
                <span data-vat="" className="cn-block-tpp-vat">
                  {vatLabel(total, { vatIncluded: copy.vatIncluded, vatExcluded: copy.vatExcluded })}
                </span>
              </dd>
            </div>
          </dl>
        </div>
        {done ? (
          <div role="status" data-paid="" className="cn-block-tpp-done">
            <CheckCircle aria-hidden="true" className="cn-block-tpp-done-icon" />
            <div>
              <p className="cn-block-tpp-done-title font-heading-ko">{copy.done.title}</p>
              <p>{copy.done.body}</p>
            </div>
          </div>
        ) : (
          <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={onSubmit} className="cn-block-tpp-form">
            <FormAlert form={form} fieldTitle={copy.fieldErrorTitle} serverTitle={copy.serverErrorTitle} />
            <fieldset className="cn-block-tpp-fieldset">
              <legend id={`${id}-methods-legend`} className="cn-block-tpp-legend font-heading-ko">
                {copy.methods.legend}
              </legend>
              <div
                id={`${id}-method`}
                role="radiogroup"
                tabIndex={bad ? -1 : undefined}
                aria-labelledby={`${id}-methods-legend`}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? `${id}-method-error` : undefined}
                className="cn-block-tpp-methods"
              >
                {copy.methods.options.map((o) => (
                  <div key={o.id} className="cn-block-tpp-method-wrap">
                    <label className="cn-block-tpp-method">
                      <input
                        type="radio"
                        name="method"
                        value={o.id}
                        checked={method === o.id}
                        onChange={() => {
                          setMethod(o.id)
                          form.clear("method")
                        }}
                        className="cn-block-tpp-radio"
                      />
                      <span className="cn-block-tpp-method-text">
                        <span className="cn-block-tpp-method-label">{o.label}</span>
                        {o.hint ? <span className="cn-block-tpp-method-hint">{o.hint}</span> : null}
                      </span>
                    </label>
                    {o.escrow ? (
                      <div data-escrow="" className="cn-block-tpp-escrow">
                        <Info aria-hidden="true" className="cn-block-tpp-escrow-icon" />
                        <p className="cn-block-tpp-escrow-text">
                          <span className="cn-block-tpp-escrow-title font-heading-ko">{copy.escrow.title}</span> {copy.escrow.body}{" "}
                          <a href={copy.escrow.link.href} className="cn-block-tpp-link">
                            {copy.escrow.link.label}
                          </a>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {bad ? (
                <p id={`${id}-method-error`} className="cn-block-tpp-error">
                  {form.fieldErrors.method?.join(" ")}
                </p>
              ) : null}
            </fieldset>
            {copy.inApp ? <InAppEscape copy={copy.inApp} /> : null}
            <SubmitButton form={form} label={fillText(copy.pay, { amount })} pendingLabel={copy.pending} className="cn-block-tpp-pay" approval={{ action: "checkout", hint: copy.humanHint }} />
          </form>
        )}
      </div>
    </section>
  )
}
