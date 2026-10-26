"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import { humanApprovalProps } from "@/components/contract/human-actions"
import type { AnalyticsPort, BillingPort, CancelReason, Money, Plan, RetentionOffer, Subscription } from "@/components/contract/ports"
import { retentionOfferIssues } from "@/lib/retention-offer"
import { Check, CheckCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { BlockHeading } from "../_shared/block-heading"
import { DateText, MoneyText, fill, fillText, vatLabel } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 해지 흐름 — 단계 줄(① 해지 방식 ② 다른 방법 ③ 완료) 아래 한 단계씩. 방통위 「해지 복잡화」 기준·전자상거래법(마케팅 규칙 L3·L4·L5·R2):
//   · 단계 수(data-flow="cancel" data-steps=3)는 가입 흐름(auth/sign-up-consents, 3단계) 이하다. 모든 단계에 해지 쪽 버튼(data-choice="decline")이
//     다른 선택지(data-choice="primary")와 같은 크기·모양으로 있다(choice-pair).
//   · 묻는 것은 사유 하나뿐이고 선택이다(고르지 않아도 넘어간다). 혜택을 되풀이해 늘어놓거나 만류 질문을 하지 않는다.
//   · 약관에 중도해지가 있으면(terms.midTerm) 일반해지(기간 끝)와 중도해지(지금)를 둘 다 고를 수 있다. 없으면 일반해지만 적는다.
//   · 대안은 한 화면에 하나만: 일시정지 → 다운그레이드 → 할인 순으로 쓸 수 있는 첫 대안(pickRetentionOffer, 할인은 금액으로 — 30% 이하·2~3개월).
//     대안이 없으면 ②는 해지 확인 한 장이다.
//   · 완료 화면에 이용이 끝나는 날(cancelAt)을 적는다.
// P3-6 감사 F05·F12·F13(factory-rules.md §22-1 L4·L5, §23-3 U12):
//   · 쓸 수 있는 대안이 없으면 ② 확인 장을 두지 않는다 — ① 의 [해지하기] 가 바로 해지한다(같은 결정을 두 번 묻지 않는다, 흐름은 두 단계: 해지 방식 → 완료, data-steps=2).
//     대안이 있을 때만 세 단계다(대안 하나를 본 뒤 [해지하기] 한 번). 사유는 처음부터 선택이다.
//   · 이미 해지가 예약된 구독(cancelAt)에는 해지 흐름을 다시 보이지 않는다 — 상태(언제까지 쓰고 그 뒤 결제되지 않는다)와 [계속 쓰기](resume) 하나만(copy.scheduled, F05).
//   · 완료 화면은 「다음 결제는 없다」(done.noMoreCharges)·종료일·「앱스토어·통신사 등 다른 곳에서 결제했다면 거기서 해지」(done.otherChannels)를 적는다(F13).
// 포트: subscription·plans(읽기 4상태) · cancel · applyRetentionOffer · resume(선택 — 해지 예약 거두기). 계측(선택): cancel_start · cancel_alternative_view/accept · cancel_complete{reason, when}
// (사유 자유 글은 받지 않는다 — 계측에 개인정보가 섞이지 않게).
export const CANCEL_STEPS = 3
const REASONS: readonly CancelReason[] = ["too_expensive", "not_using", "missing_feature", "switching", "temporary", "other"]
const ORDER: Record<RetentionOffer["kind"], number> = { pause: 0, downgrade: 1, discount: 2 }

/** 보일 대안 하나(R2 순서: 일시정지 → 다운그레이드 → 할인). 한도(lib retention-offer)를 넘거나 옮길 요금제가 없으면 건너뛴다 */
export function pickRetentionOffer(offers: readonly RetentionOffer[], ctx: { planId: string | null; plans: readonly Plan[] }): RetentionOffer | null {
  const current = ctx.plans.find((p) => p.id === ctx.planId)
  const ok = (o: RetentionOffer) => {
    if (retentionOfferIssues(o).length) return false
    if (o.kind === "downgrade") {
      const to = ctx.plans.find((p) => p.id === o.planId)
      return !!to && to.id !== ctx.planId && (!current || to.price.amount < current.price.amount)
    }
    if (o.kind === "discount") return !!current
    return true
  }
  return [...offers].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]).find(ok) ?? null
}

