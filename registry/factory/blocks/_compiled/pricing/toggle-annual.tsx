"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import type { SaasContent } from "@/registry/factory/content/schemas/saas"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/registry/factory/ui/toggle-group"

import { BlockHeading } from "../_shared/block-heading"
import { resolvePlanCta, type PlanCtaCopy, type PlanCtaState } from "../_shared/plan-cta"
import { PriceTag, formatPrice, planPrice, planVatText, type PlanPrices, type PlanVatCopy } from "../_shared/price-tag"

// 요금 — 월·연 전환 + 요금제 줄. 위 전환(월 결제 ↔ 연 결제, 연은 할인율 배지)을 누르면 모든 줄의 금액이 바뀐다.
// 요금제는 가로로 긴 줄 하나씩(이름·포함 기능 요약 | 금액 | 버튼) 쌓는다 — 카드 격자가 아니라 목록이라 요금제가 4~5개여도 한눈에 비교된다.
// 연 결제 금액 = 월 금액 × 12 × (1 − 할인율), 줄에는 한 달 꼴 금액과 「연 ○○원 한 번에」를 함께 보인다.
type Period = "monthly" | "annual"
// 연 결제 줄은 연 총액과 아끼는 금액을 돈으로 보인다(P3-6 E03 · factory-rules.md §22-2 P4·P5). 행동 버튼은 로그인 상태를 따른다(E01 · §23 U9).
export type PricingToggleAnnualCopy = PlanCtaCopy & {
  title: string
  lead?: string
  plans: SaasContent["plans"]
  // 전환 묶음의 이름(aria-label)과 두 칸 이름.
  periodLabel: string
  monthlyLabel: string
  annualLabel: string
  // 연 결제 할인율(0~1, 예: 0.2).
  annualDiscount: number
  // 할인 배지 틀 — {p} 자리에 할인 %(예: 「{p}% 할인」).
  discountTemplate: string
  perMonth: string
  // 연 결제 총액 줄 틀 — {total} 자리에 연 금액(예: 「연 {total} 한 번에 결제」).
  billedAnnuallyTemplate: string
  // 아끼는 금액 줄 틀(선택) — {saving} 자리에 「월 결제로 열두 번 낼 때보다 줄어드는 금액」(예: 「월 결제보다 연 {saving} 아껴요」). 없으면 이 줄을 그리지 않는다
  savingTemplate?: string
  // 연 요금제의 id(BillingPort Plan.id) — plans 와 같은 순서. 연 결제로 보는 동안의 행동 버튼은 이 id 를 싣는다(없으면 planIds 에 interval=year 를 더한다)
  annualPlanIds?: string[]
  contactLabel: string
  planCtas?: Cta[]
  cta: Cta
  recommended?: string
  recommendedLabel: string
  // 표 아래 한 줄(VAT 포함·별도, 약정 — 원화 금액이 있으면 부가세 표기가 화면에 있어야 한다, 마케팅 규칙 L1).
  footnote?: string
  // 현지 가격(prices)의 세금 표기 문구(대장 A66) — 「부가세 포함」·「부가세 별도」. prices 가 있고 이 칸이 있을 때만 가격 아래에 보인다
  vat?: PlanVatCopy
}
// prices(선택, 대장 A66): 요금제 이름 → 현지 통화·세금 월 금액(연 금액은 그 월 금액으로 셈한다). 없으면 콘텐츠 값
// annualPrices(선택, P3-6 E03): 요금제 이름 → 연 요금제의 실제 연 총액(결제창이 받는 값 — 있으면 월 금액 × 12 × (1 − 할인율)로 셈하지 않고 이 값을 보인다)
export type PricingToggleAnnualProps = BlockBase<PricingToggleAnnualCopy> & PlanCtaState & { defaultPeriod?: Period; prices?: PlanPrices; annualPrices?: PlanPrices }

