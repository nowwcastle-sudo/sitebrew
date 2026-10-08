"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import { ApprovalHint } from "../_shared/human-approval"
import type { AnalyticsPort, BillingPort, Subscription } from "@/registry/factory/contract/ports"
import { AlertTriangle, CheckCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { DateText, fill } from "../_shared/billing-format"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { usePortRead } from "../_shared/port-read"

// 결제 실패 띠 — 화면 위 가로 한 줄(가리지 않는다, 페이지 흐름 안): 경고 · 무엇이 안 됐나(사유별 문구) · 언제 다시 결제하나 · 그때까지 그대로 쓴다
// · [결제 수단 바꾸기] 한 번 누르면 결제 수단 화면으로(updatePaymentMethod → redirectUrl). 마케팅 규칙 R1: 재시도 기간 동안 접근 유지,
// 비차단 배너, 원클릭 카드 변경, 복구되면 배너가 사라진다 — 구독을 다시 읽어(창으로 돌아올 때 · 카드를 바꾼 뒤) past_due 가 아니면 그리지 않는다.
// 구독 읽기가 끝나기 전·실패하면 아무것도 그리지 않는다(결제 문제가 없는 대부분의 사람에게 빈 띠를 보이지 않는다).
// P3-6 F02(factory-rules.md §23-3 U11): 띠는 role="alert"(접근 기술이 알린다 — 가리는 모달이 아니다)이고, 다시 결제하는 날과 접근이 멈추는 날(graceEndsAt — copy.accessUntil)을 같은 띠에 적는다.
// 구독을 다시 읽어 복구되면 띠는 사라지고 확인 글(copy.recovered, role="status")이 남는다.
// 계측(선택): 보이면 payment_failed_view{reason}, 누르면 payment_method_update{surface:"banner"}.
type Reason = NonNullable<Subscription["paymentIssue"]>["reason"]
export type RetentionPaymentFailedBannerCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  reasons: Record<Reason, string>
  retry: string // {date}
  access: string
  // 접근이 멈추는 날을 적는 틀(선택) — {date} = graceEndsAt(그날까지). 구독에 graceEndsAt 이 있을 때만 access 대신 쓴다
  accessUntil?: string
  // 복구 확인 글(선택) — 결제 실패였다가 다시 읽었을 때 past_due 가 아니면 띠 자리에 role="status" 로 남는다
  recovered?: string
  action: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
}
export type RetentionPaymentFailedBannerProps = BlockBase<RetentionPaymentFailedBannerCopy> & {
  subscription: BillingPort["subscription"]
  updatePaymentMethod: BillingPort["updatePaymentMethod"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  initial?: { subscription?: Subscription }
}

export function RetentionPaymentFailedBanner({ copy, locale, timeZone, subscription, updatePaymentMethod, track, onRedirect, initial, id = "payment-failed", className }: RetentionPaymentFailedBannerProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 8 })
  })
  const read = usePortRead(subscription, initial?.subscription)
  const { reload } = read
  const form = usePortForm({ id, notices: copy.notices })
  // 결제 수단 화면에서 돌아오면 다시 읽는다 — 복구됐으면 띠가 사라진다
  React.useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") reload()
    }
    document.addEventListener("visibilitychange", again)
    window.addEventListener("focus", again)
    return () => {
      document.removeEventListener("visibilitychange", again)
      window.removeEventListener("focus", again)
    }
  }, [reload])
  const sub = read.state.status === "ready" ? read.state.data : null
  const issue = sub?.status === "past_due" ? (sub.paymentIssue ?? { reason: "unknown" as const }) : null

  // 결제 실패였다가 복구됐는가(구독을 다시 읽은 결과) — 띠가 사라지고 확인 글이 남는다
  const [recovered, setRecovered] = React.useState(false)
  const wasIssue = React.useRef(false)
  const hasIssue = !!issue
  React.useEffect(() => {
    if (!sub) return
    if (hasIssue) wasIssue.current = true
    else if (wasIssue.current) setRecovered(true)
  }, [sub, hasIssue])
  const reason = issue?.reason ?? null
  const seen = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!reason || seen.current === reason) return
    seen.current = reason
    track?.("payment_failed_view", { reason })
  }, [reason, track])

  const update = async () => {
    track?.("payment_method_update", { surface: "banner" })
    const r = await form.run(() => updatePaymentMethod())
    if (!r) return
    goTo(r.redirectUrl, onRedirect)
    reload()
  }
  return (
    <section ref={ref} id={id} data-block="retention-payment-failed-banner" aria-labelledby={`${id}-title`} hidden={(!issue && !(recovered && copy.recovered)) || undefined} className={cn("cn-block-pfail-section", className)}>
      {issue ? (
        <div data-enter data-payment-issue={issue.reason} role="alert" className="cn-block-pfail">
          <AlertTriangle aria-hidden="true" className="cn-block-pfail-icon" />
          <div className="cn-block-pfail-text">
            <h2 id={`${id}-title`} className="cn-block-pfail-title font-heading">
              {copy.title}
            </h2>
            <p className="cn-block-pfail-body">
              {copy.reasons[issue.reason]} {issue.retryAt ? fill(copy.retry, { date: <DateText locale={locale} timeZone={timeZone} iso={issue.retryAt} as="since" /> }) : null} <strong data-access-kept="" className="cn-block-pfail-access">
                {sub?.graceEndsAt && copy.accessUntil ? fill(copy.accessUntil, { date: <DateText locale={locale} timeZone={timeZone} iso={sub.graceEndsAt} /> }) : copy.access}
              </strong>
            </p>
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <ApprovalHint id={`${id}-update-hint`}>{copy.humanHint}</ApprovalHint>
          </div>
          <Button type="button" size="lg" disabled={form.pending || !!form.holdLabel} focusableWhenDisabled onClick={update} className="cn-block-pfail-cta" {...humanApprovalProps("update-payment-method", `${id}-update-hint`)}>
            {form.pending ? copy.pending : (form.holdLabel ?? copy.action)}
          </Button>
        </div>
      ) : (
        <h2 id={`${id}-title`} className="sr-only">
          {copy.title}
        </h2>
      )}
      {!issue && recovered && copy.recovered ? (
        <p role="status" data-recovered="" className="cn-block-pfail-recovered">
          <CheckCircle aria-hidden="true" className="cn-block-pfail-recovered-icon" />
          {copy.recovered}
        </p>
      ) : null}
    </section>
  )
}
