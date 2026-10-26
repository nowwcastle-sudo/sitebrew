"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { Cta } from "@/components/content/content-core"
import type { SaasContent } from "@/components/content/schemas/saas"
import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

import { BlockHeading } from "../_shared/block-heading"
import { resolvePlanCta, type PlanCtaCopy, type PlanCtaState } from "../_shared/plan-cta"
import { PriceTag, planPrice, planVatText, type PlanPrices, type PlanVatCopy } from "../_shared/price-tag"

// 요금 — 요금제 카드 3개(추천 하나 강조). 요금제 객체는 saas 콘텐츠의 plans 그대로(화면 요금표와 JSON-LD offers 가 같은 값).
// 카드마다 이름 h3 · 월 금액(문의형이면 문의 문구) · 포함 기능 목록 · 행동 버튼. 추천 요금제는 배지 + 테두리 강조 + 채운 버튼, 나머지는 테두리 버튼.
// 행동 버튼은 로그인 상태를 따른다(P3-6 E01 · factory-rules.md §23 U9): 로그아웃 = 가입(planIds 가 있으면 ?plan=<id>), 로그인(signedIn) = 결제 /upgrade?plan=<id>, 지금 쓰는 요금제(currentPlanId)는 표지.
export type PricingThreeTierCardsCopy = PlanCtaCopy & {
  title: string
  lead?: string
  plans: SaasContent["plans"]
  // 추천 요금제 이름(plans 의 name 과 같게).
  recommended?: string
  recommendedLabel: string
  // 금액 뒤 기간(예: 「/월」).
  perMonth: string
  // 월 가격이 null(문의형)일 때 금액 자리 문구.
  contactLabel: string
  // 요금제별 행동(순서대로). 없으면 cta.
  planCtas?: Cta[]
  cta: Cta
  // 표 아래 한 줄(부가세·약정 등).
  footnote?: string
  // 현지 가격(prices)의 세금 표기 문구(대장 A66) — 「부가세 포함」·「부가세 별도」. prices 가 있고 이 칸이 있을 때만 가격 아래에 보인다
  vat?: PlanVatCopy
}
// prices(선택, 대장 A66): 요금제 이름 → 현지 통화·세금 금액. 없으면 콘텐츠 값
export type PricingThreeTierCardsProps = BlockBase<PricingThreeTierCardsCopy> & PlanCtaState & { prices?: PlanPrices }

export function PricingThreeTierCards({ copy, prices, signedIn, currentPlanId, id = "pricing", className }: PricingThreeTierCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  const pid = (i: number) => `${id}-plan-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="pricing-three-tier-cards" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="grid items-stretch gap-6 md:grid-cols-3 md:data-[count=1]:max-w-md md:data-[count=1]:grid-cols-1 md:data-[count=2]:grid-cols-2 lg:data-[count=4]:grid-cols-4" data-count={copy.plans.length}>
        {copy.plans.map((p, i) => {
          const rec = p.name === copy.recommended
          const price = planPrice(p, prices)
          const cta = resolvePlanCta(copy, { signedIn, currentPlanId }, i, copy.planCtas?.[i] ?? copy.cta, price.amount)
          const vat = planVatText(price, copy.vat)
          return (
            <li key={i} data-enter className="flex min-w-0">
              <Card role="group" data-recommended={rec ? "" : undefined} aria-labelledby={pid(i)} className="w-full data-[recommended]:ring-2 data-[recommended]:ring-primary">
                <CardHeader className="gap-3">
                  {rec ? <Badge className="justify-self-start">{copy.recommendedLabel}</Badge> : null}
                  <h3 id={pid(i)} className="text-[1.25rem] leading-[1.35] font-heading">
                    {p.name}
                  </h3>
                  <p className="pt-1">
                    {price.amount === null ? (
                      <span className="text-[1.953rem] leading-[1.1] font-heading">{copy.contactLabel}</span>
                    ) : (
                      <PriceTag amount={price.amount} currency={price.currency} per={copy.perMonth} />
                    )}
                    {vat && price.amount !== null ? <span data-vat="" className="block text-base leading-[1.5] text-muted-foreground">{vat}</span> : null}
                  </p>
                </CardHeader>
                {p.features.length > 0 ? (
                  <CardContent className="flex-1">
                    <ul className="flex flex-col gap-2.5">
                      {p.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-base leading-[1.5]">
                          <Check aria-hidden="true" className="mt-1 size-4 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
                <CardFooter className="pt-2">
                  {cta.current ? (
                    <Button variant="outline" size="lg" disabled focusableWhenDisabled data-current-plan="" aria-current="true" className="w-full">
                      {cta.label}
                      <span className="sr-only"> — {p.name}</span>
                    </Button>
                  ) : (
                    <Button variant={rec ? "default" : "outline"} size="lg" nativeButton={false} render={<a href={cta.href} />} className="w-full">
                      {cta.label}
                      <span className="sr-only"> — {p.name}</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
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
