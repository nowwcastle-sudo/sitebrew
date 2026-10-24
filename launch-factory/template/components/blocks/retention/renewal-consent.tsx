"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import { humanApprovalProps } from "@/components/contract/human-actions"
import type { AnalyticsPort, BillingPort, PendingPriceChange, Subscription } from "@/components/contract/ports"
import { CheckCircle, X } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { DateText, MoneyText, fill, vatLabel } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 가격 변경 동의 — 동의를 기다리는 가격 변경(subscription.pendingPriceChange)이 있을 때만 보이는 판(페이지 안 — 첫 화면을 가리는 모달이 아니다, A6·X3).
// 마케팅 규칙 L6(무료→유료 전환·가격 인상은 명시 동의): 전후 금액(글자·원·VAT — <table>), 새 가격이 적용되는 날, 동의해 달라는 기한,
// 동의하지 않으면 어떻게 되나(오른 가격으로 결제되지 않고 기간 끝에 멈춘다), [해지하기][새 요금에 동의하기] 대등(L3).
// 동의는 acceptPriceChange, 해지는 cancel({ when: "period_end" }). 닫기(×「나중에 결정하기」)는 이번 화면에서 접을 뿐 동의가 아니다 —
// 아무 포트도 부르지 않고, 다시 들어오면 또 보인다(무응답은 동의가 아니다).
// P3-6 F04(factory-rules.md §22-1 L6 · §23-3 U12 — 전자상거래법 §13⑥: 증액·전환 전 30일 이내 명시 동의 + 전후 가격·결제 방법·해지 조건·방법 고지): 메일 링크가 닿는 쪽 두 곳(가격 변경 동의·거절)이 이 블록으로 선다.
//   · standalone 이면 메일에서 곧장 온 쪽이다 — 동의할 것이 없거나 읽는 중·실패여도 빈 화면이 아니라 안내(copy.empty·loading·error)를 보인다.
//   · change(선택)로 전후 가격·적용일을 직접 줄 수 있다(없으면 구독 읽기의 pendingPriceChange). 동의·거절은 대등한 두 버튼(L3) — 한쪽을 키우지 않는다.
//   · paymentMethod·howToCancel(선택)은 전환·증액 고지의 결제 방법과 해지 방법·효과 글이다 — 버튼 바로 위에 보인다.
// 계측(선택): 동의하면 cta_click{id:"accept-price-change"}, 해지하면 cancel_complete{when:"period_end"}.
export type RetentionRenewalConsentCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: { price_increase: string; trial_to_paid: string }
  lead: { price_increase: string; trial_to_paid: string } // {date}
  caption: string
  cols: { item: string; before: string; after: string }
  rows: { price: string; billing: string; from: string }
  consentBy: string // {date}
  ifNot: string // {date}
  accept: string
  cancel: string
  pending: string
  later: string
  accepted: string // {date} · {amount}
  canceled: string // {date}
  // 고지(선택, F04 — 전자상거래법 §13⑥): 결제 방법 한 줄 · 해지 방법·효과 한 줄. 버튼 바로 위에 보인다
  paymentMethod?: string
  howToCancel?: string
  // standalone 에서만 쓰는 안내(선택): 동의할 것이 없을 때(empty — label·href 는 결제 관리로) · 읽는 중 · 읽기 실패
  empty?: { title: string; body: string; label: string; href: string }
  loading?: string
  error?: string
  retry?: string
  vatIncluded: string
  vatExcluded: string
  per: string
  alert: { field: string; server: string }
  notices: SubmitNotices
}
export type RetentionRenewalConsentProps = BlockBase<RetentionRenewalConsentCopy> & {
  subscription: BillingPort["subscription"]
  acceptPriceChange: BillingPort["acceptPriceChange"]
  cancel: BillingPort["cancel"]
  track?: AnalyticsPort["track"]
  // 메일 링크가 곧장 닿는 쪽(F04). 동의할 것이 없거나 읽는 중·실패일 때 안내를 보인다(기본 false — 예전처럼 다른 화면 안의 판)
  standalone?: boolean
  // 전후 가격·적용일을 직접 준다(선택) — 있으면 구독 읽기의 pendingPriceChange 보다 앞선다
  change?: PendingPriceChange
  initial?: { subscription?: Subscription }
}

