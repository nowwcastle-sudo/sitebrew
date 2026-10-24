"use client"

import * as React from "react"

import type { ActionResult, BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, Money } from "@/registry/factory/contract/ports"
import { CheckCircle, Phone } from "@/registry/factory/icons"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { MoneyText, vatLabel } from "../_shared/billing-format"
import { PrintButton } from "../_shared/print-button"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 주문 완료(마케팅 규칙 A10·O3·L1 — factory-rules.md §22-3·§22-6). 흐름을 끊지 않는다(A10): 주문 번호·결제 총액(VAT 포함 표기 — L1) · 다음에 일어날 일과 그때(단계마다 언제)
// · 도움 받을 곳(전화·문의) · 다음 행동 하나(주 버튼 하나). 비회원 주문 조회 경로를 주문 번호 곁에 둔다(O3 — 한국). 계정 만들기는 완료 화면에서 1~2칸으로 권한다
// (O3 — 이메일은 주문에서 채워 두고 비밀번호 하나만 받는다, 선택). 평점·리뷰는 여기서 묻지 않는다(배송 뒤에 — V4 는 booking-complete 참고).
// 폼 블록: submit({ email, password }) → ActionResult. 계측(선택): 주 행동 cta_click · 계정 만들기 signup_start → signup_complete — 이메일 값은 싣지 않는다.
// 로그인한 구매자(account/order-history 가 있는 사이트)에게는 계정 만들기도 비회원 조회 안내도 필요 없다: copy.account(와 submit)·copy.guest 를 주지 않으면 그 칸만 빠지고 나머지는 그대로다(선택 — 주면 예전과 같다).
export type ConfirmationOrderCompleteCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead: string
  orderLabel: string
  totalLabel: string
  vatIncluded: string
  vatExcluded: string
  /** 선택: 비회원 주문 조회 안내(O3). 로그인한 구매자에게는 주지 않는다 */
  guest?: { text: string; link: { label: string; href: string } }
  nextTitle: string
  next: { title: string; when: string; body?: string }[]
  help: { title: string; body: string; phone?: string; phoneLabel: string; link?: { label: string; href: string } }
  primary: { label: string; href: string }
  // 「인쇄·PDF로 저장」 버튼 글(대장 A104) — 있을 때만 그린다. 버튼은 인쇄물에 나오지 않는다
  print?: string
  /** 선택: 계정 만들기 권유. 없으면(또는 submit 이 없으면) 그리지 않는다 */
  account?: {
    title: string
    body: string
    email: { label: string; marker: string; required: string }
    // show·capsLock: 비밀번호 보기 토글 이름과 Caps Lock 안내(대장 A41)
    password: { label: string; marker: string; hint: string; required: string; short: string; show?: string; capsLock?: string }
    submit: string
    pending: string
    fieldErrorTitle: string
    serverErrorTitle: string
    notices: SubmitNotices
    done: { title: string; body: string }
  }
}
export type ConfirmationOrderCompleteProps = BlockBase<ConfirmationOrderCompleteCopy> & {
  order: { id: string; total: Money; email?: string }
  /** 선택: 계정 만들기 제출. 로그인한 구매자에게는 주지 않는다(copy.account 도 함께 뺀다) */
  submit?: (input: { email: string; password: string }) => Promise<ActionResult<unknown>>
  track?: AnalyticsPort["track"]
}

