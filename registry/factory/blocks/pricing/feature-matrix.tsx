"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import type { SaasContent } from "@/registry/factory/content/schemas/saas"
import { Check, Minus } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { resolvePlanCta, type PlanCtaCopy, type PlanCtaState } from "../_shared/plan-cta"
import { PriceTag, planPrice, planVatText, type PlanPrices, type PlanVatCopy } from "../_shared/price-tag"
import { ScrollHint } from "../_shared/scroll-hint"

// 요금 — 기능 × 요금제 표. 열 = 요금제(머리에 이름·월 금액), 행 = 기능(행 머리 th). 칸은 그 요금제의 features 에 그 기능이 있는지(아이콘 +
// 읽기 도구용 글자). 맨 아래 줄에 요금제마다 행동 버튼. 추천 요금제 열은 muted 면. 좁은 화면에서는 표 안에서만 가로로 밀리고 기능 열이 붙어 있다.
// 행동 버튼은 로그인 상태를 따른다(P3-6 E01 · factory-rules.md §23 U9) — three-tier-cards 와 같은 약속(planIds·signedInHref·signedIn·currentPlanId).
export type PricingFeatureMatrixCopy = PlanCtaCopy & {
  title: string
  lead?: string
  caption: string
  plans: SaasContent["plans"]
  // 행 순서(모든 기능). 요금제 features 에 같은 글자가 있으면 「있음」.
  features: string[]
  featureLabel: string
  yesLabel: string
  noLabel: string
  perMonth: string
  contactLabel: string
  recommended?: string
  planCtas?: Cta[]
  cta: Cta
  // 표 아래 한 줄(VAT 포함·별도, 약정 — 원화 금액이 있으면 부가세 표기가 화면에 있어야 한다, 마케팅 규칙 L1).
  footnote?: string
  // 표가 칸보다 넓을 때만 보이는 「옆으로 밀어 보세요」 글(선택 — 없으면 부품 문구 표의 locale 값, _shared/scroll-hint)
  scrollHint?: string
  // 현지 가격(prices)의 세금 표기 문구(대장 A66) — 「부가세 포함」·「부가세 별도」. prices 가 있고 이 칸이 있을 때만 가격 아래에 보인다
  vat?: PlanVatCopy
}
// prices(선택, 대장 A66): 요금제 이름 → 현지 통화·세금 금액. 없으면 콘텐츠 값
export type PricingFeatureMatrixProps = BlockBase<PricingFeatureMatrixCopy> & PlanCtaState & { prices?: PlanPrices }

export function PricingFeatureMatrix({ copy, locale, prices, signedIn, currentPlanId, id = "pricing", className }: PricingFeatureMatrixProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const rec = (name: string) => (name === copy.recommended ? "" : undefined)
  return (
    <section ref={ref} id={id} data-block="pricing-feature-matrix" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-matrix">
        <ScrollHint locale={locale} text={copy.scrollHint}>
        <Table>
          <TableCaption className="cn-block-matrix-caption">{copy.caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="cn-block-matrix-corner">
                {copy.featureLabel}
              </TableHead>
              {copy.plans.map((p, i) => {
                const price = planPrice(p, prices)
                const vat = planVatText(price, copy.vat)
                return (
                  <TableHead key={i} scope="col" data-recommended={rec(p.name)} className="cn-block-matrix-plan">
                    <span className="cn-block-matrix-plan-name font-heading">{p.name}</span>
                    {price.amount === null ? (
                      <span className="cn-block-matrix-contact">{copy.contactLabel}</span>
                    ) : (
                      <PriceTag amount={price.amount} currency={price.currency} per={copy.perMonth} className="cn-block-matrix-price" />
                    )}
                    {vat && price.amount !== null ? <span data-vat="" className="cn-block-pricing-vat">{vat}</span> : null}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {copy.features.map((f, i) => (
              <TableRow key={i}>
                <TableHead scope="row" className="cn-block-matrix-feature">
                  {f}
                </TableHead>
                {copy.plans.map((p, j) => {
                  const on = p.features.includes(f)
                  return (
                    <TableCell /* numeric-cell: 글자 열 */ key={j} data-recommended={rec(p.name)} className="cn-block-matrix-cell">
                      <span className="cn-block-matrix-mark" data-on={on ? "" : undefined}>
                        {on ? <Check aria-hidden="true" className="cn-block-matrix-icon" /> : <Minus aria-hidden="true" className="cn-block-matrix-icon" />}
                        <span className="sr-only">{on ? copy.yesLabel : copy.noLabel}</span>
                      </span>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell /* numeric-cell: 글자 열 */ className="cn-block-matrix-feature" />
              {copy.plans.map((p, i) => {
                const cta = resolvePlanCta(copy, { signedIn, currentPlanId }, i, copy.planCtas?.[i] ?? copy.cta, planPrice(p, prices).amount)
                return (
                  <TableCell /* numeric-cell: 글자 열 */ key={i} data-recommended={rec(p.name)} className="cn-block-matrix-cell">
                    {cta.current ? (
                      <Button variant="outline" disabled focusableWhenDisabled data-current-plan="" aria-current="true" className="cn-block-matrix-cta">
                        {cta.label}
                        <span className="sr-only"> — {p.name}</span>
                      </Button>
                    ) : (
                      <Button variant={rec(p.name) === "" ? "default" : "outline"} nativeButton={false} render={<a href={cta.href} />} className="cn-block-matrix-cta">
                        {cta.label}
                        <span className="sr-only"> — {p.name}</span>
                      </Button>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableFooter>
        </Table>
        </ScrollHint>
      </div>
      {copy.footnote ? (
        <p data-enter className="cn-block-pricing-footnote">
          {copy.footnote}
        </p>
      ) : null}
    </section>
  )
}