export function PricingToggleAnnual({ copy, prices, annualPrices, signedIn, currentPlanId, id = "pricing", className, defaultPeriod = "monthly" }: PricingToggleAnnualProps) {
  const ref = React.useRef<HTMLElement>(null)
  const [period, setPeriod] = React.useState<Period>(defaultPeriod)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.06 })
  })
  const pct = Math.round(copy.annualDiscount * 100)
  const pid = (i: number) => `${id}-plan-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="pricing-toggle-annual" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        <div data-enter className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            aria-label={copy.periodLabel}
            variant="outline"
            spacing={0}
            value={[period]}
            onValueChange={(v) => {
              const next = v[0] as Period | undefined
              if (next) setPeriod(next)
            }}
          >
            <ToggleGroupItem value="monthly" className="min-h-11 px-4 text-base">
              {copy.monthlyLabel}
            </ToggleGroupItem>
            <ToggleGroupItem value="annual" className="min-h-11 px-4 text-base">
              {copy.annualLabel}
            </ToggleGroupItem>
          </ToggleGroup>
          {pct > 0 ? <Badge variant="secondary">{copy.discountTemplate.replace("{p}", String(pct))}</Badge> : null}
        </div>
      </div>
      <ul className="flex flex-col border-t" data-period={period}>
        {copy.plans.map((p, i) => {
          const rec = p.name === copy.recommended
          const price = planPrice(p, prices)
          const vat = planVatText(price, copy.vat)
          // 연 총액: 연 요금제의 실제 값(annualPrices)이 있으면 그것, 없으면 월 금액 × 12 × (1 − 할인율)
          const own = annualPrices?.[p.name]
          const yearly = price.amount === null ? null : own ? (own.currency === "USD" || own.currency === "EUR" ? own.amount / 100 : own.amount) : Math.round(price.amount * 12 * (1 - copy.annualDiscount))
          const saving = price.amount === null || yearly === null ? 0 : Math.round(price.amount * 12 - yearly)
          const annualId = period === "annual" ? copy.annualPlanIds?.[i] : undefined
          const cta = resolvePlanCta(copy, { signedIn, currentPlanId }, i, copy.planCtas?.[i] ?? copy.cta, price.amount, annualId ?? copy.planIds?.[i], period === "annual" && annualId === undefined ? "year" : undefined)
          const shown = price.amount === null ? null : period === "annual" && yearly !== null ? Math.round(yearly / 12) : price.amount
          return (
            <li key={i} data-enter data-recommended={rec ? "" : undefined} aria-labelledby={pid(i)} className="grid gap-4 border-b py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_minmax(0,12rem)] md:items-center md:gap-8">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 id={pid(i)} className="flex flex-wrap items-center gap-2 text-[1.25rem] leading-[1.35] font-heading">
                  {p.name}
                  {rec ? <Badge className="align-middle">{copy.recommendedLabel}</Badge> : null}
                </h3>
                {p.features.length ? <p className="text-base leading-[1.6]">{p.features.join(" · ")}</p> : null}
              </div>
              <div className="flex flex-col gap-1">
                {shown === null ? (
                  <span className="text-[1.563rem] leading-[1.2] font-heading">{copy.contactLabel}</span>
                ) : (
                  <>
                    <PriceTag amount={shown} currency={price.currency} per={copy.perMonth} />
                    {vat ? <span data-vat="" className="block text-base leading-[1.5] text-muted-foreground">{vat}</span> : null}
                    {period === "annual" && yearly !== null ? (
                      <span className="text-base leading-[1.5]">{copy.billedAnnuallyTemplate.replace("{total}", formatPrice(yearly, price.currency))}</span>
                    ) : null}
                    {period === "annual" && saving > 0 && copy.savingTemplate ? (
                      <span data-saving="" className="text-base leading-[1.5] font-medium">{copy.savingTemplate.replace("{saving}", formatPrice(saving, price.currency))}</span>
                    ) : null}
                  </>
                )}
              </div>
              {cta.current ? (
                <Button variant="outline" size="lg" disabled focusableWhenDisabled data-current-plan="" aria-current="true" className="w-full md:justify-self-end">
                  {cta.label}
                  <span className="sr-only"> — {p.name}</span>
                </Button>
              ) : (
                <Button variant={rec ? "default" : "outline"} size="lg" nativeButton={false} render={<a href={cta.href} />} className="w-full md:justify-self-end">
                  {cta.label}
                  <span className="sr-only"> — {p.name}</span>
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {copy.footnote ? (
        <p data-enter className="text-base leading-[1.7]">
          {copy.footnote}
        </p>
      ) : null}
    </section>
  )
}
