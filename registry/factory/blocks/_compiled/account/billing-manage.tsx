"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import type { AnalyticsPort, BillingPort, Plan, Subscription, SubscriptionStatus } from "@/registry/factory/contract/ports"
import { AlertTriangle, CheckCircle, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { BillingInvoices, BillingRevive, type InvoicesCopy, type ReviveCopy } from "../_shared/billing-actions"
import { ApprovalHint } from "../_shared/human-approval"
import { DateText, MoneyText, fill, fillText, formatUntil, vatLabel } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 결제 관리(구독 관리 진입점 — 마케팅 규칙 L11: 앱 안에 요금제 · 다음 결제일 · 금액 · 변경 · 해지). 위 요약 판(요금제 | 다음 결제일 | 결제 금액, data-billing)
// + 상태 줄(체험·결제 실패·일시정지·해지 예약·예약된 변경) + 결제 수단 바꾸기 + 해지 진입 링크, 아래 요금제 표(<table> — 요금은 글자·원·VAT, P3).
// 요금제를 고르면 표 아래에 [취소][○○로 바꾸기] 대등한 확인(L3)과 무엇이 언제 바뀌는지(다음 결제일부터 — changePlan when "period_end").
// P3-6(UX 감사 F02·F03): ① 결제 실패(past_due)는 「다음 결제일」에 실패한 갱신일을 정상 일정처럼 보이지 않는다 — 요약 칸은 「재결제 시도일」(labels.retry)이고, 안내 글에 유예 마감일(graceEndsAt)도 적는다.
// ② 해지·만료 뒤에는 한 번에 닿는 「다시 시작」(copy.restart — 결제 화면 링크, 요금제 id 가 실린다)이 있고, 요금제 표는 「바꾸기」(변경할 구독이 없다)가 아니라 「시작하기」 링크다.
// 포트: subscription·plans(읽기 4상태) · changePlan · updatePaymentMethod(redirectUrl 로 간다) · 해지는 링크(retention/cancel-flow 로). 계측(선택): plan_select·payment_method_update.
type Per = { perMonth: string; perYear: string; once: string }
export type AccountBillingManageCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  // labels.retry(선택): 결제 실패(past_due) 때 요약의 날짜 칸 이름(예: 「다시 결제를 시도하는 날」) — 없으면 그 칸은 「—」다(실패한 갱신일을 다음 결제일로 보이지 않는다, F02)
  labels: { plan: string; nextDate: string; amount: string; method: string; retry?: string }
  status: Record<SubscriptionStatus, string>
  // notes.pastDue 틀의 {date} = 다시 결제하는 날, {until} = 유예가 끝나 접근이 멈추는 날(graceEndsAt, 선택 — 없으면 「—」)
  notes: { trialing: string; pastDue: string; paused: string; cancelAt: string; expired: string; scheduled: string }
  none: { title: string; body: string; label: string; href: string }
  per: Per
  vatIncluded: string
  vatExcluded: string
  updateMethod: { label: string; pending: string; body: string }
  cancel: { label: string; href: string; note: string }
  change: { title: string; caption: string; cols: { plan: string; price: string; billing: string; features: string; action: string }; current: string; scheduled: string; choose: string; question: string; body: string; cancel: string; confirm: string; pending: string; done: string }
  alert: { field: string; server: string }
  // 선택(P3-6 F03): 해지·만료 뒤 「다시 시작」. href 의 {plan} 은 요금제 id(결제 화면이 요금제를 받는다 — 동의·고지는 그 화면에서 받는다), label 의 {plan} 은 요금제 이름,
  // choose 는 요금제 표 줄마다의 링크 글({plan}). 없으면 예전 모양 그대로다
  restart?: { title: string; body: string; label: string; href: string; choose: string }
  // 선택(Task 7b — A81·A48): 주면 해지 예약·일시정지의 되살리기 버튼(resume)과 「청구서·영수증 보기」(portal)가 나온다
  revive?: ReviveCopy
  invoices?: InvoicesCopy
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
}
export type AccountBillingManageProps = BlockBase<AccountBillingManageCopy> & {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  changePlan: BillingPort["changePlan"]
  updatePaymentMethod: BillingPort["updatePaymentMethod"]
  resume?: BillingPort["resume"]
  portal?: BillingPort["portal"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  initial?: { subscription?: Subscription; plans?: Plan[] }
}

const perOf = (p: Plan, per: Per) => (p.interval === "year" ? per.perYear : p.interval === "once" ? per.once : per.perMonth)

export function AccountBillingManage({ copy, locale, timeZone, subscription, plans, changePlan, updatePaymentMethod, resume, portal, track, onRedirect, initial, id = "billing", className }: AccountBillingManageProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const subRead = usePortRead(subscription, initial?.subscription)
  const planRead = usePortRead(plans, initial?.plans)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [changed, setChanged] = React.useState<string | null>(null)
  const questionRef = React.useRef<HTMLParagraphElement>(null)
  const doneRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (picked) questionRef.current?.focus()
  }, [picked])
  React.useEffect(() => {
    if (changed) doneRef.current?.focus()
  }, [changed])
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "billing-manage", fields: e.fields, kind: e.kind }) })

  const sub = subRead.state.status === "ready" ? subRead.state.data : null
  const list = planRead.state.status === "ready" ? planRead.state.data : null
  const current = sub && list ? list.find((p) => p.id === sub.planId) ?? null : null
  const target = picked && list ? list.find((p) => p.id === picked) ?? null : null
  const nextDate = sub?.currentPeriodEnd ?? sub?.trialEnd
  const vat = (p: Plan) => vatLabel(p.price, copy)

  const confirmChange = async () => {
    if (!target) return
    // confirmed: 요금제 비교 뒤 [변경하기] 가 확인 단계다 — 눌렀다는 선언을 싣는다(P3-7 AXC, R20)
    const r = await form.run(() => changePlan({ planId: target.id, when: "period_end", confirmed: true }))
    if (!r) return
    track?.("plan_select", { planId: target.id, interval: target.interval })
    subRead.set(r)
    setPicked(null)
    setChanged(target.id)
  }
  const updateMethod = async () => {
    const r = await form.run(() => updatePaymentMethod())
    if (!r) return
    track?.("payment_method_update", { surface: "billing-manage" })
    goTo(r.redirectUrl, onRedirect)
  }
  const loading = subRead.state.status === "loading" || planRead.state.status === "loading"
  const err = subRead.state.status === "error" ? subRead.state : planRead.state.status === "error" ? planRead.state : null
  const hasPlan = !!sub && sub.status !== "none" && sub.planId !== null
  const ended = !!sub && (sub.status === "canceled" || sub.status === "expired")
  // 해지·만료 뒤: 시작 링크(요금제 id 가 실린다). 변경할 구독이 없으니 요금제 표도 「바꾸기」가 아니라 시작 링크다
  const restartHref = (planId: string) => (copy.restart ? copy.restart.href.replace("{plan}", encodeURIComponent(planId)) : "#")
  const restartMode = ended && !!copy.restart

  return (
    <section ref={ref} id={id} data-block="account-billing-manage" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex flex-col gap-6">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {!loading && !err && sub && !hasPlan ? (
          <div className="flex max-w-2xl flex-col items-start gap-3 border px-6 py-8">
            <h3 className="text-[1.563rem] leading-[1.25] font-heading">{copy.none.title}</h3>
            <p className="min-w-0 text-base leading-[1.6]">{copy.none.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.none.href} />}>
              {copy.none.label}
            </Button>
          </div>
        ) : null}
        {!loading && !err && sub && hasPlan ? (
          <>
            <dl className="grid border md:grid-cols-3">
              <div data-billing="plan" className="flex min-w-0 flex-col gap-2 border-b px-5 py-5 last:border-b-0 md:border-e md:border-b-0 md:px-6 md:last:border-e-0">
                <dt className="text-base leading-[1.5]">{copy.labels.plan}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-2 text-[1.25rem] leading-[1.35] font-heading">
                  {current?.name ?? sub.planId}
                  <Badge variant="outline" className="self-center">
                    {sub.status === "active" && sub.cancelAt ? copy.status.canceled : copy.status[sub.status]}
                  </Badge>
                </dd>
              </div>
              <div data-billing={sub.status === "past_due" ? "retry-date" : "next-date"} className="flex min-w-0 flex-col gap-2 border-b px-5 py-5 last:border-b-0 md:border-e md:border-b-0 md:px-6 md:last:border-e-0">
                <dt className="text-base leading-[1.5]">{sub.status === "past_due" && copy.labels.retry ? copy.labels.retry : copy.labels.nextDate}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-2 text-[1.25rem] leading-[1.35] font-heading">
                  {sub.status === "past_due" ? (
                    sub.paymentIssue?.retryAt && copy.labels.retry ? (
                      <DateText locale={locale} timeZone={timeZone} iso={sub.paymentIssue.retryAt} as="since" />
                    ) : (
                      "—"
                    )
                  ) : nextDate && sub.status !== "canceled" && sub.status !== "expired" && !sub.cancelAt ? (
                    <DateText locale={locale} timeZone={timeZone} iso={nextDate} as="since" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div data-billing="amount" className="flex min-w-0 flex-col gap-2 border-b px-5 py-5 last:border-b-0 md:border-e md:border-b-0 md:px-6 md:last:border-e-0">
                <dt className="text-base leading-[1.5]">{copy.labels.amount}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-2 text-[1.25rem] leading-[1.35]">
                  {current ? (
                    <>
                      <MoneyText money={current.price} price="billed" className="text-[1.563rem] leading-none tabular-nums font-heading" />
                      <span className="text-base leading-[1.5]">
                        /{perOf(current, copy.per)} · {vat(current)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            {sub.status === "trialing" && sub.trialEnd ? <p className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">{fill(copy.notes.trialing, { date: <DateText locale={locale} timeZone={timeZone} iso={sub.trialEnd} /> })}</p> : null}
            {sub.status === "past_due" ? (
              <p data-kind="warn" className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">
                <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                <span className="min-w-0 text-base leading-[1.6]">
                  {fill(copy.notes.pastDue, {
                    date: sub.paymentIssue?.retryAt ? <DateText locale={locale} timeZone={timeZone} iso={sub.paymentIssue.retryAt} as="since" /> : "—",
                    until: sub.graceEndsAt ? <DateText locale={locale} timeZone={timeZone} iso={sub.graceEndsAt} /> : "—",
                  })}
                </span>
              </p>
            ) : null}
            {sub.status === "paused" && sub.pausedUntil ? <p className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">{fill(copy.notes.paused, { date: <DateText locale={locale} timeZone={timeZone} iso={sub.pausedUntil} /> })}</p> : null}
            {sub.cancelAt ? <p className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">{fill(copy.notes.cancelAt, { date: <DateText locale={locale} timeZone={timeZone} iso={sub.cancelAt} /> })}</p> : null}
            {resume && copy.revive ? <BillingRevive id={`${id}-revive`} sub={sub} resume={resume} copy={copy.revive} notices={copy.notices} humanHint={copy.humanHint} track={track} onRevived={subRead.set} /> : null}
            {sub.status === "expired" ? <p className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">{copy.notes.expired}</p> : null}
            {restartMode && copy.restart ? (
              <div data-restart={sub.status} className="flex flex-col items-start gap-3 border px-5 py-6 md:px-8">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.restart.title}</h3>
                <p className="min-w-0 text-base leading-[1.6]">{copy.restart.body}</p>
                {sub.planId ? (
                  <Button size="lg" nativeButton={false} role="link" render={<a href={restartHref(sub.planId)} />} data-restart-action="" onClick={() => track?.("cta_click", { id: "restart-plan", label: fillText(copy.restart!.label, { plan: current?.name ?? sub.planId! }), section: id })}>
                    {fillText(copy.restart.label, { plan: current?.name ?? sub.planId })}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {sub.scheduledPlanId && nextDate ? (
              <p ref={doneRef} tabIndex={-1} role={changed ? "status" : undefined} className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring data-[kind=warn]:border-destructive">
                <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                <span className="min-w-0 text-base leading-[1.6]">{fill(copy.notes.scheduled, { date: <DateText locale={locale} timeZone={timeZone} iso={nextDate} as="since" />, plan: list?.find((p) => p.id === sub.scheduledPlanId)?.name ?? sub.scheduledPlanId })}</span>
              </p>
            ) : null}
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {restartMode ? null : (
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 md:max-w-xl">
                <Lock aria-hidden="true" className="mt-1 size-5 shrink-0" />
                <p className="min-w-0 text-base leading-[1.6]">{copy.updateMethod.body}</p>
                <ApprovalHint id={`${id}-method-hint`} className="col-start-2">{copy.humanHint}</ApprovalHint>
                <Button type="button" variant={sub.status === "past_due" ? "default" : "outline"} size="lg" disabled={form.pending || !!form.holdLabel} focusableWhenDisabled onClick={updateMethod} className="col-start-2 justify-self-start" {...humanApprovalProps("update-payment-method", `${id}-method-hint`)}>
                  {form.pending ? copy.updateMethod.pending : (form.holdLabel ?? copy.updateMethod.label)}
                </Button>
              </div>
              )}
              {portal && copy.invoices ? <BillingInvoices id={`${id}-invoices`} portal={portal} copy={copy.invoices} notices={copy.notices} onRedirect={onRedirect} /> : null}
              {sub.status !== "canceled" && sub.status !== "expired" && !sub.cancelAt ? (
                <p data-billing="cancel" className="flex flex-col gap-1 md:items-end md:text-end">
                  <a href={copy.cancel.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                    {copy.cancel.label}
                  </a>
                  {nextDate ? <span className="text-base leading-[1.6]">{fillText(copy.cancel.note, { date: formatUntil(nextDate, locale, timeZone) })}</span> : null}
                </p>
              ) : null}
            </div>
            {list && list.length ? (
              <div data-billing="change" className="flex flex-col gap-4 border-t pt-8">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.change.title}</h3>
                <div className="w-full overflow-x-auto">
                  <Table role="table" className="text-base max-sm:block max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-[repeat(var(--stack-cols,2),minmax(0,1fr))] max-sm:[&_tr]:gap-x-4 max-sm:[&_tr]:gap-y-1 max-sm:[&_tr]:py-3 max-sm:[&_caption]:block max-sm:[&_th]:block max-sm:[&_th]:h-auto max-sm:[&_th]:w-auto max-sm:[&_th]:border-0 max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:min-w-0 max-sm:[&_td]:border-0 max-sm:[&_td]:py-0 max-sm:[&_[data-stack=skip]]:hidden max-sm:[&_th[scope=row]]:col-span-full max-sm:[&_td[colspan]]:col-span-full max-sm:[&_td[data-label]]:before:block max-sm:[&_td[data-label]]:before:text-sm max-sm:[&_td[data-label]]:before:font-normal max-sm:[&_td[data-label]]:before:text-muted-foreground max-sm:[&_td[data-label]]:before:content-[attr(data-label)]">
                    <caption className="sr-only">{copy.change.caption}</caption>
                    <TableHeader role="rowgroup">
                      <TableRow role="row">
                        <TableHead scope="col" role="columnheader">{copy.change.cols.plan}</TableHead>
                        <TableHead scope="col" role="columnheader">{copy.change.cols.price}</TableHead>
                        <TableHead scope="col" role="columnheader">{copy.change.cols.billing}</TableHead>
                        <TableHead scope="col" role="columnheader" data-stack="skip" className="hidden md:table-cell">
                          {copy.change.cols.features}
                        </TableHead>
                        <TableHead scope="col" role="columnheader">
                          <span className="sr-only">{copy.change.cols.action}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody role="rowgroup">
                      {list.map((p) => {
                        const isCurrent = p.id === sub.planId && !restartMode
                        const isScheduled = p.id === sub.scheduledPlanId
                        return (
                          <TableRow key={p.id} role="row" data-current={isCurrent ? "" : undefined}>
                            <TableHead scope="row" role="rowheader" className="text-base font-medium">
                              {p.name}
                            </TableHead>
                            <TableCell role="cell" data-label={copy.change.cols.price} data-numeric className="whitespace-nowrap tabular-nums">
                              <MoneyText money={p.price} />
                            </TableCell>
                            <TableCell role="cell" data-label={copy.change.cols.billing} className="whitespace-nowrap text-base">
                              {perOf(p, copy.per)} · {vat(p)}
                            </TableCell>
                            <TableCell role="cell" data-stack="skip" className="hidden md:table-cell">{p.features.join(" · ")}</TableCell>
                            <TableCell role="cell" className="text-end max-sm:col-span-full max-sm:pt-1 max-sm:text-start">
                              {isCurrent ? (
                                <Badge variant="secondary">{copy.change.current}</Badge>
                              ) : isScheduled ? (
                                <Badge variant="outline">{copy.change.scheduled}</Badge>
                              ) : restartMode && copy.restart ? (
                                <Button variant="outline" nativeButton={false} role="link" render={<a href={restartHref(p.id)} />}>
                                  {fillText(copy.restart.choose, { plan: p.name })}
                                </Button>
                              ) : (
                                <Button type="button" variant="outline" onClick={() => setPicked(p.id)} aria-pressed={picked === p.id}>
                                  {fillText(copy.change.choose, { plan: p.name })}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {target && nextDate ? (
                  <div className="flex max-w-2xl flex-col gap-3 border px-5 py-5">
                    <p ref={questionRef} tabIndex={-1} className="text-[1.125rem] leading-[1.4] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                      {fillText(copy.change.question, { plan: target.name })}
                    </p>
                    <p className="min-w-0 text-base leading-[1.6]">{fill(copy.change.body, { date: <DateText locale={locale} timeZone={timeZone} iso={nextDate} as="since" />, amount: <MoneyText money={target.price} />, vat: vat(target), plan: target.name })}</p>
                    <ApprovalHint id={`${id}-change-hint`}>{copy.humanHint}</ApprovalHint>
                    <ChoiceRow label={fillText(copy.change.question, { plan: target.name })}>
                      <ChoiceButton choice="decline" type="button" onClick={() => setPicked(null)}>
                        {copy.change.cancel}
                      </ChoiceButton>
                      <ChoiceButton choice="primary" type="button" disabled={form.pending || !!form.holdLabel} focusableWhenDisabled onClick={confirmChange} {...humanApprovalProps("change-plan", `${id}-change-hint`)}>
                        {form.pending ? copy.change.pending : (form.holdLabel ?? fillText(copy.change.confirm, { plan: target.name }))}
                      </ChoiceButton>
                    </ChoiceRow>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
