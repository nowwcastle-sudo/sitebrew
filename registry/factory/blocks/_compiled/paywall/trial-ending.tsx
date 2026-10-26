"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, BillingPort, IsoDate, Plan, Subscription } from "@/registry/factory/contract/ports"
import { CheckCircle, Clock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"
import { DateText, DaysLeft, daysBetween, fill, fillText, formatMoney } from "../_shared/billing-format"
import { PlanOffer, type PlanOfferCopy } from "../_shared/plan-offer"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import { useSnooze } from "../_shared/snooze"

// 체험 종료 예고 — 맨 위 띠(시계 · 「3일 남았어요」 — 실제 체험 끝(subscription.trialEnd)에 묶은 남은 날, L8) 아래 두 단:
//   왼쪽 무엇이 일어나나(끝나는 날 · 동의하지 않으면 결제되지 않고 무료로 바뀐다 — 무료→유료는 명시 동의, L6) + 체험 동안 한 일(value — P8),
//   오른쪽 제안 한 판(plan-offer — 청구액이 가장 크고 버튼 앞에 첫 결제·자동 갱신·해지 방법, [체험만 쓰고 끝내기][계속 쓰기] 대등 — P1·P2·L1·L3).
// 예고는 끝나기 7·3·1일 전 구간에만 보인다(P8). 「체험만 쓰고 끝내기」를 누르면 다음 예고 구간까지 쉰다(같은 구간에서 다시 묻지 않는다 — L7·P9).
// 체험 중이 아니면(trialEnd 없음) 아무것도 그리지 않는다. 계측(선택): 보이면 upgrade_prompt_view{trigger:"trial-ending-<n>"}, 계속하면 upgrade_click·checkout_start.
export type PaywallTrialEndingCopy = {
  title: string
  daysLeft: string // {days}
  endsOn: string // {date}
  whatHappens: string // {date} · {plan}
  valueTitle: string
  value: string[]
  offer: PlanOfferCopy
  decline: string
  cta: string // {amount}
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
  done: string // {plan}
}
export type PaywallTrialEndingProps = BlockBase<PaywallTrialEndingCopy> & {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  checkout: BillingPort["checkout"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  // 예고 구간(끝나기 며칠 전부터). 기본 7·3·1
  notices?: number[]
  now?: IsoDate
  initial?: { subscription?: Subscription; plans?: Plan[] }
}

export function PaywallTrialEnding({ copy, locale, timeZone, subscription, plans, checkout, track, onRedirect, notices = [7, 3, 1], now, initial, id = "trial-ending", className }: PaywallTrialEndingProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [first] = React.useState(() => now ?? new Date().toISOString())
  const today = now ?? first
  const subRead = usePortRead(subscription, initial?.subscription)
  const planRead = usePortRead(plans, initial?.plans)
  const [done, setDone] = React.useState(false)
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "trial-ending", fields: e.fields, kind: e.kind }) })

  const sub = subRead.state.status === "ready" ? subRead.state.data : null
  const list = planRead.state.status === "ready" ? planRead.state.data : null
  const plan = sub && list ? (list.find((p) => p.id === sub.planId) ?? null) : null
  const endsAt = sub?.status === "trialing" ? sub.trialEnd : undefined
  const left = endsAt ? daysBetween(new Date(today).getTime(), endsAt) : null
  // 지금 예고 구간 — 남은 날 이하인 가장 작은 구간(7일 전이면 7, 2일 전이면 3 … 가 아니라 가장 가까운 큰 구간)
  const stage = left === null ? null : ([...notices].sort((a, b) => a - b).find((n) => left <= n) ?? null)
  const { snoozed, snooze } = useSnooze(`wf-trial-ending:${endsAt ?? "none"}:${stage ?? "x"}`, stage ?? 1)
  const visible = !!endsAt && stage !== null && snoozed !== true

  const seen = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!visible || stage === null || seen.current === stage) return
    seen.current = stage
    track?.("upgrade_prompt_view", { trigger: `trial-ending-${stage}` })
  }, [visible, stage, track])

  const start = async (consent: { withdrawalConsent?: true }) => {
    if (!plan) return
    track?.("upgrade_click", { trigger: `trial-ending-${stage}`, planId: plan.id })
    track?.("checkout_start", { planId: plan.id })
    const r = await form.run(() => checkout({ planId: plan.id, ...consent }), { retry: () => void start(consent) })
    if (!r) return
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    setDone(true)
  }
  const loading = subRead.state.status === "loading" || planRead.state.status === "loading"
  const err = subRead.state.status === "error" ? subRead.state : planRead.state.status === "error" ? planRead.state : null
  if (!loading && !err && !visible) return <section ref={ref} id={id} data-block="paywall-trial-ending" aria-labelledby={`${id}-title`} hidden className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}><h2 id={`${id}-title`}>{copy.title}</h2></section>

  return (
    <section ref={ref} id={id} data-block="paywall-trial-ending" aria-labelledby={`${id}-title`} aria-busy={loading || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
      {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
      {visible && endsAt ? (
        <>
          <div data-enter className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-primary px-5 py-4 text-primary-foreground md:px-8">
            <Clock aria-hidden="true" className="size-6 shrink-0" />
            <p className="text-[1.25rem] leading-[1.35] md:text-[1.563rem] font-heading">
              <DaysLeft endsAt={endsAt} now={today} template={copy.daysLeft} className="tabular-nums" />
            </p>
            <p className="text-base leading-[1.5] md:ms-auto">{fill(copy.endsOn, { date: <DateText locale={locale} timeZone={timeZone} iso={endsAt} /> })}</p>
          </div>
          <div className="grid gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-16">
            <div className="flex flex-col gap-8">
              <BlockHeading id={`${id}-title`} title={copy.title} lead={fill(copy.whatHappens, { date: <DateText locale={locale} timeZone={timeZone} iso={endsAt} />, plan: plan?.name ?? "" })} />
              {copy.value.length ? (
                <div data-enter className="flex flex-col gap-3 border-t pt-6">
                  <h3 className="text-[1.125rem] leading-[1.4] font-heading">{copy.valueTitle}</h3>
                  <ul className="flex flex-col gap-2">
                    {copy.value.map((v) => (
                      <li key={v} className="flex items-start gap-2 text-base leading-[1.6]">
                        <CheckCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div data-enter className="flex min-w-0 flex-col gap-4 border px-5 py-6 md:px-8">
              {done ? (
                <p role="status" className="border px-5 py-4 text-base leading-[1.6]">
                  {fillText(copy.done, { plan: plan?.name ?? "" })}
                </p>
              ) : plan ? (
                <>
                  <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                  <PlanOffer locale={locale} timeZone={timeZone} plan={{ ...plan, trialDays: undefined }} copy={copy.offer} firstChargeAt={endsAt} onCheckout={start} onDecline={snooze} declineLabel={copy.decline} ctaLabel={fillText(copy.cta, { amount: formatMoney(plan.price) })} pending={form.pending} holdLabel={form.holdLabel} />
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
