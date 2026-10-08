"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, BillingPort, IsoDate, Plan } from "@/registry/factory/contract/ports"
import { Check, CheckCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"
import { addDays, fillText, useNow } from "../_shared/billing-format"
import { PlanOffer, type PlanOfferCopy } from "../_shared/plan-offer"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 온보딩 끝 체험 제안 — 가운데 한 줄기: 축하 머리(설정을 마쳤어요) · 방금 끝낸 것 칩 줄 · 아래 가운데 제안 판(체험 요금제 plan-offer).
// 첫 세션 온보딩 끝의 체험 제안은 「무료로 계속」이 보일 때만 허용된다(마케팅 규칙 P6) — 거절 선택지가 「무료로 계속하기」 링크(continueHref)이고
// 주 선택지와 크기·모양이 같다(L3). 체험 기간·첫 결제일·금액·자동 갱신·해지 방법·약관이 버튼 앞에 있다(P2), 청구액이 가장 크다(P1).
// 포트: plans(읽기 4상태) · checkout. 계측(선택): 보이면 upgrade_prompt_view{trigger:"onboarding-end"}, 시작하면 upgrade_click·checkout_start·trial_start.
export type PaywallOnboardingOfferCopy = {
  title: string
  lead?: string
  doneLabel: string
  done: string[]
  offerTitle: string // {plan}
  offerLead?: string
  offer: PlanOfferCopy
  continueFree: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
  started: string // {plan}
}
export type PaywallOnboardingOfferProps = BlockBase<PaywallOnboardingOfferCopy> & {
  plans: BillingPort["plans"]
  checkout: BillingPort["checkout"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  // 무료로 계속할 때 갈 곳(앱 첫 화면)
  continueHref: string
  planId?: string
  now?: IsoDate
  initial?: { plans?: Plan[] }
}

export function PaywallOnboardingOffer({ copy, locale, timeZone, plans, checkout, track, onRedirect, continueHref, planId, now, initial, id = "onboarding-offer", className }: PaywallOnboardingOfferProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  const today = useNow(now)
  const read = usePortRead(plans, initial?.plans)
  const [started, setStarted] = React.useState(false)
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "onboarding-offer", fields: e.fields, kind: e.kind }) })
  const list = read.state.status === "ready" ? read.state.data : null
  const plan = list ? (list.find((p) => p.id === planId) ?? list.find((p) => p.recommended && p.trialDays) ?? list.find((p) => p.trialDays) ?? null) : null

  const seen = React.useRef(false)
  React.useEffect(() => {
    if (!plan || seen.current) return
    seen.current = true
    track?.("upgrade_prompt_view", { trigger: "onboarding-end" })
  }, [plan, track])

  const start = async (consent: { withdrawalConsent?: true }) => {
    if (!plan) return
    track?.("upgrade_click", { trigger: "onboarding-end", planId: plan.id })
    track?.("checkout_start", { planId: plan.id })
    const r = await form.run(() => checkout({ planId: plan.id, ...consent }), { retry: () => void start(consent) })
    if (!r) return
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    if (plan.trialDays) track?.("trial_start", { planId: plan.id, trialDays: plan.trialDays })
    setStarted(true)
  }
  return (
    <section ref={ref} id={id} data-block="paywall-onboarding-offer" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <CheckCircle aria-hidden="true" data-enter className="size-14" />
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} className="items-center" />
        {copy.done.length ? (
          <ul data-enter aria-label={copy.doneLabel} className="flex flex-wrap justify-center gap-2">
            {copy.done.map((d) => (
              <li key={d} className="inline-flex min-h-9 items-center gap-1.5 border px-3 text-base">
                <Check aria-hidden="true" className="size-4" />
                {d}
              </li>
            ))}
          </ul>
        ) : null}
        <div data-enter aria-busy={read.state.status === "loading" || undefined} className="mt-4 flex w-full flex-col gap-4 border px-5 py-6 text-start md:px-10 md:py-8">
          {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
          {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
          {started && plan ? (
            <p role="status" className="border px-5 py-4 text-base leading-[1.6]">
              {fillText(copy.started, { plan: plan.name })}
            </p>
          ) : plan ? (
            <>
              <h3 className="text-[1.25rem] leading-[1.35] font-heading">{fillText(copy.offerTitle, { plan: plan.name })}</h3>
              {copy.offerLead ? <p className="text-base leading-[1.6]">{copy.offerLead}</p> : null}
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              <PlanOffer locale={locale} timeZone={timeZone} plan={plan} copy={copy.offer} firstChargeAt={plan.trialDays ? addDays(today, plan.trialDays) : undefined} onCheckout={start} onDecline={() => undefined} declineHref={continueHref} declineLabel={copy.continueFree} pending={form.pending} holdLabel={form.holdLabel} />
            </>
          ) : read.state.status === "ready" ? (
            <a href={continueHref} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
              {copy.continueFree}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
