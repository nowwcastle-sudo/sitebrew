"use client"

import * as React from "react"

import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import type { AnalyticsPort, BillingPort, Subscription } from "@/registry/factory/contract/ports"
import { CheckCircle, ExternalLink } from "@/registry/factory/icons"
import { Button } from "@/registry/factory/ui/button"

import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 구독 되살리기·청구서 보기(P3-2 Task 7b, 대장 A81·A48 — block-shared-billing-actions — account/billing-manage 가 부른다).
//   · BillingRevive: 해지가 예약된 구독(cancelAt 이 있고 아직 끝나지 않음)은 [해지 취소하고 계속 쓰기], 일시정지 구독은 [지금 다시 시작] — 둘 다 BillingPort.resume() 하나다
//     (일시정지와 예약된 해지를 함께 거둔다 — ports.ts). 누르면 결과 구독을 부른 쪽에 돌려주고(onRevived) 결과 줄(role=status)에 무엇이 바뀌었는지 적는다. 계측 resume.
//   · BillingInvoices: 「청구서·영수증 보기」 — BillingPort.portal() 이 준 임시 주소(저장하지 않는다, 누를 때마다 부른다)를 새 창에서 연다. 창 막힘을 피하려고
//     누르는 순간 빈 창을 먼저 열고 주소를 받으면 그 창을 옮긴다(안 열리면 같은 창으로 간다). 포트에 portal 이 없으면 버튼이 없다(부르는 쪽이 이 조각을 그리지 않는다).
export type ReviveCopy = {
  cancelScheduled: { label: string; pending: string; done: string }
  paused: { label: string; pending: string; done: string }
  errorTitle: string
}
export type InvoicesCopy = { label: string; pending: string; hint: string; errorTitle: string }

export function BillingRevive({ id = "billing-revive", sub, resume, copy, notices, humanHint, track, onRevived }: { id?: string; humanHint: string; sub: Subscription; resume: BillingPort["resume"]; copy: ReviveCopy; notices: SubmitNotices; track?: AnalyticsPort["track"]; onRevived: (next: Subscription) => void }) {
  const form = usePortForm({ id, notices })
  const [done, setDone] = React.useState<string | null>(null)
  const doneRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])
  const scheduled = !!sub.cancelAt && sub.status !== "canceled" && sub.status !== "expired"
  const paused = sub.status === "paused"
  if (!scheduled && !paused && !done) return null
  const text = scheduled ? copy.cancelScheduled : copy.paused
  const revive = async () => {
    const r = await form.run(() => resume())
    if (!r) return
    track?.("resume", {})
    setDone(text.done)
    onRevived(r)
  }
  return (
    <div data-revive={scheduled ? "cancel-scheduled" : paused ? "paused" : "done"} className="cn-block-bm-revive">
      <FormAlert form={form} fieldTitle={copy.errorTitle} serverTitle={copy.errorTitle} />
      {scheduled || paused ? (
        <>
          <ApprovalHint id={`${id}-hint`}>{humanHint}</ApprovalHint>
          <Button type="button" size="lg" disabled={form.pending} focusableWhenDisabled onClick={revive} data-resume="" {...humanApprovalProps("resume-subscription", `${id}-hint`)}>
            {form.pending ? text.pending : text.label}
          </Button>
        </>
      ) : null}
      {done ? (
        <p ref={doneRef} tabIndex={-1} role="status" className="cn-block-bm-note">
          <CheckCircle aria-hidden="true" className="cn-block-bm-note-icon" />
          <span className="cn-block-bm-note-text">{done}</span>
        </p>
      ) : null}
    </div>
  )
}

export function BillingInvoices({ id = "billing-invoices", portal, copy, notices, onRedirect }: { id?: string; portal: NonNullable<BillingPort["portal"]>; copy: InvoicesCopy; notices: SubmitNotices; onRedirect?: (url: string) => void }) {
  const form = usePortForm({ id, notices })
  const open = async () => {
    // 누르는 순간 빈 창을 먼저 연다 — 답을 기다린 뒤 여는 창은 브라우저가 막는다. opener 는 끊는다(포털이 이 페이지를 건드리지 못하게).
    const win = onRedirect ? null : window.open("", "_blank")
    if (win) win.opener = null
    const r = await form.run(() => portal())
    if (!r) {
      win?.close()
      return
    }
    if (onRedirect) onRedirect(r.redirectUrl)
    else if (win) win.location.href = r.redirectUrl
    else window.location.assign(r.redirectUrl)
  }
  return (
    <div className="cn-block-bm-invoices">
      <FormAlert form={form} fieldTitle={copy.errorTitle} serverTitle={copy.errorTitle} />
      <Button type="button" variant="outline" size="lg" disabled={form.pending} focusableWhenDisabled onClick={open} data-invoices="">
        {form.pending ? copy.pending : copy.label}
        <ExternalLink aria-hidden="true" />
      </Button>
      <p className="cn-block-bm-note-text">{copy.hint}</p>
    </div>
  )
}
