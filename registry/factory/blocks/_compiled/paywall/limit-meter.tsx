"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, BillingPort, IsoDate, Plan, Subscription } from "@/registry/factory/contract/ports"
import { AlertTriangle, ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Progress } from "@/registry/factory/ui/progress"

import { BlockHeading } from "../_shared/block-heading"
import { addDays, fill, fillText, useNow } from "../_shared/billing-format"
import { PlanOffer, type PlanOfferCopy } from "../_shared/plan-offer"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import { useSnooze } from "../_shared/snooze"

// 사용량 한도 — 막대 한 줄(쓴 양 / 한도, data-limit=ok|warn|blocked) 아래에 한도에 따라 다른 판(마케팅 규칙 P7):
//   · 80% 이상: 한 줄 제안(「한도의 85%를 썼어요 — ○○ 요금제면 1,000개」) + [며칠 안 보기][요금제 살펴보기] — 살펴보면 그 자리에 제안 한 판이 펼쳐진다.
//     닫으면 snoozeDays 동안 쉰다(P9). 작업 흐름을 막지 않는 인라인이다.
//   · 100%: 부드러운 막음 — 무엇을 못 하고 무엇은 계속 되는지 + 무료로 계속할 길(링크 — 안 쓰는 항목 보관 등) + 제안 한 판(plan-offer — P1·P2·L1·L3).
// 사용량은 포트 subscription().usage[limitKey], 권할 요금제는 그 한도가 더 큰 첫 요금제(plans()). 계측(선택): 제안을 보이면 upgrade_prompt_view,
// 100%면 limit_reached, 시작하면 upgrade_click·checkout_start.
export type PaywallLimitMeterCopy = {
  title: string
  lead?: string
  resource: string // 「프로젝트」
  usage: string // {used} · {limit} · {resource}
  warn: { title: string; body: string; later: string; look: string }
  blocked: { title: string; body: string; free: { label: string; href: string } }
  offer: PlanOfferCopy
  noUsage: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
  done: string
}
export type PaywallLimitMeterProps = BlockBase<PaywallLimitMeterCopy> & {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  checkout: BillingPort["checkout"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  // 사용량 키(subscription.usage·plan.limits 의 키)
  limitKey: string
  snoozeDays?: number
  now?: IsoDate
  initial?: { subscription?: Subscription; plans?: Plan[] }
}

const WARN_AT = 0.8

export function PaywallLimitMeter({ copy, locale, timeZone, subscription, plans, checkout, track, onRedirect, limitKey, snoozeDays = 3, now, initial, id = "limit", className }: PaywallLimitMeterProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const today = useNow(now)
  const subRead = usePortRead(subscription, initial?.subscription)
  const planRead = usePortRead(plans, initial?.plans)
  const { snoozed, snooze } = useSnooze(`wf-limit-offer:${limitKey}`, snoozeDays)
  const [look, setLook] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "limit-upgrade", fields: e.fields, kind: e.kind }) })

  const sub = subRead.state.status === "ready" ? subRead.state.data : null
  const list = planRead.state.status === "ready" ? planRead.state.data : null
  const u = sub?.usage?.[limitKey]
  const ratio = u && u.limit > 0 ? u.used / u.limit : 0
  const level = !u ? null : ratio >= 1 ? "blocked" : ratio >= WARN_AT ? "warn" : "ok"
  const target = u && list ? (list.find((p) => (p.limits?.[limitKey] ?? 0) > u.limit && p.id !== sub?.planId) ?? null) : null
  const showWarn = level === "warn" && target && snoozed === false
  const showOffer = !!target && !done && (level === "blocked" || (showWarn && look))

  const seen = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!u || !level || level === "ok" || seen.current === level) return
    if (level === "warn" && !showWarn) return
    seen.current = level
    if (level === "blocked") track?.("limit_reached", { limit: limitKey, used: u.used, max: u.limit })
    track?.("upgrade_prompt_view", { trigger: `limit-${level}` })
  }, [u, level, showWarn, limitKey, track])

  const start = async (consent: { withdrawalConsent?: true }) => {
    if (!target) return
    track?.("upgrade_click", { trigger: `limit-${level}`, planId: target.id })
    track?.("checkout_start", { planId: target.id })
    const r = await form.run(() => checkout({ planId: target.id, ...consent }), { retry: () => void start(consent) })
    if (!r) return
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    setDone(true)
  }
  const loading = subRead.state.status === "loading" || planRead.state.status === "loading"
  const err = subRead.state.status === "error" ? subRead.state : planRead.state.status === "error" ? planRead.state : null
  const limitText = (n: number) => n.toLocaleString("ko-KR")

  return (
    <section ref={ref} id={id} data-block="paywall-limit-meter" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex max-w-3xl flex-col gap-5">
        {loading ? <ReadLoading label={copy.loading} lines={2} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {!loading && !err && sub && !u ? <p className="text-base leading-[1.6]">{copy.noUsage}</p> : null}
        {u && level ? (
          <div data-limit={level} className="flex flex-col gap-2">
            <Progress value={Math.min(100, Math.round(ratio * 100))} aria-label={fillText(copy.usage, { used: limitText(u.used), limit: limitText(u.limit), resource: copy.resource })} className="w-full in-data-[limit=blocked]:[&_[data-slot=progress-indicator]]:bg-destructive" />
            <p className="text-[1.125rem] leading-[1.4] tabular-nums">
              {fill(copy.usage, { used: <span data-numeric>{limitText(u.used)}</span>, limit: <span data-numeric>{limitText(u.limit)}</span>, resource: copy.resource })}
            </p>
          </div>
        ) : null}
        {showWarn && !look && !done ? (
          <div role="region" aria-labelledby={`${id}-warn`} className="flex flex-col gap-4 border-s-4 border-primary bg-muted/40 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p id={`${id}-warn`} className="text-[1.125rem] leading-[1.4] font-heading">
                {fill(copy.warn.title, { percent: <span data-numeric>{Math.round(ratio * 100)}</span> })}
              </p>
              <p className="text-base leading-[1.6]">{fill(copy.warn.body, { plan: target.name, limit: <span data-numeric>{limitText(target.limits?.[limitKey] ?? 0)}</span>, resource: copy.resource })}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button type="button" variant="outline" size="lg" data-snooze="" onClick={snooze}>
                {fillText(copy.warn.later, { days: snoozeDays })}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setLook(true)}>
                {fillText(copy.warn.look, { plan: target.name })}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
        {level === "blocked" && !done ? (
          <div data-soft-block="" className="flex items-start gap-4 border border-destructive px-5 py-5">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-[1.125rem] leading-[1.4] font-heading">{fillText(copy.blocked.title, { resource: copy.resource })}</p>
              <p className="text-base leading-[1.6]">{copy.blocked.body}</p>
              <a data-free-path="" href={copy.blocked.free.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
                {copy.blocked.free.label}
              </a>
            </div>
          </div>
        ) : null}
        {done ? (
          <p role="status" className="border px-5 py-4 text-base leading-[1.6]">
            {fillText(copy.done, { plan: target?.name ?? "" })}
          </p>
        ) : null}
        {showOffer && target ? (
          <div className="flex max-w-xl flex-col gap-4 border px-5 py-6 md:px-8">
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <PlanOffer
              locale={locale}
              timeZone={timeZone}
              plan={target}
              copy={copy.offer}
              firstChargeAt={target.trialDays ? addDays(today, target.trialDays) : undefined}
              onCheckout={start}
              onDecline={() => {
                setLook(false)
                if (level !== "blocked") snooze()
              }}
              declineHref={level === "blocked" ? copy.blocked.free.href : undefined}
              declineLabel={level === "blocked" ? copy.blocked.free.label : undefined}
              pending={form.pending} holdLabel={form.holdLabel}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