export function ConfirmationOrderComplete({ copy, order, submit, track, id = "order-complete", className }: ConfirmationOrderCompleteProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [created, setCreated] = React.useState(false)
  const a = copy.account
  const form = usePortForm({
    id: `${id}-account`,
    notices: a?.notices,
    validators: { email: (v) => (v ? null : (a?.email.required ?? null)), password: (v) => (!v ? (a?.password.required ?? null) : v.length < 8 ? (a?.password.short ?? null) : null) },
    onError: (e) => track?.("form_error", { form: `${id}-account`, fields: e.fields, kind: e.kind }),
  })
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["email", "password"])
    if (!v || !submit) return
    track?.("signup_start", { method: "password" })
    const r = await form.run(() => submit({ email: v.email, password: v.password }))
    if (r === null) return
    track?.("signup_complete", { method: "password", marketingConsent: false })
    setCreated(true)
  }
  const tel = copy.help.phone ? normalizePhone(copy.help.phone) : null
  return (
    <section ref={ref} id={id} data-block="confirmation-order-complete" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div data-enter className="cn-block-coc-head">
        <CheckCircle aria-hidden="true" className="cn-block-coc-check" />
        <h2 id={`${id}-title`} className="cn-block-coc-title font-heading-ko">
          {copy.title}
        </h2>
        <p className="cn-block-coc-lead">{copy.lead}</p>
      </div>
      <div className="cn-block-coc-grid">
        <div data-enter className="cn-block-coc-main">
          <dl data-order="" className="cn-block-coc-receipt">
            <div className="cn-block-coc-receipt-row">
              <dt>{copy.orderLabel}</dt>
              <dd data-numeric className="cn-block-coc-order-id">
                {order.id}
              </dd>
            </div>
            <div className="cn-block-coc-receipt-row">
              <dt>{copy.totalLabel}</dt>
              <dd className="cn-block-coc-total">
                <MoneyText money={order.total} price="billed" className="cn-block-coc-amount" />
                <span data-vat="" className="cn-block-coc-vat">
                  {vatLabel(order.total, { vatIncluded: copy.vatIncluded, vatExcluded: copy.vatExcluded })}
                </span>
              </dd>
            </div>
          </dl>
          {copy.guest ? (
            <p data-guest-lookup="" className="cn-block-coc-guest">
              {copy.guest.text}{" "}
              <a href={copy.guest.link.href} className="cn-block-coc-link">
                {copy.guest.link.label}
              </a>
            </p>
          ) : null}
          <h3 className="cn-block-coc-sub font-heading-ko">{copy.nextTitle}</h3>
          <ol data-next-steps="" className="cn-block-coc-steps">
            {copy.next.map((s, i) => (
              <li key={i} className="cn-block-coc-step">
                <span aria-hidden="true" data-numeric className="cn-block-coc-step-no">
                  {i + 1}
                </span>
                <div className="cn-block-coc-step-text">
                  <p className="cn-block-coc-step-title font-heading-ko">{s.title}</p>
                  <p data-when="" className="cn-block-coc-step-when">
                    {s.when}
                  </p>
                  {s.body ? <p className="cn-block-coc-step-body">{s.body}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.primary.href} />} data-next-action="" onClick={() => track?.("cta_click", { id: "order-next", label: copy.primary.label, section: id })} className="cn-block-coc-primary">
            {copy.primary.label}
          </Button>
          {copy.print ? <PrintButton label={copy.print} /> : null}
        </div>
        <div data-enter className="cn-block-coc-side">
          <div data-help="" className="cn-block-coc-help">
            <h3 className="cn-block-coc-sub font-heading-ko">{copy.help.title}</h3>
            <p className="cn-block-coc-help-body">{copy.help.body}</p>
            {tel && copy.help.phone ? (
              <a href={`tel:${tel}`} className="cn-block-coc-link">
                <Phone aria-hidden="true" className="cn-block-coc-link-icon" />
                {copy.help.phoneLabel} <span data-numeric>{copy.help.phone}</span>
              </a>
            ) : null}
            {copy.help.link ? (
              <a href={copy.help.link.href} className="cn-block-coc-link">
                {copy.help.link.label}
              </a>
            ) : null}
          </div>
          {a && submit ? (
            <div data-account-offer="" className="cn-block-coc-account">
              <h3 className="cn-block-coc-sub font-heading-ko">{a.title}</h3>
              {created ? (
                <p role="status" className="cn-block-coc-account-done">
                  <span className="cn-block-coc-account-done-title font-heading-ko">{a.done.title}</span> {a.done.body}
                </p>
              ) : (
                <>
                  <p className="cn-block-coc-account-body">{a.body}</p>
                  <form method="post" id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={onSubmit} className="cn-block-coc-form">
                    <FormAlert form={form} fieldTitle={a.fieldErrorTitle} serverTitle={a.serverErrorTitle} />
                    <FormField form={form} name="email" type="email" autoComplete="email" label={a.email.label} marker={a.email.marker} defaultValue={order.email} />
                    <FormField form={form} name="password" type="password" autoComplete="new-password" showLabel={a.password.show} capsLockNote={a.password.capsLock} label={a.password.label} marker={a.password.marker} hint={a.password.hint} />
                    <SubmitButton form={form} label={a.submit} pendingLabel={a.pending} className="cn-block-coc-submit" approval={{ action: "sign-up", hint: copy.humanHint }} />
                  </form>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