export type RetentionCancelFlowCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  steps: [string, string, string]
  reason: { legend: string; marker: string; hint: string; options: Record<CancelReason, string> }
  when: { legend: string; periodEnd: { label: string; body: string }; now: { label: string; body: string }; only: string }
  next: string
  keep: string
  offer: {
    title: string
    pause: { title: string; body: string; accept: string }
    downgrade: { title: string; body: string; accept: string }
    discount: { title: string; body: string; accept: string }
  }
  confirm: { title: string; body: string; keep: string }
  cancel: string
  pending: string
  // done.noMoreCharges(선택): 「다음 결제는 없어요」처럼 더 청구되지 않는다는 한 줄 · done.otherChannels(선택): 앱스토어·통신사·결제 대행처럼 다른 경로로 결제했다면 거기서 해지해야 한다는 안내(F13)
  done: { title: string; periodEnd: string; now: string; again: string; noMoreCharges?: string; otherChannels?: { title: string; body: string }; back: { label: string; href: string } }
  // 선택(F05): 이미 해지가 예약된 구독이 이 화면에 오면 흐름 대신 상태와 [계속 쓰기]. body 의 {date} = 이용이 끝나는 날(cancelAt). 없으면 예전 모양 그대로다
  scheduled?: { title: string; body: string; keep: string; pending: string; done: string }
  offerDone: { title: string; pause: string; downgrade: string; discount: string }
  vatIncluded: string
  vatExcluded: string
  none: { title: string; body: string }
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
}
export type RetentionCancelFlowProps = BlockBase<RetentionCancelFlowCopy> & {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  cancel: BillingPort["cancel"]
  applyRetentionOffer: BillingPort["applyRetentionOffer"]
  // 해지 예약을 거두는 포트(선택, F05) — 없으면 [계속 쓰기] 는 keepHref 로 가는 링크다
  resume?: BillingPort["resume"]
  // 보일 수 있는 대안(요금제와 따로 — 이 중 하나만 보인다)
  offers: RetentionOffer[]
  // 약관의 중도해지 여부(있으면 일반·중도 둘 다 고른다 — L5)
  terms: { midTerm: boolean }
  // 「계속 쓰기」가 갈 곳
  keepHref: string
  track?: AnalyticsPort["track"]
  initial?: { subscription?: Subscription; plans?: Plan[] }
}

const discounted = (m: Money, percent: number): Money => ({ ...m, amount: Math.round((m.amount * (100 - percent)) / 100 / 10) * 10 })