export function RetentionRenewalConsent({ copy, locale, timeZone, subscription, acceptPriceChange, cancel, track, standalone = false, change: given, initial, id = "renewal-consent", className }: RetentionRenewalConsentProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(subscription, initial?.subscription)
  const [closed, setClosed] = React.useState(false)
  const [busy, setBusy] = React.useState<"accept" | "cancel" | null>(null)
  const [outcome, setOutcome] = React.useState<{ kind: "accepted"; change: PendingPriceChange } | { kind: "canceled"; at?: string } | null>(null)
  const outcomeRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (outcome) outcomeRef.current?.focus()
  }, [outcome])
  const form = usePortForm({ id, notices: copy.notices })
  const sub = read.state.status === "ready" ? read.state.data : null
  const change = given ?? sub?.pendingPriceChange ?? null

  const accept = async () => {
    if (!change) return
    setBusy("accept")
    // confirmed: 「동의합니다」 버튼이 확인 단계다(L6 명시 동의) — 눌렀다는 선언을 싣는다(P3-7 AXC, R20)
    const r = await form.run(() => acceptPriceChange({ confirmed: true }))
    setBusy(null)
    if (!r) return
    track?.("cta_click", { id: "accept-price-change", label: copy.accept, section: id })
    setOutcome({ kind: "accepted", change })
  }
  const doCancel = async () => {
    setBusy("cancel")
    const r = await form.run(() => cancel({ when: "period_end", confirmed: true }))
    setBusy(null)
    if (!r) return
    track?.("cancel_complete", { when: "period_end" })
    setOutcome({ kind: "canceled", at: r.cancelAt })
  }
  const visible = !!change && !closed
  // 메일에서 곧장 온 쪽: 읽는 중·실패·동의할 것 없음도 빈 화면이 아니라 안내로 보인다
  const note = standalone && !outcome && !visible ? (read.state.status === "loading" ? "loading" : read.state.status === "error" && !given ? "error" : closed ? null : "empty") : null
  return (
    <section ref={ref} id={id} data-block="retention-renewal-consent" aria-labelledby={`${id}-title`} hidden={(!visible && !outcome && !note) || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      {outcome ? (
        <div data-enter className="flex max-w-2xl flex-col gap-5 border-2 px-5 py-6 md:px-8 md:py-8">
          <h2 id={`${id}-title`} className="sr-only">
            {change ? copy.title[change.kind] : copy.title.price_increase}
          </h2>
          <p ref={outcomeRef} tabIndex={-1} role="status" data-outcome={outcome.kind} className="flex items-start gap-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
            <CheckCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
            <span>
              {outcome.kind === "accepted"
                ? fill(copy.accepted, { date: <DateText locale={locale} timeZone={timeZone} iso={outcome.change.effectiveAt} as="since" />, amount: <MoneyText money={outcome.change.to} /> })
                : fill(copy.canceled, { date: outcome.at ? <DateText locale={locale} timeZone={timeZone} iso={outcome.at} /> : "—" })}
            </span>
          </p>
        </div>
      ) : change && visible ? (
        <div data-enter role="region" aria-labelledby={`${id}-title`} className="flex max-w-2xl flex-col gap-5 border-2 px-5 py-6 md:px-8 md:py-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading">
              {copy.title[change.kind]}
            </h2>
            <Button type="button" variant="ghost" size="icon" aria-label={copy.later} data-close="" onClick={() => setClosed(true)} className="-me-2 -mt-1 shrink-0">
              <X aria-hidden="true" />
            </Button>
          </div>
          <p className="text-base leading-[1.7]">{fill(copy.lead[change.kind], { date: <DateText locale={locale} timeZone={timeZone} iso={change.effectiveAt} as="since" /> })}</p>
          <div className="w-full overflow-x-auto">
            <Table role="table" className="text-base max-sm:block max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-[repeat(var(--stack-cols,2),minmax(0,1fr))] max-sm:[&_tr]:gap-x-4 max-sm:[&_tr]:gap-y-1 max-sm:[&_tr]:py-3 max-sm:[&_caption]:block max-sm:[&_th]:block max-sm:[&_th]:h-auto max-sm:[&_th]:w-auto max-sm:[&_th]:border-0 max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:min-w-0 max-sm:[&_td]:border-0 max-sm:[&_td]:py-0 max-sm:[&_[data-stack=skip]]:hidden max-sm:[&_th[scope=row]]:col-span-full max-sm:[&_td[colspan]]:col-span-full max-sm:[&_td[data-label]]:before:block max-sm:[&_td[data-label]]:before:text-sm max-sm:[&_td[data-label]]:before:font-normal max-sm:[&_td[data-label]]:before:text-muted-foreground max-sm:[&_td[data-label]]:before:content-[attr(data-label)]">
              <caption className="sr-only">{copy.caption}</caption>
              <TableHeader role="rowgroup">
                <TableRow role="row">
                  <TableHead scope="col" role="columnheader">{copy.cols.item}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.cols.before}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.cols.after}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody role="rowgroup">
                <TableRow role="row">
                  <TableHead scope="row" role="rowheader">{copy.rows.price}</TableHead>
                  <TableCell role="cell" data-label={copy.cols.before} data-numeric className="whitespace-nowrap tabular-nums">
                    <MoneyText money={change.from} price="before" />
                  </TableCell>
                  <TableCell role="cell" data-label={copy.cols.after} data-numeric className="whitespace-nowrap tabular-nums text-[1.25rem]">
                    <MoneyText money={change.to} price="after" className="font-heading" />
                  </TableCell>
                </TableRow>
                <TableRow role="row">
                  <TableHead scope="row" role="rowheader">{copy.rows.billing}</TableHead>
                  <TableCell role="cell" data-label={copy.cols.before} /* numeric-cell: 글자 열 */ className="text-base">
                    {copy.per} · {vatLabel(change.from, copy)}
                  </TableCell>
                  <TableCell role="cell" data-label={copy.cols.after} /* numeric-cell: 글자 열 */ className="text-base">
                    {copy.per} · {vatLabel(change.to, copy)}
                  </TableCell>
                </TableRow>
                <TableRow role="row">
                  <TableHead scope="row" role="rowheader">{copy.rows.from}</TableHead>
                  <TableCell role="cell" /* numeric-cell: 글자 열 */ colSpan={2} className="whitespace-nowrap tabular-nums">
                    <DateText locale={locale} timeZone={timeZone} iso={change.effectiveAt} as="since" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p data-consent-by={change.consentBy} className="border-s-4 border-primary ps-4 text-[1.125rem] leading-[1.4] font-heading">
            {fill(copy.consentBy, { date: <DateText locale={locale} timeZone={timeZone} iso={change.consentBy} /> })}
          </p>
          <p className="text-base leading-[1.7]">{fill(copy.ifNot, { date: <DateText locale={locale} timeZone={timeZone} iso={change.effectiveAt} as="since" /> })}</p>
          {copy.paymentMethod || copy.howToCancel ? (
            <ul data-terms="notice" className="flex list-disc flex-col gap-1 ps-5 text-base leading-[1.6]">
              {copy.paymentMethod ? <li data-terms="payment-method">{copy.paymentMethod}</li> : null}
              {copy.howToCancel ? <li data-terms="cancel">{copy.howToCancel}</li> : null}
            </ul>
          ) : null}
          <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
          <ApprovalHint id={`${id}-human-hint`}>{copy.humanHint}</ApprovalHint>
          <ChoiceRow label={copy.title[change.kind]}>
            <ChoiceButton choice="decline" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={doCancel} {...humanApprovalProps("cancel-subscription", `${id}-human-hint`)}>
              {busy === "cancel" ? copy.pending : copy.cancel}
            </ChoiceButton>
            <ChoiceButton choice="primary" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={accept} {...humanApprovalProps("accept-price-change", `${id}-human-hint`)}>
              {busy === "accept" ? copy.pending : (form.holdLabel ?? copy.accept)}
            </ChoiceButton>
          </ChoiceRow>
        </div>
      ) : note ? (
        <div data-enter data-standalone={note} className="flex max-w-2xl flex-col gap-5 border-2 px-5 py-6 md:px-8 md:py-8">
          <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] md:text-[1.953rem] md:leading-[1.2] font-heading">
            {note === "empty" && copy.empty ? copy.empty.title : copy.title.price_increase}
          </h2>
          {note === "loading" && copy.loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
          {note === "error" && read.state.status === "error" && copy.error && copy.retry ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
          {note === "empty" && copy.empty ? (
            <>
              <p className="text-base leading-[1.7]">{copy.empty.body}</p>
              <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
                {copy.empty.label}
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <h2 id={`${id}-title`} className="sr-only">
          {copy.title.price_increase}
        </h2>
      )}
    </section>
  )
}