export function RetentionCancelFlow({ copy, locale, timeZone, subscription, plans, cancel, applyRetentionOffer, resume, offers, terms, keepHref, track, initial, id = "cancel", className }: RetentionCancelFlowProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const subRead = usePortRead(subscription, initial?.subscription)
  const planRead = usePortRead(plans, initial?.plans)
  const [step, setStep] = React.useState(1)
  const [reason, setReason] = React.useState<CancelReason | null>(null)
  const [when, setWhen] = React.useState<"period_end" | "now">("period_end")
  const [result, setResult] = React.useState<{ kind: "canceled"; sub: Subscription } | { kind: "offer"; offer: RetentionOffer; sub: Subscription } | null>(null)
  const [busy, setBusy] = React.useState<"cancel" | "offer" | null>(null)
  const stepTitle = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)
  React.useEffect(() => {
    if (moved.current) stepTitle.current?.focus()
  }, [step])
  const go = (n: number) => {
    moved.current = true
    setStep(n)
  }
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "cancel-flow", fields: e.fields, kind: e.kind }) })

  const sub = subRead.state.status === "ready" ? subRead.state.data : null
  const list = planRead.state.status === "ready" ? planRead.state.data : null
  const current = sub && list ? (list.find((p) => p.id === sub.planId) ?? null) : null
  const offer = sub && list ? pickRetentionOffer(offers, { planId: sub.planId, plans: list }) : null
  const endAt = sub?.currentPeriodEnd ?? sub?.trialEnd
  const hasSub = !!sub && sub.status !== "none" && sub.status !== "canceled" && sub.status !== "expired" && sub.planId !== null
  // 이미 해지가 예약됐다(cancelAt) — 해지 흐름을 다시 보이지 않고 상태와 [계속 쓰기]만(F05). 이 화면에서 방금 해지했거나 대안을 받은 사람(result)은 완료 화면이 먼저다
  const alreadyScheduled = hasSub && !!sub?.cancelAt && !result && !!copy.scheduled
  const [kept, setKept] = React.useState(false)
  const keptRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (kept) keptRef.current?.focus()
  }, [kept])
  const keepPlan = async () => {
    if (!resume) return
    setBusy("offer")
    const r = await form.run(() => resume())
    setBusy(null)
    if (!r) return
    track?.("resume", {})
    // 구독 읽기는 그대로 둔다 — 다시 읽으면 cancelAt 이 사라져 방금 보인 확인 글 대신 해지 흐름이 떠 버린다(새로 열면 새 값)
    setKept(true)
  }
  // 흐름의 단계: 대안이 없으면 ② 확인 장이 없다(① 에서 바로 해지). 대안이 있을 때만 세 단계
  const flowSteps = offer ? CANCEL_STEPS : CANCEL_STEPS - 1
  const stepNames = offer ? copy.steps : ([copy.steps[0], copy.steps[2]] as const)
  const stepNo = offer ? step : step === 3 ? 2 : 1

  const started = React.useRef(false)
  React.useEffect(() => {
    if (!hasSub || started.current || alreadyScheduled) return
    started.current = true
    track?.("cancel_start", { planId: sub?.planId ?? null })
  }, [hasSub, sub, track, alreadyScheduled])
  const toStep2 = () => {
    if (offer) track?.("cancel_alternative_view", { alternative: offer.kind })
    go(2)
  }
  const doCancel = async () => {
    setBusy("cancel")
    // confirmed: 이 버튼이 해지 흐름의 확인 단계다 — 눌렀다는 선언을 포트가 요구할 수 있다(P3-7 AXC, R20)
    const r = await form.run(() => cancel({ when, ...(reason ? { reason } : {}), confirmed: true }))
    setBusy(null)
    if (!r) return
    track?.("cancel_complete", { when, ...(reason ? { reason } : {}) })
    setResult({ kind: "canceled", sub: r })
    go(3)
  }
  const doOffer = async () => {
    if (!offer) return
    setBusy("offer")
    const r = await form.run(() => applyRetentionOffer({ offerId: offer.id, confirmed: true }))
    setBusy(null)
    if (!r) return
    track?.("cancel_alternative_accept", { alternative: offer.kind })
    setResult({ kind: "offer", offer, sub: r })
    go(3)
  }
  const vat = (m: Money) => vatLabel(m, copy)
  const loading = subRead.state.status === "loading" || planRead.state.status === "loading"
  const err = subRead.state.status === "error" ? subRead.state : planRead.state.status === "error" ? planRead.state : null

  const offerView = (o: RetentionOffer) => {
    if (o.kind === "pause") {
      const months = o.pauseMonths ?? 1
      return {
        title: fillText(copy.offer.pause.title, { months }),
        body: fill(copy.offer.pause.body, { months: <span data-numeric>{months}</span> }),
        accept: fillText(copy.offer.pause.accept, { months }),
      }
    }
    if (o.kind === "downgrade") {
      const to = list?.find((p) => p.id === o.planId)
      return {
        title: fillText(copy.offer.downgrade.title, { plan: to?.name ?? "" }),
        body: to ? fill(copy.offer.downgrade.body, { plan: to.name, amount: <MoneyText money={to.price} price="after" />, vat: vat(to.price) }) : null,
        accept: fillText(copy.offer.downgrade.accept, { plan: to?.name ?? "" }),
      }
    }
    const d = o.discount ?? { percent: 0, months: 0 }
    return {
      title: fillText(copy.offer.discount.title, { months: d.months, percent: d.percent }),
      body: current ? fill(copy.offer.discount.body, { months: <span data-numeric>{d.months}</span>, before: <MoneyText money={current.price} price="before" />, after: <MoneyText money={discounted(current.price, d.percent)} price="after" />, vat: vat(current.price) }) : null,
      accept: fillText(copy.offer.discount.accept, { months: d.months, percent: d.percent }),
    }
  }

  return (
    <section ref={ref} id={id} data-block="retention-cancel-flow" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter aria-busy={loading || undefined} className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {loading ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {!loading && !err && sub && !hasSub && !result ? (
          <div className="flex flex-col items-start gap-3">
            <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.none.title}</h3>
            <p className="text-base leading-[1.7]">{copy.none.body}</p>
          </div>
        ) : null}
        {alreadyScheduled && copy.scheduled && sub?.cancelAt ? (
          <div data-cancel-scheduled="" className="flex flex-col items-start gap-3 border px-5 py-6 md:px-8">
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            {kept ? (
              <>
                <p ref={keptRef} tabIndex={-1} role="status" data-kept="" className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                  <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
                  {copy.scheduled.done}
                </p>
                <Button variant="outline" size="lg" nativeButton={false} role="link" render={<a href={copy.done.back.href} />}>
                  {copy.done.back.label}
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.scheduled.title}</h3>
                <p data-end-date={sub.cancelAt} className="text-base leading-[1.7]">
                  {fill(copy.scheduled.body, { date: <DateText locale={locale} timeZone={timeZone} iso={sub.cancelAt} /> })}
                </p>
                {resume ? <ApprovalHint id={`${id}-hint-resume`}>{copy.humanHint}</ApprovalHint> : null}
                {resume ? (
                  <Button type="button" size="lg" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={keepPlan} data-resume="" {...humanApprovalProps("resume-subscription", `${id}-hint-resume`)}>
                    {busy === "offer" ? copy.scheduled.pending : (form.holdLabel ?? copy.scheduled.keep)}
                  </Button>
                ) : (
                  <Button size="lg" nativeButton={false} role="link" render={<a href={keepHref} />} data-resume="">
                    {copy.scheduled.keep}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : null}
        {!alreadyScheduled && (hasSub || result) && list ? (
          <>
            <ol aria-label={copy.title} className="grid grid-cols-3 border-b">
              {stepNames.map((label, i) => (
                <li key={label} aria-current={stepNo === i + 1 ? "step" : undefined} data-done={stepNo > i + 1 ? "" : undefined} className="flex min-w-0 flex-col items-start gap-2 border-b-2 border-transparent pb-4 sm:flex-row sm:items-center sm:gap-3 aria-[current=step]:border-foreground">
                  <span data-numeric className="flex size-9 shrink-0 items-center justify-center border text-base in-aria-[current=step]:bg-primary in-aria-[current=step]:text-primary-foreground in-data-[done]:bg-muted">
                    {stepNo > i + 1 ? <Check aria-hidden="true" className="size-4" /> : i + 1}
                  </span>
                  <span className="text-base leading-[1.4] in-aria-[current=step]:font-medium">{label}</span>
                </li>
              ))}
            </ol>
            <div data-flow="cancel" data-step={stepNo} data-steps={flowSteps} className="flex flex-col gap-6">
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              {step === 1 ? (
                <>
                  <h3 ref={stepTitle} tabIndex={-1} className="text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                    {copy.steps[0]}
                  </h3>
                  <fieldset data-optional-question="reason" className="flex min-w-0 flex-col gap-3">
                    <legend className="px-1 text-base leading-[1.5] font-heading">
                      {copy.reason.legend}
                      <span className="ms-1 text-base">{copy.reason.marker}</span>
                    </legend>
                    <FieldDescription className="text-base leading-[1.6] text-foreground">{copy.reason.hint}</FieldDescription>
                    <RadioGroup value={reason ?? ""} onValueChange={(v) => setReason((v as CancelReason) || null)} aria-label={copy.reason.legend} className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                      {REASONS.map((r) => (
                        <div key={r} className="flex items-center gap-3">
                          <RadioGroupItem id={`${id}-reason-${r}`} value={r} />
                          <FieldLabel htmlFor={`${id}-reason-${r}`}>{copy.reason.options[r]}</FieldLabel>
                        </div>
                      ))}
                    </RadioGroup>
                  </fieldset>
                  <fieldset data-cancel-when={terms.midTerm ? "both" : "period_end"} className="flex min-w-0 flex-col gap-3">
                    <legend className="px-1 text-base leading-[1.5] font-heading">{copy.when.legend}</legend>
                    {terms.midTerm ? (
                      <RadioGroup value={when} onValueChange={(v) => setWhen(v as "period_end" | "now")} aria-label={copy.when.legend} className="grid gap-3">
                        {(["period_end", "now"] as const).map((w) => {
                          const c = w === "period_end" ? copy.when.periodEnd : copy.when.now
                          return (
                            <div key={w} data-when={w} className="flex items-start gap-3 border px-4 py-4">
                              <RadioGroupItem id={`${id}-when-${w}`} value={w} aria-describedby={`${id}-when-${w}-body`} />
                              <div className="flex min-w-0 flex-col gap-1">
                                <FieldLabel htmlFor={`${id}-when-${w}`}>{c.label}</FieldLabel>
                                <p id={`${id}-when-${w}-body`} className="text-base leading-[1.6]">
                                  {fill(c.body, { date: endAt ? <DateText locale={locale} timeZone={timeZone} iso={endAt} /> : "—" })}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </RadioGroup>
                    ) : (
                      <p data-when="period_end" className="text-base leading-[1.6]">
                        {fill(copy.when.only, { date: endAt ? <DateText locale={locale} timeZone={timeZone} iso={endAt} /> : "—" })}
                      </p>
                    )}
                  </fieldset>
                  {offer ? null : <ApprovalHint id={`${id}-hint-1`}>{copy.humanHint}</ApprovalHint>}
                  <ChoiceRow label={copy.steps[0]}>
                    {offer ? (
                      <ChoiceButton choice="decline" type="button" onClick={toStep2}>
                        {copy.next}
                      </ChoiceButton>
                    ) : (
                      <ChoiceButton choice="decline" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={doCancel} {...humanApprovalProps("cancel-subscription", `${id}-hint-1`)}>
                        {busy === "cancel" ? copy.pending : copy.cancel}
                      </ChoiceButton>
                    )}
                    <ChoiceButton choice="primary" nativeButton={false} role="link" render={<a href={keepHref} />}>
                      {copy.keep}
                    </ChoiceButton>
                  </ChoiceRow>
                </>
              ) : step === 2 ? (
                <>
                  <h3 ref={stepTitle} tabIndex={-1} className="text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                    {offer ? copy.offer.title : copy.confirm.title}
                  </h3>
                  {offer ? (
                    (() => {
                      const v = offerView(offer)
                      return (
                        <div data-alternative={offer.kind} className="flex flex-col gap-4 border px-5 py-6 md:px-8">
                          <p className="text-[1.563rem] leading-[1.25] font-heading">{v.title}</p>
                          {v.body ? <p className="text-base leading-[1.6]">{v.body}</p> : null}
                          <ApprovalHint id={`${id}-hint-offer`}>{copy.humanHint}</ApprovalHint>
                          <ChoiceRow label={copy.offer.title}>
                            <ChoiceButton choice="decline" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={doCancel} {...humanApprovalProps("cancel-subscription", `${id}-hint-offer`)}>
                              {busy === "cancel" ? copy.pending : copy.cancel}
                            </ChoiceButton>
                            <ChoiceButton choice="primary" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={doOffer} {...humanApprovalProps("accept-retention-offer", `${id}-hint-offer`)}>
                              {busy === "offer" ? copy.pending : (form.holdLabel ?? v.accept)}
                            </ChoiceButton>
                          </ChoiceRow>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="flex flex-col gap-4 border px-5 py-6 md:px-8">
                      <p className="text-base leading-[1.6]">{fill(copy.confirm.body, { date: endAt ? <DateText locale={locale} timeZone={timeZone} iso={endAt} /> : "—" })}</p>
                      <ApprovalHint id={`${id}-hint-confirm`}>{copy.humanHint}</ApprovalHint>
                      <ChoiceRow label={copy.confirm.title}>
                        <ChoiceButton choice="decline" type="button" disabled={busy !== null || !!form.holdLabel} focusableWhenDisabled onClick={doCancel} {...humanApprovalProps("cancel-subscription", `${id}-hint-confirm`)}>
                          {busy === "cancel" ? copy.pending : copy.cancel}
                        </ChoiceButton>
                        <ChoiceButton choice="primary" nativeButton={false} role="link" render={<a href={keepHref} />}>
                          {copy.confirm.keep}
                        </ChoiceButton>
                      </ChoiceRow>
                    </div>
                  )}
                </>
              ) : result ? (
                <div role="status" data-done={result.kind} className="flex flex-col items-start gap-3">
                  <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
                  <h3 ref={stepTitle} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                    {result.kind === "canceled" ? copy.done.title : copy.offerDone.title}
                  </h3>
                  {result.kind === "canceled" ? (
                    <>
                      <p data-end-date={result.sub.cancelAt} className="text-base leading-[1.7]">
                        {fill(when === "now" ? copy.done.now : copy.done.periodEnd, { date: result.sub.cancelAt ? <DateText locale={locale} timeZone={timeZone} iso={result.sub.cancelAt} /> : "—" })}
                      </p>
                      {copy.done.noMoreCharges ? (
                        <p data-no-charge="" className="text-base leading-[1.7] font-heading">
                          {copy.done.noMoreCharges}
                        </p>
                      ) : null}
                      <p className="text-base leading-[1.7]">{copy.done.again}</p>
                      {copy.done.otherChannels ? (
                        <div data-other-channels="" className="flex flex-col gap-1 border-t pt-3">
                          <p className="text-[1.125rem] leading-[1.4] font-heading">{copy.done.otherChannels.title}</p>
                          <p className="text-base leading-[1.7]">{copy.done.otherChannels.body}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-base leading-[1.7]">
                      {fill(copy.offerDone[result.offer.kind], {
                        date: result.sub.pausedUntil ? <DateText locale={locale} timeZone={timeZone} iso={result.sub.pausedUntil} /> : endAt ? <DateText locale={locale} timeZone={timeZone} iso={endAt} as="since" /> : "—",
                        plan: list.find((p) => p.id === result.sub.scheduledPlanId)?.name ?? "",
                      })}
                    </p>
                  )}
                  <Button variant="outline" size="lg" nativeButton={false} role="link" render={<a href={copy.done.back.href} />}>
                    {copy.done.back.label}
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
